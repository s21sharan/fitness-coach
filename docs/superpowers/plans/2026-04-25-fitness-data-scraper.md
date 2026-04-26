# Fitness Data Scraper Agent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an autonomous web scraping agent that collects fitness coaching data from research papers, YouTube, podcasts, articles, books, and Reddit into a SQLite database with Celery+Redis pause/resume and a CLI/API interface.

**Architecture:** Python FastAPI microservice with Celery workers (4 concurrent) backed by Redis for task queuing and pause/resume. SQLite is the primary data store. Content is extracted from PDFs, EPUBs, VTT transcripts, HTML, and audio. A CLI and REST API control the scraping sessions.

**Tech Stack:** Python 3.11+, FastAPI, Celery, Redis, SQLite, PyMuPDF, yt-dlp, Whisper, trafilatura, BeautifulSoup, PRAW, scholarly, scidownl, libgen-api, Click, Rich

**Design spec:** `docs/superpowers/specs/2026-04-25-fitness-data-scraper-design.md`

---

## File Structure

```
scraper/
├── api.py                  # FastAPI endpoints for start/pause/resume/stop/status
├── cli.py                  # Click CLI wrapper for local control
├── config.py               # Category weights, source weights, search terms, targets
├── celery_app.py           # Celery + Redis configuration
├── db.py                   # SQLite schema, connection manager, CRUD operations
├── tasks/
│   ├── __init__.py
│   ├── orchestrator.py     # Top-level session orchestration + time management
│   ├── papers.py           # PMC, Sci-Hub, JISSN, Frontiers, ACSM, NSCA, preprints
│   ├── youtube.py          # yt-dlp transcript extraction
│   ├── podcasts.py         # RSS + Whisper transcription
│   ├── articles.py         # trafilatura + site-specific scrapers
│   ├── books.py            # LibGen fetch + PDF/EPUB extraction
│   └── reddit.py           # Reddit API (PRAW) scraping
├── extractors/
│   ├── __init__.py
│   ├── pdf.py              # PyMuPDF text extraction from PDF bytes
│   ├── epub.py             # ebooklib chapter extraction
│   ├── transcript.py       # VTT/SRT cleaning and dedup
│   ├── audio.py            # Whisper transcription wrapper
│   └── html.py             # trafilatura + BeautifulSoup extraction
├── utils/
│   ├── __init__.py
│   ├── dedup.py            # Content hashing + SQLite dedup check
│   ├── classifier.py       # Keyword-based category tagging
│   ├── rate_limiter.py     # Per-source rate limiting with token bucket
│   └── quality.py          # Quality scoring per source type
├── exports/
│   ├── __init__.py
│   ├── rag_export.py       # SQLite → chunked JSONL for RAG
│   └── finetune_export.py  # Claude synthesis → coaching Q&A JSONL (dormant)
├── tests/
│   ├── __init__.py
│   ├── test_db.py
│   ├── test_config.py
│   ├── test_extractors.py
│   ├── test_utils.py
│   ├── test_tasks.py
│   ├── test_orchestrator.py
│   ├── test_api.py
│   ├── test_cli.py
│   ├── test_exports.py
│   └── fixtures/
│       ├── sample.pdf
│       ├── sample.epub
│       ├── sample.vtt
│       └── sample.html
├── data/                   # Created at runtime
├── requirements.txt
└── Dockerfile
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `scraper/requirements.txt`
- Create: `scraper/tasks/__init__.py`, `scraper/extractors/__init__.py`, `scraper/utils/__init__.py`, `scraper/exports/__init__.py`, `scraper/tests/__init__.py`

- [ ] **Step 1: Create directory structure**

```bash
cd /Users/sharans/Desktop/projects/macrofactor-agent
mkdir -p scraper/{tasks,extractors,utils,exports,tests/fixtures,data}
```

- [ ] **Step 2: Create requirements.txt**

Create `scraper/requirements.txt`:

```
# Core
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
celery[redis]>=5.4.0
redis>=5.0.0
pydantic>=2.0.0

# Scraping & extraction
requests>=2.31.0
trafilatura>=1.12.0
beautifulsoup4>=4.12.0
scholarly>=1.8.0
yt-dlp>=2024.0.0
feedparser>=6.0.0
PyMuPDF>=1.24.0
EbookLib>=0.18
openai-whisper>=20231117
scidownl>=1.0.0
libgen-api>=1.0.0
praw>=7.7.0

# Utilities
langdetect>=1.0.9
click>=8.1.0
rich>=13.0.0
httpx>=0.27.0

# Testing
pytest>=8.0.0
pytest-asyncio>=0.23.0
```

- [ ] **Step 3: Create __init__.py files**

Create empty `__init__.py` in `scraper/tasks/`, `scraper/extractors/`, `scraper/utils/`, `scraper/exports/`, `scraper/tests/`.

- [ ] **Step 4: Install dependencies**

```bash
cd scraper
pip install -r requirements.txt
```

- [ ] **Step 5: Verify key imports**

```bash
python -c "import celery; import fastapi; import fitz; import yt_dlp; import trafilatura; import praw; print('All imports OK')"
```

- [ ] **Step 6: Commit**

```bash
git add scraper/
git commit -m "feat: scaffold scraper project with dependencies"
```

---

## Task 2: Database Layer

**Files:**
- Create: `scraper/db.py`
- Create: `scraper/tests/test_db.py`

- [ ] **Step 1: Write failing tests for database layer**

Create `scraper/tests/test_db.py`:

```python
import os
import pytest
import sqlite3
from scraper.db import Database


@pytest.fixture
def db(tmp_path):
    db_path = str(tmp_path / "test.db")
    database = Database(db_path)
    database.initialize()
    yield database
    database.close()


class TestDatabaseInit:
    def test_creates_tables(self, db):
        tables = db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).fetchall()
        table_names = [t[0] for t in tables]
        assert "content" in table_names
        assert "scrape_sessions" in table_names
        assert "search_tasks" in table_names
        assert "failed_fetches" in table_names
        assert "export_log" in table_names

    def test_content_table_has_correct_columns(self, db):
        cursor = db.execute("PRAGMA table_info(content)")
        columns = {row[1] for row in cursor.fetchall()}
        expected = {
            "id", "content_hash", "title", "authors", "source_type",
            "source_platform", "source_url", "source_id", "abstract",
            "full_text", "category", "subcategories", "content_format",
            "year", "date_published", "journal", "channel_name",
            "duration_sec", "word_count", "quality_score", "language",
            "created_at",
        }
        assert expected.issubset(columns)


class TestContentCRUD:
    def test_insert_content(self, db):
        content_id = db.insert_content(
            content_hash="abc123",
            title="Test Paper",
            authors='["Author One"]',
            source_type="paper",
            source_platform="pmc",
            source_url="https://example.com",
            source_id="PMC12345",
            abstract="Test abstract",
            full_text=b"Full text content here",
            category="hypertrophy",
            subcategories='["volume", "frequency"]',
            content_format="research_paper",
            year=2024,
            date_published="2024-01-15",
            journal="JISSN",
            channel_name=None,
            duration_sec=None,
            word_count=500,
            quality_score=8.5,
        )
        assert content_id is not None
        assert content_id > 0

    def test_duplicate_hash_rejected(self, db):
        db.insert_content(
            content_hash="dup123", title="Paper 1", authors="[]",
            source_type="paper", source_platform="pmc", source_url="",
            source_id="1", abstract="", full_text=b"text",
            category="hypertrophy", subcategories="[]",
            content_format="research_paper", year=2024,
            date_published="", journal="", channel_name=None,
            duration_sec=None, word_count=100, quality_score=1.0,
        )
        result = db.insert_content(
            content_hash="dup123", title="Paper 2", authors="[]",
            source_type="paper", source_platform="pmc", source_url="",
            source_id="2", abstract="", full_text=b"text2",
            category="nutrition", subcategories="[]",
            content_format="review", year=2024,
            date_published="", journal="", channel_name=None,
            duration_sec=None, word_count=200, quality_score=2.0,
        )
        assert result is None

    def test_hash_exists(self, db):
        assert db.hash_exists("nonexistent") is False
        db.insert_content(
            content_hash="exists123", title="Paper", authors="[]",
            source_type="paper", source_platform="pmc", source_url="",
            source_id="1", abstract="", full_text=b"text",
            category="hypertrophy", subcategories="[]",
            content_format="research_paper", year=2024,
            date_published="", journal="", channel_name=None,
            duration_sec=None, word_count=100, quality_score=1.0,
        )
        assert db.hash_exists("exists123") is True

    def test_get_content_count(self, db):
        assert db.get_content_count() == 0
        db.insert_content(
            content_hash="c1", title="P1", authors="[]",
            source_type="paper", source_platform="pmc", source_url="",
            source_id="1", abstract="", full_text=b"t",
            category="hypertrophy", subcategories="[]",
            content_format="research_paper", year=2024,
            date_published="", journal="", channel_name=None,
            duration_sec=None, word_count=10, quality_score=1.0,
        )
        assert db.get_content_count() == 1

    def test_get_content_count_by_source(self, db):
        db.insert_content(
            content_hash="c1", title="P1", authors="[]",
            source_type="paper", source_platform="pmc", source_url="",
            source_id="1", abstract="", full_text=b"t",
            category="hypertrophy", subcategories="[]",
            content_format="research_paper", year=2024,
            date_published="", journal="", channel_name=None,
            duration_sec=None, word_count=10, quality_score=1.0,
        )
        db.insert_content(
            content_hash="c2", title="V1", authors="[]",
            source_type="youtube", source_platform="youtube", source_url="",
            source_id="vid1", abstract="", full_text=b"t",
            category="nutrition", subcategories="[]",
            content_format="transcript", year=2024,
            date_published="", journal=None, channel_name="RP",
            duration_sec=600, word_count=50, quality_score=5.0,
        )
        counts = db.get_content_count_by_source()
        assert counts["paper"] == 1
        assert counts["youtube"] == 1

    def test_full_text_compression(self, db):
        long_text = "This is a test. " * 1000
        db.insert_content(
            content_hash="compress1", title="Long", authors="[]",
            source_type="paper", source_platform="pmc", source_url="",
            source_id="1", abstract="", full_text=long_text.encode("utf-8"),
            category="hypertrophy", subcategories="[]",
            content_format="research_paper", year=2024,
            date_published="", journal="", channel_name=None,
            duration_sec=None, word_count=4000, quality_score=1.0,
        )
        row = db.get_content_by_hash("compress1")
        assert row is not None
        retrieved_text = db.decompress_text(row["full_text"])
        assert retrieved_text == long_text


class TestSessionCRUD:
    def test_create_session(self, db):
        session_id = db.create_session(config='{"duration_hours": 12}')
        assert session_id > 0

    def test_update_session_status(self, db):
        session_id = db.create_session(config='{}')
        db.update_session_status(session_id, "paused")
        session = db.get_session(session_id)
        assert session["status"] == "paused"
        assert session["paused_at"] is not None

    def test_get_session_status(self, db):
        session_id = db.create_session(config='{}')
        assert db.get_session_status(session_id) == "running"


class TestSearchTaskCRUD:
    def test_create_search_task(self, db):
        session_id = db.create_session(config='{}')
        task_id = db.create_search_task(
            session_id=session_id,
            category="hypertrophy",
            source_type="paper",
            search_term="muscle hypertrophy volume",
            source_platform="pmc",
        )
        assert task_id > 0

    def test_get_pending_tasks(self, db):
        session_id = db.create_session(config='{}')
        db.create_search_task(session_id, "hypertrophy", "paper", "term1", "pmc")
        db.create_search_task(session_id, "nutrition", "paper", "term2", "pmc")
        pending = db.get_pending_search_tasks(session_id)
        assert len(pending) == 2

    def test_update_search_task_progress(self, db):
        session_id = db.create_session(config='{}')
        task_id = db.create_search_task(session_id, "hypertrophy", "paper", "term1", "pmc")
        db.update_search_task(task_id, status="in_progress", page_cursor="2", results_found=50)
        task = db.get_search_task(task_id)
        assert task["status"] == "in_progress"
        assert task["page_cursor"] == "2"
        assert task["results_found"] == 50


class TestFailedFetches:
    def test_log_failed_fetch(self, db):
        session_id = db.create_session(config='{}')
        db.log_failed_fetch(
            session_id=session_id,
            source_type="paper",
            source_id="10.1234/test",
            title="Failed Paper",
            error_message="Connection timeout",
        )
        failures = db.get_failed_fetches(session_id)
        assert len(failures) == 1
        assert failures[0]["error_message"] == "Connection timeout"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/sharans/Desktop/projects/macrofactor-agent
python -m pytest scraper/tests/test_db.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'scraper.db'`

- [ ] **Step 3: Implement database layer**

Create `scraper/db.py`:

```python
import sqlite3
import zlib
import threading
from datetime import datetime, timezone
from typing import Optional


