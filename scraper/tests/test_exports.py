import json
import os
import pytest
from scraper.db import Database


@pytest.fixture
def db_with_content(tmp_path):
    db = Database(str(tmp_path / "test.db"))
    db.initialize()

    db.insert_content(
        content_hash="test1",
        title="Test Paper About Creatine",
        authors='["Author One"]',
        source_type="paper",
        source_platform="pmc",
        source_url="https://example.com",
        source_id="PMC12345",
        abstract="Test abstract",
        full_text=("This is a long paper about creatine supplementation. " * 100).encode("utf-8"),
        category="supplements",
        subcategories='["creatine"]',
        content_format="research_paper",
        year=2024,
        date_published="2024-01-15",
        journal="JISSN",
        channel_name=None,
        duration_sec=None,
        word_count=800,
        quality_score=8.5,
    )

    yield db


class TestChunkText:
    def test_short_text_single_chunk(self):
        from scraper.exports.rag_export import chunk_text
        chunks = chunk_text("Short text here")
        assert len(chunks) == 1

    def test_long_text_multiple_chunks(self):
        from scraper.exports.rag_export import chunk_text
        text = "Word " * 2000
        chunks = chunk_text(text, max_tokens=1000, overlap_tokens=100)
        assert len(chunks) >= 2

    def test_chunks_within_bounds(self):
        from scraper.exports.rag_export import chunk_text
        text = "Word " * 2000
        chunks = chunk_text(text, max_tokens=1000, overlap_tokens=100)
        for chunk in chunks:
            assert len(chunk.split()) <= 1100


class TestRAGExport:
    def test_export_creates_file(self, db_with_content, tmp_path):
        from scraper.exports.rag_export import export_rag_jsonl
        output_path = str(tmp_path / "rag.jsonl")
        count = export_rag_jsonl(db_with_content, output_path)
        assert count > 0
        assert os.path.exists(output_path)

    def test_export_jsonl_format(self, db_with_content, tmp_path):
        from scraper.exports.rag_export import export_rag_jsonl
        output_path = str(tmp_path / "rag.jsonl")
        export_rag_jsonl(db_with_content, output_path)

        with open(output_path) as f:
            lines = f.readlines()
        assert len(lines) > 0

        first = json.loads(lines[0])
        assert "id" in first
        assert "title" in first
        assert "content" in first
        assert "category" in first
        assert "chunk_index" in first
        assert "chunk_total" in first

    def test_chunks_have_metadata(self, db_with_content, tmp_path):
        from scraper.exports.rag_export import export_rag_jsonl
        output_path = str(tmp_path / "rag.jsonl")
        export_rag_jsonl(db_with_content, output_path)

        with open(output_path) as f:
            first = json.loads(f.readline())

        assert first["category"] == "supplements"
        assert "metadata" in first
        assert first["metadata"]["source_type"] == "paper"
        assert first["metadata"]["journal"] == "JISSN"


class TestOrchestratorSearchTasks:
    def test_generate_search_tasks_papers_only(self):
        from scraper.tasks.orchestrator import generate_search_tasks
        from scraper.config import ScraperConfig

        tasks = generate_search_tasks(ScraperConfig(sources_enabled=["papers"]))
        assert len(tasks) > 0
        assert all(t["source_type"] == "papers" for t in tasks)

    def test_generate_search_tasks_respects_enabled(self):
        from scraper.tasks.orchestrator import generate_search_tasks
        from scraper.config import ScraperConfig

        config = ScraperConfig(sources_enabled=["papers", "youtube"])
        tasks = generate_search_tasks(config)
        source_types = {t["source_type"] for t in tasks}
        assert "papers" in source_types
        assert "youtube" in source_types
        assert "reddit" not in source_types

    def test_youtube_tasks_are_channel_urls(self):
        from scraper.tasks.orchestrator import generate_search_tasks
        from scraper.config import ScraperConfig

        tasks = generate_search_tasks(ScraperConfig(sources_enabled=["youtube"]))
        assert all(t["source_type"] == "youtube" for t in tasks)
        assert all("youtube.com" in t["search_term"] for t in tasks)

    def test_books_tasks_are_titles(self):
        from scraper.tasks.orchestrator import generate_search_tasks
        from scraper.config import ScraperConfig

        tasks = generate_search_tasks(ScraperConfig(sources_enabled=["books"]))
        assert all(t["source_type"] == "books" for t in tasks)
        assert len(tasks) == 20
