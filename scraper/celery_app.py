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
    worker_prefetch_multiplier=1,
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

app.autodiscover_tasks(["scraper.tasks"])
