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
