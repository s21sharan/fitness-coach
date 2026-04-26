"""
Fine-tuning export pipeline (DORMANT).

This module synthesizes coaching-tone Q&A pairs from raw content using Claude.
It is not active — run it manually when ready to fine-tune.

Usage:
    python -m scraper.exports.finetune_export --output exports/finetune.jsonl
"""

from scraper.db import Database


def export_finetune_jsonl(db: Database, output_path: str) -> int:
    """
    Export fine-tuning data. Requires Claude API key.

    This is a placeholder — the actual implementation will:
    1. Read content from SQLite by category
    2. Send batches to Claude API to generate coaching Q&A pairs
    3. Write the synthesized pairs to JSONL

    Not implemented until fine-tuning phase.
    """
    raise NotImplementedError(
        "Fine-tuning export is not yet implemented. "
        "Use RAG export (rag_export.py) for now."
    )
