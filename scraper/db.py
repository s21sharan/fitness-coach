"""Database layer for the scraper — SQLite with zlib compression for full_text."""
import json
import sqlite3
import threading
import zlib
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


class Database:
    """Thread-safe SQLite database manager with zlib-compressed full_text fields."""

    def __init__(self, db_path: str) -> None:
        self.db_path = db_path
        self._local = threading.local()

    # ------------------------------------------------------------------
    # Connection management
    # ------------------------------------------------------------------

    def _get_conn(self) -> sqlite3.Connection:
        """Return a thread-local SQLite connection, creating it if needed."""
        if not hasattr(self._local, "conn") or self._local.conn is None:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA foreign_keys=ON")
            self._local.conn = conn
        return self._local.conn

    # ------------------------------------------------------------------
    # Schema initialisation
    # ------------------------------------------------------------------

    def initialize(self) -> None:
        """Create all tables and indexes if they don't exist."""
        conn = self._get_conn()
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS content (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                content_hash    TEXT    UNIQUE NOT NULL,
                title           TEXT,
                authors         TEXT,
                source_type     TEXT,
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
                created_at      TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS scrape_sessions (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                config      TEXT,
                status      TEXT DEFAULT 'pending',
                total_items INTEGER DEFAULT 0,
                created_at  TEXT DEFAULT (datetime('now')),
                paused_at   TEXT,
                resumed_at  TEXT,
                completed_at TEXT
            );

            CREATE TABLE IF NOT EXISTS search_tasks (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id      INTEGER NOT NULL REFERENCES scrape_sessions(id),
                query           TEXT,
                source_type     TEXT,
                source_platform TEXT,
                status          TEXT DEFAULT 'pending',
                results_found   INTEGER DEFAULT 0,
                results_saved   INTEGER DEFAULT 0,
                error_message   TEXT,
                created_at      TEXT DEFAULT (datetime('now')),
                updated_at      TEXT
            );

            CREATE TABLE IF NOT EXISTS failed_fetches (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id    INTEGER NOT NULL REFERENCES scrape_sessions(id),
                url           TEXT,
                error_message TEXT,
                source_type   TEXT,
                created_at    TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS export_log (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id  INTEGER REFERENCES scrape_sessions(id),
                export_path TEXT,
                format      TEXT,
                row_count   INTEGER DEFAULT 0,
                created_at  TEXT DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_content_hash
                ON content(content_hash);
            CREATE INDEX IF NOT EXISTS idx_content_source_type
                ON content(source_type);
            CREATE INDEX IF NOT EXISTS idx_content_category
                ON content(category);
            CREATE INDEX IF NOT EXISTS idx_search_tasks_session_id
                ON search_tasks(session_id);
            CREATE INDEX IF NOT EXISTS idx_search_tasks_status
                ON search_tasks(status);
        """)
        conn.commit()

    # ------------------------------------------------------------------
    # Compression helpers
    # ------------------------------------------------------------------

    @staticmethod
    def compress_text(text: str) -> bytes:
        """Compress a string using zlib."""
        return zlib.compress(text.encode("utf-8"))

    @staticmethod
    def decompress_text(data: bytes) -> str:
        """Decompress zlib-compressed bytes back to a string."""
        return zlib.decompress(data).decode("utf-8")

    # ------------------------------------------------------------------
    # Content methods
    # ------------------------------------------------------------------

    def hash_exists(self, content_hash: str) -> bool:
        """Return True if content_hash already exists in the content table."""
        conn = self._get_conn()
        row = conn.execute(
            "SELECT 1 FROM content WHERE content_hash=? LIMIT 1",
            (content_hash,),
        ).fetchone()
        return row is not None

    def get_content_by_hash(self, content_hash: str) -> Optional[sqlite3.Row]:
        """Return the content row for the given hash, or None."""
        conn = self._get_conn()
        return conn.execute(
            "SELECT * FROM content WHERE content_hash=? LIMIT 1",
            (content_hash,),
        ).fetchone()

    def insert_content(
        self,
        content_hash: str,
        title: Optional[str] = None,
        authors: Optional[str] = None,
        source_type: Optional[str] = None,
        source_platform: Optional[str] = None,
        source_url: Optional[str] = None,
        source_id: Optional[str] = None,
        abstract: Optional[str] = None,
        full_text: Optional[Any] = None,
        category: Optional[str] = None,
        subcategories: Optional[str] = None,
        content_format: Optional[str] = None,
        year: Optional[int] = None,
        date_published: Optional[str] = None,
        journal: Optional[str] = None,
        channel_name: Optional[str] = None,
        duration_sec: Optional[int] = None,
        word_count: Optional[int] = None,
        quality_score: Optional[float] = None,
        language: str = "en",
    ) -> Optional[int]:
        """Insert a content row; returns the new row ID or None if hash exists."""
        if self.hash_exists(content_hash):
            return None

        # Compress full_text if provided
        compressed: Optional[bytes] = None
        if full_text is not None:
            if isinstance(full_text, bytes):
                full_text = full_text.decode("utf-8")
            compressed = self.compress_text(full_text)

        conn = self._get_conn()
        cursor = conn.execute(
            """
            INSERT INTO content (
                content_hash, title, authors, source_type, source_platform,
                source_url, source_id, abstract, full_text, category,
                subcategories, content_format, year, date_published, journal,
                channel_name, duration_sec, word_count, quality_score, language
            ) VALUES (
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?
            )
            """,
            (
                content_hash, title, authors, source_type, source_platform,
                source_url, source_id, abstract, compressed, category,
                subcategories, content_format, year, date_published, journal,
                channel_name, duration_sec, word_count, quality_score, language,
            ),
        )
        conn.commit()
        return cursor.lastrowid

    def get_content_count(self) -> int:
        """Return the total number of content rows."""
        conn = self._get_conn()
        row = conn.execute("SELECT COUNT(*) FROM content").fetchone()
        return row[0]

    def get_content_count_by_source(self) -> Dict[str, int]:
        """Return a dict mapping source_type -> count."""
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT source_type, COUNT(*) as cnt FROM content GROUP BY source_type"
        ).fetchall()
        return {row["source_type"]: row["cnt"] for row in rows}

    def get_content_count_by_category(self) -> Dict[str, int]:
        """Return a dict mapping category -> count."""
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT category, COUNT(*) as cnt FROM content GROUP BY category"
        ).fetchall()
        return {row["category"]: row["cnt"] for row in rows}

    def get_all_content(self, limit: int = 100, offset: int = 0) -> List[sqlite3.Row]:
        """Return content rows with pagination."""
        conn = self._get_conn()
        return conn.execute(
            "SELECT * FROM content ORDER BY id LIMIT ? OFFSET ?",
            (limit, offset),
        ).fetchall()

    # ------------------------------------------------------------------
    # Session methods
    # ------------------------------------------------------------------

    def create_session(self, config: Dict) -> int:
        """Create a new scrape session and return its ID."""
        conn = self._get_conn()
        cursor = conn.execute(
            "INSERT INTO scrape_sessions (config, status) VALUES (?, 'pending')",
            (json.dumps(config),),
        )
        conn.commit()
        return cursor.lastrowid

    def get_session(self, session_id: int) -> Optional[sqlite3.Row]:
        """Return the session row or None."""
        conn = self._get_conn()
        return conn.execute(
            "SELECT * FROM scrape_sessions WHERE id=? LIMIT 1",
            (session_id,),
        ).fetchone()

    def get_session_status(self, session_id: int) -> Optional[str]:
        """Return the status string for a session, or None."""
        session = self.get_session(session_id)
        if session is None:
            return None
        return session["status"]

    def update_session_status(self, session_id: int, status: str) -> None:
        """Update the status of a session; set paused_at/resumed_at as needed."""
        now = datetime.now(timezone.utc).isoformat()
        conn = self._get_conn()
        if status == "paused":
            conn.execute(
                "UPDATE scrape_sessions SET status=?, paused_at=? WHERE id=?",
                (status, now, session_id),
            )
        elif status == "running":
            conn.execute(
                "UPDATE scrape_sessions SET status=?, resumed_at=? WHERE id=?",
                (status, now, session_id),
            )
        elif status == "completed":
            conn.execute(
                "UPDATE scrape_sessions SET status=?, completed_at=? WHERE id=?",
                (status, now, session_id),
            )
        else:
            conn.execute(
                "UPDATE scrape_sessions SET status=? WHERE id=?",
                (status, session_id),
            )
        conn.commit()

    def update_session_total(self, session_id: int) -> None:
        """Recompute and update total_items for a session from the content table."""
        conn = self._get_conn()
        conn.execute(
            """
            UPDATE scrape_sessions
            SET total_items = (SELECT COUNT(*) FROM content)
            WHERE id = ?
            """,
            (session_id,),
        )
        conn.commit()

    # ------------------------------------------------------------------
    # Search task methods
    # ------------------------------------------------------------------

    def create_search_task(
        self,
        session_id: int,
        query: str,
        source_type: str,
        source_platform: str,
    ) -> int:
        """Create a search task and return its ID."""
        conn = self._get_conn()
        cursor = conn.execute(
            """
            INSERT INTO search_tasks (session_id, query, source_type, source_platform, status)
            VALUES (?, ?, ?, ?, 'pending')
            """,
            (session_id, query, source_type, source_platform),
        )
        conn.commit()
        return cursor.lastrowid

    def get_search_task(self, task_id: int) -> Optional[sqlite3.Row]:
        """Return the search task row or None."""
        conn = self._get_conn()
        return conn.execute(
            "SELECT * FROM search_tasks WHERE id=? LIMIT 1",
            (task_id,),
        ).fetchone()

    def get_pending_search_tasks(self, session_id: int) -> List[sqlite3.Row]:
        """Return all pending search tasks for a session."""
        conn = self._get_conn()
        return conn.execute(
            "SELECT * FROM search_tasks WHERE session_id=? AND status='pending'",
            (session_id,),
        ).fetchall()

    def update_search_task(
        self,
        task_id: int,
        status: str,
        results_found: int,
        results_saved: int,
        error_message: Optional[str],
    ) -> None:
        """Update a search task's status, result counts, and optional error."""
        now = datetime.now(timezone.utc).isoformat()
        conn = self._get_conn()
        conn.execute(
            """
            UPDATE search_tasks
            SET status=?, results_found=?, results_saved=?, error_message=?, updated_at=?
            WHERE id=?
            """,
            (status, results_found, results_saved, error_message, now, task_id),
        )
        conn.commit()

    # ------------------------------------------------------------------
    # Failed fetch methods
    # ------------------------------------------------------------------

    def log_failed_fetch(
        self,
        session_id: int,
        url: str,
        error_message: str,
        source_type: str,
    ) -> None:
        """Log a URL that failed to fetch."""
        conn = self._get_conn()
        conn.execute(
            """
            INSERT INTO failed_fetches (session_id, url, error_message, source_type)
            VALUES (?, ?, ?, ?)
            """,
            (session_id, url, error_message, source_type),
        )
        conn.commit()

    def get_failed_fetches(
        self, session_id: int, limit: int = 100
    ) -> List[sqlite3.Row]:
        """Return up to `limit` failed fetch rows for a session."""
        conn = self._get_conn()
        return conn.execute(
            "SELECT * FROM failed_fetches WHERE session_id=? ORDER BY id LIMIT ?",
            (session_id, limit),
        ).fetchall()

    def get_failed_fetch_count(self, session_id: int) -> int:
        """Return the count of failed fetches for a session."""
        conn = self._get_conn()
        row = conn.execute(
            "SELECT COUNT(*) FROM failed_fetches WHERE session_id=?",
            (session_id,),
        ).fetchone()
        return row[0]
