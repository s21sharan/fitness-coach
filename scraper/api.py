from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import json

from scraper.db import Database
from scraper.config import ScraperConfig
from scraper.tasks.orchestrator import run_session

app = FastAPI(title="Fitness Data Scraper", version="1.0.0")

_db: Optional[Database] = None


def get_db() -> Database:
    global _db
    if _db is None:
        _db = Database("scraper/data/fitness_data.db")
        _db.initialize()
    return _db


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
    )
    config_dict = json.loads(config.to_json())
    session_id = db.create_session(config=config_dict)
    db.update_session_status(session_id, "running")
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
        "started_at": session["created_at"],
        "paused_at": session["paused_at"],
        "total_items": total,
        "by_source": dict(by_source),
        "by_category": dict(by_category),
        "errors": errors,
    }


@app.get("/scraper/history")
def get_history():
    db = get_db()
    conn = db._get_conn()
    rows = conn.execute("SELECT * FROM scrape_sessions ORDER BY id DESC").fetchall()
    return [dict(r) for r in rows]


@app.get("/scraper/errors")
def get_errors(session_id: int, limit: int = 50):
    db = get_db()
    failures = db.get_failed_fetches(session_id, limit)
    return [dict(f) for f in failures]
