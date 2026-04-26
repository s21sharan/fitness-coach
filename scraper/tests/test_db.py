"""Tests for scraper/db.py - Database layer with SQLite + zlib compression."""
import pytest
import zlib
from pathlib import Path


@pytest.fixture
def db(tmp_path):
    """Create a fresh database for each test."""
    from scraper.db import Database
    db_instance = Database(str(tmp_path / "test.db"))
    db_instance.initialize()
    return db_instance


class TestTableCreation:
    def test_tables_created(self, db):
        """All required tables should exist after initialize()."""
        conn = db._get_conn()
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        tables = {row["name"] for row in cursor.fetchall()}
        assert "content" in tables
        assert "scrape_sessions" in tables
        assert "search_tasks" in tables
        assert "failed_fetches" in tables
        assert "export_log" in tables

    def test_indexes_created(self, db):
        """Key indexes should exist."""
        conn = db._get_conn()
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='index'"
        )
        indexes = {row["name"] for row in cursor.fetchall()}
        # Should have indexes on content_hash, source_type, category
        assert any("content_hash" in idx for idx in indexes)
        assert any("source_type" in idx for idx in indexes)
        assert any("category" in idx for idx in indexes)

    def test_wal_mode_enabled(self, db):
        """WAL journal mode should be enabled."""
        conn = db._get_conn()
        result = conn.execute("PRAGMA journal_mode").fetchone()
        assert result[0] == "wal"

    def test_foreign_keys_enabled(self, db):
        """Foreign keys should be enabled."""
        conn = db._get_conn()
        result = conn.execute("PRAGMA foreign_keys").fetchone()
        assert result[0] == 1