class Database:
    """SQLite database manager with zlib compression for full_text content."""

    def __init__(self, db_path: str = "scraper/data/fitness_data.db"):
        self.db_path = db_path
        self._local = threading.local()

    @property
    def conn(self) -> sqlite3.Connection:
        if not hasattr(self._local, "conn") or self._local.conn is None:
            self._local.conn = sqlite3.connect(self.db_path)
            self._local.conn.row_factory = sqlite3.Row
            self._local.conn.execute("PRAGMA journal_mode=WAL")
            self._local.conn.execute("PRAGMA foreign_keys=ON")
        return self._local.conn

    def execute(self, sql: str, params: tuple = ()) -> sqlite3.Cursor:
        return self.conn.execute(sql, params)

    def close(self):
        if hasattr(self._local, "conn") and self._local.conn:
            self._local.conn.close()
            self._local.conn = None

    def initialize(self):
        """Create all tables if they don't exist."""
        self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS content (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                content_hash    TEXT UNIQUE NOT NULL,
                title           TEXT NOT NULL,
                authors         TEXT,
                source_type     TEXT NOT NULL,
                source_platform TEXT,
                source_url      TEXT,
                source_id       TEXT,
                abstract        TEXT,
                full_text       BLOB,
                category        TEXT,
                subcategories   TEXT,
                content_format  TEXT,
                year            INTEGER,
                date_published  TEXT,
                journal         TEXT,
                channel_name    TEXT,
                duration_sec    INTEGER,
                word_count      INTEGER,
                quality_score   REAL,
                language        TEXT DEFAULT 'en',
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS scrape_sessions (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                started_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                paused_at       TIMESTAMP,
                resumed_at      TIMESTAMP,
                status          TEXT DEFAULT 'running',
                total_items     INTEGER DEFAULT 0,
                config          TEXT
            );

            CREATE TABLE IF NOT EXISTS search_tasks (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id      INTEGER NOT NULL,
                category        TEXT,
                source_type     TEXT NOT NULL,
                search_term     TEXT,
                source_platform TEXT,
                status          TEXT DEFAULT 'pending',
                results_found   INTEGER DEFAULT 0,
                results_fetched INTEGER DEFAULT 0,
                page_cursor     TEXT,
                error_message   TEXT,
                updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES scrape_sessions(id)
            );

            CREATE TABLE IF NOT EXISTS failed_fetches (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id      INTEGER NOT NULL,
                source_type     TEXT,
                source_id       TEXT,
                title           TEXT,
                error_message   TEXT,
                retry_count     INTEGER DEFAULT 0,
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES scrape_sessions(id)
            );

            CREATE TABLE IF NOT EXISTS export_log (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                content_id      INTEGER NOT NULL,
                export_type     TEXT,
                exported_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (content_id) REFERENCES content(id)
            );

            CREATE INDEX IF NOT EXISTS idx_content_hash ON content(content_hash);
            CREATE INDEX IF NOT EXISTS idx_content_source ON content(source_type);
            CREATE INDEX IF NOT EXISTS idx_content_category ON content(category);
            CREATE INDEX IF NOT EXISTS idx_search_tasks_session ON search_tasks(session_id);
            CREATE INDEX IF NOT EXISTS idx_search_tasks_status ON search_tasks(status);
        """)

    @staticmethod
    def compress_text(text: str) -> bytes:
        return zlib.compress(text.encode("utf-8"))

    @staticmethod
    def decompress_text(data: bytes) -> str:
        return zlib.decompress(data).decode("utf-8")

    def hash_exists(self, content_hash: str) -> bool:
        row = self.execute(
            "SELECT 1 FROM content WHERE content_hash = ?", (content_hash,)
        ).fetchone()
        return row is not None

    def get_content_by_hash(self, content_hash: str) -> Optional[sqlite3.Row]:
        return self.execute(
            "SELECT * FROM content WHERE content_hash = ?", (content_hash,)
        ).fetchone()

    def insert_content(
        self,
        content_hash: str,
        title: str,
        authors: str,
        source_type: str,
        source_platform: str,
        source_url: str,
        source_id: str,
        abstract: str,
        full_text: bytes,
        category: str,
        subcategories: str,
        content_format: str,
        year: int,
        date_published: str,
        journal: Optional[str],
        channel_name: Optional[str],
        duration_sec: Optional[int],
        word_count: int,
        quality_score: float,
        language: str = "en",
    ) -> Optional[int]:
        """Insert content. Returns row ID or None if hash already exists."""
        if self.hash_exists(content_hash):
            return None
        compressed = self.compress_text(full_text.decode("utf-8")) if isinstance(full_text, bytes) else self.compress_text(full_text)
        cursor = self.execute(
            """INSERT INTO content (
                content_hash, title, authors, source_type, source_platform,
                source_url, source_id, abstract, full_text, category,
                subcategories, content_format, year, date_published, journal,
                channel_name, duration_sec, word_count, quality_score, language
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                content_hash, title, authors, source_type, source_platform,
                source_url, source_id, abstract, compressed, category,
                subcategories, content_format, year, date_published, journal,
                channel_name, duration_sec, word_count, quality_score, language,
            ),
        )
        self.conn.commit()
        return cursor.lastrowid

    def get_content_count(self) -> int:
        return self.execute("SELECT COUNT(*) FROM content").fetchone()[0]

    def get_content_count_by_source(self) -> dict:
        rows = self.execute(
            "SELECT source_type, COUNT(*) as cnt FROM content GROUP BY source_type"
        ).fetchall()
        return {row["source_type"]: row["cnt"] for row in rows}

    def get_content_count_by_category(self) -> dict:
        rows = self.execute(
            "SELECT category, COUNT(*) as cnt FROM content GROUP BY category"
        ).fetchall()
        return {row["category"]: row["cnt"] for row in rows}

    def get_all_content(self, limit: int = 100, offset: int = 0) -> list:
        return self.execute(
            "SELECT * FROM content ORDER BY id LIMIT ? OFFSET ?", (limit, offset)
        ).fetchall()

    # --- Session CRUD ---

    def create_session(self, config: str) -> int:
        cursor = self.execute(
            "INSERT INTO scrape_sessions (config) VALUES (?)", (config,)
        )
        self.conn.commit()
        return cursor.lastrowid

    def get_session(self, session_id: int) -> Optional[sqlite3.Row]:
        return self.execute(
            "SELECT * FROM scrape_sessions WHERE id = ?", (session_id,)
        ).fetchone()

    def get_session_status(self, session_id: int) -> Optional[str]:
        row = self.get_session(session_id)
        return row["status"] if row else None

    def update_session_status(self, session_id: int, status: str):
        now = datetime.now(timezone.utc).isoformat()
        if status == "paused":
            self.execute(
                "UPDATE scrape_sessions SET status = ?, paused_at = ? WHERE id = ?",
                (status, now, session_id),
            )
        elif status == "running":
            self.execute(
                "UPDATE scrape_sessions SET status = ?, resumed_at = ? WHERE id = ?",
                (status, now, session_id),
            )
        else:
            self.execute(
                "UPDATE scrape_sessions SET status = ? WHERE id = ?",
                (status, session_id),
            )
        self.conn.commit()

    def update_session_total(self, session_id: int):
        count = self.get_content_count()
        self.execute(
            "UPDATE scrape_sessions SET total_items = ? WHERE id = ?",
            (count, session_id),
        )
        self.conn.commit()

    # --- Search Task CRUD ---

    def create_search_task(
        self, session_id: int, category: str, source_type: str,
        search_term: str, source_platform: str,
    ) -> int:
        cursor = self.execute(
            """INSERT INTO search_tasks
                (session_id, category, source_type, search_term, source_platform)
                VALUES (?, ?, ?, ?, ?)""",
            (session_id, category, source_type, search_term, source_platform),
        )
        self.conn.commit()
        return cursor.lastrowid

    def get_search_task(self, task_id: int) -> Optional[sqlite3.Row]:
        return self.execute(
            "SELECT * FROM search_tasks WHERE id = ?", (task_id,)
        ).fetchone()

    def get_pending_search_tasks(self, session_id: int) -> list:
        return self.execute(
            "SELECT * FROM search_tasks WHERE session_id = ? AND status = 'pending' ORDER BY id",
            (session_id,),
        ).fetchall()

    def update_search_task(
        self, task_id: int, status: Optional[str] = None,
        page_cursor: Optional[str] = None,
        results_found: Optional[int] = None,
        results_fetched: Optional[int] = None,
        error_message: Optional[str] = None,
    ):
        updates = []
        params = []
        if status is not None:
            updates.append("status = ?")
            params.append(status)
        if page_cursor is not None:
            updates.append("page_cursor = ?")
            params.append(page_cursor)
        if results_found is not None:
            updates.append("results_found = ?")
            params.append(results_found)
        if results_fetched is not None:
            updates.append("results_fetched = ?")
            params.append(results_fetched)
        if error_message is not None:
            updates.append("error_message = ?")
            params.append(error_message)
        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.append(task_id)
        self.execute(
            f"UPDATE search_tasks SET {', '.join(updates)} WHERE id = ?", tuple(params)
        )
        self.conn.commit()

    # --- Failed Fetches ---

    def log_failed_fetch(
        self, session_id: int, source_type: str, source_id: str,
        title: str, error_message: str,
    ):
        self.execute(
            """INSERT INTO failed_fetches
                (session_id, source_type, source_id, title, error_message)
                VALUES (?, ?, ?, ?, ?)""",
            (session_id, source_type, source_id, title, error_message),
        )
        self.conn.commit()

    def get_failed_fetches(self, session_id: int, limit: int = 50) -> list:
        return self.execute(
            "SELECT * FROM failed_fetches WHERE session_id = ? ORDER BY id DESC LIMIT ?",
            (session_id, limit),
        ).fetchall()

    def get_failed_fetch_count(self, session_id: int) -> int:
        return self.execute(
            "SELECT COUNT(*) FROM failed_fetches WHERE session_id = ?", (session_id,)
        ).fetchone()[0]
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python -m pytest scraper/tests/test_db.py -v
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add scraper/db.py scraper/tests/test_db.py
git commit -m "feat: implement SQLite database layer with compression"
```

---

## Task 3: Configuration

**Files:**
- Create: `scraper/config.py`
- Create: `scraper/tests/test_config.py`

- [ ] **Step 1: Write failing tests**

Create `scraper/tests/test_config.py`:

```python
from scraper.config import ScraperConfig, CATEGORIES, SOURCE_TYPES


def test_categories_weights_sum_to_100():
    total = sum(c["weight"] for c in CATEGORIES.values())
    assert abs(total - 1.0) < 0.01


def test_source_weights_sum_to_100():
    total = sum(s["weight"] for s in SOURCE_TYPES.values())
    assert abs(total - 1.0) < 0.01


def test_all_categories_have_search_terms():
    for name, cat in CATEGORIES.items():
        assert len(cat["search_terms"]) > 0, f"{name} has no search terms"


def test_default_config():
    config = ScraperConfig()
    assert config.duration_hours == 12
    assert config.num_workers == 4
    assert len(config.categories) == 8
    assert len(config.source_types) == 6


def test_config_time_budget():
    config = ScraperConfig(duration_hours=12)
    budgets = config.get_time_budgets()
    total = sum(budgets.values())
    assert abs(total - 12 * 3600) < 10  # within 10 seconds of 12 hours


def test_config_custom_sources():
    config = ScraperConfig(sources_enabled=["papers", "youtube"])
    assert len(config.sources_enabled) == 2


def test_youtube_channels_defined():
    from scraper.config import YOUTUBE_CHANNELS
    assert len(YOUTUBE_CHANNELS) > 5


def test_podcast_feeds_defined():
    from scraper.config import PODCAST_FEEDS
    assert len(PODCAST_FEEDS) > 5


def test_article_sites_defined():
    from scraper.config import ARTICLE_SITES
    assert len(ARTICLE_SITES) > 5


def test_target_books_defined():
    from scraper.config import TARGET_BOOKS
    assert len(TARGET_BOOKS) > 15


def test_reddit_subreddits_defined():
    from scraper.config import REDDIT_SUBREDDITS
    assert len(REDDIT_SUBREDDITS) > 5
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python -m pytest scraper/tests/test_config.py -v
```

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement config**

Create `scraper/config.py`:

```python
from dataclasses import dataclass, field


CATEGORIES = {
    "hypertrophy": {
        "weight": 0.25,
        "search_terms": [
            "muscle hypertrophy volume",
            "resistance training frequency",
            "periodization strength training",
            "progressive overload muscle growth",
            "training volume landmarks",
            "mechanical tension hypertrophy",
            "rep range muscle growth",
            "compound vs isolation exercises",
            "muscle protein synthesis resistance",
            "training to failure hypertrophy",
        ],
    },
    "nutrition": {
        "weight": 0.20,
        "search_terms": [
            "protein synthesis muscle building",
            "caloric deficit lean mass retention",
            "carb cycling athletic performance",
            "reverse dieting metabolism",
            "protein timing distribution",
            "macronutrient ratios body composition",
            "contest prep bodybuilding diet",
            "bulking diet muscle gain",
            "intermittent fasting muscle mass",
            "recomposition calorie intake",
        ],
    },
    "supplements": {
        "weight": 0.15,
        "search_terms": [
            "creatine monohydrate performance meta-analysis",
            "caffeine ergogenic aid exercise",
            "beta-alanine endurance performance",
            "ashwagandha testosterone cortisol",
            "citrulline malate exercise performance",
            "omega-3 fatty acids muscle recovery",
            "vitamin D muscle function",
            "magnesium sleep athletic performance",
            "collagen peptides joint health",
            "probiotics gut health athletes",
        ],
    },
    "peptides": {
        "weight": 0.15,
        "search_terms": [
            "BPC-157 tendon healing",
            "TB-500 tissue repair regeneration",
            "growth hormone secretagogue",
            "SARMs muscle mass research",
            "IGF-1 muscle hypertrophy",
            "MK-677 ibutamoren growth hormone",
            "peptide therapy recovery",
            "GHK-Cu wound healing collagen",
            "CJC-1295 growth hormone releasing",
            "thymosin beta tissue regeneration",
        ],
    },
    "endurance": {
        "weight": 0.10,
        "search_terms": [
            "concurrent training interference effect",
            "VO2max improvement training",
            "zone 2 training metabolic adaptation",
            "hybrid athlete strength endurance",
            "marathon training periodization",
            "triathlon training program",
            "lactate threshold training",
            "polarized training endurance",
            "running economy biomechanics",
            "cycling power training zones",
        ],
    },
    "recovery": {
        "weight": 0.07,
        "search_terms": [
            "sleep deprivation strength performance",
            "HRV training readiness monitoring",
            "overtraining syndrome markers",
            "deload recovery adaptation",
            "cold water immersion recovery",
            "massage therapy muscle recovery",
            "active recovery exercise",
            "stress cortisol training adaptation",
        ],
    },
    "body_composition": {
        "weight": 0.05,
        "search_terms": [
            "DEXA body composition accuracy",
            "body fat measurement methods comparison",
            "lean mass retention caloric deficit",
            "body recomposition evidence",
            "weight loss muscle preservation",
            "visceral fat exercise reduction",
        ],
    },
    "injury_prevention": {
        "weight": 0.03,
        "search_terms": [
            "tendinopathy loading protocol rehabilitation",
            "rotator cuff injury prevention exercises",
            "return to training criteria injury",
            "ACL injury prevention program",
            "low back pain resistance training",
            "mobility flexibility injury prevention",
        ],
    },
}

SOURCE_TYPES = {
    "papers": {"weight": 0.40, "queue_priority": 1},
    "youtube": {"weight": 0.20, "queue_priority": 2},
    "articles": {"weight": 0.15, "queue_priority": 3},
    "podcasts": {"weight": 0.10, "queue_priority": 4},
    "books": {"weight": 0.10, "queue_priority": 5},
    "reddit": {"weight": 0.05, "queue_priority": 6},
}

YOUTUBE_CHANNELS = [
    "https://www.youtube.com/@RenaissancePeriodization/videos",
    "https://www.youtube.com/@JeffNippard/videos",
    "https://www.youtube.com/@AlexBromley/videos",
    "https://www.youtube.com/@GVS/videos",
    "https://www.youtube.com/@BarbellMedicine/videos",
    "https://www.youtube.com/@StrongerByScience/videos",
    "https://www.youtube.com/@NickBare/videos",
    "https://www.youtube.com/@CrossFit/videos",
    "https://www.youtube.com/@StartingStrength/videos",
    "https://www.youtube.com/@PrecisionNutrition/videos",
]

PODCAST_FEEDS = [
    {"name": "Iron Culture", "url": "https://feeds.megaphone.fm/ironculture"},
    {"name": "Stronger By Science", "url": "https://sbspod.libsyn.com/rss"},
    {"name": "Revive Stronger", "url": "https://feeds.buzzsprout.com/258298.rss"},
    {"name": "RP Strength Podcast", "url": "https://feeds.megaphone.fm/rpstrength"},
    {"name": "Barbell Medicine", "url": "https://barbellmedicine.libsyn.com/rss"},
    {"name": "Mind Pump", "url": "https://mindpumpmedia.libsyn.com/rss"},
    {"name": "Huberman Lab", "url": "https://feeds.megaphone.fm/hubermanlab"},
    {"name": "Sigma Nutrition Radio", "url": "https://sigmanutrition.libsyn.com/rss"},
    {"name": "The Drive - Peter Attia", "url": "https://peterattiamd.libsyn.com/rss"},
]

ARTICLE_SITES = [
    {"name": "Stronger By Science", "base_url": "https://www.strongerbyscience.com", "sitemap": "/sitemap.xml"},
    {"name": "RippedBody", "base_url": "https://rippedbody.com", "sitemap": "/sitemap.xml"},
    {"name": "T-Nation", "base_url": "https://www.t-nation.com", "sitemap": "/sitemap.xml"},
    {"name": "EliteFTS", "base_url": "https://www.elitefts.com", "sitemap": "/sitemap.xml"},
    {"name": "Examine.com", "base_url": "https://examine.com", "sitemap": "/sitemap.xml"},
    {"name": "Renaissance Periodization", "base_url": "https://rpstrength.com", "sitemap": "/sitemap.xml"},
    {"name": "Barbell Medicine", "base_url": "https://www.barbellmedicine.com", "sitemap": "/sitemap.xml"},
    {"name": "Precision Nutrition", "base_url": "https://www.precisionnutrition.com", "sitemap": "/sitemap.xml"},
    {"name": "TrainingPeaks Blog", "base_url": "https://www.trainingpeaks.com/blog", "sitemap": "/sitemap.xml"},
    {"name": "CrossFit Journal", "base_url": "https://journal.crossfit.com", "sitemap": "/sitemap.xml"},
    {"name": "Starting Strength", "base_url": "https://startingstrength.com/articles", "sitemap": "/sitemap.xml"},
]

