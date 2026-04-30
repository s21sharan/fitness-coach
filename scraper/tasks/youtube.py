"""YouTube scraping tasks: fetch transcripts and scrape channels."""

from __future__ import annotations

import json
import logging
import requests
import yt_dlp
from typing import Optional

from scraper.celery_app import app
from scraper.config import DB_PATH
from scraper.db import Database
from scraper.extractors.transcript import parse_vtt_string
from scraper.utils.dedup import url_hash
from scraper.utils.classifier import classify, get_subcategories
from scraper.utils.quality import score_youtube
from scraper.utils.rate_limiter import get_limiter

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


def list_channel_videos(channel_url: str) -> list[dict]:
    """List all videos in a YouTube channel.

    Returns a list of dicts with keys: id, title, url, duration, upload_date.
    Entries with None id are filtered out.
    """
    opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": "in_playlist",
        "skip_download": True,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(channel_url, download=False)

    entries = info.get("entries", []) if info else []
    videos = []
    for entry in entries:
        if entry is None:
            continue
        video_id = entry.get("id")
        if video_id is None:
            continue
        videos.append({
            "id": video_id,
            "title": entry.get("title"),
            "url": f"https://www.youtube.com/watch?v={video_id}",
            "duration": entry.get("duration"),
            "upload_date": entry.get("upload_date"),
        })
    return videos


def get_transcript_in_memory(video_url: str, lang: str = "en") -> Optional[str]:
    """Download and parse the VTT transcript for a YouTube video.

    Checks subtitles first, then automatic_captions for the given language.
    Finds a VTT format URL, downloads it with requests, and parses it.
    Returns the transcript text or None if unavailable.
    """
    opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "writesubtitles": True,
        "writeautomaticsub": True,
        "subtitleslangs": [lang],
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(video_url, download=False)

    if not info:
        return None

    # Try manual subtitles first, then automatic captions
    vtt_url = None
    for source_key in ("subtitles", "automatic_captions"):
        captions = info.get(source_key, {}) or {}
        lang_entries = captions.get(lang, [])
        for fmt in lang_entries:
            if fmt.get("ext") == "vtt":
                vtt_url = fmt.get("url")
                break
        if vtt_url:
            break

    if not vtt_url:
        return None

    try:
        resp = requests.get(vtt_url, timeout=30)
        resp.raise_for_status()
        vtt_content = resp.text
    except Exception as exc:
        logger.warning("Failed to download VTT from %s: %s", vtt_url, exc)
        return None

    return parse_vtt_string(vtt_content) or None


def get_video_metadata(video_url: str) -> dict:
    """Return metadata for a YouTube video.

    Keys: title, channel, views, likes, duration, upload_date, description.
    Description is truncated to 500 characters.
    """
    opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(video_url, download=False)

    if not info:
        return {}

    description = info.get("description") or ""
    return {
        "title": info.get("title"),
        "channel": info.get("channel") or info.get("uploader"),
        "views": info.get("view_count") or 0,
        "likes": info.get("like_count") or 0,
        "duration": info.get("duration") or 0,
        "upload_date": info.get("upload_date"),
        "description": description[:500],
    }


# ---------------------------------------------------------------------------
# Celery tasks
# ---------------------------------------------------------------------------


@app.task(name="scraper.tasks.youtube.fetch_video", bind=True)
def fetch_video(self, video_url: str, session_id: int = 0):
    """Fetch, classify, and store a single YouTube video transcript.

    Returns a status dict with keys: status, video_url, and optionally
    content_id or reason.
    """
    dedup_key = url_hash(video_url)

    db = Database(DB_PATH)
    db.initialize()
    limiter = get_limiter("youtube")

    # Dedup check
    if db.hash_exists(dedup_key):
        return {"status": "duplicate", "video_url": video_url}

    # Get metadata
    limiter.wait()
    try:
        meta = get_video_metadata(video_url)
    except Exception as exc:
        logger.error("Failed to get metadata for %s: %s", video_url, exc)
        if session_id:
            db.log_failed_fetch(session_id, video_url, str(exc), "youtube")
        return {"status": "error", "video_url": video_url, "reason": str(exc)}

    duration = meta.get("duration") or 0
    if duration < 180:
        return {"status": "skipped", "video_url": video_url, "reason": "too_short"}

    # Get transcript (wait between yt-dlp calls to avoid 429s)
    limiter.wait()
    transcript = get_transcript_in_memory(video_url)
    if not transcript:
        logger.warning("No transcript available for %s", video_url)
        if session_id:
            db.log_failed_fetch(session_id, video_url, "no_transcript", "youtube")
        return {"status": "skipped", "video_url": video_url, "reason": "no_transcript"}

    # Classify using title + description + transcript
    classify_text = " ".join(filter(None, [
        meta.get("title", ""),
        meta.get("description", ""),
        transcript or "",
    ]))
    category = classify(classify_text)
    subcategories = get_subcategories(classify_text, category)

    # Score
    quality = score_youtube(
        views=meta.get("views") or 0,
        likes=meta.get("likes") or 0,
        duration_sec=duration,
    )

    # Extract year from upload_date (YYYYMMDD format)
    year = None
    upload_date = meta.get("upload_date")
    if upload_date and len(upload_date) >= 4:
        try:
            year = int(upload_date[:4])
        except ValueError:
            pass

    # Insert into DB
    content_id = db.insert_content(
        content_hash=dedup_key,
        title=meta.get("title"),
        authors=meta.get("channel"),
        source_type="youtube",
        source_url=video_url,
        full_text=transcript,
        category=category,
        subcategories=json.dumps(subcategories),
        content_format="transcript",
        year=year,
        date_published=upload_date,
        channel_name=meta.get("channel"),
        duration_sec=duration,
        quality_score=quality,
    )

    return {
        "status": "saved" if content_id else "duplicate",
        "video_url": video_url,
        "content_id": content_id,
    }


@app.task(name="scraper.tasks.youtube.scrape_channel", bind=True)
def scrape_channel(self, channel_url: str, session_id: int, task_id: int):
    """Scrape all videos from a YouTube channel.

    Checks pause status, lists videos, and enqueues fetch_video for each.
    Updates the search_task progress on completion.
    """
    db = Database(DB_PATH)
    db.initialize()

    # Check pause status
    status = db.get_session_status(session_id)
    if status == "paused":
        return {"status": "paused", "channel_url": channel_url}

    # List videos
    try:
        videos = list_channel_videos(channel_url)
    except Exception as exc:
        logger.error("Failed to list videos for %s: %s", channel_url, exc)
        db.update_search_task(task_id, "error", 0, 0, str(exc))
        return {"status": "error", "channel_url": channel_url, "reason": str(exc)}

    limiter = get_limiter("youtube")
    enqueued = 0
    for video in videos:
        limiter.wait()
        video_url = video.get("url")
        if not video_url:
            continue
        fetch_video.delay(video_url, session_id)
        enqueued += 1

    # Update search task
    db.update_search_task(task_id, "completed", len(videos), enqueued, None)

    return {
        "status": "completed",
        "channel_url": channel_url,
        "videos_found": len(videos),
        "videos_enqueued": enqueued,
    }
