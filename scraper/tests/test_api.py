import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock


@pytest.fixture
def client(tmp_path):
    with patch("scraper.api.get_db") as mock_db_factory:
        from scraper.db import Database
        db = Database(str(tmp_path / "test.db"))
        db.initialize()
        mock_db_factory.return_value = db

        with patch("scraper.api.run_session") as mock_run:
            mock_run.delay = MagicMock()
            from scraper.api import app
            yield TestClient(app)


class TestHealthEndpoint:
    def test_health(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


class TestStartSession:
    def test_start_returns_session_id(self, client):
        resp = client.post("/scraper/start", json={"duration_hours": 1})
        assert resp.status_code == 200
        data = resp.json()
        assert "session_id" in data
        assert data["status"] == "running"

    def test_start_with_custom_sources(self, client):
        resp = client.post("/scraper/start", json={
            "duration_hours": 1,
            "sources_enabled": ["papers", "youtube"],
        })
        assert resp.status_code == 200


class TestSessionLifecycle:
    def test_status_unknown_session(self, client):
        resp = client.get("/scraper/status?session_id=999")
        assert resp.status_code == 404

    def test_pause_session(self, client):
        start = client.post("/scraper/start", json={"duration_hours": 1})
        sid = start.json()["session_id"]
        resp = client.post("/scraper/pause", json={"session_id": sid})
        assert resp.status_code == 200
        assert resp.json()["status"] == "paused"

    def test_resume_session(self, client):
        start = client.post("/scraper/start", json={"duration_hours": 1})
        sid = start.json()["session_id"]
        client.post("/scraper/pause", json={"session_id": sid})
        resp = client.post("/scraper/resume", json={"session_id": sid})
        assert resp.status_code == 200
        assert resp.json()["status"] == "running"

    def test_stop_session(self, client):
        start = client.post("/scraper/start", json={"duration_hours": 1})
        sid = start.json()["session_id"]
        resp = client.post("/scraper/stop", json={"session_id": sid})
        assert resp.status_code == 200
        assert resp.json()["status"] == "completed"

    def test_status_after_start(self, client):
        start = client.post("/scraper/start", json={"duration_hours": 1})
        sid = start.json()["session_id"]
        resp = client.get(f"/scraper/status?session_id={sid}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "running"
        assert data["total_items"] == 0

    def test_history(self, client):
        client.post("/scraper/start", json={"duration_hours": 1})
        resp = client.get("/scraper/history")
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    def test_errors_empty(self, client):
        start = client.post("/scraper/start", json={"duration_hours": 1})
        sid = start.json()["session_id"]
        resp = client.get(f"/scraper/errors?session_id={sid}")
        assert resp.status_code == 200
        assert resp.json() == []
