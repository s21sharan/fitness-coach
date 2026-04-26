#!/bin/bash
# Stop all scraper services

echo "Stopping Celery..."
celery -A scraper.celery_app control shutdown 2>/dev/null
kill $(cat /tmp/celery-scraper.pid 2>/dev/null) 2>/dev/null

echo "Stopping FastAPI..."
pkill -f "uvicorn scraper.api:app" 2>/dev/null

echo "All services stopped."
