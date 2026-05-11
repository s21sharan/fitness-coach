import os
import sys
import tempfile
from datetime import date, datetime, timedelta
from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectTooManyRequestsError,
)


def log(msg: str):
    """Log to stderr so it shows in service output."""
    print(f"[garmin] {msg}", file=sys.stderr, flush=True)


def create_client(email: str, password: str) -> Garmin:
    """Create and authenticate a Garmin client."""
    token_dir = os.path.join(tempfile.gettempdir(), "garmin_tokens", email.replace("@", "_at_"))
    os.makedirs(token_dir, exist_ok=True)

    client = Garmin(email=email, password=password)
    client.login(token_dir)
    return client


def safe_get_hrv(client: Garmin, date_str: str) -> int | None:
    """Extract HRV from multiple possible response structures."""
    try:
        hrv = client.get_hrv_data(date_str)
        if not hrv:
            return None

        # Try direct lastNightAvg (older garminconnect versions)
        if isinstance(hrv, dict):
            if hrv.get("lastNightAvg"):
                return round(hrv["lastNightAvg"])

            # Try hrvSummary.lastNightAvg (newer structure)
            summary = hrv.get("hrvSummary", {})
            if summary and summary.get("lastNightAvg"):
                return round(summary["lastNightAvg"])

            # Try lastNight5MinHigh
            if summary and summary.get("lastNight5MinHigh"):
                return round(summary["lastNight5MinHigh"])

            # Try weeklyAvg as fallback
            if summary and summary.get("weeklyAvg"):
                return round(summary["weeklyAvg"])

            # Log the actual structure so we can debug
            keys = list(hrv.keys()) if isinstance(hrv, dict) else str(type(hrv))
            log(f"  HRV {date_str}: unknown structure, keys={keys}")

        return None
    except Exception as e:
        log(f"  HRV {date_str}: error - {e}")
        return None


def safe_get_stress_and_bb(client: Garmin, date_str: str) -> tuple[int | None, int | None]:
    """Extract stress level and body battery."""
    stress_val = None
    bb_val = None

    try:
        stress = client.get_all_day_stress(date_str)
        if not stress:
            return None, None

        if isinstance(stress, dict):
            # Stress level — field is "avgStressLevel" in current API
            stress_val = stress.get("avgStressLevel") or stress.get("averageStressLevel")
            if stress_val is not None:
                stress_val = round(stress_val)

            # Body battery from stress endpoint
            # Array items can be [ts, value] OR [ts, "MEASURED", value, delta]
            bb_values = stress.get("bodyBatteryValuesArray", [])
            if bb_values and isinstance(bb_values, list):
                valid = []
                for v in bb_values:
                    if not isinstance(v, (list, tuple)) or len(v) < 2:
                        continue
                    # If v[1] is a string like "MEASURED", the actual value is at v[2]
                    if isinstance(v[1], str) and len(v) > 2:
                        val = v[2]
                    else:
                        val = v[1]
                    if isinstance(val, (int, float)) and val >= 0:
                        valid.append(val)
                if valid:
                    bb_val = max(valid)
    except Exception as e:
        log(f"  Stress {date_str}: error - {e}")

    # Fallback: try dedicated body battery endpoint if available
    if bb_val is None:
        try:
            if hasattr(client, "get_body_battery"):
                bb_data = client.get_body_battery(date_str)
                if bb_data and isinstance(bb_data, list):
                    valid = [v.get("value", v.get("bodyBatteryLevel")) for v in bb_data if isinstance(v, dict)]
                    valid = [v for v in valid if v is not None and v >= 0]
                    if valid:
                        bb_val = max(valid)
                elif bb_data and isinstance(bb_data, dict):
                    charged = bb_data.get("bodyBatteryChargedValue") or bb_data.get("maxBodyBattery")
                    if charged:
                        bb_val = round(charged)
        except Exception as e:
            log(f"  BB fallback {date_str}: error - {e}")

    return stress_val, bb_val


def safe_get_steps(client: Garmin, date_str: str) -> int | None:
    """Extract steps from user summary or stats."""
    try:
        summary = client.get_user_summary(date_str)
        if summary and isinstance(summary, dict):
            steps = summary.get("totalSteps") or summary.get("steps")
            if steps:
                return int(steps)

            # Some versions nest it
            if summary.get("dailyStepGoal") and summary.get("totalSteps"):
                return int(summary["totalSteps"])

        return None
    except Exception as e:
        log(f"  Steps {date_str}: error - {e}")
        return None


def safe_get_sleep(client: Garmin, date_str: str) -> tuple[float | None, int | None]:
    """Extract sleep hours and score."""
    try:
        sleep = client.get_sleep_data(date_str)
        if not sleep:
            return None, None

        hours = None
        score = None

        if isinstance(sleep, dict):
            dto = sleep.get("dailySleepDTO", {})
            score_obj = sleep.get("overallSleepScore") or sleep.get("sleepScores", {})

            if dto and isinstance(dto, dict):
                total_seconds = sum([
                    dto.get("deepSleepSeconds", 0) or 0,
                    dto.get("lightSleepSeconds", 0) or 0,
                    dto.get("remSleepSeconds", 0) or 0,
                ])
                if total_seconds > 0:
                    hours = round(total_seconds / 3600, 1)

            if isinstance(score_obj, dict):
                score = score_obj.get("value") or score_obj.get("overall") or score_obj.get("qualityScore")
                if score is not None:
                    score = round(score)

        return hours, score
    except Exception as e:
        log(f"  Sleep {date_str}: error - {e}")
        return None, None


def fetch_data(client: Garmin, since: str) -> dict:
    """Fetch all health metrics from Garmin since the given date."""
    start = datetime.strptime(since, "%Y-%m-%d").date()
    end = date.today()

    dates = []
    resting_hr = []
    hrv_data = []
    sleep_data = []
    body_battery = []
    stress_data = []
    steps_data = []

    current = start
    while current <= end:
        date_str = current.isoformat()
        dates.append(date_str)
        log(f"Fetching {date_str}...")

        # Resting HR
        try:
            hr = client.get_heart_rates(date_str)
            if hr and isinstance(hr, dict) and hr.get("restingHeartRate"):
                resting_hr.append({"date": date_str, "value": hr["restingHeartRate"]})
        except Exception as e:
            log(f"  HR {date_str}: error - {e}")

        # HRV
        hrv_val = safe_get_hrv(client, date_str)
        if hrv_val is not None:
            hrv_data.append({"date": date_str, "value": hrv_val})

        # Sleep
        sleep_hours, sleep_score = safe_get_sleep(client, date_str)
        if sleep_hours is not None:
            sleep_data.append({"date": date_str, "hours": sleep_hours, "score": sleep_score})

        # Stress & Body Battery
        stress_val, bb_val = safe_get_stress_and_bb(client, date_str)
        if stress_val is not None:
            stress_data.append({"date": date_str, "value": stress_val})
        if bb_val is not None:
            body_battery.append({"date": date_str, "value": bb_val})

        # Steps
        steps_val = safe_get_steps(client, date_str)
        if steps_val is not None:
            steps_data.append({"date": date_str, "value": steps_val})

        current += timedelta(days=1)

    log(f"Done. HR={len(resting_hr)}, HRV={len(hrv_data)}, Sleep={len(sleep_data)}, BB={len(body_battery)}, Stress={len(stress_data)}, Steps={len(steps_data)}")

    return {
        "dates": dates,
        "resting_hr": resting_hr,
        "hrv": hrv_data,
        "sleep": sleep_data,
        "body_battery": body_battery,
        "stress": stress_data,
        "steps": steps_data,
    }
