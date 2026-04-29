"""Celery tasks and helper functions for fetching research papers from PMC,
Sci-Hub, and bioRxiv."""

from __future__ import annotations

import logging
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Optional

import requests
from bs4 import BeautifulSoup

from scraper.celery_app import app
from scraper.config import BIORXIV_API, DB_PATH, NCBI_BASE, SCIHUB_MIRRORS
from scraper.db import Database
from scraper.extractors.pdf import detect_paper_type, extract_text_from_bytes
from scraper.utils.classifier import classify, get_subcategories
from scraper.utils.dedup import doi_hash, title_author_hash
from scraper.utils.quality import score_paper
from scraper.utils.rate_limiter import get_limiter

logger = logging.getLogger(__name__)

HEADERS = {"User-Agent": "FitnessScraper/1.0 (research data collection)"}

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


def search_pmc(
    query: str,
    max_results: int = 100,
    api_key: str = "",
    email: str = "",
) -> list[str]:
    """Search PMC via NCBI E-utilities esearch and return a list of PMC IDs.

    Args:
        query: Search term string.
        max_results: Maximum number of IDs to return.
        api_key: Optional NCBI API key for higher rate limits.
        email: Email address for NCBI usage policy compliance.

    Returns:
        List of PMC ID strings.
    """
    get_limiter("pmc").wait()

    params: dict = {
        "db": "pmc",
        "term": query,
        "retmax": max_results,
        "retmode": "json",
        "tool": "fitness_scraper",
        "email": email,
    }
    if api_key:
        params["api_key"] = api_key

    url = f"{NCBI_BASE}esearch.fcgi"
    resp = requests.get(url, params=params, headers=HEADERS)
    resp.raise_for_status()
    return resp.json()["esearchresult"]["idlist"]


def fetch_pmc_fulltext(
    pmcid: str,
    api_key: str = "",
    email: str = "",
) -> Optional[str]:
    """Fetch full text of a PMC article and return the body text.

    Args:
        pmcid: PMC ID, with or without the "PMC" prefix.
        api_key: Optional NCBI API key.
        email: Email for NCBI usage policy.

    Returns:
        Body text as a string, or None if the body element is not found.
    """
    get_limiter("pmc").wait()

    # Strip the "PMC" prefix if present
    numeric_id = pmcid.upper().lstrip("PMC") if pmcid.upper().startswith("PMC") else pmcid

    params: dict = {
        "db": "pmc",
        "id": numeric_id,
        "rettype": "full",
        "retmode": "xml",
        "tool": "fitness_scraper",
        "email": email,
    }
    if api_key:
        params["api_key"] = api_key

    url = f"{NCBI_BASE}efetch.fcgi"
    resp = requests.get(url, params=params, headers=HEADERS)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.content, "xml")
    body = soup.find("body")
    if body is None:
        return None
    return body.get_text(separator=" ", strip=True)


def fetch_pmc_metadata(
    pmcid: str,
    api_key: str = "",
    email: str = "",
) -> dict:
    """Fetch metadata for a PMC article via esummary.

    Args:
        pmcid: PMC ID, with or without the "PMC" prefix.
        api_key: Optional NCBI API key.
        email: Email for NCBI usage policy.

    Returns:
        Dict with keys: Title, AuthorList, Source, PubDate, DOI.
        Values default to empty strings when not found.
    """
    get_limiter("pmc").wait()

    numeric_id = pmcid.upper().lstrip("PMC") if pmcid.upper().startswith("PMC") else pmcid

    params: dict = {
        "db": "pmc",
        "id": numeric_id,
        "retmode": "xml",
        "tool": "fitness_scraper",
        "email": email,
    }
    if api_key:
        params["api_key"] = api_key

    url = f"{NCBI_BASE}esummary.fcgi"
    resp = requests.get(url, params=params, headers=HEADERS)
    resp.raise_for_status()

    root = ET.fromstring(resp.content)

    def _item_text(name: str) -> str:
        elem = root.find(f".//Item[@Name='{name}']")
        return elem.text.strip() if elem is not None and elem.text else ""

    # AuthorList: join all Author sub-items
    author_elems = root.findall(".//Item[@Name='AuthorList']/Item[@Name='Author']")
    authors = ", ".join(
        a.text.strip() for a in author_elems if a.text
    )

    return {
        "Title": _item_text("Title"),
        "AuthorList": authors,
        "Source": _item_text("Source"),
        "PubDate": _item_text("PubDate"),
        "DOI": _item_text("DOI"),
    }


