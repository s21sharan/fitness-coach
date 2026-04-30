import time
import json

from scraper.celery_app import app
from scraper.db import Database
from scraper.config import (
    ScraperConfig, CATEGORIES, SOURCE_TYPES,
    YOUTUBE_CHANNELS, PODCAST_FEEDS, ARTICLE_SITES,
    TARGET_BOOKS, REDDIT_SUBREDDITS, DB_PATH,
)


def generate_search_tasks(config: ScraperConfig) -> list[dict]:
    """Generate all search task definitions based on config."""
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

            elif source_type == "reddit":
                for term in category_info["search_terms"][:3]:
                    for subreddit in REDDIT_SUBREDDITS:
                        tasks.append({
                            "category": category_name,
                            "source_type": "reddit",
                            "search_term": term,
                            "source_platform": f"r/{subreddit}",
                        })

    if "youtube" in config.sources_enabled:
        for channel_url in YOUTUBE_CHANNELS:
            tasks.append({
                "category": "",
                "source_type": "youtube",
                "search_term": channel_url,
                "source_platform": "youtube",
            })

    if "podcasts" in config.sources_enabled:
        for feed in PODCAST_FEEDS:
            tasks.append({
                "category": "",
                "source_type": "podcasts",
                "search_term": feed["url"],
                "source_platform": feed["name"],
            })

    if "articles" in config.sources_enabled:
        for site in ARTICLE_SITES:
            tasks.append({
                "category": "",
                "source_type": "articles",
                "search_term": site["base_url"],
                "source_platform": site["name"],
            })

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
    db = Database(DB_PATH)
    db.initialize()

    search_tasks = generate_search_tasks(config)
    task_ids = []
    for st in search_tasks:
        tid = db.create_search_task(
            session_id=session_id,
            query=st["search_term"],
            source_type=st["source_type"],
            source_platform=st["source_platform"],
        )
        task_ids.append((tid, st))

    time_budgets = config.get_time_budgets()
    start_time = time.time()
    total_seconds = config.duration_hours * 3600

    for task_id, st in task_ids:
        elapsed = time.time() - start_time
        if elapsed >= total_seconds - 900:
            break

        if db.get_session_status(session_id) == "paused":
            break

        source = st["source_type"]

        if source == "papers":
            search_and_fetch_papers.delay(
                search_term=st["search_term"],
                session_id=session_id,
                task_id=task_id,
                source_platform=st["source_platform"],
                api_key=config.ncbi_api_key or "",
                email=config.ncbi_email or "",
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
            book = next(
                (b for b in TARGET_BOOKS if b["title"] == st["search_term"]), None
            )
            if book:
                fetch_book.delay(
                    title=book["title"],
                    author=book["author"],
                    isbn=book.get("isbn", ""),
                    session_id=session_id,
                )
                db.update_search_task(task_id, "completed", 1, 1, None)

        elif source == "reddit":
            fetch_subreddit.delay(
                subreddit_name=st["source_platform"].replace("r/", ""),
                search_term=st["search_term"],
                session_id=session_id,
                task_id=task_id,
                credentials={
                    "client_id": config.reddit_client_id or "",
                    "client_secret": config.reddit_client_secret or "",
                },
            )

    return {"status": "dispatched", "total_tasks": len(task_ids)}