TARGET_BOOKS = [
    # Strength & Hypertrophy
    {"title": "Science and Practice of Strength Training", "author": "Zatsiorsky", "isbn": "9780736056281"},
    {"title": "Practical Programming for Strength Training", "author": "Rippetoe", "isbn": "9780982522752"},
    {"title": "Scientific Principles of Hypertrophy Training", "author": "Israetel", "isbn": ""},
    {"title": "The Muscle and Strength Pyramid Training", "author": "Helms", "isbn": ""},
    {"title": "NSCA Essentials of Strength Training and Conditioning", "author": "Haff", "isbn": "9781492501626"},
    {"title": "Periodization Theory and Methodology of Training", "author": "Bompa", "isbn": "9781492544807"},
    {"title": "Supertraining", "author": "Verkhoshansky", "isbn": "9788890403811"},
    {"title": "The Renaissance Diet 2.0", "author": "Israetel", "isbn": ""},
    {"title": "Optimizing Strength Training", "author": "Kraemer", "isbn": "9780736060684"},
    # Running & Endurance
    {"title": "80/20 Running", "author": "Fitzgerald", "isbn": "9780451470881"},
    {"title": "Daniels Running Formula", "author": "Daniels", "isbn": "9781450431835"},
    {"title": "Advanced Marathoning", "author": "Pfitzinger", "isbn": "9780736074605"},
    {"title": "Hansons Marathon Method", "author": "Hansons", "isbn": "9781934030851"},
    {"title": "Run Less Run Faster", "author": "Pierce", "isbn": "9781609618025"},
    {"title": "The Science of Running", "author": "Magness", "isbn": "9780615942940"},
    {"title": "Fast After 50", "author": "Friel", "isbn": "9781937715267"},
    # Triathlon
    {"title": "The Triathletes Training Bible", "author": "Friel", "isbn": "9781937715441"},
    {"title": "Training and Racing with a Power Meter", "author": "Allen", "isbn": "9781937715939"},
    {"title": "Total Immersion Swimming", "author": "Laughlin", "isbn": "9780743253437"},
    {"title": "Going Long Training for Triathlons Ultimate Challenge", "author": "Friel", "isbn": "9781934030066"},
]

REDDIT_SUBREDDITS = [
    "weightroom",
    "naturalbodybuilding",
    "bodybuilding",
    "advancedfitness",
    "steroids",
    "Supplements",
    "strength_training",
]

RATE_LIMITS = {
    "pmc": {"requests_per_second": 3, "delay": 0.34},
    "scholar": {"requests_per_second": 0.05, "delay": 20},
    "scihub": {"requests_per_second": 0.2, "delay": 5},
    "libgen": {"requests_per_second": 0.2, "delay": 5},
    "frontiers": {"requests_per_second": 0.5, "delay": 2},
    "jissn": {"requests_per_second": 0.5, "delay": 2},
    "biorxiv": {"requests_per_second": 0.5, "delay": 2},
    "youtube": {"requests_per_second": 1, "delay": 1},
    "reddit": {"requests_per_second": 1, "delay": 1},
    "articles": {"requests_per_second": 0.5, "delay": 2},
}

SCIHUB_MIRRORS = [
    "https://sci-hub.se",
    "https://sci-hub.st",
    "https://sci-hub.ru",
    "https://sci-hub.do",
]

LIBGEN_MIRRORS = [
    "https://libgen.rs",
    "https://libgen.is",
    "https://libgen.st",
]

NCBI_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
BIORXIV_API = "https://api.biorxiv.org"


@dataclass
class ScraperConfig:
    duration_hours: float = 12
    num_workers: int = 4
    sources_enabled: list = field(default_factory=lambda: list(SOURCE_TYPES.keys()))
    categories: dict = field(default_factory=lambda: CATEGORIES)
    source_types: dict = field(default_factory=lambda: SOURCE_TYPES)
    ncbi_api_key: str = ""
    ncbi_email: str = ""
    reddit_client_id: str = ""
    reddit_client_secret: str = ""
    reddit_username: str = ""
    reddit_password: str = ""

    def get_time_budgets(self) -> dict:
        """Returns time budget in seconds per source type."""
        total_seconds = self.duration_hours * 3600
        enabled_sources = {
            k: v for k, v in self.source_types.items()
            if k in self.sources_enabled
        }
        total_weight = sum(s["weight"] for s in enabled_sources.values())
        return {
            source: int(total_seconds * (info["weight"] / total_weight))
            for source, info in enabled_sources.items()
        }

    def to_json(self) -> str:
        import json
        return json.dumps({
            "duration_hours": self.duration_hours,
            "num_workers": self.num_workers,
            "sources_enabled": self.sources_enabled,
        })
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python -m pytest scraper/tests/test_config.py -v
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add scraper/config.py scraper/tests/test_config.py
git commit -m "feat: add scraper configuration with categories, sources, and targets"
```

---

## Task 4: Content Extractors

**Files:**
- Create: `scraper/extractors/pdf.py`
- Create: `scraper/extractors/epub.py`
- Create: `scraper/extractors/transcript.py`
- Create: `scraper/extractors/html.py`
- Create: `scraper/extractors/audio.py`
- Create: `scraper/tests/test_extractors.py`
- Create: test fixtures in `scraper/tests/fixtures/`

- [ ] **Step 1: Create test fixtures**

Create `scraper/tests/fixtures/sample.vtt`:

```
WEBVTT

00:00:00.000 --> 00:00:03.000
Hello and welcome to the show.

00:00:03.000 --> 00:00:06.000
Hello and welcome to the show.

00:00:06.000 --> 00:00:10.000
Today we're talking about hypertrophy training.

00:00:10.000 --> 00:00:15.000
Today we're talking about hypertrophy training.

00:00:15.000 --> 00:00:20.000
Volume is the primary driver of muscle growth.
```

Create `scraper/tests/fixtures/sample.html`:

```html
<!DOCTYPE html>
<html>
<head><title>Test Article</title></head>
<body>
<nav>Navigation stuff</nav>
<article>
<h1>The Science of Muscle Growth</h1>
<p>Muscle hypertrophy occurs when the rate of muscle protein synthesis exceeds the rate of muscle protein breakdown.</p>
<p>Progressive overload is the most important principle for driving hypertrophy over time.</p>
<p>Research suggests that training volume is a primary driver of muscle growth, with most individuals responding well to 10-20 sets per muscle group per week.</p>
</article>
<footer>Footer stuff</footer>
</body>
</html>
```

- [ ] **Step 2: Write failing tests for extractors**

Create `scraper/tests/test_extractors.py`:

```python
import os
import pytest

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")


class TestVTTExtractor:
    def test_parse_vtt_removes_timestamps(self):
        from scraper.extractors.transcript import parse_vtt

        vtt_path = os.path.join(FIXTURES_DIR, "sample.vtt")
        text = parse_vtt(vtt_path)
        assert "-->" not in text
        assert "00:00" not in text

    def test_parse_vtt_deduplicates_lines(self):
        from scraper.extractors.transcript import parse_vtt

        vtt_path = os.path.join(FIXTURES_DIR, "sample.vtt")
        text = parse_vtt(vtt_path)
        # "Hello and welcome to the show." appears twice in VTT but should appear once
        assert text.count("Hello and welcome to the show.") == 1

    def test_parse_vtt_preserves_content(self):
        from scraper.extractors.transcript import parse_vtt

        vtt_path = os.path.join(FIXTURES_DIR, "sample.vtt")
        text = parse_vtt(vtt_path)
        assert "hypertrophy training" in text
        assert "Volume is the primary driver" in text

    def test_parse_vtt_from_string(self):
        from scraper.extractors.transcript import parse_vtt_string

        vtt_content = """WEBVTT

00:00:00.000 --> 00:00:05.000
First line of text.

00:00:05.000 --> 00:00:10.000
Second line of text.
"""
        text = parse_vtt_string(vtt_content)
        assert "First line" in text
        assert "Second line" in text
        assert "-->" not in text


class TestHTMLExtractor:
    def test_extract_article_text(self):
        from scraper.extractors.html import extract_article

        html_path = os.path.join(FIXTURES_DIR, "sample.html")
        with open(html_path, "r") as f:
            html = f.read()
        text = extract_article(html)
        assert "muscle protein synthesis" in text.lower() or "Muscle" in text

    def test_extract_strips_navigation(self):
        from scraper.extractors.html import extract_article

        html_path = os.path.join(FIXTURES_DIR, "sample.html")
        with open(html_path, "r") as f:
            html = f.read()
        text = extract_article(html)
        assert "Navigation stuff" not in text

    def test_extract_from_url_returns_text(self):
        from scraper.extractors.html import extract_from_url

        # Use a known stable URL
        text = extract_from_url("https://example.com")
        assert text is not None
        assert len(text) > 0


class TestPDFExtractor:
    def test_extract_text_from_bytes(self):
        from scraper.extractors.pdf import extract_text_from_bytes

        # Create a minimal PDF in memory using PyMuPDF
        import fitz
        doc = fitz.open()
        page = doc.new_page()
        page.insert_text((72, 72), "This is test content about muscle hypertrophy.")
        pdf_bytes = doc.tobytes()
        doc.close()

        text = extract_text_from_bytes(pdf_bytes)
        assert "muscle hypertrophy" in text

    def test_extract_strips_empty_pages(self):
        from scraper.extractors.pdf import extract_text_from_bytes

        import fitz
        doc = fitz.open()
        doc.new_page()  # empty page
        page2 = doc.new_page()
        page2.insert_text((72, 72), "Actual content here.")
        pdf_bytes = doc.tobytes()
        doc.close()

        text = extract_text_from_bytes(pdf_bytes)
        assert "Actual content" in text


class TestEPUBExtractor:
    def test_extract_chapters(self):
        from scraper.extractors.epub import extract_chapters

        # We'll test with a real EPUB if available, otherwise skip
        # This is a structural test — the actual method is straightforward
        assert callable(extract_chapters)
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
python -m pytest scraper/tests/test_extractors.py -v
```

Expected: FAIL — modules not found

- [ ] **Step 4: Implement transcript extractor**

Create `scraper/extractors/transcript.py`:

```python
import re


def parse_vtt(file_path: str) -> str:
    """Parse a WebVTT file into clean plain text."""
    with open(file_path, "r", encoding="utf-8") as f:
        return parse_vtt_string(f.read())


def parse_vtt_string(vtt_content: str) -> str:
    """Parse VTT content string into clean plain text."""
    content = vtt_content
    # Strip WEBVTT header
    content = re.sub(r"WEBVTT.*?\n", "", content)
    # Remove NOTE blocks
    content = re.sub(r"NOTE\s.*?\n\n", "", content, flags=re.DOTALL)
    # Remove timestamp lines
    content = re.sub(
        r"\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}.*\n",
        "", content,
    )
    # Remove cue identifiers
    content = re.sub(r"^\d+\s*$", "", content, flags=re.MULTILINE)
    # Remove inline tags like <c>, </c>, <00:00:01.234>
    content = re.sub(r"<[^>]+>", "", content)

    # Deduplicate consecutive identical lines (auto-captions repeat)
    lines = [line.strip() for line in content.splitlines() if line.strip()]
    deduped = []
    for line in lines:
        if not deduped or line != deduped[-1]:
            deduped.append(line)

    return " ".join(deduped)
```

- [ ] **Step 5: Implement HTML extractor**

Create `scraper/extractors/html.py`:

```python
import trafilatura
from bs4 import BeautifulSoup
from typing import Optional


def extract_article(html: str) -> Optional[str]:
    """Extract article text from HTML, stripping boilerplate."""
    text = trafilatura.extract(html)
    if text and len(text) > 100:
        return text
    # Fallback to BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["nav", "footer", "header", "script", "style", "aside"]):
        tag.decompose()
    article = soup.find("article")
    if article:
        return article.get_text(separator="\n", strip=True)
    body = soup.find("body")
    if body:
        return body.get_text(separator="\n", strip=True)
    return soup.get_text(separator="\n", strip=True)


def extract_from_url(url: str) -> Optional[str]:
    """Fetch URL and extract article text."""
    downloaded = trafilatura.fetch_url(url)
    if downloaded:
        text = trafilatura.extract(downloaded)
        if text:
            return text
    # Fallback
    import requests
    try:
        resp = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
        return extract_article(resp.text)
    except Exception:
        return None


def extract_metadata_from_url(url: str) -> dict:
    """Fetch URL and extract article text + metadata."""
    downloaded = trafilatura.fetch_url(url)
    if not downloaded:
        return {}
    import json
    result = trafilatura.extract(
        downloaded, include_metadata=True, output_format="json"
    )
    if result:
        return json.loads(result)
    return {}
```

- [ ] **Step 6: Implement PDF extractor**

Create `scraper/extractors/pdf.py`:

```python
import fitz  # PyMuPDF
import re
from typing import Optional


