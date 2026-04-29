"""Celery tasks for book fetching via LibGen."""

from __future__ import annotations

import json
import logging
import os
import tempfile
from typing import Optional

from scraper.celery_app import app
from scraper.config import DB_PATH
from scraper.db import Database
from scraper.extractors.epub import extract_chapters
from scraper.extractors.pdf import extract_text_from_bytes
from scraper.utils.classifier import classify, get_subcategories
from scraper.utils.dedup import title_author_hash
from scraper.utils.rate_limiter import get_limiter

logger = logging.getLogger(__name__)



def _get_db() -> Database:
    db = Database(DB_PATH)
    db.initialize()
    return db


def search_libgen(title: str, author: str = "") -> list[dict]:
    """Search LibGen for a book by title and optional author.

    Args:
        title: Book title.
        author: Book author (optional).

    Returns:
        List of result dicts from LibGen, or empty list on failure.
    """
    try:
        from libgen_api import LibgenSearch  # type: ignore

        searcher = LibgenSearch()
        query = f"{title} {author}".strip()
        results = searcher.search_title(query)
        return results or []
    except Exception as exc:
        logger.warning("LibGen search failed for '%s': %s", title, exc)
        return []


def download_libgen_book(item: dict) -> Optional[bytes]:
    """Download a book from LibGen using the resolved download links.

    Tries GET, Cloudflare, and IPFS mirrors in order.

    Args:
        item: A LibGen result dict (from search_libgen).

    Returns:
        Raw bytes of the book file, or None if all attempts fail.
    """
    import requests

    try:
        from libgen_api import LibgenSearch  # type: ignore

        searcher = LibgenSearch()
        links = searcher.resolve_download_links(item)
    except Exception as exc:
        logger.warning("Failed to resolve download links: %s", exc)
        return None

    get_limiter("libgen").wait()

    for source_name in ("GET", "Cloudflare", "IPFS"):
        url = links.get(source_name)
        if not url:
            continue
        try:
            resp = requests.get(url, timeout=60, headers={"User-Agent": "Mozilla/5.0"})
            resp.raise_for_status()
            if resp.content:
                return resp.content
        except Exception as exc:
            logger.debug("Download from %s failed: %s", source_name, exc)

    return None


@app.task(name="scraper.tasks.books.fetch_book")
def fetch_book(
    title: str,
    author: str,
    isbn: str = "",
    session_id: int = 0,
) -> int:
    """Search LibGen for a book, download it, extract text, and store in DB.

    EPUBs are stored chapter-by-chapter; PDFs are stored as a single entry.

    Args:
        title: Book title.
        author: Book author.
        isbn: ISBN (optional, for metadata only).
        session_id: Scrape session ID for error logging.

    Returns:
        Number of DB rows inserted (chapters or 1 for PDF).
    """
    db = _get_db()

    # Dedup check at book level
    content_hash = title_author_hash(title, author)
    if db.hash_exists(content_hash):
        logger.debug("Skipping duplicate book: %s by %s", title, author)
        return 0

    results = search_libgen(title, author)
    if not results:
        logger.info("No LibGen results for '%s' by '%s'", title, author)
        return 0

    # Prefer PDF or EPUB
    item: Optional[dict] = None
    extension: str = ""
    for preferred_ext in ("pdf", "epub"):
        for result in results:
            ext = result.get("Extension", "").lower()
            if ext == preferred_ext:
                item = result
                extension = ext
                break
        if item:
            break

    # Fall back to first result if no preferred format found
    if item is None and results:
        item = results[0]
        extension = item.get("Extension", "").lower()

    if item is None:
        return 0

    book_bytes = download_libgen_book(item)
    if not book_bytes:
        logger.warning("Failed to download book: %s by %s", title, author)
        db.log_failed_fetch(session_id, f"libgen:{title}", "Download failed", "book")
        return 0

    inserted = 0

    if extension == "epub":
        # Write to temp file, extract chapters
        tmp_path: Optional[str] = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".epub", delete=False) as tmp:
                tmp.write(book_bytes)
                tmp_path = tmp.name

            chapters = extract_chapters(tmp_path)
            for i, chapter in enumerate(chapters):
                chapter_text = chapter.get("content", "")
                chapter_title = chapter.get("title", "") or f"{title} — Chapter {i + 1}"

                if not chapter_text or len(chapter_text) < 200:
                    continue

                chapter_hash = title_author_hash(f"{title} ch{i}", author)
                category = classify(chapter_text)
                subcats = get_subcategories(chapter_text, category)
                word_count = len(chapter_text.split())

                row_id = db.insert_content(
                    content_hash=chapter_hash,
                    title=chapter_title,
                    authors=author,
                    source_type="book",
                    source_platform="libgen",
                    source_id=isbn or None,
                    full_text=chapter_text,
                    category=category,
                    subcategories=json.dumps(subcats),
                    content_format="book_chapter",
                    word_count=word_count,
                    quality_score=7.0,
                )
                if row_id is not None:
                    inserted += 1

            # Store a sentinel hash for the whole book to prevent re-fetching
            db.insert_content(
                content_hash=content_hash,
                title=title,
                authors=author,
                source_type="book",
                source_platform="libgen",
                source_id=isbn or None,
                full_text=f"[EPUB processed: {len(chapters)} chapters]",
                content_format="book_chapter",
                quality_score=7.0,
            )

        except Exception as exc:
            logger.warning("EPUB extraction failed for '%s': %s", title, exc)
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)

    else:
        # PDF or other — extract as single content row
        try:
            if extension == "pdf":
                text = extract_text_from_bytes(book_bytes)
            else:
                text = book_bytes.decode("utf-8", errors="replace")

            if text and len(text) >= 200:
                category = classify(text)
                subcats = get_subcategories(text, category)
                word_count = len(text.split())

                row_id = db.insert_content(
                    content_hash=content_hash,
                    title=title,
                    authors=author,
                    source_type="book",
                    source_platform="libgen",
                    source_id=isbn or None,
                    full_text=text,
                    category=category,
                    subcategories=json.dumps(subcats),
                    content_format="book_chapter",
                    word_count=word_count,
                    quality_score=7.0,
                )
                if row_id is not None:
                    inserted = 1
        except Exception as exc:
            logger.warning("PDF extraction failed for '%s': %s", title, exc)

    return inserted
