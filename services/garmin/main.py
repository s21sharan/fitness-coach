import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from garmin_client import create_client, fetch_data, fetch_activities, GarminMFARequired, _token_dir_for
from garminconnect import GarminConnectAuthenticationError, GarminConnectTooManyRequestsError

app = FastAPI(title="Hybro Garmin Service")


def _classify_login_error(err: Exception) -> tuple[int, str]:
    """Map a login failure into (http_status, error_code).

    `all_strategies_exhausted` lands here when every SSO entry point either
    returned 429 or got challenged — that's typically a sticky IP block, not
    a transient hiccup, so it gets its own code so the UI can tell the user
    to seed tokens from another network.
    """
    msg = str(err).lower()
    if "all login strategies" in msg or "all login strategies exhausted" in msg:
        return 429, "ip_blocked"
    return 500, str(err) or "unknown"


class AuthRequest(BaseModel):
    email: str
    password: str
    mfa_code: str | None = None


class SyncRequest(BaseModel):
    email: str
    password: str
    since: str  # YYYY-MM-DD
    mfa_code: str | None = None


def validate_credentials(email: str, password: str, mfa_code: str | None = None) -> bool:
    """Attempt login to validate credentials."""
    create_client(email, password, mfa_code=mfa_code)
    return True


def fetch_garmin_data(email: str, password: str, since: str, mfa_code: str | None = None) -> dict:
    """Authenticate and fetch data."""
    client = create_client(email, password, mfa_code=mfa_code)
    return fetch_data(client, since)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/auth/status")
def auth_status(email: str):
    """Report whether cached OAuth tokens exist for this email.

    Useful for debugging IP-block situations: if tokens are present we should
    never hit Garmin SSO at all, so a sync failing with `ip_blocked` despite
    `has_tokens: true` means token persistence itself is broken.
    """
    token_dir = _token_dir_for(email)
    token_file = os.path.join(token_dir, "garmin_tokens.json")
    has_tokens = os.path.exists(token_file)
    return {
        "email": email,
        "token_dir": token_dir,
        "token_file": token_file,
        "has_tokens": has_tokens,
        "size_bytes": os.path.getsize(token_file) if has_tokens else 0,
    }


@app.post("/auth/validate")
def auth_validate(req: AuthRequest):
    try:
        validate_credentials(req.email, req.password, mfa_code=req.mfa_code)
        return {"valid": True}
    except GarminMFARequired:
        return {"valid": False, "error": "needs_mfa"}
    except GarminConnectAuthenticationError:
        return {"valid": False, "error": "auth_failed"}
    except GarminConnectTooManyRequestsError:
        return {"valid": False, "error": "rate_limited"}
    except Exception as e:
        return {"valid": False, "error": str(e)}


class DebugRequest(BaseModel):
    email: str
    password: str
    date: str  # YYYY-MM-DD, single day
    mfa_code: str | None = None


@app.post("/debug")
def debug_day(req: DebugRequest):
    """Fetch raw Garmin API responses for a single day to debug field structures."""
    try:
        client = create_client(req.email, req.password, mfa_code=req.mfa_code)
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
        data = fetch_garmin_data(req.email, req.password, req.since, mfa_code=req.mfa_code)
        return data
    except GarminMFARequired:
        raise HTTPException(status_code=401, detail={"error": "needs_mfa"})
    except GarminConnectAuthenticationError:
        raise HTTPException(status_code=401, detail={"error": "auth_failed"})
    except GarminConnectTooManyRequestsError:
        raise HTTPException(status_code=429, detail={"error": "rate_limited"})
    except Exception as e:
        status, code = _classify_login_error(e)
        raise HTTPException(status_code=status, detail={"error": code})


@app.post("/sync-activities")
def sync_activities(req: SyncRequest):
    try:
        client = create_client(req.email, req.password, mfa_code=req.mfa_code)
        activities = fetch_activities(client, req.since)
        return {"activities": activities}
    except GarminMFARequired:
        raise HTTPException(status_code=401, detail={"error": "needs_mfa"})
    except GarminConnectAuthenticationError:
        raise HTTPException(status_code=401, detail={"error": "auth_failed"})
    except GarminConnectTooManyRequestsError:
        raise HTTPException(status_code=429, detail={"error": "rate_limited"})
    except Exception as e:
        status, code = _classify_login_error(e)
        raise HTTPException(status_code=status, detail={"error": code})