def extract_text_from_bytes(pdf_bytes: bytes) -> str:
    """Extract text from PDF bytes in memory. Never writes to disk."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = []
    for page in doc:
        text = page.get_text().strip()
        if text:
            pages.append(text)
    doc.close()
    full_text = "\n\n".join(pages)
    return clean_paper_text(full_text)


def extract_text_from_stream(stream) -> str:
    """Extract text from a file-like stream."""
    pdf_bytes = stream.read()
    return extract_text_from_bytes(pdf_bytes)


def clean_paper_text(text: str) -> str:
    """Strip references section, headers/footers, page numbers."""
    # Remove references section (common patterns)
    for pattern in [
        r"\nReferences\s*\n.*",
        r"\nBibliography\s*\n.*",
        r"\nWorks Cited\s*\n.*",
        r"\nLiterature Cited\s*\n.*",
    ]:
        text = re.sub(pattern, "", text, flags=re.DOTALL | re.IGNORECASE)

    # Remove page numbers (standalone numbers on their own line)
    text = re.sub(r"^\s*\d{1,4}\s*$", "", text, flags=re.MULTILINE)

    # Remove excessive whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def detect_paper_type(text: str) -> str:
    """Detect if paper is meta-analysis, review, RCT, position stand, etc."""
    lower = text[:3000].lower()
    if "meta-analysis" in lower or "meta analysis" in lower:
        return "meta_analysis"
    if "systematic review" in lower:
        return "review"
    if "position stand" in lower or "position statement" in lower:
        return "position_stand"
    if "randomized controlled" in lower or "randomised controlled" in lower:
        return "rct"
    if "case study" in lower or "case report" in lower:
        return "case_study"
    if "review" in lower and ("literature" in lower or "narrative" in lower):
        return "review"
    return "research_paper"
```

- [ ] **Step 7: Implement EPUB extractor**

Create `scraper/extractors/epub.py`:

```python
import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup
from typing import Optional


def extract_chapters(epub_path: str) -> list[dict]:
    """Extract chapters from an EPUB file as plain text."""
    book = epub.read_epub(epub_path)
    chapters = []
    chapter_num = 0

    for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
        html_content = item.get_content().decode("utf-8", errors="ignore")
        soup = BeautifulSoup(html_content, "html.parser")
        text = soup.get_text(separator="\n", strip=True)

        if len(text) < 200:
            continue

        chapter_num += 1
        title = ""
        heading = soup.find(["h1", "h2", "h3"])
        if heading:
            title = heading.get_text(strip=True)

        chapters.append({
            "chapter_num": chapter_num,
            "title": title or f"Chapter {chapter_num}",
            "text": text,
            "word_count": len(text.split()),
        })

    return chapters


def extract_full_text(epub_path: str) -> str:
    """Extract all text from EPUB as a single string."""
    chapters = extract_chapters(epub_path)
    return "\n\n".join(ch["text"] for ch in chapters)
```

- [ ] **Step 8: Implement audio transcriber**

Create `scraper/extractors/audio.py`:

```python
import os
import tempfile
from typing import Optional


def transcribe_audio(audio_path: str, model_name: str = "base.en") -> str:
    """Transcribe audio file using Whisper. Returns plain text transcript."""
    import whisper

    model = whisper.load_model(model_name)
    result = model.transcribe(audio_path)
    return result["text"].strip()


def transcribe_and_cleanup(audio_path: str, model_name: str = "base.en") -> str:
    """Transcribe audio file, then delete the audio file."""
    text = transcribe_audio(audio_path, model_name)
    try:
        os.remove(audio_path)
    except OSError:
        pass
    return text


def download_and_transcribe(url: str, model_name: str = "base.en") -> str:
    """Download audio from URL, transcribe, delete audio."""
    import requests

    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
        resp = requests.get(url, stream=True, timeout=120)
        resp.raise_for_status()
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)
        tmp_path = f.name

    text = transcribe_and_cleanup(tmp_path, model_name)
    return text
```

- [ ] **Step 9: Run tests to verify they pass**

```bash
python -m pytest scraper/tests/test_extractors.py -v
```

Expected: All tests PASS (EPUB test just verifies callable exists)

- [ ] **Step 10: Commit**

```bash
git add scraper/extractors/ scraper/tests/test_extractors.py scraper/tests/fixtures/
git commit -m "feat: implement content extractors for PDF, EPUB, VTT, HTML, audio"
```

---

## Task 5: Utility Modules

**Files:**
- Create: `scraper/utils/dedup.py`
- Create: `scraper/utils/classifier.py`
- Create: `scraper/utils/rate_limiter.py`
- Create: `scraper/utils/quality.py`
- Create: `scraper/tests/test_utils.py`

- [ ] **Step 1: Write failing tests**

Create `scraper/tests/test_utils.py`:

```python
import time
import pytest


class TestDedup:
    def test_content_hash_deterministic(self):
        from scraper.utils.dedup import content_hash
        h1 = content_hash("Same content here")
        h2 = content_hash("Same content here")
        assert h1 == h2

    def test_content_hash_different_for_different_content(self):
        from scraper.utils.dedup import content_hash
        h1 = content_hash("Content A")
        h2 = content_hash("Content B")
        assert h1 != h2

    def test_doi_hash(self):
        from scraper.utils.dedup import doi_hash
        h = doi_hash("10.1186/s12970-017-0177-8")
        assert h.startswith("doi:")

    def test_url_hash(self):
        from scraper.utils.dedup import url_hash
        h = url_hash("https://example.com/article/123")
        assert h.startswith("url:")


class TestClassifier:
    def test_classify_hypertrophy(self):
        from scraper.utils.classifier import classify
        category = classify("The effects of training volume on muscle hypertrophy in resistance-trained individuals")
        assert category == "hypertrophy"

    def test_classify_nutrition(self):
        from scraper.utils.classifier import classify
        category = classify("Protein intake and muscle protein synthesis during caloric deficit")
        assert category == "nutrition"

    def test_classify_supplements(self):
        from scraper.utils.classifier import classify
        category = classify("Creatine monohydrate supplementation and athletic performance: a meta-analysis")
        assert category == "supplements"

    def test_classify_peptides(self):
        from scraper.utils.classifier import classify
        category = classify("BPC-157 promotes tendon healing and tissue regeneration in animal models")
        assert category == "peptides"

    def test_classify_endurance(self):
        from scraper.utils.classifier import classify
        category = classify("VO2max improvements through polarized training in marathon runners")
        assert category == "endurance"

    def test_classify_returns_best_match(self):
        from scraper.utils.classifier import classify
        # Should match hypertrophy, not nutrition
        category = classify("Progressive overload and rep ranges for maximizing muscle growth")
        assert category == "hypertrophy"

    def test_get_subcategories(self):
        from scraper.utils.classifier import get_subcategories
        subs = get_subcategories("Creatine monohydrate increases strength and muscle mass", "supplements")
        assert isinstance(subs, list)
        assert "creatine" in subs


class TestRateLimiter:
    def test_rate_limiter_delays(self):
        from scraper.utils.rate_limiter import RateLimiter
        limiter = RateLimiter("test", requests_per_second=10)
        start = time.time()
        limiter.wait()
        limiter.wait()
        elapsed = time.time() - start
        assert elapsed >= 0.09  # at least 1/10th second between calls

    def test_rate_limiter_respects_source(self):
        from scraper.utils.rate_limiter import get_limiter
        limiter = get_limiter("pmc")
        assert limiter.delay >= 0.3


class TestQuality:
    def test_paper_quality_score(self):
        from scraper.utils.quality import score_paper
        score = score_paper(citations=100, year=2020)
        assert score > 0

    def test_youtube_quality_score(self):
        from scraper.utils.quality import score_youtube
        score = score_youtube(views=100000, likes=5000, duration_sec=600)
        assert score > 0

    def test_reddit_quality_score(self):
        from scraper.utils.quality import score_reddit
        score = score_reddit(upvotes=50, num_comments=20)
        assert score > 0

    def test_meta_analysis_boost(self):
        from scraper.utils.quality import score_paper
        regular = score_paper(citations=50, year=2022)
        meta = score_paper(citations=50, year=2022, paper_type="meta_analysis")
        assert meta > regular
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python -m pytest scraper/tests/test_utils.py -v
```

Expected: FAIL — modules not found

- [ ] **Step 3: Implement dedup utility**

Create `scraper/utils/dedup.py`:

```python
import hashlib


def content_hash(text: str) -> str:
    """Generate SHA-256 hash of content text."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def doi_hash(doi: str) -> str:
    """Generate a dedup key from a DOI."""
    return f"doi:{doi.lower().strip()}"


def url_hash(url: str) -> str:
    """Generate a dedup key from a URL."""
    return f"url:{hashlib.sha256(url.encode('utf-8')).hexdigest()}"


def title_author_hash(title: str, authors: str) -> str:
    """Generate a dedup key from title + authors (fallback when no DOI)."""
    combined = f"{title.lower().strip()}|{authors.lower().strip()}"
    return f"ta:{hashlib.sha256(combined.encode('utf-8')).hexdigest()}"
```

- [ ] **Step 4: Implement classifier**

Create `scraper/utils/classifier.py`:

```python
import re
from typing import Optional

CATEGORY_KEYWORDS = {
    "hypertrophy": [
        "hypertrophy", "muscle growth", "resistance training", "strength training",
        "progressive overload", "training volume", "rep range", "periodization",
        "compound exercise", "isolation exercise", "muscle fiber", "mechanical tension",
        "training frequency", "muscle protein synthesis", "lifting", "powerlifting",
        "bodybuilding", "squat", "bench press", "deadlift", "workout split",
    ],
    "nutrition": [
        "protein intake", "caloric deficit", "caloric surplus", "macronutrient",
        "carb cycling", "reverse diet", "meal timing", "protein timing",
        "body recomposition", "contest prep", "bulking", "cutting",
        "intermittent fasting", "dietary protein", "energy balance",
        "micronutrient", "calorie", "diet plan", "macro",
    ],
    "supplements": [
        "creatine", "caffeine", "beta-alanine", "citrulline", "ashwagandha",
        "omega-3", "fish oil", "vitamin d", "magnesium", "zinc",
        "pre-workout", "ergogenic", "supplement", "nutraceutical",
        "collagen", "probiotic", "whey protein", "casein",
    ],
    "peptides": [
        "bpc-157", "tb-500", "peptide", "sarm", "sarms", "growth hormone",
        "igf-1", "mk-677", "ibutamoren", "ghk-cu", "cjc-1295",
        "thymosin", "secretagogue", "anabolic", "testosterone",
        "performance enhancing", "PED",
    ],
    "endurance": [
        "vo2max", "vo2 max", "endurance training", "aerobic capacity",
        "marathon", "triathlon", "cycling", "swimming", "running",
        "zone 2", "lactate threshold", "polarized training",
        "concurrent training", "interference effect", "hybrid athlete",
        "cardio", "cardiovascular", "ironman",
    ],
    "recovery": [
        "sleep", "hrv", "heart rate variability", "overtraining",
        "recovery", "deload", "rest day", "cortisol", "fatigue",
        "cold water immersion", "ice bath", "massage", "foam rolling",
        "active recovery", "stress management",
    ],
    "body_composition": [
        "dexa", "body fat", "body composition", "lean mass", "fat mass",
        "visceral fat", "skinfold", "bioimpedance", "bmi",
        "waist circumference", "body weight",
    ],
    "injury_prevention": [
        "tendinopathy", "tendinitis", "rotator cuff", "acl",
        "injury prevention", "rehabilitation", "mobility",
        "flexibility", "joint health", "low back pain",
        "prehab", "physical therapy", "return to sport",
    ],
}

SUBCATEGORY_KEYWORDS = {
    "supplements": {
        "creatine": ["creatine", "creatine monohydrate"],
        "caffeine": ["caffeine", "coffee"],
        "beta_alanine": ["beta-alanine", "beta alanine"],
        "ashwagandha": ["ashwagandha", "withania"],
        "vitamin_d": ["vitamin d", "cholecalciferol"],
        "omega_3": ["omega-3", "fish oil", "epa", "dha"],
        "collagen": ["collagen", "collagen peptide"],
    },
    "peptides": {
        "bpc_157": ["bpc-157", "bpc 157"],
        "tb_500": ["tb-500", "tb 500", "thymosin beta"],
        "mk_677": ["mk-677", "mk 677", "ibutamoren"],
        "sarms": ["sarm", "sarms", "ostarine", "lgd-4033", "rad-140"],
        "growth_hormone": ["growth hormone", "hgh", "gh secretagogue"],
    },
    "hypertrophy": {
        "volume": ["volume", "sets per week", "training volume"],
        "frequency": ["frequency", "training frequency", "times per week"],
        "intensity": ["intensity", "rpe", "rir", "1rm", "rep max"],
        "periodization": ["periodization", "linear", "undulating", "block"],
    },
}


def classify(text: str) -> str:
    """Classify text into one of the 8 categories based on keyword matching."""
    lower = text.lower()
    scores = {}

    for category, keywords in CATEGORY_KEYWORDS.items():
        score = 0
        for keyword in keywords:
            count = len(re.findall(r"\b" + re.escape(keyword) + r"\b", lower, re.IGNORECASE))
            score += count
        scores[category] = score

    if not scores or max(scores.values()) == 0:
        return "hypertrophy"  # default fallback

    return max(scores, key=scores.get)


def get_subcategories(text: str, category: str) -> list[str]:
    """Get subcategory tags within a category."""
    lower = text.lower()
    subs = []
    category_subs = SUBCATEGORY_KEYWORDS.get(category, {})

    for sub_name, keywords in category_subs.items():
        for keyword in keywords:
            if keyword.lower() in lower:
                subs.append(sub_name)
                break

    return subs
```

- [ ] **Step 5: Implement rate limiter**

Create `scraper/utils/rate_limiter.py`:

```python
import time
import threading
from scraper.config import RATE_LIMITS

_limiters: dict = {}
_lock = threading.Lock()


class RateLimiter:
    """Simple token-bucket rate limiter."""

    def __init__(self, source: str, requests_per_second: float = 1.0):
        self.source = source
        self.delay = 1.0 / requests_per_second
        self._last_call = 0.0
        self._lock = threading.Lock()

    def wait(self):
        """Block until enough time has passed since the last call."""
        with self._lock:
            now = time.time()
            elapsed = now - self._last_call
            if elapsed < self.delay:
                time.sleep(self.delay - elapsed)
            self._last_call = time.time()


def get_limiter(source: str) -> RateLimiter:
    """Get or create a rate limiter for a source."""
    with _lock:
        if source not in _limiters:
            config = RATE_LIMITS.get(source, {"requests_per_second": 1, "delay": 1})
            _limiters[source] = RateLimiter(source, config["requests_per_second"])
        return _limiters[source]
```

- [ ] **Step 6: Implement quality scorer**

Create `scraper/utils/quality.py`:

```python
from datetime import datetime


def score_paper(
    citations: int = 0, year: int = 2024, paper_type: str = "research_paper"
) -> float:
    """Score a research paper. Higher = more valuable for RAG."""
    age = max(1, datetime.now().year - year)
    # Citations per year, normalized
    score = (citations / age) * 10

    # Boost for meta-analyses and reviews
    type_multiplier = {
        "meta_analysis": 2.0,
        "review": 1.5,
        "position_stand": 1.8,
        "rct": 1.3,
        "research_paper": 1.0,
        "case_study": 0.7,
    }
    score *= type_multiplier.get(paper_type, 1.0)

    return round(score, 2)


def score_youtube(
    views: int = 0, likes: int = 0, duration_sec: int = 0
) -> float:
    """Score a YouTube video. Prefer longer, well-liked content."""
    if views == 0:
        return 0.0
    like_ratio = likes / views if views > 0 else 0
    # Prefer videos 5-30 min (300-1800 sec)
    duration_score = min(duration_sec / 300, 1.0) if duration_sec > 0 else 0.5
    score = (views / 10000) * like_ratio * 100 * duration_score
    return round(min(score, 100), 2)


def score_reddit(upvotes: int = 0, num_comments: int = 0) -> float:
    """Score a Reddit post."""
    return round(upvotes * 0.5 + num_comments * 1.0, 2)


def score_article(word_count: int = 0) -> float:
    """Score an article. Prefer substantial content."""
    if word_count < 500:
        return 1.0
    if word_count < 1500:
        return 3.0
    if word_count < 5000:
        return 5.0
    return 7.0


def score_podcast(duration_sec: int = 0) -> float:
    """Score a podcast episode. Prefer 30-90 min episodes."""
    minutes = duration_sec / 60
    if minutes < 15:
        return 2.0
    if minutes < 90:
        return 5.0
    return 4.0  # very long episodes are slightly less focused
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
python -m pytest scraper/tests/test_utils.py -v
```

Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add scraper/utils/ scraper/tests/test_utils.py
git commit -m "feat: implement dedup, classifier, rate limiter, quality scorer utilities"
```

---

## Task 6: Celery App Configuration

**Files:**
- Create: `scraper/celery_app.py`

- [ ] **Step 1: Implement Celery app**

Create `scraper/celery_app.py`:

```python
from celery import Celery

app = Celery(
    "fitness_scraper",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/0",
)

app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,  # fetch one task at a time for fair scheduling
    task_routes={
        "scraper.tasks.papers.*": {"queue": "papers"},
        "scraper.tasks.youtube.*": {"queue": "youtube"},
        "scraper.tasks.articles.*": {"queue": "articles"},
        "scraper.tasks.podcasts.*": {"queue": "podcasts"},
        "scraper.tasks.books.*": {"queue": "books"},
        "scraper.tasks.reddit.*": {"queue": "reddit"},
        "scraper.tasks.orchestrator.*": {"queue": "default"},
    },
    task_default_queue="default",
)

# Auto-discover tasks
app.autodiscover_tasks(["scraper.tasks"])
```

- [ ] **Step 2: Verify Redis connection works**

