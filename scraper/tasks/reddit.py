"""Celery tasks for Reddit scraping via PRAW."""

from __future__ import annotations

import json
import logging
from typing import Optional

import praw

from scraper.celery_app import app
from scraper.config import DB_PATH
from scraper.db import Database
from scraper.utils.classifier import classify, get_subcategories
from scraper.utils.dedup import url_hash
from scraper.utils.quality import score_reddit

logger = logging.getLogger(__name__)



def _get_db() -> Database:
    db = Database(DB_PATH)
    db.initialize()
    return db


def create_reddit_client(
    client_id: str,
    client_secret: str,
    username: str = "",
    password: str = "",
) -> praw.Reddit:
    """Create and return a PRAW Reddit client.

    Args:
        client_id: Reddit OAuth client ID.
        client_secret: Reddit OAuth client secret.
        username: Reddit username (optional, for script-type auth).
        password: Reddit password (optional, for script-type auth).

    Returns:
        Authenticated praw.Reddit instance.
    """
    kwargs: dict = {
        "client_id": client_id,
        "client_secret": client_secret,
        "user_agent": "FitnessScraper/1.0",
    }
    if username and password:
        kwargs["username"] = username
        kwargs["password"] = password

    return praw.Reddit(**kwargs)


def search_subreddit(
    reddit: praw.Reddit,
    subreddit_name: str,
    query: str,
    limit: int = 25,
) -> list[dict]:
    """Search a subreddit and return qualifying posts with top comments.

    Filters to posts with score > 20 that have selftext. Includes top 10
    comments (skipping [deleted] ones).

    Args:
        reddit: Authenticated PRAW Reddit instance.
        subreddit_name: Name of the subreddit (without r/).
        query: Search query string.
        limit: Maximum number of search results to fetch.

    Returns:
        List of post dicts with keys: id, title, body, score, num_comments,
        url, created_utc, subreddit, comments.
    """
    subreddit = reddit.subreddit(subreddit_name)
    results = subreddit.search(query, sort="top", time_filter="all", limit=limit)

    posts = []
    for submission in results:
        if submission.score <= 20:
            continue
        if not submission.is_self or not submission.selftext:
            continue

        # Load comments
        submission.comments.replace_more(limit=0)
        top_comments = []
        for comment in sorted(
            submission.comments.list(), key=lambda c: getattr(c, "score", 0), reverse=True
        )[:10]:
            body = getattr(comment, "body", "")
            if body and body != "[deleted]" and body != "[removed]":
                top_comments.append(
                    {
                        "body": body,
                        "score": getattr(comment, "score", 0),
                    }
                )

        posts.append(
            {
                "id": submission.id,
                "title": submission.title,
                "body": submission.selftext,
                "score": submission.score,
                "num_comments": submission.num_comments,
                "url": submission.url,
                "created_utc": submission.created_utc,
                "subreddit": subreddit_name,
                "comments": top_comments,
            }
        )

    return posts


@app.task(name="scraper.tasks.reddit.fetch_subreddit")
def fetch_subreddit(
    subreddit_name: str,
    search_term: str,
    session_id: int,
    task_id: int,
    credentials: dict,
) -> int:
    """Search a subreddit, classify posts, and store in DB.

    Args:
        subreddit_name: Name of the subreddit (without r/).
        search_term: Search query to run.
        session_id: Scrape session ID.
        task_id: Search task ID for status tracking.
        credentials: Dict with keys: client_id, client_secret, and optionally
                     username and password.

    Returns:
        Number of posts saved to DB.
    """
    db = _get_db()

    # Check if session is paused
    status = db.get_session_status(session_id)
    if status == "paused":
        logger.info("Session %d is paused, skipping subreddit: %s", session_id, subreddit_name)
        return 0

    reddit = create_reddit_client(
        client_id=credentials["client_id"],
        client_secret=credentials["client_secret"],
        username=credentials.get("username", ""),
        password=credentials.get("password", ""),
    )

    try:
        posts = search_subreddit(reddit, subreddit_name, search_term)
    except Exception as exc:
        logger.warning("Reddit search failed for r/%s '%s': %s", subreddit_name, search_term, exc)
        db.log_failed_fetch(session_id, f"reddit:r/{subreddit_name}?q={search_term}", str(exc), "reddit")
        return 0

    saved = 0
    for post in posts:
        content_hash = url_hash(post["url"])
        if db.hash_exists(content_hash):
            continue

        # Combine body and top comments into full_content
        comment_texts = "\n\n".join(c["body"] for c in post.get("comments", []))
        full_content = post["body"]
        if comment_texts:
            full_content = f"{post['body']}\n\n---\n\n{comment_texts}"

        if len(full_content) < 200:
            continue

        # Detect content format
        title_lower = post["title"].lower()
        has_question = "?" in title_lower
        has_high_score_comment = any(
            c.get("score", 0) > 10 for c in post.get("comments", [])
        )
        if has_question and has_high_score_comment:
            content_format = "coaching_qa"
        else:
            content_format = "forum_post"

        category = classify(full_content)
        subcats = get_subcategories(full_content, category)
        word_count = len(full_content.split())
        quality = score_reddit(upvotes=post["score"], num_comments=post["num_comments"])

        import datetime
        date_published: Optional[str] = None
        created_utc = post.get("created_utc")
        if created_utc:
            date_published = datetime.datetime.utcfromtimestamp(created_utc).isoformat()

        row_id = db.insert_content(
            content_hash=content_hash,
            title=post["title"],
            source_type="reddit",
            source_platform=f"r/{subreddit_name}",
            source_url=post["url"],
            source_id=post["id"],
            full_text=full_content,
            category=category,
            subcategories=json.dumps(subcats),
            content_format=content_format,
            date_published=date_published,
            word_count=word_count,
            quality_score=quality,
        )
        if row_id is not None:
            saved += 1

    logger.info("Saved %d posts from r/%s search '%s'", saved, subreddit_name, search_term)
    return saved