class TestContentCRUD:
    def test_insert_content_basic(self, db):
        """Insert content returns a row ID."""
        row_id = db.insert_content(
            content_hash="abc123",
            title="Test Article",
            source_type="article",
            source_platform="test",
            source_url="http://example.com/1",
        )
        assert row_id is not None
        assert isinstance(row_id, int)
        assert row_id > 0

    def test_insert_content_duplicate_rejected(self, db):
        """Inserting content with duplicate hash returns None."""
        db.insert_content(
            content_hash="abc123",
            title="Test Article",
            source_type="article",
            source_platform="test",
            source_url="http://example.com/1",
        )
        result = db.insert_content(
            content_hash="abc123",
            title="Duplicate Article",
            source_type="article",
            source_platform="test",
            source_url="http://example.com/2",
        )
        assert result is None

    def test_hash_exists_true(self, db):
        """hash_exists returns True for existing hash."""
        db.insert_content(
            content_hash="myhash",
            title="Something",
            source_type="paper",
            source_platform="arxiv",
            source_url="http://arxiv.org/1",
        )
        assert db.hash_exists("myhash") is True

    def test_hash_exists_false(self, db):
        """hash_exists returns False for non-existent hash."""
        assert db.hash_exists("nonexistent") is False

    def test_get_content_by_hash(self, db):
        """get_content_by_hash retrieves the correct row."""
        db.insert_content(
            content_hash="xyz789",
            title="My Paper",
            source_type="paper",
            source_platform="arxiv",
            source_url="http://arxiv.org/2",
            year=2024,
        )
        row = db.get_content_by_hash("xyz789")
        assert row is not None
        assert row["title"] == "My Paper"
        assert row["year"] == 2024
        assert row["content_hash"] == "xyz789"

    def test_get_content_by_hash_missing(self, db):
        """get_content_by_hash returns None for missing hash."""
        assert db.get_content_by_hash("missing") is None

    def test_get_content_count_empty(self, db):
        """Content count is 0 for empty db."""
        assert db.get_content_count() == 0

    def test_get_content_count(self, db):
        """Content count returns correct number."""
        db.insert_content(content_hash="h1", title="T1", source_type="article",
                          source_platform="p1", source_url="http://a.com/1")
        db.insert_content(content_hash="h2", title="T2", source_type="paper",
                          source_platform="p2", source_url="http://a.com/2")
        assert db.get_content_count() == 2

    def test_get_content_count_by_source(self, db):
        """Count by source_type returns a dict with correct counts."""
        db.insert_content(content_hash="h1", title="T1", source_type="article",
                          source_platform="p1", source_url="http://a.com/1")
        db.insert_content(content_hash="h2", title="T2", source_type="article",
                          source_platform="p1", source_url="http://a.com/2")
        db.insert_content(content_hash="h3", title="T3", source_type="paper",
                          source_platform="p2", source_url="http://a.com/3")
        counts = db.get_content_count_by_source()
        assert counts["article"] == 2
        assert counts["paper"] == 1

    def test_get_content_count_by_category(self, db):
        """Count by category returns a dict with correct counts."""
        db.insert_content(content_hash="h1", title="T1", source_type="article",
                          source_platform="p1", source_url="http://a.com/1",
                          category="science")
        db.insert_content(content_hash="h2", title="T2", source_type="article",
                          source_platform="p1", source_url="http://a.com/2",
                          category="science")
        db.insert_content(content_hash="h3", title="T3", source_type="paper",
                          source_platform="p2", source_url="http://a.com/3",
                          category="tech")
        counts = db.get_content_count_by_category()
        assert counts["science"] == 2
        assert counts["tech"] == 1

    def test_get_all_content_pagination(self, db):
        """get_all_content respects limit and offset."""
        for i in range(5):
            db.insert_content(
                content_hash=f"hash{i}",
                title=f"Title {i}",
                source_type="article",
                source_platform="test",
                source_url=f"http://a.com/{i}",
            )
        page1 = db.get_all_content(limit=3, offset=0)
        assert len(page1) == 3
        page2 = db.get_all_content(limit=3, offset=3)
        assert len(page2) == 2

    def test_insert_content_all_fields(self, db):
        """Insert and retrieve content with all optional fields."""
        row_id = db.insert_content(
            content_hash="full123",
            title="Full Paper",
            authors="Author A, Author B",
            source_type="paper",
            source_platform="arxiv",
            source_url="http://arxiv.org/full",
            source_id="1234.5678",
            abstract="A test abstract",
            full_text="This is the full text of the paper.",
            category="science",
            subcategories="physics,quantum",
            content_format="text",
            year=2023,
            date_published="2023-06-15",
            journal="Nature",
            channel_name=None,
            duration_sec=None,
            word_count=500,
            quality_score=0.95,
            language="en",
        )
        assert row_id is not None
        row = db.get_content_by_hash("full123")
        assert row["title"] == "Full Paper"
        assert row["authors"] == "Author A, Author B"
        assert row["abstract"] == "A test abstract"
        assert row["journal"] == "Nature"
        assert row["word_count"] == 500
        assert row["quality_score"] == pytest.approx(0.95)


class TestFullTextCompression:
    def test_compress_text_returns_bytes(self, db):
        """compress_text returns bytes."""
        result = db.compress_text("hello world")
        assert isinstance(result, bytes)

    def test_compress_decompress_roundtrip(self, db):
        """compress and decompress are inverse operations."""
        original = "This is a test string with some content. " * 50
        compressed = db.compress_text(original)
        decompressed = db.decompress_text(compressed)
        assert decompressed == original

    def test_compress_actually_compresses(self, db):
        """Compressed data should be smaller than highly repetitive text."""
        repetitive = "aaaa" * 1000
        compressed = db.compress_text(repetitive)
        assert len(compressed) < len(repetitive.encode())

    def test_full_text_stored_compressed(self, db):
        """full_text is stored as compressed blob and retrieved correctly."""
        long_text = "This is the full text. " * 100
        db.insert_content(
            content_hash="compressed_test",
            title="Compressed",
            source_type="article",
            source_platform="test",
            source_url="http://test.com",
            full_text=long_text,
        )
        conn = db._get_conn()
        row = conn.execute(
            "SELECT full_text FROM content WHERE content_hash=?",
            ("compressed_test",)
        ).fetchone()
        # raw value should be bytes (compressed blob)
        assert isinstance(row["full_text"], bytes)
        # should decompress correctly
        decompressed = db.decompress_text(row["full_text"])
        assert decompressed == long_text

    def test_full_text_bytes_input(self, db):
        """insert_content accepts full_text as bytes."""
        text = "Text as bytes input"
        db.insert_content(
            content_hash="bytes_input",
            title="Bytes Input",
            source_type="article",
            source_platform="test",
            source_url="http://test.com",
            full_text=text.encode("utf-8"),
        )
        conn = db._get_conn()
        row = conn.execute(
            "SELECT full_text FROM content WHERE content_hash=?",
            ("bytes_input",)
        ).fetchone()
        decompressed = db.decompress_text(row["full_text"])
        assert decompressed == text