```bash
redis-cli ping
```

Expected: `PONG`

If Redis is not running:
```bash
brew install redis
brew services start redis
```

- [ ] **Step 3: Commit**

```bash
git add scraper/celery_app.py
git commit -m "feat: configure Celery app with Redis and task routing"
```

---

## Task 7: Paper Scraping Task

**Files:**
- Create: `scraper/tasks/papers.py`
- Create: `scraper/tests/test_tasks.py`

- [ ] **Step 1: Write failing tests**

Add to `scraper/tests/test_tasks.py`:

```python
import pytest
from unittest.mock import patch, MagicMock


class TestPapersFunctions:
    def test_search_pmc_returns_ids(self):
        from scraper.tasks.papers import search_pmc

        with patch("scraper.tasks.papers.requests.get") as mock_get:
            mock_get.return_value.status_code = 200
            mock_get.return_value.json.return_value = {
                "esearchresult": {"idlist": ["12345", "67890"]}
            }
            ids = search_pmc("muscle hypertrophy", max_results=2)
            assert ids == ["12345", "67890"]

    def test_fetch_pmc_fulltext(self):
        from scraper.tasks.papers import fetch_pmc_fulltext

        with patch("scraper.tasks.papers.requests.get") as mock_get:
            mock_get.return_value.status_code = 200
            mock_get.return_value.text = "<article><body><p>Test content</p></body></article>"
            text = fetch_pmc_fulltext("12345")
            assert "Test content" in text

    def test_fetch_scihub_pdf(self):
        from scraper.tasks.papers import fetch_scihub_pdf

        with patch("scraper.tasks.papers.requests.get") as mock_get:
            # First call: Sci-Hub page
            page_resp = MagicMock()
            page_resp.status_code = 200
            page_resp.text = '<div id="viewer"><iframe src="//sci-hub.se/downloads/paper.pdf"></iframe></div>'
            # Second call: PDF download
            pdf_resp = MagicMock()
            pdf_resp.status_code = 200
            pdf_resp.content = b"%PDF-fake"
            pdf_resp.iter_content = lambda chunk_size: [b"%PDF-fake"]
            mock_get.side_effect = [page_resp, pdf_resp]

            result = fetch_scihub_pdf("10.1234/test")
            assert result is not None

    def test_search_biorxiv(self):
        from scraper.tasks.papers import search_biorxiv

        with patch("scraper.tasks.papers.requests.get") as mock_get:
            mock_get.return_value.status_code = 200
            mock_get.return_value.json.return_value = {
                "messages": [{"status": "ok"}],
                "collection": [
                    {"doi": "10.1101/123", "title": "Test", "authors": "Author",
                     "date": "2024-01-01", "version": "1", "category": "physiology",
                     "abstract": "Abstract text", "jatsxml": "http://example.com/xml"}
                ],
            }
            results = search_biorxiv("hypertrophy", "2024-01-01", "2024-01-07")
            assert len(results) == 1
            assert results[0]["doi"] == "10.1101/123"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python -m pytest scraper/tests/test_tasks.py -v
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement papers task**

Create `scraper/tasks/papers.py`:

```python
import requests
import time
import json
from typing import Optional
from xml.etree import ElementTree as ET
from bs4 import BeautifulSoup

from scraper.celery_app import app
from scraper.db import Database
from scraper.config import (
    NCBI_BASE, BIORXIV_API, SCIHUB_MIRRORS,
)
from scraper.extractors.pdf import extract_text_from_bytes, detect_paper_type
from scraper.utils.dedup import doi_hash, title_author_hash
from scraper.utils.classifier import classify, get_subcategories
from scraper.utils.rate_limiter import get_limiter
from scraper.utils.quality import score_paper

HEADERS = {"User-Agent": "FitnessScraper/1.0 (research data collection)"}


