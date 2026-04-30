from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from garmin_client import create_client, fetch_data
from garminconnect import GarminConnectAuthenticationError, GarminConnectTooManyRequestsError

app = FastAPI(title="Hybro Garmin Service")


class AuthRequest(BaseModel):
    email: str
    password: str


class SyncRequest(BaseModel):
    email: str
    password: str
    since: str  # YYYY-MM-DD


def validate_credentials(email: str, password: str) -> bool:
    """Attempt login to validate credentials."""
    client = create_client(email, password)
    return True


def fetch_garmin_data(email: str, password: str, since: str) -> dict:
    """Authenticate and fetch data."""
    client = create_client(email, password)
    return fetch_data(client, since)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/auth/validate")
def auth_validate(req: AuthRequest):
    try:
        validate_credentials(req.email, req.password)
        return {"valid": True}
    except GarminConnectAuthenticationError as e:
        return {"valid": False, "error": "auth_failed"}
    except GarminConnectTooManyRequestsError:
        return {"valid": False, "error": "rate_limited"}
    except Exception as e:
        return {"valid": False, "error": str(e)}


@app.post("/sync")
def sync(req: SyncRequest):
    try:
        data = fetch_garmin_data(req.email, req.password, req.since)
        return data
    except GarminConnectAuthenticationError:
        raise HTTPException(status_code=401, detail={"error": "auth_failed"})
    except GarminConnectTooManyRequestsError:
        raise HTTPException(status_code=429, detail={"error": "rate_limited"})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e)})
