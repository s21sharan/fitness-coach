"""Celery tasks for podcast feed scraping and episode transcription."""

from __future__ import annotations

import json
import logging
from typing import Optional

import feedparser

from scraper.celery_app import app
from scraper.config import DB_PATH, LIBGEN_MIRRORS
from scraper.db import Database
from scraper.extractors.audio import download_and_transcribe
from scraper.utils.classifier import classify, get_subcategories
from scraper.utils.dedup import url_hash
from scraper.utils.quality import score_podcast

logger = logging.getLogger(__name__)



def _get_db() -> Database:
    db = Database(DB_PATH)
    db.initialize()
    return db


def parse_feed(feed_url: str) -> list[dict]:
    """Parse a podcast RSS feed and return episode metadata.

    Args:
        feed_url: URL of the RSS/Atom feed.

    Returns:
        List of dicts with keys: title, audio_url, published, summary,
        duration, guid.
    """
    parsed = feedparser.parse(feed_url)
    episodes = []

    for entry in parsed.entries:
        audio_url: Optional[str] = None

        # Check links for audio type
        for link in getattr(entry, "links", []):
            link_type = link.get("type", "")
            if link_type.startswith("audio/"):
                audio_url = link.get("href") or link.get("url")
                break

        # Fall back to enclosures
        if not audio_url:
            for enc in getattr(entry, "enclosures", []):
                enc_type = enc.get("type", "")
                if enc_type.startswith("audio/"):
                    audio_url = enc.get("href") or enc.get("url")
                    break

        if not audio_url:
            continue

        duration = getattr(entry, "itunes_duration", None)
        published = getattr(entry, "published", None)
        summary = getattr(entry, "summary", "") or ""
        title = getattr(entry, "title", "") or ""
        guid = getattr(entry, "id", audio_url) or audio_url

        episodes.append(
            {
                "title": title,
                "audio_url": audio_url,
                "published": published,
                "summary": summary,
                "duration": duration,
                "guid": guid,
            }
        )

    return episodes


@app.task(name="scraper.tasks.podcasts.fetch_episode")
def fetch_episode(
    audio_url: str,
    title: str,
    podcast_name: str,
    published: Optional[str],
    summary: str,
    session_id: int,
) -> Optional[int]:
    """Download, transcribe, classify, and store a single podcast episode.

    Args:
        audio_url: Direct URL to the audio file.
        title: Episode title.
        podcast_name: Name of the podcast / channel.
        published: ISO date string when the episode was published.
        summary: Episode description / show notes.
        session_id: Scrape session ID for logging.

    Returns:
        DB row ID on success, None if skipped or failed.
    """
    db = _get_db()

    # Dedup check
    content_hash = url_hash(audio_url)
    if db.hash_exists(content_hash):
        logger.debug("Skipping duplicate episode: %s", audio_url)
        return None

    try:
        transcript = download_and_transcribe(audio_url)
    except Exception as exc:
        logger.warning("Failed to transcribe %s: %s", audio_url, exc)
        db.log_failed_fetch(session_id, audio_url, str(exc), "podcast")
        return None

    if not transcript or len(transcript) < 200:
        logger.debug("Transcript too short for %s, skipping", audio_url)
        return None

    category = classify(transcript)
    subcats = get_subcategories(transcript, category)

    # Estimate duration from transcript word count (~130 wpm for podcasts)
    word_count = len(transcript.split())
    duration_sec = int(word_count / 130 * 60)
    quality = score_podcast(duration_sec)

    row_id = db.insert_content(
        content_hash=content_hash,
        title=title,
        authors=podcast_name,
        source_type="podcast",
        source_platform=podcast_name,
        source_url=audio_url,
        abstract=summary[:1000] if summary else None,
        full_text=transcript,
        category=category,
        subcategories=json.dumps(subcats),
        content_format="transcript",
        date_published=published,
        channel_name=podcast_name,
        duration_sec=duration_sec,
        word_count=word_count,
        quality_score=quality,
    )
    return row_id


@app.task(name="scraper.tasks.podcasts.scrape_feed")
def scrape_feed(
    feed_url: str,
    podcast_name: str,
    session_id: int,
    task_id: int,
) -> int:
    """Parse a podcast RSS feed and enqueue fetch_episode tasks for each episode.

    Args:
        feed_url: URL of the RSS/Atom feed.
        podcast_name: Human-readable name of the podcast.
        session_id: Scrape session ID.
        task_id: Search task ID for status tracking.

    Returns:
        Number of episodes enqueued.
    """
    db = _get_db()

    # Check if session is paused
    status = db.get_session_status(session_id)
    if status == "paused":
        logger.info("Session %d is paused, skipping feed: %s", session_id, feed_url)
        return 0

    episodes = parse_feed(feed_url)
    enqueued = 0

    for ep in episodes:
        audio_url = ep.get("audio_url")
        if not audio_url:
            continue
        fetch_episode.delay(
            audio_url=audio_url,
            title=ep.get("title", ""),
            podcast_name=podcast_name,
            published=ep.get("published"),
            summary=ep.get("summary", ""),
            session_id=session_id,
        )
        enqueued += 1

    logger.info("Enqueued %d episodes from feed: %s", enqueued, feed_url)
    return enqueued