class TestSessionCRUD:
    def test_create_session_returns_id(self, db):
        """create_session returns an integer session ID."""
        session_id = db.create_session(config={"source": "arxiv", "limit": 100})
        assert isinstance(session_id, int)
        assert session_id > 0

    def test_get_session(self, db):
        """get_session retrieves the session row."""
        session_id = db.create_session(config={"source": "test"})
        session = db.get_session(session_id)
        assert session is not None
        assert session["id"] == session_id

    def test_get_session_missing(self, db):
        """get_session returns None for missing ID."""
        assert db.get_session(9999) is None

    def test_get_session_status_initial(self, db):
        """New session starts with 'pending' or 'running' status."""
        session_id = db.create_session(config={})
        status = db.get_session_status(session_id)
        assert status in ("pending", "running")

    def test_update_session_status_paused(self, db):
        """Updating status to 'paused' sets paused_at."""
        session_id = db.create_session(config={})
        db.update_session_status(session_id, "paused")
        session = db.get_session(session_id)
        assert session["status"] == "paused"
        assert session["paused_at"] is not None

    def test_update_session_status_running(self, db):
        """Updating status to 'running' sets resumed_at."""
        session_id = db.create_session(config={})
        db.update_session_status(session_id, "paused")
        db.update_session_status(session_id, "running")
        session = db.get_session(session_id)
        assert session["status"] == "running"
        assert session["resumed_at"] is not None

    def test_update_session_status_completed(self, db):
        """Updating status to 'completed' works."""
        session_id = db.create_session(config={})
        db.update_session_status(session_id, "completed")
        assert db.get_session_status(session_id) == "completed"

    def test_update_session_total(self, db):
        """update_session_total updates the total count field."""
        session_id = db.create_session(config={})
        db.update_session_total(session_id)
        session = db.get_session(session_id)
        assert session is not None


