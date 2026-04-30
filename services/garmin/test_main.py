import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@patch("main.validate_credentials")
def test_auth_validate_success(mock_validate):
    mock_validate.return_value = True
    response = client.post("/auth/validate", json={
        "email": "test@example.com",
        "password": "password123"
    })
    assert response.status_code == 200
    assert response.json()["valid"] is True


@patch("main.validate_credentials")
def test_auth_validate_failure(mock_validate):
    mock_validate.side_effect = Exception("Invalid credentials")
    response = client.post("/auth/validate", json={
        "email": "test@example.com",
        "password": "wrong"
    })
    assert response.status_code == 200
    assert response.json()["valid"] is False
    assert "error" in response.json()


@patch("main.fetch_garmin_data")
def test_sync_success(mock_fetch):
    mock_fetch.return_value = {
        "dates": ["2026-04-29"],
        "resting_hr": [{"date": "2026-04-29", "value": 52}],
        "hrv": [{"date": "2026-04-29", "value": 45}],
        "sleep": [{"date": "2026-04-29", "hours": 7.5, "score": 82}],
        "body_battery": [{"date": "2026-04-29", "value": 75}],
        "stress": [{"date": "2026-04-29", "value": 28}],
        "steps": [{"date": "2026-04-29", "value": 8500}],
    }
    response = client.post("/sync", json={
        "email": "test@example.com",
        "password": "password123",
        "since": "2026-04-29"
    })
    assert response.status_code == 200
    data = response.json()
    assert len(data["dates"]) == 1
    assert data["resting_hr"][0]["value"] == 52


@patch("main.fetch_garmin_data")
def test_sync_auth_failure(mock_fetch):
    mock_fetch.side_effect = Exception("auth_failed")
    response = client.post("/sync", json={
        "email": "test@example.com",
        "password": "wrong",
        "since": "2026-04-29"
    })
    assert response.status_code == 500