def fetch_scihub_pdf(doi: str) -> Optional[bytes]:
    """Attempt to download a PDF from Sci-Hub mirrors.

    Tries each mirror in SCIHUB_MIRRORS in order. Parses the HTML response
    to find the PDF URL embedded in ``#viewer iframe``, ``#viewer embed``,
    ``iframe[src]``, or ``embed[src]`` elements.

    Args:
        doi: DOI string, e.g. "10.1000/xyz123".

    Returns:
        Raw PDF bytes, or None if no PDF could be retrieved.
    """
    for mirror in SCIHUB_MIRRORS:
        try:
            get_limiter("scihub").wait()
            page_url = f"{mirror}/{doi}"
            resp = requests.get(page_url, headers=HEADERS, timeout=15)
            resp.raise_for_status()

            soup = BeautifulSoup(resp.content, "html.parser")

            # Try selectors in priority order
            pdf_url: Optional[str] = None
            for selector in [
                "#viewer iframe",
                "#viewer embed",
                "iframe[src]",
                "embed[src]",
            ]:
                tag = soup.select_one(selector)
                if tag:
                    src = tag.get("src")
                    if src:
                        pdf_url = src
                        break

            if pdf_url is None:
                continue

            # Handle protocol-relative URLs
            if pdf_url.startswith("//"):
                pdf_url = "https:" + pdf_url
            elif pdf_url.startswith("/"):
                # Relative URL — prepend mirror base
                pdf_url = mirror + pdf_url

            # Download the PDF
            pdf_resp = requests.get(pdf_url, headers=HEADERS, timeout=30)
            pdf_resp.raise_for_status()
            return pdf_resp.content

        except Exception as exc:  # noqa: BLE001
            logger.debug("Sci-Hub mirror %s failed for DOI %s: %s", mirror, doi, exc)
            continue

    return None