class TestSearchTaskCRUD:
    def test_create_search_task(self, db):
        """create_search_task returns an integer task ID."""
        session_id = db.create_session(config={})
        task_id = db.create_search_task(
            session_id=session_id,
            query="machine learning",
            source_type="paper",
            source_platform="arxiv",
        )
        assert isinstance(task_id, int)
        assert task_id > 0

    def test_get_search_task(self, db):
        """get_search_task retrieves the correct task."""
        session_id = db.create_session(config={})
        task_id = db.create_search_task(
            session_id=session_id,
            query="deep learning",
            source_type="paper",
            source_platform="arxiv",
        )
        task = db.get_search_task(task_id)
        assert task is not None
        assert task["id"] == task_id
        assert task["query"] == "deep learning"
        assert task["session_id"] == session_id

    def test_get_pending_search_tasks(self, db):
        """get_pending_search_tasks returns only pending tasks for a session."""
        session_id = db.create_session(config={})
        task1 = db.create_search_task(session_id=session_id, query="q1",
                                       source_type="article", source_platform="web")
        task2 = db.create_search_task(session_id=session_id, query="q2",
                                       source_type="article", source_platform="web")
        task3 = db.create_search_task(session_id=session_id, query="q3",
                                       source_type="article", source_platform="web")
        # Mark task1 as completed
        db.update_search_task(task1, status="completed", results_found=5,
                               results_saved=3, error_message=None)
        pending = db.get_pending_search_tasks(session_id)
        pending_ids = {t["id"] for t in pending}
        assert task1 not in pending_ids
        assert task2 in pending_ids
        assert task3 in pending_ids

    def test_update_search_task_progress(self, db):
        """update_search_task updates status and results."""
        session_id = db.create_session(config={})
        task_id = db.create_search_task(
            session_id=session_id,
            query="test query",
            source_type="paper",
            source_platform="arxiv",
        )
        db.update_search_task(task_id, status="completed",
                               results_found=10, results_saved=8,
                               error_message=None)
        task = db.get_search_task(task_id)
        assert task["status"] == "completed"
        assert task["results_found"] == 10
        assert task["results_saved"] == 8

    def test_update_search_task_with_error(self, db):
        """update_search_task can set an error message."""
        session_id = db.create_session(config={})
        task_id = db.create_search_task(
            session_id=session_id,
            query="broken query",
            source_type="paper",
            source_platform="arxiv",
        )
        db.update_search_task(task_id, status="failed",
                               results_found=0, results_saved=0,
                               error_message="Connection timeout")
        task = db.get_search_task(task_id)
        assert task["status"] == "failed"
        assert task["error_message"] == "Connection timeout"

    def test_search_tasks_isolated_by_session(self, db):
        """get_pending_search_tasks only returns tasks for the given session."""
        session1 = db.create_session(config={})
        session2 = db.create_session(config={})
        t1 = db.create_search_task(session_id=session1, query="q1",
                                    source_type="article", source_platform="web")
        t2 = db.create_search_task(session_id=session2, query="q2",
                                    source_type="article", source_platform="web")
        pending_s1 = db.get_pending_search_tasks(session1)
        ids_s1 = {t["id"] for t in pending_s1}
        assert t1 in ids_s1
        assert t2 not in ids_s1


class TestFailedFetches:
    def test_log_failed_fetch(self, db):
        """log_failed_fetch stores a failed URL."""
        session_id = db.create_session(config={})
        db.log_failed_fetch(
            session_id=session_id,
            url="http://fail.com/1",
            error_message="404 Not Found",
            source_type="article",
        )
        count = db.get_failed_fetch_count(session_id)
        assert count == 1

    def test_get_failed_fetches(self, db):
        """get_failed_fetches returns the logged failures."""
        session_id = db.create_session(config={})
        db.log_failed_fetch(session_id=session_id, url="http://fail.com/1",
                            error_message="timeout", source_type="article")
        db.log_failed_fetch(session_id=session_id, url="http://fail.com/2",
                            error_message="403 Forbidden", source_type="paper")
        fetches = db.get_failed_fetches(session_id, limit=10)
        assert len(fetches) == 2
        urls = {f["url"] for f in fetches}
        assert "http://fail.com/1" in urls
        assert "http://fail.com/2" in urls

    def test_get_failed_fetch_count_zero(self, db):
        """get_failed_fetch_count returns 0 for session with no failures."""
        session_id = db.create_session(config={})
        assert db.get_failed_fetch_count(session_id) == 0

    def test_get_failed_fetches_limit(self, db):
        """get_failed_fetches respects the limit parameter."""
        session_id = db.create_session(config={})
        for i in range(5):
            db.log_failed_fetch(session_id=session_id,
                                url=f"http://fail.com/{i}",
                                error_message="error",
                                source_type="article")
        fetches = db.get_failed_fetches(session_id, limit=3)
        assert len(fetches) == 3

    def test_failed_fetches_isolated_by_session(self, db):
        """Failed fetches are isolated by session."""
        s1 = db.create_session(config={})
        s2 = db.create_session(config={})
        db.log_failed_fetch(session_id=s1, url="http://fail.com/s1",
                            error_message="err", source_type="article")
        db.log_failed_fetch(session_id=s2, url="http://fail.com/s2",
                            error_message="err", source_type="article")
        assert db.get_failed_fetch_count(s1) == 1
        assert db.get_failed_fetch_count(s2) == 1
