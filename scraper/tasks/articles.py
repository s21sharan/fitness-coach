"""Celery tasks for article / blog post scraping."""

from __future__ import annotations

import json
import logging
from typing import Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from scraper.celery_app import app
from scraper.config import DB_PATH
from scraper.db import Database
from scraper.extractors.html import extract_from_url, extract_metadata_from_url
from scraper.utils.classifier import classify, get_subcategories
from scraper.utils.dedup import url_hash
from scraper.utils.quality import score_article
from scraper.utils.rate_limiter import get_limiter

logger = logging.getLogger(__name__)


_ARTICLE_PATH_KEYWORDS = ("/article", "/blog", "/post", "/research", "/supplement")


def _get_db() -> Database:
    db = Database(DB_PATH)
    db.initialize()
    return db


@app.task(name="scraper.tasks.articles.fetch_article")
def fetch_article(
    url: str,
    site_name: str = "",
    session_id: int = 0,
) -> Optional[int]:
    """Fetch, extract, classify, and store a single article.

    Args:
        url: Article URL.
        site_name: Human-readable site name for metadata.
        session_id: Scrape session ID for error logging.

    Returns:
        DB row ID on success, None if skipped or failed.
    """
    db = _get_db()

    content_hash = url_hash(url)
    if db.hash_exists(content_hash):
        logger.debug("Skipping duplicate article: %s", url)
        return None

    get_limiter("articles").wait()

    try:
        metadata = extract_metadata_from_url(url)
        text: Optional[str] = metadata.get("text") if metadata else None

        if not text:
            text = extract_from_url(url)
    except Exception as exc:
        logger.warning("Failed to fetch article %s: %s", url, exc)
        db.log_failed_fetch(session_id, url, str(exc), "article")
        return None

    if not text or len(text) < 200:
        logger.debug("Article text too short for %s, skipping", url)
        return None

    category = classify(text)
    subcats = get_subcategories(text, category)

    word_count = len(text.split())
    quality = score_article(word_count)

    title = metadata.get("title") if metadata else None
    author = metadata.get("author") if metadata else None
    date_published = metadata.get("date") if metadata else None
    abstract = metadata.get("description") if metadata else None

    row_id = db.insert_content(
        content_hash=content_hash,
        title=title,
        authors=author,
        source_type="article",
        source_platform=site_name,
        source_url=url,
        abstract=abstract[:1000] if abstract else None,
        full_text=text,
        category=category,
        subcategories=json.dumps(subcats),
        content_format="blog_post",
        date_published=date_published,
        word_count=word_count,
        quality_score=quality,
    )
    return row_id


@app.task(name="scraper.tasks.articles.scrape_site")
def scrape_site(
    base_url: str,
    site_name: str,
    session_id: int,
    task_id: int,
) -> int:
    """Discover article URLs from a site and enqueue fetch_article tasks.

    Tries the sitemap at {base_url}/sitemap.xml first, filtering for URLs
    containing article-related path keywords. Falls back to scraping the main
    page for internal links. Caps at 200 URLs per site.

    Args:
        base_url: Base URL of the site (no trailing slash).
        site_name: Human-readable site name.
        session_id: Scrape session ID.
        task_id: Search task ID for status tracking.

    Returns:
        Number of article URLs enqueued.
    """
    db = _get_db()
    urls: list[str] = []

    # --- Try sitemap ---
    sitemap_url = base_url.rstrip("/") + "/sitemap.xml"
    try:
        resp = requests.get(sitemap_url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, "xml")
            for loc in soup.find_all("loc"):
                href = loc.get_text(strip=True)
                lower = href.lower()
                if any(kw in lower for kw in _ARTICLE_PATH_KEYWORDS):
                    urls.append(href)
    except Exception as exc:
        logger.debug("Sitemap fetch failed for %s: %s", base_url, exc)

    # --- Fallback: scrape main page for internal links ---
    if not urls:
        try:
            resp = requests.get(base_url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")
            base_parsed = urlparse(base_url)
            for a_tag in soup.find_all("a", href=True):
                href = a_tag["href"]
                full_url = urljoin(base_url, href)
                parsed = urlparse(full_url)
                # Only internal links
                if parsed.netloc == base_parsed.netloc:
                    lower = full_url.lower()
                    if any(kw in lower for kw in _ARTICLE_PATH_KEYWORDS):
                        urls.append(full_url)
        except Exception as exc:
            logger.warning("Main page fallback failed for %s: %s", base_url, exc)

    # Deduplicate and cap
    urls = list(dict.fromkeys(urls))[:200]

    enqueued = 0
    for article_url in urls:
        fetch_article.delay(
            url=article_url,
            site_name=site_name,
            session_id=session_id,
        )
        enqueued += 1

    logger.info("Enqueued %d articles from site: %s", enqueued, base_url)
    return enqueued
