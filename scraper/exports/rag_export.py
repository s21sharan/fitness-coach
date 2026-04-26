import json
from scraper.db import Database


def chunk_text(text: str, max_tokens: int = 1000, overlap_tokens: int = 100) -> list[str]:
    """Split text into chunks at word boundaries with overlap."""
    words = text.split()
    if len(words) <= max_tokens:
        return [text]

    chunks = []
    start = 0
    while start < len(words):
        end = min(start + max_tokens, len(words))
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        start = end - overlap_tokens
        if start >= len(words) - overlap_tokens:
            break

    return chunks


def export_rag_jsonl(db: Database, output_path: str, batch_size: int = 100) -> int:
    """Export all content from SQLite to chunked JSONL for RAG."""
    total_chunks = 0
    offset = 0

    with open(output_path, "w") as f:
        while True:
            rows = db.get_all_content(limit=batch_size, offset=offset)
            if not rows:
                break

            for row in rows:
                full_text = db.decompress_text(row["full_text"])
                chunks = chunk_text(full_text)

                for i, chunk in enumerate(chunks):
                    record = {
                        "id": f"{row['source_id']}:chunk:{i}",
                        "title": row["title"],
                        "category": row["category"],
                        "subcategories": json.loads(row["subcategories"]) if row["subcategories"] else [],
                        "source_type": row["source_type"],
                        "content_format": row["content_format"],
                        "chunk_index": i,
                        "chunk_total": len(chunks),
                        "content": chunk,
                        "metadata": {
                            "authors": json.loads(row["authors"]) if row["authors"] else [],
                            "source_type": row["source_type"],
                            "source_platform": row["source_platform"],
                            "journal": row["journal"],
                            "year": row["year"],
                            "word_count": len(chunk.split()),
                            "quality_score": row["quality_score"],
                        },
                    }
                    f.write(json.dumps(record) + "\n")
                    total_chunks += 1

            offset += batch_size

    return total_chunks