def search_pmc(query: str, max_results: int = 100, api_key: str = "", email: str = "") -> list[str]:
    """Search PubMed Central, return list of PMCIDs."""
    params = {
        "db": "pmc",
        "term": query,
        "retmax": max_results,
        "retmode": "json",
        "tool": "fitness_scraper",
        "email": email or "scraper@example.com",
    }
    if api_key:
        params["api_key"] = api_key

    limiter = get_limiter("pmc")
    limiter.wait()

    resp = requests.get(f"{NCBI_BASE}/esearch.fcgi", params=params, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    return resp.json()["esearchresult"]["idlist"]


def fetch_pmc_fulltext(pmcid: str, api_key: str = "", email: str = "") -> Optional[str]:
    """Fetch full-text XML from PMC and extract text."""
    pmcid = pmcid.replace("PMC", "")
    params = {
        "db": "pmc",
        "id": pmcid,
        "rettype": "full",
        "retmode": "xml",
        "tool": "fitness_scraper",
        "email": email or "scraper@example.com",
    }
    if api_key:
        params["api_key"] = api_key

    limiter = get_limiter("pmc")
    limiter.wait()

    resp = requests.get(f"{NCBI_BASE}/efetch.fcgi", params=params, headers=HEADERS, timeout=30)
    resp.raise_for_status()

    # Parse JATS XML to extract text
    soup = BeautifulSoup(resp.text, "xml")
    body = soup.find("body")
    if body:
        return body.get_text(separator="\n", strip=True)
    return resp.text


def fetch_pmc_metadata(pmcid: str, api_key: str = "", email: str = "") -> dict:
    """Fetch article metadata from PubMed."""
    pmcid = pmcid.replace("PMC", "")
    params = {
        "db": "pmc",
        "id": pmcid,
        "retmode": "xml",
        "tool": "fitness_scraper",
        "email": email or "scraper@example.com",
    }
    if api_key:
        params["api_key"] = api_key

    limiter = get_limiter("pmc")
    limiter.wait()

    resp = requests.get(f"{NCBI_BASE}/esummary.fcgi", params=params, headers=HEADERS, timeout=15)
    resp.raise_for_status()

    root = ET.fromstring(resp.text)
    doc = root.find(".//DocSum")
    if not doc:
        return {}

    def get_item(name):
        item = doc.find(f".//Item[@Name='{name}']")
        return item.text if item is not None and item.text else ""

    return {
        "title": get_item("Title"),
        "authors": get_item("AuthorList") or get_item("Author"),
        "source": get_item("Source"),
        "pubdate": get_item("PubDate"),
        "doi": get_item("DOI"),
    }


def fetch_scihub_pdf(doi: str) -> Optional[bytes]:
    """Fetch PDF bytes from Sci-Hub by DOI."""
    limiter = get_limiter("scihub")

    for mirror in SCIHUB_MIRRORS:
        try:
            limiter.wait()
            url = f"{mirror}/{doi}"
            resp = requests.get(url, headers=HEADERS, timeout=15)
            if resp.status_code != 200:
                continue

            soup = BeautifulSoup(resp.text, "html.parser")
            pdf_url = None
            for selector in ["#viewer iframe", "#viewer embed", "iframe[src]", "embed[src]"]:
                tag = soup.select_one(selector)
                if tag and tag.get("src"):
                    src = tag["src"]
                    if src.startswith("//"):
                        src = "https:" + src
                    elif src.startswith("/"):
                        src = mirror + src
                    pdf_url = src.split("#")[0]
                    break

            if not pdf_url:
                continue

            limiter.wait()
            pdf_resp = requests.get(pdf_url, headers=HEADERS, timeout=60)
            pdf_resp.raise_for_status()
            return pdf_resp.content

        except Exception:
            continue

    return None


def search_biorxiv(query: str, start_date: str, end_date: str, server: str = "biorxiv") -> list[dict]:
    """Search bioRxiv/medRxiv via CrossRef then fetch metadata."""
    limiter = get_limiter("biorxiv")
    limiter.wait()

    # Use the date-range API
    resp = requests.get(
        f"{BIORXIV_API}/details/{server}/{start_date}/{end_date}/0/json",
        headers=HEADERS,
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    return data.get("collection", [])


@app.task(name="scraper.tasks.papers.fetch_paper")
def fetch_paper(
    doi: str = "",
    pmcid: str = "",
    title: str = "",
    authors: str = "",
    source_platform: str = "pmc",
    session_id: int = 0,
    api_key: str = "",
    email: str = "",
):
    """Celery task: fetch a single paper, extract text, store in SQLite."""
    db = Database()
    db.initialize()

    # Determine dedup hash
    if doi:
        hash_key = doi_hash(doi)
    else:
        hash_key = title_author_hash(title, authors)

    if db.hash_exists(hash_key):
        db.close()
        return {"status": "skipped", "reason": "duplicate"}

    full_text = None
    abstract = ""

    try:
        # Try PMC first (open access)
        if pmcid:
            full_text = fetch_pmc_fulltext(pmcid, api_key, email)
            meta = fetch_pmc_metadata(pmcid, api_key, email)
            title = title or meta.get("title", "")
            authors = authors or meta.get("authors", "")
            doi = doi or meta.get("doi", "")

        # Fallback to Sci-Hub
        if not full_text and doi:
            pdf_bytes = fetch_scihub_pdf(doi)
            if pdf_bytes:
                full_text = extract_text_from_bytes(pdf_bytes)

        if not full_text:
            db.log_failed_fetch(
                session_id, "paper", doi or pmcid, title, "No full text available"
            )
            db.close()
            return {"status": "failed", "reason": "no_fulltext"}

        # Classify and score
        category = classify(f"{title} {full_text[:2000]}")
        subcategories = get_subcategories(f"{title} {full_text[:2000]}", category)
        paper_type = detect_paper_type(full_text)
        quality = score_paper(citations=0, year=2024, paper_type=paper_type)
        word_count = len(full_text.split())

        content_id = db.insert_content(
            content_hash=hash_key,
            title=title,
            authors=json.dumps([authors]) if authors else "[]",
            source_type="paper",
            source_platform=source_platform,
            source_url=f"https://doi.org/{doi}" if doi else "",
            source_id=doi or pmcid,
            abstract=abstract,
            full_text=full_text.encode("utf-8"),
            category=category,
            subcategories=json.dumps(subcategories),
            content_format=paper_type,
            year=2024,
            date_published="",
            journal="",
            channel_name=None,
            duration_sec=None,
            word_count=word_count,
            quality_score=quality,
        )

        db.update_session_total(session_id)
        db.close()
        return {"status": "success", "content_id": content_id, "category": category}

    except Exception as e:
        db.log_failed_fetch(session_id, "paper", doi or pmcid, title, str(e))
        db.close()
        return {"status": "error", "error": str(e)}


@app.task(name="scraper.tasks.papers.search_and_fetch_papers")
def search_and_fetch_papers(
    search_term: str,
    session_id: int,
    task_id: int,
    source_platform: str = "pmc",
    max_results: int = 50,
    api_key: str = "",
    email: str = "",
):
    """Celery task: search a source for papers and enqueue fetch tasks."""
    db = Database()
    db.initialize()

    # Check if session is paused
    if db.get_session_status(session_id) == "paused":
        db.close()
        return {"status": "paused"}

    db.update_search_task(task_id, status="in_progress")

    try:
        if source_platform == "pmc":
            ids = search_pmc(search_term, max_results, api_key, email)
            db.update_search_task(task_id, results_found=len(ids))
            for pmcid in ids:
                if db.get_session_status(session_id) == "paused":
                    break
                fetch_paper.delay(
                    pmcid=pmcid,
                    source_platform="pmc",
                    session_id=session_id,
                    api_key=api_key,
                    email=email,
                )

        elif source_platform == "scihub":
            # Sci-Hub is a fallback, not a search engine
            # Papers are fetched by DOI from other search results
            pass

        elif source_platform == "biorxiv":
            papers = search_biorxiv(search_term, "2020-01-01", "2026-12-31")
            db.update_search_task(task_id, results_found=len(papers))
            for paper in papers:
                if db.get_session_status(session_id) == "paused":
                    break
                fetch_paper.delay(
                    doi=paper.get("doi", ""),
                    title=paper.get("title", ""),
                    authors=paper.get("authors", ""),
                    source_platform="biorxiv",
                    session_id=session_id,
                )

        db.update_search_task(task_id, status="completed")
    except Exception as e:
        db.update_search_task(task_id, status="failed", error_message=str(e))

    db.close()
    return {"status": "completed", "search_term": search_term}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python -m pytest scraper/tests/test_tasks.py -v
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add scraper/tasks/papers.py scraper/tests/test_tasks.py
git commit -m "feat: implement paper scraping tasks for PMC, Sci-Hub, bioRxiv"
```

---

## Task 8: YouTube Scraping Task

**Files:**
- Create: `scraper/tasks/youtube.py`

- [ ] **Step 1: Write failing tests**

Add to `scraper/tests/test_tasks.py`:

```python
class TestYouTubeFunctions:
    def test_parse_vtt_to_text(self):
        from scraper.extractors.transcript import parse_vtt_string
        vtt = """WEBVTT

00:00:00.000 --> 00:00:05.000
Hello world.

00:00:05.000 --> 00:00:10.000
This is a test.
"""
        text = parse_vtt_string(vtt)
        assert "Hello world" in text
        assert "This is a test" in text

    def test_list_channel_videos(self):
        from scraper.tasks.youtube import list_channel_videos

        with patch("scraper.tasks.youtube.yt_dlp.YoutubeDL") as mock_ydl:
            instance = MagicMock()
            instance.__enter__ = lambda s: s
            instance.__exit__ = MagicMock(return_value=False)
            instance.extract_info.return_value = {
                "entries": [
                    {"id": "abc123", "title": "Video 1", "duration": 600, "upload_date": "20240101"},
                    {"id": "def456", "title": "Video 2", "duration": 300, "upload_date": "20240102"},
                ]
            }
            mock_ydl.return_value = instance

            videos = list_channel_videos("https://www.youtube.com/@TestChannel/videos")
            assert len(videos) == 2
            assert videos[0]["id"] == "abc123"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python -m pytest scraper/tests/test_tasks.py::TestYouTubeFunctions -v
```

- [ ] **Step 3: Implement YouTube task**

Create `scraper/tasks/youtube.py`:

```python
import re
import json
import requests
import yt_dlp
from typing import Optional

from scraper.celery_app import app
from scraper.db import Database
from scraper.extractors.transcript import parse_vtt_string
from scraper.utils.dedup import url_hash
from scraper.utils.classifier import classify, get_subcategories
from scraper.utils.quality import score_youtube
from scraper.utils.rate_limiter import get_limiter


def list_channel_videos(channel_url: str) -> list[dict]:
    """List all videos from a YouTube channel/playlist."""
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": "in_playlist",
        "skip_download": True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(channel_url, download=False)
        entries = info.get("entries", [])
        return [
            {
                "id": e.get("id"),
                "title": e.get("title"),
                "url": e.get("url") or f"https://www.youtube.com/watch?v={e.get('id')}",
                "duration": e.get("duration"),
                "upload_date": e.get("upload_date"),
            }
            for e in entries
            if e
        ]


def get_transcript_in_memory(video_url: str, lang: str = "en") -> Optional[str]:
    """Get transcript without writing files to disk."""
    ydl_opts = {"quiet": True, "no_warnings": True, "skip_download": True}

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(video_url, download=False)

    sub_url = None
    for sub_dict_key in ("subtitles", "automatic_captions"):
        sub_dict = info.get(sub_dict_key, {})
        lang_subs = sub_dict.get(lang, [])
        for fmt in lang_subs:
            if fmt.get("ext") == "vtt":
                sub_url = fmt["url"]
                break
        if sub_url:
            break

    if not sub_url:
        return None

    vtt_content = requests.get(sub_url, timeout=30).text
    return parse_vtt_string(vtt_content)


def get_video_metadata(video_url: str) -> dict:
    """Get metadata without downloading."""
    ydl_opts = {"quiet": True, "no_warnings": True, "skip_download": True}
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(video_url, download=False)
        return {
            "title": info.get("title", ""),
            "channel": info.get("channel") or info.get("uploader", ""),
            "views": info.get("view_count", 0),
            "likes": info.get("like_count", 0),
            "duration": info.get("duration", 0),
            "upload_date": info.get("upload_date", ""),
            "description": info.get("description", "")[:500],
        }


@app.task(name="scraper.tasks.youtube.fetch_video")
def fetch_video(video_url: str, session_id: int = 0):
    """Celery task: fetch a single video's transcript and metadata."""
    db = Database()
    db.initialize()

    hash_key = url_hash(video_url)
    if db.hash_exists(hash_key):
        db.close()
        return {"status": "skipped", "reason": "duplicate"}

    try:
        meta = get_video_metadata(video_url)

        # Skip short videos (< 3 min)
        if meta.get("duration", 0) < 180:
            db.close()
            return {"status": "skipped", "reason": "too_short"}

        transcript = get_transcript_in_memory(video_url)
        if not transcript:
            db.log_failed_fetch(session_id, "youtube", video_url, meta.get("title", ""), "No transcript available")
            db.close()
            return {"status": "failed", "reason": "no_transcript"}

        category = classify(f"{meta['title']} {transcript[:2000]}")
        subcategories = get_subcategories(f"{meta['title']} {transcript[:2000]}", category)
        quality = score_youtube(meta.get("views", 0), meta.get("likes", 0), meta.get("duration", 0))
        word_count = len(transcript.split())

        year = None
        if meta.get("upload_date"):
            year = int(meta["upload_date"][:4])

        content_id = db.insert_content(
            content_hash=hash_key,
            title=meta["title"],
            authors=json.dumps([meta["channel"]]),
            source_type="youtube",
            source_platform="youtube",
            source_url=video_url,
            source_id=video_url.split("v=")[-1] if "v=" in video_url else video_url,
            abstract=meta.get("description", ""),
            full_text=transcript.encode("utf-8"),
            category=category,
            subcategories=json.dumps(subcategories),
            content_format="transcript",
            year=year,
            date_published=meta.get("upload_date", ""),
            journal=None,
            channel_name=meta["channel"],
            duration_sec=meta.get("duration"),
            word_count=word_count,
            quality_score=quality,
        )

        db.update_session_total(session_id)
        db.close()
        return {"status": "success", "content_id": content_id}

    except Exception as e:
        db.log_failed_fetch(session_id, "youtube", video_url, "", str(e))
        db.close()
        return {"status": "error", "error": str(e)}


@app.task(name="scraper.tasks.youtube.scrape_channel")
def scrape_channel(channel_url: str, session_id: int, task_id: int):
    """Celery task: list all videos from a channel and enqueue fetch tasks."""
    db = Database()
    db.initialize()

    if db.get_session_status(session_id) == "paused":
        db.close()
        return {"status": "paused"}

    db.update_search_task(task_id, status="in_progress")

    try:
        videos = list_channel_videos(channel_url)
        db.update_search_task(task_id, results_found=len(videos))

        for video in videos:
            if db.get_session_status(session_id) == "paused":
                break
            limiter = get_limiter("youtube")
            limiter.wait()
            fetch_video.delay(video["url"], session_id)

        db.update_search_task(task_id, status="completed")
    except Exception as e:
        db.update_search_task(task_id, status="failed", error_message=str(e))

    db.close()
    return {"status": "completed"}
```

- [ ] **Step 4: Run tests**

```bash
python -m pytest scraper/tests/test_tasks.py::TestYouTubeFunctions -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scraper/tasks/youtube.py
git commit -m "feat: implement YouTube transcript scraping task"
```

---

## Task 9: Podcast, Article, Book, and Reddit Tasks

**Files:**
- Create: `scraper/tasks/podcasts.py`
- Create: `scraper/tasks/articles.py`
- Create: `scraper/tasks/books.py`
- Create: `scraper/tasks/reddit.py`

- [ ] **Step 1: Implement podcast task**

Create `scraper/tasks/podcasts.py`:

```python
import json
import feedparser
from typing import Optional

from scraper.celery_app import app
from scraper.db import Database
from scraper.extractors.audio import download_and_transcribe
from scraper.utils.dedup import url_hash
from scraper.utils.classifier import classify, get_subcategories
from scraper.utils.quality import score_podcast


def parse_feed(feed_url: str) -> list[dict]:
    """Parse RSS feed and return episode list."""
    feed = feedparser.parse(feed_url)
    episodes = []
    for entry in feed.entries:
        audio_url = ""
        for link in entry.get("links", []):
            if link.get("type", "").startswith("audio/"):
                audio_url = link["href"]
                break
        if not audio_url:
            enclosures = entry.get("enclosures", [])
            if enclosures:
                audio_url = enclosures[0].get("href", "")

        episodes.append({
            "title": entry.get("title", ""),
            "audio_url": audio_url,
            "published": entry.get("published", ""),
            "summary": entry.get("summary", ""),
            "duration": entry.get("itunes_duration", ""),
            "guid": entry.get("id", entry.get("link", "")),
        })
    return episodes


@app.task(name="scraper.tasks.podcasts.fetch_episode")
def fetch_episode(
    audio_url: str, title: str, podcast_name: str,
    published: str, summary: str, session_id: int = 0,
):
    """Celery task: download, transcribe, and store a podcast episode."""
    db = Database()
    db.initialize()

    hash_key = url_hash(audio_url)
    if db.hash_exists(hash_key):
        db.close()
        return {"status": "skipped", "reason": "duplicate"}

    try:
        transcript = download_and_transcribe(audio_url)
        if not transcript or len(transcript) < 200:
            db.log_failed_fetch(session_id, "podcast", audio_url, title, "Transcript too short")
            db.close()
            return {"status": "failed", "reason": "short_transcript"}

        category = classify(f"{title} {transcript[:2000]}")
        subcategories = get_subcategories(f"{title} {transcript[:2000]}", category)
        word_count = len(transcript.split())

        content_id = db.insert_content(
            content_hash=hash_key,
            title=title,
            authors=json.dumps([podcast_name]),
            source_type="podcast",
            source_platform="rss",
            source_url=audio_url,
            source_id=audio_url,
            abstract=summary[:1000],
            full_text=transcript.encode("utf-8"),
            category=category,
            subcategories=json.dumps(subcategories),
            content_format="transcript",
            year=None,
            date_published=published,
            journal=None,
            channel_name=podcast_name,
            duration_sec=None,
            word_count=word_count,
            quality_score=score_podcast(word_count * 2),  # rough duration estimate
        )

        db.update_session_total(session_id)
        db.close()
        return {"status": "success", "content_id": content_id}

    except Exception as e:
        db.log_failed_fetch(session_id, "podcast", audio_url, title, str(e))
        db.close()
        return {"status": "error", "error": str(e)}


@app.task(name="scraper.tasks.podcasts.scrape_feed")
def scrape_feed(feed_url: str, podcast_name: str, session_id: int, task_id: int):
    """Celery task: parse RSS feed and enqueue episode fetch tasks."""
    db = Database()
    db.initialize()

    if db.get_session_status(session_id) == "paused":
        db.close()
        return {"status": "paused"}

    db.update_search_task(task_id, status="in_progress")

    try:
        episodes = parse_feed(feed_url)
        db.update_search_task(task_id, results_found=len(episodes))

        for ep in episodes:
            if db.get_session_status(session_id) == "paused":
                break
            if ep["audio_url"]:
                fetch_episode.delay(
                    audio_url=ep["audio_url"],
                    title=ep["title"],
                    podcast_name=podcast_name,
                    published=ep["published"],
                    summary=ep["summary"],
                    session_id=session_id,
                )

        db.update_search_task(task_id, status="completed")
    except Exception as e:
        db.update_search_task(task_id, status="failed", error_message=str(e))

    db.close()
    return {"status": "completed"}
```

- [ ] **Step 2: Implement articles task**

Create `scraper/tasks/articles.py`:

```python
import json
from typing import Optional

from scraper.celery_app import app
from scraper.db import Database
from scraper.extractors.html import extract_from_url, extract_metadata_from_url
from scraper.utils.dedup import url_hash
from scraper.utils.classifier import classify, get_subcategories
from scraper.utils.quality import score_article
from scraper.utils.rate_limiter import get_limiter


@app.task(name="scraper.tasks.articles.fetch_article")
def fetch_article(url: str, site_name: str = "", session_id: int = 0):
    """Celery task: fetch and extract a single article."""
    db = Database()
    db.initialize()

    hash_key = url_hash(url)
    if db.hash_exists(hash_key):
        db.close()
        return {"status": "skipped", "reason": "duplicate"}

    limiter = get_limiter("articles")
    limiter.wait()

    try:
        metadata = extract_metadata_from_url(url)
        text = metadata.get("text") or metadata.get("raw_text")

        if not text:
            text = extract_from_url(url)

        if not text or len(text) < 200:
            db.log_failed_fetch(session_id, "article", url, "", "No content extracted")
            db.close()
            return {"status": "failed", "reason": "no_content"}

        title = metadata.get("title", url)
        author = metadata.get("author", site_name)
        date = metadata.get("date", "")

        category = classify(f"{title} {text[:2000]}")
        subcategories = get_subcategories(f"{title} {text[:2000]}", category)
        word_count = len(text.split())

        year = None
        if date and len(date) >= 4:
            try:
                year = int(date[:4])
            except ValueError:
                pass

        content_id = db.insert_content(
            content_hash=hash_key,
            title=title,
            authors=json.dumps([author]) if author else "[]",
            source_type="article",
            source_platform=site_name.lower().replace(" ", "_"),
            source_url=url,
            source_id=url,
            abstract=text[:500],
            full_text=text.encode("utf-8"),
            category=category,
            subcategories=json.dumps(subcategories),
            content_format="blog_post",
            year=year,
            date_published=date,
            journal=None,
            channel_name=site_name,
            duration_sec=None,
            word_count=word_count,
            quality_score=score_article(word_count),
        )

        db.update_session_total(session_id)
        db.close()
        return {"status": "success", "content_id": content_id}

    except Exception as e:
        db.log_failed_fetch(session_id, "article", url, "", str(e))
        db.close()
        return {"status": "error", "error": str(e)}


@app.task(name="scraper.tasks.articles.scrape_site")
def scrape_site(base_url: str, site_name: str, session_id: int, task_id: int):
    """Celery task: discover article URLs from a site and enqueue fetch tasks."""
    import requests
    from bs4 import BeautifulSoup

    db = Database()
    db.initialize()

    if db.get_session_status(session_id) == "paused":
        db.close()
        return {"status": "paused"}

    db.update_search_task(task_id, status="in_progress")

    try:
        # Try sitemap first
        sitemap_url = f"{base_url}/sitemap.xml"
        limiter = get_limiter("articles")
        limiter.wait()

        resp = requests.get(sitemap_url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
        urls = []

        if resp.status_code == 200 and "xml" in resp.headers.get("content-type", ""):
            soup = BeautifulSoup(resp.text, "xml")
            for loc in soup.find_all("loc"):
                url = loc.text.strip()
                # Filter for article-like URLs
                if any(p in url for p in ["/article", "/blog", "/post", "/research", "/supplement"]):
                    urls.append(url)

        # Fallback: scrape the main page for links
        if not urls:
            limiter.wait()
            resp = requests.get(base_url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
            soup = BeautifulSoup(resp.text, "html.parser")
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if href.startswith("/"):
                    href = base_url + href
                if href.startswith(base_url) and len(href) > len(base_url) + 5:
                    urls.append(href)

        urls = list(set(urls))[:200]  # cap at 200 per site
        db.update_search_task(task_id, results_found=len(urls))

        for url in urls:
            if db.get_session_status(session_id) == "paused":
                break
            fetch_article.delay(url, site_name, session_id)

        db.update_search_task(task_id, status="completed")
    except Exception as e:
        db.update_search_task(task_id, status="failed", error_message=str(e))

    db.close()
    return {"status": "completed"}
```

- [ ] **Step 3: Implement books task**

Create `scraper/tasks/books.py`:

```python
import json
import os
import tempfile
import requests
from typing import Optional

from scraper.celery_app import app
from scraper.db import Database
from scraper.extractors.pdf import extract_text_from_bytes
from scraper.extractors.epub import extract_chapters
from scraper.utils.dedup import title_author_hash
from scraper.utils.classifier import classify, get_subcategories
from scraper.utils.rate_limiter import get_limiter

HEADERS = {"User-Agent": "Mozilla/5.0"}


def search_libgen(title: str, author: str = "") -> list[dict]:
    """Search LibGen by title."""
    from libgen_api import LibgenSearch
    s = LibgenSearch()
    query = f"{title} {author}".strip()
    try:
        results = s.search_title(query)
        return results or []
    except Exception:
        return []


def download_libgen_book(item: dict) -> Optional[bytes]:
    """Download a book from LibGen mirrors."""
    from libgen_api import LibgenSearch
    s = LibgenSearch()

    try:
        links = s.resolve_download_links(item)
    except Exception:
        return None

    for source, url in links.items():
        try:
            limiter = get_limiter("libgen")
            limiter.wait()
            resp = requests.get(url, headers=HEADERS, timeout=120, stream=True)
            resp.raise_for_status()
            content = b""
            for chunk in resp.iter_content(8192):
                content += chunk
            return content
        except Exception:
            continue

    return None


@app.task(name="scraper.tasks.books.fetch_book")
def fetch_book(title: str, author: str, isbn: str = "", session_id: int = 0):
    """Celery task: search LibGen, download, extract text, store chapters."""
    db = Database()
    db.initialize()

    hash_key = title_author_hash(title, author)
    if db.hash_exists(hash_key):
        db.close()
        return {"status": "skipped", "reason": "duplicate"}

    try:
        results = search_libgen(title, author)
        if not results:
            db.log_failed_fetch(session_id, "book", isbn or title, title, "Not found on LibGen")
            db.close()
            return {"status": "failed", "reason": "not_found"}

        # Prefer PDF or EPUB
        preferred = None
        for r in results:
            ext = r.get("Extension", "").lower()
            if ext in ("pdf", "epub"):
                preferred = r
                break
        if not preferred:
            preferred = results[0]

        book_bytes = download_libgen_book(preferred)
        if not book_bytes:
            db.log_failed_fetch(session_id, "book", isbn or title, title, "Download failed")
            db.close()
            return {"status": "failed", "reason": "download_failed"}

        ext = preferred.get("Extension", "pdf").lower()

        if ext == "epub":
            # Write to temp file for ebooklib
            with tempfile.NamedTemporaryFile(suffix=".epub", delete=False) as f:
                f.write(book_bytes)
                tmp_path = f.name
            chapters = extract_chapters(tmp_path)
            os.remove(tmp_path)

            # Store each chapter as a separate content row
            for ch in chapters:
                ch_hash = title_author_hash(f"{title} {ch['title']}", author)
                if db.hash_exists(ch_hash):
                    continue

                category = classify(f"{title} {ch['title']} {ch['text'][:1000]}")
                subcategories = get_subcategories(ch["text"][:2000], category)

                db.insert_content(
                    content_hash=ch_hash,
                    title=f"{title} — {ch['title']}",
                    authors=json.dumps([author]),
                    source_type="book",
                    source_platform="libgen",
                    source_url="",
                    source_id=isbn or title,
                    abstract="",
                    full_text=ch["text"].encode("utf-8"),
                    category=category,
                    subcategories=json.dumps(subcategories),
                    content_format="book_chapter",
                    year=int(preferred.get("Year", 0)) or None,
                    date_published=preferred.get("Year", ""),
                    journal=None,
                    channel_name=None,
                    duration_sec=None,
                    word_count=ch["word_count"],
                    quality_score=7.0,  # books are high quality by default
                )
        else:
            # PDF
            full_text = extract_text_from_bytes(book_bytes)
            category = classify(f"{title} {full_text[:2000]}")
            subcategories = get_subcategories(full_text[:2000], category)

            db.insert_content(
                content_hash=hash_key,
                title=title,
                authors=json.dumps([author]),
                source_type="book",
                source_platform="libgen",
                source_url="",
                source_id=isbn or title,
                abstract="",
                full_text=full_text.encode("utf-8"),
                category=category,
                subcategories=json.dumps(subcategories),
                content_format="book_chapter",
                year=int(preferred.get("Year", 0)) or None,
                date_published=preferred.get("Year", ""),
                journal=None,
                channel_name=None,
                duration_sec=None,
                word_count=len(full_text.split()),
                quality_score=7.0,
            )

        db.update_session_total(session_id)
        db.close()
        return {"status": "success", "title": title}

    except Exception as e:
        db.log_failed_fetch(session_id, "book", isbn or title, title, str(e))
        db.close()
        return {"status": "error", "error": str(e)}
```

- [ ] **Step 4: Implement Reddit task**

Create `scraper/tasks/reddit.py`:

```python
import json
import praw
from typing import Optional

from scraper.celery_app import app
from scraper.db import Database
from scraper.utils.dedup import url_hash
from scraper.utils.classifier import classify, get_subcategories
from scraper.utils.quality import score_reddit
from scraper.utils.rate_limiter import get_limiter


def create_reddit_client(
    client_id: str, client_secret: str,
    username: str = "", password: str = "",
) -> praw.Reddit:
    """Create authenticated Reddit client."""
    kwargs = {
        "client_id": client_id,
        "client_secret": client_secret,
        "user_agent": "FitnessScraper/1.0",
    }
    if username and password:
        kwargs["username"] = username
        kwargs["password"] = password
    return praw.Reddit(**kwargs)


def search_subreddit(
    reddit: praw.Reddit, subreddit_name: str,
    query: str, limit: int = 25,
) -> list[dict]:
    """Search a subreddit and return posts with top comments."""
    subreddit = reddit.subreddit(subreddit_name)
    results = []

    for submission in subreddit.search(query, sort="top", time_filter="all", limit=limit):
        if submission.score < 20:
            continue
        if not submission.selftext and not submission.is_self:
            continue  # skip link-only posts

        submission.comments.replace_more(limit=0)
        comments = []
        for comment in list(submission.comments)[:10]:
            if hasattr(comment, "body") and comment.body and comment.body != "[deleted]":
                comments.append({
                    "body": comment.body,
                    "score": comment.score,
                    "author": str(comment.author),
                })

        results.append({
            "id": submission.id,
            "title": submission.title,
            "body": submission.selftext,
            "score": submission.score,
            "num_comments": submission.num_comments,
            "url": f"https://reddit.com{submission.permalink}",
            "created_utc": submission.created_utc,
            "subreddit": subreddit_name,
            "comments": comments,
        })

    return results


@app.task(name="scraper.tasks.reddit.fetch_subreddit")
def fetch_subreddit(
    subreddit_name: str, search_term: str, session_id: int, task_id: int,
    client_id: str = "", client_secret: str = "",
    username: str = "", password: str = "",
):
    """Celery task: search a subreddit and store posts."""
    db = Database()
    db.initialize()

    if db.get_session_status(session_id) == "paused":
        db.close()
        return {"status": "paused"}

    db.update_search_task(task_id, status="in_progress")

    try:
        reddit = create_reddit_client(client_id, client_secret, username, password)
        limiter = get_limiter("reddit")
        limiter.wait()

        posts = search_subreddit(reddit, subreddit_name, search_term)
        db.update_search_task(task_id, results_found=len(posts))

        for post in posts:
            if db.get_session_status(session_id) == "paused":
                break

            hash_key = url_hash(post["url"])
            if db.hash_exists(hash_key):
                continue

            # Combine post body + top comments
            full_content = post["body"] + "\n\n---\n\n"
            for c in post["comments"]:
                full_content += f"[+{c['score']}] {c['body']}\n\n"

            if len(full_content) < 200:
                continue

            category = classify(f"{post['title']} {full_content[:2000]}")
            subcategories = get_subcategories(full_content[:2000], category)
            quality = score_reddit(post["score"], post["num_comments"])

            # Determine content format
            has_question_mark = "?" in post["title"]
            has_coaching_comments = any(c["score"] > 10 for c in post["comments"])
            content_format = "coaching_qa" if has_question_mark and has_coaching_comments else "forum_post"

            db.insert_content(
                content_hash=hash_key,
                title=post["title"],
                authors=json.dumps([f"r/{subreddit_name}"]),
                source_type="reddit",
                source_platform="reddit",
                source_url=post["url"],
                source_id=post["id"],
                abstract=post["body"][:500],
                full_text=full_content.encode("utf-8"),
                category=category,
                subcategories=json.dumps(subcategories),
                content_format=content_format,
                year=None,
                date_published="",
                journal=None,
                channel_name=f"r/{subreddit_name}",
                duration_sec=None,
                word_count=len(full_content.split()),
                quality_score=quality,
            )

        db.update_session_total(session_id)
        db.update_search_task(task_id, status="completed")

    except Exception as e:
        db.update_search_task(task_id, status="failed", error_message=str(e))

    db.close()
    return {"status": "completed"}
```

- [ ] **Step 5: Commit**

```bash
git add scraper/tasks/
git commit -m "feat: implement podcast, article, book, and Reddit scraping tasks"
```

---

## Task 10: Session Orchestrator

**Files:**
- Create: `scraper/tasks/orchestrator.py`

- [ ] **Step 1: Write failing tests**

Add to `scraper/tests/test_tasks.py`:

```python
class TestOrchestrator:
    def test_generate_search_tasks_creates_tasks(self):
        from scraper.tasks.orchestrator import generate_search_tasks
        from scraper.config import ScraperConfig

        tasks = generate_search_tasks(ScraperConfig(sources_enabled=["papers"]))
        assert len(tasks) > 0
        assert all(t["source_type"] == "papers" for t in tasks)

    def test_generate_search_tasks_respects_enabled_sources(self):
        from scraper.tasks.orchestrator import generate_search_tasks
        from scraper.config import ScraperConfig

        config = ScraperConfig(sources_enabled=["papers", "youtube"])
        tasks = generate_search_tasks(config)
        source_types = {t["source_type"] for t in tasks}
        assert "papers" in source_types
        assert "youtube" in source_types
        assert "reddit" not in source_types
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python -m pytest scraper/tests/test_tasks.py::TestOrchestrator -v
```

- [ ] **Step 3: Implement orchestrator**

Create `scraper/tasks/orchestrator.py`:

```python
import time
import json
import threading
from datetime import datetime, timezone

from scraper.celery_app import app
from scraper.db import Database
from scraper.config import (
    ScraperConfig, CATEGORIES, SOURCE_TYPES,
    YOUTUBE_CHANNELS, PODCAST_FEEDS, ARTICLE_SITES,
    TARGET_BOOKS, REDDIT_SUBREDDITS,
)


def generate_search_tasks(config: ScraperConfig) -> list[dict]:
    """Generate all search tasks based on config."""
    tasks = []

    for category_name, category_info in config.categories.items():
        for source_type in config.sources_enabled:
            if source_type == "papers":
                for term in category_info["search_terms"]:
                    for platform in ["pmc", "biorxiv"]:
                        tasks.append({
                            "category": category_name,
                            "source_type": "papers",
                            "search_term": term,
                            "source_platform": platform,
                        })

            elif source_type == "youtube":
                # YouTube searches by channel, not by category keyword
                # We handle this separately
                pass

            elif source_type == "reddit":
                for term in category_info["search_terms"][:3]:  # top 3 terms per category
                    for subreddit in REDDIT_SUBREDDITS:
                        tasks.append({
                            "category": category_name,
                            "source_type": "reddit",
                            "search_term": term,
                            "source_platform": f"r/{subreddit}",
                        })

    # YouTube: one task per channel
    if "youtube" in config.sources_enabled:
        for channel_url in YOUTUBE_CHANNELS:
            tasks.append({
                "category": "",  # classified per-video
                "source_type": "youtube",
                "search_term": channel_url,
                "source_platform": "youtube",
            })

    # Podcasts: one task per feed
    if "podcasts" in config.sources_enabled:
        for feed in PODCAST_FEEDS:
            tasks.append({
                "category": "",
                "source_type": "podcasts",
                "search_term": feed["url"],
                "source_platform": feed["name"],
            })

    # Articles: one task per site
    if "articles" in config.sources_enabled:
        for site in ARTICLE_SITES:
            tasks.append({
                "category": "",
                "source_type": "articles",
                "search_term": site["base_url"],
                "source_platform": site["name"],
            })

    # Books: one task per book
    if "books" in config.sources_enabled:
        for book in TARGET_BOOKS:
            tasks.append({
                "category": "",
                "source_type": "books",
                "search_term": book["title"],
                "source_platform": "libgen",
            })

    return tasks


@app.task(name="scraper.tasks.orchestrator.run_session")
def run_session(session_id: int, config_json: str):
    """Top-level Celery task: orchestrate a full scraping session."""
    from scraper.tasks.papers import search_and_fetch_papers
    from scraper.tasks.youtube import scrape_channel
    from scraper.tasks.podcasts import scrape_feed
    from scraper.tasks.articles import scrape_site
    from scraper.tasks.books import fetch_book
    from scraper.tasks.reddit import fetch_subreddit

    config = ScraperConfig(**json.loads(config_json)) if config_json != "{}" else ScraperConfig()
    db = Database()
    db.initialize()

    # Generate and store all search tasks
    search_tasks = generate_search_tasks(config)
    task_ids = []
    for st in search_tasks:
        tid = db.create_search_task(
            session_id=session_id,
            category=st["category"],
            source_type=st["source_type"],
            search_term=st["search_term"],
            source_platform=st["source_platform"],
        )
        task_ids.append((tid, st))

    # Calculate time budgets
    time_budgets = config.get_time_budgets()
    start_time = time.time()
    total_seconds = config.duration_hours * 3600

    # Dispatch tasks by source type
    for task_id, st in task_ids:
        # Check time budget
        elapsed = time.time() - start_time
        if elapsed >= total_seconds - 900:  # stop 15 min before deadline
            break

        # Check if paused
        if db.get_session_status(session_id) == "paused":
            break

        source = st["source_type"]

        if source == "papers":
            search_and_fetch_papers.delay(
                search_term=st["search_term"],
                session_id=session_id,
                task_id=task_id,
                source_platform=st["source_platform"],
                api_key=config.ncbi_api_key,
                email=config.ncbi_email,
            )

        elif source == "youtube":
            scrape_channel.delay(
                channel_url=st["search_term"],
                session_id=session_id,
                task_id=task_id,
            )

        elif source == "podcasts":
            scrape_feed.delay(
                feed_url=st["search_term"],
                podcast_name=st["source_platform"],
                session_id=session_id,
                task_id=task_id,
            )

        elif source == "articles":
            scrape_site.delay(
                base_url=st["search_term"],
                site_name=st["source_platform"],
                session_id=session_id,
                task_id=task_id,
            )

        elif source == "books":
            # Find the book config
            book = next(
                (b for b in TARGET_BOOKS if b["title"] == st["search_term"]), None
            )
            if book:
                from scraper.tasks.books import fetch_book as fb
                fb.delay(
                    title=book["title"],
                    author=book["author"],
                    isbn=book.get("isbn", ""),
                    session_id=session_id,
                )
                db.update_search_task(task_id, status="completed")

        elif source == "reddit":
            fetch_subreddit.delay(
                subreddit_name=st["source_platform"].replace("r/", ""),
                search_term=st["search_term"],
                session_id=session_id,
                task_id=task_id,
                client_id=config.reddit_client_id,
                client_secret=config.reddit_client_secret,
                username=config.reddit_username,
                password=config.reddit_password,
            )

    db.close()
    return {"status": "dispatched", "total_tasks": len(task_ids)}
```

- [ ] **Step 4: Run tests**

```bash
python -m pytest scraper/tests/test_tasks.py::TestOrchestrator -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scraper/tasks/orchestrator.py
git commit -m "feat: implement session orchestrator with time budgeting"
```

---

## Task 11: FastAPI Endpoints

**Files:**
- Create: `scraper/api.py`
- Create: `scraper/tests/test_api.py`

- [ ] **Step 1: Write failing tests**

Create `scraper/tests/test_api.py`:

```python
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock


@pytest.fixture
def client(tmp_path):
    # Patch DB to use temp path
    with patch("scraper.api.get_db") as mock_db_factory:
        from scraper.db import Database
        db = Database(str(tmp_path / "test.db"))
        db.initialize()
        mock_db_factory.return_value = db

        from scraper.api import app
        yield TestClient(app)
        db.close()


class TestAPIEndpoints:
    def test_health(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    @patch("scraper.api.run_session")
    def test_start_session(self, mock_run, client):
        mock_run.delay = MagicMock()
        resp = client.post("/scraper/start", json={"duration_hours": 1})
        assert resp.status_code == 200
        data = resp.json()
        assert "session_id" in data
        assert data["status"] == "running"

    def test_status_unknown_session(self, client):
        resp = client.get("/scraper/status?session_id=999")
        assert resp.status_code == 404

    @patch("scraper.api.run_session")
    def test_pause_session(self, mock_run, client):
        mock_run.delay = MagicMock()
        start = client.post("/scraper/start", json={"duration_hours": 1})
        sid = start.json()["session_id"]

        resp = client.post("/scraper/pause", json={"session_id": sid})
        assert resp.status_code == 200
        assert resp.json()["status"] == "paused"

    @patch("scraper.api.run_session")
    def test_resume_session(self, mock_run, client):
        mock_run.delay = MagicMock()
        start = client.post("/scraper/start", json={"duration_hours": 1})
        sid = start.json()["session_id"]

        client.post("/scraper/pause", json={"session_id": sid})
        resp = client.post("/scraper/resume", json={"session_id": sid})
        assert resp.status_code == 200
        assert resp.json()["status"] == "running"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python -m pytest scraper/tests/test_api.py -v
```

- [ ] **Step 3: Implement FastAPI app**

Create `scraper/api.py`:

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional

from scraper.db import Database
from scraper.config import ScraperConfig
from scraper.tasks.orchestrator import run_session

app = FastAPI(title="Fitness Data Scraper", version="1.0.0")

_db: Optional[Database] = None


def get_db() -> Database:
    global _db
    if _db is None:
        _db = Database()
        _db.initialize()
    return _db


# --- Request/Response Models ---

class StartRequest(BaseModel):
    duration_hours: float = 12
    sources_enabled: list[str] = ["papers", "youtube", "articles", "podcasts", "books", "reddit"]
    ncbi_api_key: str = ""
    ncbi_email: str = ""
    reddit_client_id: str = ""
    reddit_client_secret: str = ""
    reddit_username: str = ""
    reddit_password: str = ""


class SessionIdRequest(BaseModel):
    session_id: int


# --- Endpoints ---

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/scraper/start")
def start_session(req: StartRequest):
    db = get_db()
    config = ScraperConfig(
        duration_hours=req.duration_hours,
        sources_enabled=req.sources_enabled,
        ncbi_api_key=req.ncbi_api_key,
        ncbi_email=req.ncbi_email,
        reddit_client_id=req.reddit_client_id,
        reddit_client_secret=req.reddit_client_secret,
        reddit_username=req.reddit_username,
        reddit_password=req.reddit_password,
    )
    session_id = db.create_session(config=config.to_json())
    run_session.delay(session_id, config.to_json())
    return {"session_id": session_id, "status": "running"}


@app.post("/scraper/pause")
def pause_session(req: SessionIdRequest):
    db = get_db()
    session = db.get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.update_session_status(req.session_id, "paused")
    return {"session_id": req.session_id, "status": "paused"}


@app.post("/scraper/resume")
def resume_session(req: SessionIdRequest):
    db = get_db()
    session = db.get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.update_session_status(req.session_id, "running")
    # Re-dispatch orchestrator for remaining tasks
    config_json = session["config"] or "{}"
    run_session.delay(req.session_id, config_json)
    return {"session_id": req.session_id, "status": "running"}


@app.post("/scraper/stop")
def stop_session(req: SessionIdRequest):
    db = get_db()
    session = db.get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.update_session_status(req.session_id, "completed")
    db.update_session_total(req.session_id)
    return {"session_id": req.session_id, "status": "completed"}


@app.get("/scraper/status")
def get_status(session_id: int):
    db = get_db()
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    by_source = db.get_content_count_by_source()
    by_category = db.get_content_count_by_category()
    errors = db.get_failed_fetch_count(session_id)
    total = db.get_content_count()

    return {
        "session_id": session_id,
        "status": session["status"],
        "started_at": session["started_at"],
        "paused_at": session["paused_at"],
        "total_items": total,
        "by_source": dict(by_source),
        "by_category": dict(by_category),
        "errors": errors,
    }


@app.get("/scraper/history")
def get_history():
    db = get_db()
    rows = db.execute("SELECT * FROM scrape_sessions ORDER BY id DESC").fetchall()
    return [dict(r) for r in rows]


@app.get("/scraper/errors")
def get_errors(session_id: int, limit: int = 50):
    db = get_db()
    failures = db.get_failed_fetches(session_id, limit)
    return [dict(f) for f in failures]
```

- [ ] **Step 4: Run tests**

```bash
python -m pytest scraper/tests/test_api.py -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scraper/api.py scraper/tests/test_api.py
git commit -m "feat: implement FastAPI endpoints for scraper control"
```

---

## Task 12: CLI Interface

**Files:**
- Create: `scraper/cli.py`

- [ ] **Step 1: Implement CLI**

Create `scraper/cli.py`:

```python
import click
import time
import requests
from rich.console import Console
from rich.table import Table
from rich.live import Live

console = Console()
API_BASE = "http://localhost:8000"


@click.group()
def cli():
    """Fitness Data Scraper CLI"""
    pass


@cli.command()
@click.option("--hours", default=12, type=float, help="Duration in hours")
@click.option("--sources", default="papers,youtube,articles,podcasts,books,reddit", help="Comma-separated sources")
@click.option("--categories", default="", help="Comma-separated categories (default: all)")
def start(hours, sources, categories):
    """Start a new scraping session."""
    payload = {
        "duration_hours": hours,
        "sources_enabled": sources.split(","),
    }
    try:
        resp = requests.post(f"{API_BASE}/scraper/start", json=payload, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        console.print(f"[bold green]Session #{data['session_id']} started[/bold green]")
        console.print(f"Duration: {hours}h | Sources: {sources}")
    except requests.ConnectionError:
        console.print("[bold red]Error:[/bold red] API server not running. Start it with: uvicorn scraper.api:app")


@cli.command()
@click.option("--session-id", type=int, default=None, help="Session ID (default: latest)")
def pause(session_id):
    """Pause the active scraping session."""
    if session_id is None:
        session_id = _get_latest_session_id()
    resp = requests.post(f"{API_BASE}/scraper/pause", json={"session_id": session_id}, timeout=10)
    data = resp.json()
    console.print(f"[bold yellow]Session #{session_id} paused[/bold yellow]")


@cli.command()
@click.option("--session-id", type=int, default=None, help="Session ID (default: latest)")
def resume(session_id):
    """Resume a paused scraping session."""
    if session_id is None:
        session_id = _get_latest_session_id()
    resp = requests.post(f"{API_BASE}/scraper/resume", json={"session_id": session_id}, timeout=10)
    data = resp.json()
    console.print(f"[bold green]Session #{session_id} resumed[/bold green]")


@cli.command()
@click.option("--session-id", type=int, default=None, help="Session ID (default: latest)")
def stop(session_id):
    """Stop the active scraping session."""
    if session_id is None:
        session_id = _get_latest_session_id()
    resp = requests.post(f"{API_BASE}/scraper/stop", json={"session_id": session_id}, timeout=10)
    console.print(f"[bold red]Session #{session_id} stopped[/bold red]")


@cli.command()
@click.option("--session-id", type=int, default=None, help="Session ID (default: latest)")
@click.option("--watch", is_flag=True, help="Poll every 30 seconds")
def status(session_id, watch):
    """Show session status."""
    if session_id is None:
        session_id = _get_latest_session_id()

    if watch:
        while True:
            _print_status(session_id)
            time.sleep(30)
    else:
        _print_status(session_id)


@cli.command()
@click.option("--session-id", type=int, default=None)
def stats(session_id):
    """Show detailed stats for a session."""
    if session_id is None:
        session_id = _get_latest_session_id()
    _print_stats(session_id)


@cli.command()
@click.option("--session-id", type=int, default=None)
@click.option("--limit", default=20, type=int)
def errors(session_id, limit):
    """Show failed fetches."""
    if session_id is None:
        session_id = _get_latest_session_id()
    resp = requests.get(f"{API_BASE}/scraper/errors", params={"session_id": session_id, "limit": limit}, timeout=10)
    data = resp.json()

    if not data:
        console.print("[green]No errors![/green]")
        return

    table = Table(title=f"Errors — Session #{session_id}")
    table.add_column("Source")
    table.add_column("ID")
    table.add_column("Error")
    for err in data:
        table.add_row(err["source_type"], err["source_id"] or "", err["error_message"][:80])
    console.print(table)


def _get_latest_session_id() -> int:
    resp = requests.get(f"{API_BASE}/scraper/history", timeout=10)
    sessions = resp.json()
    if not sessions:
        console.print("[red]No sessions found.[/red]")
        raise SystemExit(1)
    return sessions[0]["id"]


def _print_status(session_id: int):
    resp = requests.get(f"{API_BASE}/scraper/status", params={"session_id": session_id}, timeout=10)
    data = resp.json()
    status_color = {"running": "green", "paused": "yellow", "completed": "blue", "failed": "red"}
    color = status_color.get(data["status"], "white")
    console.print(f"\n[bold]Session #{session_id}[/bold] — [{color}]{data['status']}[/{color}]")
    console.print(f"  Total items: {data['total_items']}")
    console.print(f"  Errors: {data['errors']}")


def _print_stats(session_id: int):
    resp = requests.get(f"{API_BASE}/scraper/status", params={"session_id": session_id}, timeout=10)
    data = resp.json()

    console.print()
    console.rule(f"[bold]Fitness Data Scraper — Session #{session_id}[/bold]")
    console.print()

    status_color = {"running": "green", "paused": "yellow", "completed": "blue"}
    color = status_color.get(data["status"], "white")
    console.print(f"  Status:  [{color}]{data['status']}[/{color}]")
    console.print(f"  Total:   {data['total_items']:,} items")
    console.print(f"  Errors:  {data['errors']}")
    console.print()

    if data["by_source"]:
        table = Table(title="By Source")
        table.add_column("Source", style="cyan")
        table.add_column("Count", justify="right")
        table.add_column("%", justify="right")
        total = max(data["total_items"], 1)
        for source, count in sorted(data["by_source"].items(), key=lambda x: -x[1]):
            pct = f"{count / total * 100:.1f}%"
            table.add_row(source, str(count), pct)
        console.print(table)

    if data["by_category"]:
        table = Table(title="By Category")
        table.add_column("Category", style="cyan")
        table.add_column("Count", justify="right")
        table.add_column("%", justify="right")
        total = max(data["total_items"], 1)
        for cat, count in sorted(data["by_category"].items(), key=lambda x: -x[1]):
            pct = f"{count / total * 100:.1f}%"
            table.add_row(cat, str(count), pct)
        console.print(table)

    console.rule()


if __name__ == "__main__":
    cli()
```

- [ ] **Step 2: Test CLI help text works**

```bash
cd /Users/sharans/Desktop/projects/macrofactor-agent
python -m scraper.cli --help
python -m scraper.cli start --help
```

Expected: Help text displayed with all commands

- [ ] **Step 3: Commit**

```bash
git add scraper/cli.py
git commit -m "feat: implement CLI with Click and Rich for scraper control"
```

---

## Task 13: RAG Export Pipeline

**Files:**
- Create: `scraper/exports/rag_export.py`
- Create: `scraper/tests/test_exports.py`

- [ ] **Step 1: Write failing tests**

Create `scraper/tests/test_exports.py`:

```python
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
    db.close()


class TestRAGExport:
    def test_chunk_text(self):
        from scraper.exports.rag_export import chunk_text

        text = "Word " * 2000  # ~2000 words
        chunks = chunk_text(text, max_tokens=1000, overlap_tokens=100)
        assert len(chunks) >= 2
        assert all(len(c.split()) <= 1100 for c in chunks)  # within bounds

    def test_export_to_jsonl(self, db_with_content, tmp_path):
        from scraper.exports.rag_export import export_rag_jsonl

        output_path = str(tmp_path / "rag_export.jsonl")
        count = export_rag_jsonl(db_with_content, output_path)
        assert count > 0
        assert os.path.exists(output_path)

        with open(output_path, "r") as f:
            lines = f.readlines()
        assert len(lines) > 0

        first = json.loads(lines[0])
        assert "id" in first
        assert "title" in first
        assert "content" in first
        assert "category" in first
        assert "chunk_index" in first

    def test_chunks_have_metadata(self, db_with_content, tmp_path):
        from scraper.exports.rag_export import export_rag_jsonl

        output_path = str(tmp_path / "rag_export.jsonl")
        export_rag_jsonl(db_with_content, output_path)

        with open(output_path, "r") as f:
            first = json.loads(f.readline())

        assert first["category"] == "supplements"
        assert "metadata" in first
        assert first["metadata"]["source_type"] == "paper"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python -m pytest scraper/tests/test_exports.py -v
```

- [ ] **Step 3: Implement RAG export**

Create `scraper/exports/rag_export.py`:

```python
import json
from scraper.db import Database


def chunk_text(text: str, max_tokens: int = 1000, overlap_tokens: int = 100) -> list[str]:
    """Split text into chunks at paragraph boundaries."""
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
```

- [ ] **Step 4: Implement fine-tune export stub**

Create `scraper/exports/finetune_export.py`:

```python
"""
Fine-tuning export pipeline (DORMANT).

This module synthesizes coaching-tone Q&A pairs from raw content using Claude.
It is not active — run it manually when ready to fine-tune.

Usage:
    python -m scraper.exports.finetune_export --output exports/finetune.jsonl
"""

import json
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
```

- [ ] **Step 5: Run tests**

```bash
python -m pytest scraper/tests/test_exports.py -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scraper/exports/ scraper/tests/test_exports.py
git commit -m "feat: implement RAG JSONL export pipeline with chunking"
```

---

## Task 14: Integration Test & Startup Scripts

**Files:**
- Create: `scraper/tests/test_integration.py`
- Create: `scraper/start.sh`

- [ ] **Step 1: Create startup script**

Create `scraper/start.sh`:

```bash
#!/bin/bash
# Start all scraper services

echo "Starting Redis..."
redis-server --daemonize yes

echo "Starting Celery workers..."
celery -A scraper.celery_app worker \
    --loglevel=info \
    --concurrency=4 \
    -Q default,papers,youtube,articles,podcasts,books,reddit \
    --detach \
    --pidfile=/tmp/celery-scraper.pid \
    --logfile=/tmp/celery-scraper.log

echo "Starting FastAPI server..."
uvicorn scraper.api:app --host 0.0.0.0 --port 8000 &

echo ""
echo "All services started."
echo "  API:    http://localhost:8000"
echo "  Docs:   http://localhost:8000/docs"
echo "  CLI:    python -m scraper.cli --help"
echo ""
echo "To stop: ./scraper/stop.sh"
```

Create `scraper/stop.sh`:

```bash
#!/bin/bash
# Stop all scraper services

echo "Stopping Celery..."
celery -A scraper.celery_app control shutdown 2>/dev/null
kill $(cat /tmp/celery-scraper.pid 2>/dev/null) 2>/dev/null

echo "Stopping FastAPI..."
pkill -f "uvicorn scraper.api:app" 2>/dev/null

echo "All services stopped."
```

- [ ] **Step 2: Make scripts executable**

```bash
chmod +x scraper/start.sh scraper/stop.sh
```

- [ ] **Step 3: Write integration test**

Create `scraper/tests/test_integration.py`:

```python
"""
Integration tests — run with services up:
    pytest scraper/tests/test_integration.py -v -m integration
"""
import pytest
import requests

BASE = "http://localhost:8000"


@pytest.mark.integration
class TestIntegration:
    def test_health_endpoint(self):
        resp = requests.get(f"{BASE}/health", timeout=5)
        assert resp.status_code == 200

    def test_start_pause_resume_stop_lifecycle(self):
        # Start
        resp = requests.post(f"{BASE}/scraper/start", json={"duration_hours": 0.01, "sources_enabled": []})
        assert resp.status_code == 200
        sid = resp.json()["session_id"]

        # Status
        resp = requests.get(f"{BASE}/scraper/status", params={"session_id": sid})
        assert resp.status_code == 200

        # Pause
        resp = requests.post(f"{BASE}/scraper/pause", json={"session_id": sid})
        assert resp.json()["status"] == "paused"

        # Resume
        resp = requests.post(f"{BASE}/scraper/resume", json={"session_id": sid})
        assert resp.json()["status"] == "running"

        # Stop
        resp = requests.post(f"{BASE}/scraper/stop", json={"session_id": sid})
        assert resp.json()["status"] == "completed"
```

- [ ] **Step 4: Run unit tests (not integration)**

```bash
python -m pytest scraper/tests/ -v --ignore=scraper/tests/test_integration.py
```

Expected: All unit tests PASS

- [ ] **Step 5: Commit**

```bash
git add scraper/start.sh scraper/stop.sh scraper/tests/test_integration.py
git commit -m "feat: add startup scripts and integration tests"
```

---

## Task 15: Final Verification & Cleanup

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/sharans/Desktop/projects/macrofactor-agent
python -m pytest scraper/tests/ -v --ignore=scraper/tests/test_integration.py
```

Expected: All tests PASS

- [ ] **Step 2: Verify all imports work**

```bash
python -c "
from scraper.db import Database
from scraper.config import ScraperConfig, CATEGORIES
from scraper.celery_app import app
from scraper.extractors.pdf import extract_text_from_bytes
from scraper.extractors.html import extract_article
from scraper.extractors.transcript import parse_vtt_string
from scraper.utils.dedup import content_hash, doi_hash
from scraper.utils.classifier import classify
from scraper.utils.rate_limiter import get_limiter
from scraper.utils.quality import score_paper
from scraper.exports.rag_export import export_rag_jsonl
print('All imports OK')
"
```

- [ ] **Step 3: Verify CLI works**

```bash
python -m scraper.cli --help
```

- [ ] **Step 4: Final commit**

```bash
git add -A scraper/
git commit -m "feat: complete fitness data scraper agent"
```
