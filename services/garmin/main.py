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


class DebugRequest(BaseModel):
    email: str
    password: str
    date: str  # YYYY-MM-DD, single day


@app.post("/debug")
def debug_day(req: DebugRequest):
    """Fetch raw Garmin API responses for a single day to debug field structures."""
    try:
        client = create_client(req.email, req.password)
        results = {}

        try:
            results["heart_rates"] = client.get_heart_rates(req.date)
        except Exception as e:
            results["heart_rates_error"] = str(e)

        try:
            results["hrv_data"] = client.get_hrv_data(req.date)
        except Exception as e:
            results["hrv_data_error"] = str(e)

        try:
            results["sleep_data"] = client.get_sleep_data(req.date)
        except Exception as e:
            results["sleep_data_error"] = str(e)

        try:
            results["stress_data"] = client.get_all_day_stress(req.date)
        except Exception as e:
            results["stress_data_error"] = str(e)

        try:
            results["user_summary"] = client.get_user_summary(req.date)
        except Exception as e:
            results["user_summary_error"] = str(e)

        # Check if body battery has its own endpoint
        if hasattr(client, "get_body_battery"):
            try:
                results["body_battery"] = client.get_body_battery(req.date)
            except Exception as e:
                results["body_battery_error"] = str(e)

        return results
    except GarminConnectAuthenticationError:
        raise HTTPException(status_code=401, detail={"error": "auth_failed"})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e)})


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
