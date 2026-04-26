"""HTML extraction utilities."""
from __future__ import annotations

import json
from typing import Optional

import requests
import trafilatura
from bs4 import BeautifulSoup


def extract_article(html: str) -> Optional[str]:
    """Extract main article text from an HTML string.

    Tries trafilatura first; falls back to BeautifulSoup stripping
    nav/footer/header/script/style/aside and preferring <article> tags.
    """
    # Try trafilatura first
    result = trafilatura.extract(html)
    if result and len(result.strip()) > 0:
        return result

    # Fallback: BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")

    # Remove unwanted elements
    for tag in soup.find_all(["nav", "footer", "header", "script", "style", "aside"]):
        tag.decompose()

    # Prefer <article> tag
    article = soup.find("article")
    if article:
        text = article.get_text(separator=" ", strip=True)
        if text:
            return text

    # Fall back to <body>
    body = soup.find("body")
    if body:
        text = body.get_text(separator=" ", strip=True)
        if text:
            return text

    return None


def extract_from_url(url: str) -> Optional[str]:
    """Fetch a URL and extract its main article text.

    Uses trafilatura.fetch_url first; falls back to requests + extract_article.
    """
    # Try trafilatura fetch + extract
    downloaded = trafilatura.fetch_url(url)
    if downloaded:
        result = trafilatura.extract(downloaded)
        if result and len(result.strip()) > 0:
            return result

    # Fallback: requests + extract_article
    try:
        response = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
        response.raise_for_status()
        return extract_article(response.text)
    except Exception:
        return None


def extract_metadata_from_url(url: str) -> dict:
    """Extract metadata from a URL using trafilatura.

    Returns a dict with keys like title, author, date, description, url, etc.
    Falls back to an empty dict on failure.
    """
    downloaded = trafilatura.fetch_url(url)
    if not downloaded:
        return {}

    result = trafilatura.extract(
        downloaded,
        with_metadata=True,
        output_format="json",
    )
    if not result:
        return {}

    try:
        return json.loads(result)
    except (json.JSONDecodeError, TypeError):
        return {}
