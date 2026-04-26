"""Deduplication utilities using SHA-256 hashing."""

from __future__ import annotations

import hashlib


def content_hash(text: str) -> str:
    """Return the SHA-256 hex digest of the given text."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def doi_hash(doi: str) -> str:
    """Return a canonical dedup key for a DOI."""
    return f"doi:{doi.lower().strip()}"


def url_hash(url: str) -> str:
    """Return a canonical dedup key for a URL."""
    return f"url:{content_hash(url)}"


def title_author_hash(title: str, authors: str) -> str:
    """Return a canonical dedup key based on title and authors."""
    combined = f"{title.lower()}|{authors.lower()}"
    return f"ta:{content_hash(combined)}"
