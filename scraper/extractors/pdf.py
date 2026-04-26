"""PDF extraction utilities."""
from __future__ import annotations

import re
from typing import BinaryIO

import fitz  # PyMuPDF


def extract_text_from_bytes(pdf_bytes: bytes) -> str:
    """Extract text from a PDF given its raw bytes."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages_text = []
    for page in doc:
        text = page.get_text()
        if text.strip():
            pages_text.append(text)
    doc.close()
    raw = "\n".join(pages_text)
    return clean_paper_text(raw)


def extract_text_from_stream(stream: BinaryIO) -> str:
    """Extract text from a PDF file-like stream object."""
    pdf_bytes = stream.read()
    return extract_text_from_bytes(pdf_bytes)


def clean_paper_text(text: str) -> str:
    """Clean extracted PDF text.

    - Strips References/Bibliography section.
    - Removes standalone page numbers.
    - Collapses excessive newlines (more than 2 consecutive).
    """
    # Strip References or Bibliography section (everything from header to end)
    text = re.sub(
        r'\n\s*(?:References|Bibliography)\s*\n.*',
        '',
        text,
        flags=re.DOTALL | re.IGNORECASE,
    )

    # Remove standalone page numbers (a line that contains only digits)
    text = re.sub(r'^\s*\d+\s*$', '', text, flags=re.MULTILINE)

    # Collapse more than 2 consecutive newlines to exactly 2
    text = re.sub(r'\n{3,}', '\n\n', text)

    return text.strip()


def detect_paper_type(text: str) -> str:
    """Detect the type of academic paper from its text.

    Checks the first 3000 characters for keywords.
    Returns one of: meta_analysis, systematic_review, position_stand,
    randomized_controlled_trial, case_study, review, research_paper.
    """
    sample = text[:3000].lower()

    if "meta-analysis" in sample or "meta analysis" in sample:
        return "meta_analysis"
    if "systematic review" in sample:
        return "systematic_review"
    if "position stand" in sample:
        return "position_stand"
    if "randomized controlled trial" in sample or "rct" in sample:
        return "randomized_controlled_trial"
    if "case study" in sample or "case report" in sample:
        return "case_study"
    if "review" in sample:
        return "review"

    return "research_paper"