def search_biorxiv(
    query: str,
    start_date: str,
    end_date: str,
    server: str = "biorxiv",
) -> list[dict]:
    """Search bioRxiv (or medRxiv) for preprints in a date range.

    Args:
        query: Unused by the date-range API; kept for interface consistency.
        start_date: Start date in "YYYY-MM-DD" format.
        end_date: End date in "YYYY-MM-DD" format.
        server: Either "biorxiv" or "medrxiv".

    Returns:
        List of paper dicts from the ``collection`` key of the API response.
    """
    url = f"{BIORXIV_API}/details/{server}/{start_date}/{end_date}/0/json"
    resp = requests.get(url, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    return data.get("collection", [])


# ---------------------------------------------------------------------------
# Celery tasks
# ---------------------------------------------------------------------------


@app.task(name="scraper.tasks.papers.fetch_paper", bind=True, max_retries=2)
def fetch_paper(
    self,
    doi: Optional[str],
    pmcid: Optional[str],
    title: str,
    authors: str,
    source_platform: str,
    session_id: int,
    api_key: str = "",
    email: str = "",
) -> dict:
    """Fetch, classify and store a single research paper.

    Deduplicates by DOI hash (if available) or title+author hash.
    Attempts PMC full text first, then Sci-Hub as a fallback.

    Args:
        doi: DOI string, or None.
        pmcid: PMC ID string, or None.
        title: Paper title.
        authors: Author string.
        source_platform: Platform label, e.g. "pmc" or "biorxiv".
        session_id: Scrape session ID for logging.
        api_key: NCBI API key.
        email: Email for NCBI usage policy.

    Returns:
        Dict with keys ``status`` ("saved", "duplicate", or "failed") and
        optional ``content_id``.
    """
    db = Database(DB_PATH)
    db.initialize()

    # --- Dedup check ---
    content_key = doi_hash(doi) if doi else title_author_hash(title, authors)
    if db.hash_exists(content_key):
        return {"status": "duplicate", "hash": content_key}

    full_text: Optional[str] = None

    # --- 1. Try PMC full text ---
    if pmcid:
        try:
            full_text = fetch_pmc_fulltext(pmcid, api_key=api_key, email=email)
        except Exception as exc:
            logger.warning("PMC fulltext fetch failed for %s: %s", pmcid, exc)

    # --- 2. Fallback to Sci-Hub ---
    if full_text is None and doi:
        try:
            pdf_bytes = fetch_scihub_pdf(doi)
            if pdf_bytes:
                full_text = extract_text_from_bytes(pdf_bytes)
        except Exception as exc:
            logger.warning("Sci-Hub PDF fetch failed for DOI %s: %s", doi, exc)

    if full_text is None:
        db.log_failed_fetch(
            session_id=session_id,
            url=doi or pmcid or title,
            error_message="No full text found via PMC or Sci-Hub",
            source_type="papers",
        )
        return {"status": "failed", "hash": content_key}

    # --- Classify & score ---
    category = classify(full_text)
    subcategories = get_subcategories(full_text, category)
    paper_type = detect_paper_type(full_text)
    quality = score_paper(citations=0, year=datetime.now(timezone.utc).year, paper_type=paper_type)
    word_count = len(full_text.split())

    # --- Persist ---
    content_id = db.insert_content(
        content_hash=content_key,
        title=title,
        authors=authors,
        source_type="papers",
        source_platform=source_platform,
        source_id=pmcid or doi,
        full_text=full_text,
        category=category,
        subcategories=",".join(subcategories),
        content_format="paper",
        word_count=word_count,
        quality_score=quality,
    )

    return {"status": "saved", "content_id": content_id, "hash": content_key}


@app.task(name="scraper.tasks.papers.search_and_fetch_papers", bind=True)
def search_and_fetch_papers(
    self,
    search_term: str,
    session_id: int,
    task_id: int,
    source_platform: str,
    max_results: int = 100,
    api_key: str = "",
    email: str = "",
) -> dict:
    """Search PMC or bioRxiv and enqueue fetch_paper tasks for each result.

    Args:
        search_term: Query string.
        session_id: Scrape session ID.
        task_id: Search task ID for progress tracking.
        source_platform: "pmc" or "biorxiv".
        max_results: Maximum number of results to retrieve.
        api_key: NCBI API key.
        email: Email for NCBI usage policy.

    Returns:
        Dict with ``status`` and ``enqueued`` count.
    """
    db = Database(DB_PATH)
    db.initialize()

    # Respect session pause
    status = db.get_session_status(session_id)
    if status == "paused":
        return {"status": "paused", "enqueued": 0}

    enqueued = 0

    if source_platform == "biorxiv":
        # bioRxiv: use a rolling 90-day window ending today
        today = datetime.now(timezone.utc)
        end_date = today.strftime("%Y-%m-%d")
        from datetime import timedelta
        start_date = (today - timedelta(days=90)).strftime("%Y-%m-%d")

        try:
            results = search_biorxiv(search_term, start_date, end_date, server="biorxiv")
        except Exception as exc:
            logger.error("bioRxiv search failed: %s", exc)
            db.update_search_task(task_id, "failed", 0, 0, str(exc))
            return {"status": "error", "enqueued": 0}

        for paper in results[:max_results]:
            doi = paper.get("doi")
            authors_list = paper.get("authors", [])
            if isinstance(authors_list, list):
                authors_str = ", ".join(
                    a.get("name", "") for a in authors_list if isinstance(a, dict)
                )
            else:
                authors_str = str(authors_list)

            fetch_paper.delay(
                doi=doi,
                pmcid=None,
                title=paper.get("title", ""),
                authors=authors_str,
                source_platform="biorxiv",
                session_id=session_id,
                api_key=api_key,
                email=email,
            )
            enqueued += 1

    else:
        # Default: PMC
        try:
            pmc_ids = search_pmc(search_term, max_results=max_results, api_key=api_key, email=email)
        except Exception as exc:
            logger.error("PMC search failed: %s", exc)
            db.update_search_task(task_id, "failed", 0, 0, str(exc))
            return {"status": "error", "enqueued": 0}

        for pmcid in pmc_ids:
            try:
                meta = fetch_pmc_metadata(pmcid, api_key=api_key, email=email)
            except Exception as exc:
                logger.warning("Metadata fetch failed for %s: %s", pmcid, exc)
                meta = {"Title": "", "AuthorList": "", "Source": "", "PubDate": "", "DOI": ""}

            fetch_paper.delay(
                doi=meta.get("DOI") or None,
                pmcid=pmcid,
                title=meta.get("Title", ""),
                authors=meta.get("AuthorList", ""),
                source_platform="pmc",
                session_id=session_id,
                api_key=api_key,
                email=email,
            )
            enqueued += 1

    db.update_search_task(task_id, "completed", enqueued, 0, None)
    return {"status": "ok", "enqueued": enqueued}
