"""EPUB extraction utilities."""
from __future__ import annotations

import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup


def extract_chapters(epub_path: str) -> list[dict]:
    """Extract chapters from an EPUB file.

    Returns a list of dicts with keys:
      - title: str (heading text or empty string)
      - content: str (plain text of the chapter)

    Skips chapters with fewer than 200 characters of text.
    """
    book = epub.read_epub(epub_path)
    chapters = []

    for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
        html_content = item.get_content().decode("utf-8", errors="replace")
        soup = BeautifulSoup(html_content, "html.parser")
        text = soup.get_text(separator=" ", strip=True)

        if len(text) < 200:
            continue

        # Try to find a heading for the title
        title = ""
        for heading_tag in ["h1", "h2", "h3", "h4"]:
            heading = soup.find(heading_tag)
            if heading:
                title = heading.get_text(strip=True)
                break

        chapters.append({"title": title, "content": text})

    return chapters


def extract_full_text(epub_path: str) -> str:
    """Extract all chapter text from an EPUB, joined with newlines."""
    chapters = extract_chapters(epub_path)
    return "\n\n".join(ch["content"] for ch in chapters)
