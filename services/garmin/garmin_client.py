import os
import sys
from datetime import date, datetime, timedelta
from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectTooManyRequestsError,
)


def log(msg: str):
    """Log to stderr so it shows in service output."""
    print(f"[garmin] {msg}", file=sys.stderr, flush=True)


class GarminMFARequired(Exception):
    """Raised when Garmin login needs an MFA code we don't have."""


def _token_dir_for(email: str) -> str:
    """Per-account token directory that survives reboots.

    Garmin login is heavily IP-rate-limited; tokens persist for weeks once
    obtained, so storing them anywhere outside of /tmp dramatically cuts the
    number of times we hit the SSO login endpoint. Defaults to ~/.garmin_tokens;
    set GARMIN_TOKEN_DIR to override (e.g. for a Railway volume mount).
    """
    base = os.environ.get("GARMIN_TOKEN_DIR") or os.path.expanduser("~/.garmin_tokens")
    path = os.path.join(base, email.replace("@", "_at_"))
    os.makedirs(path, exist_ok=True)
    return path


def create_client(email: str, password: str, mfa_code: str | None = None) -> Garmin:
    """Authenticate a Garmin client, preferring persisted tokens.

    Flow:
      1. Try to load existing tokens from disk (no network hit if valid).
      2. On miss/expiry, fall back to credential login.
      3. If credential login triggers MFA and mfa_code was supplied,
         feed it through prompt_mfa; otherwise raise GarminMFARequired
         so callers can surface a 'needs_mfa' response.
    """
    token_dir = _token_dir_for(email)

    prompt_mfa = None
    if mfa_code:
        # Garmin's lib invokes prompt_mfa() at exactly the right moment in the
        # SSO flow, so wrapping our pre-supplied code in a lambda matches its
        # interface without needing interactive stdin.
        prompt_mfa = lambda: mfa_code  # noqa: E731

    client = Garmin(email=email, password=password, prompt_mfa=prompt_mfa)
    try:
        client.login(token_dir)
    except GarminConnectAuthenticationError as e:
        msg = str(e).lower()
        if "mfa" in msg and not mfa_code:
            raise GarminMFARequired(str(e)) from e
        raise
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


# Activity type mapping constants
GARMIN_RUN_TYPES = {"running", "trail_running", "treadmill_running", "track_running"}
GARMIN_BIKE_TYPES = {"cycling", "mountain_biking", "indoor_cycling", "gravel_cycling", "e_bike_cycling"}
GARMIN_SWIM_TYPES = {"lap_swimming", "open_water_swimming"}
GARMIN_STRENGTH_TYPES = {"strength_training", "indoor_climbing", "bouldering"}


def map_garmin_activity_type(activity_type: str) -> str:
    """Map a Garmin activity type string to run/bike/swim/strength/other."""
    normalized = (activity_type or "").lower()
    if normalized in GARMIN_RUN_TYPES:
        return "run"
    if normalized in GARMIN_BIKE_TYPES:
        return "bike"
    if normalized in GARMIN_SWIM_TYPES:
        return "swim"
    if normalized in GARMIN_STRENGTH_TYPES:
        return "strength"
    return "other"


def extract_hr_zones(client: Garmin, activity_id) -> list[dict] | None:
    """Fetch HR zone breakdown via dedicated API call."""
    try:
        zones_raw = client.get_activity_hr_in_timezones(activity_id)
        if not zones_raw or not isinstance(zones_raw, list):
            return None

        zones = []
        for z in zones_raw:
            if not isinstance(z, dict):
                continue
            zone_num = z.get("zoneNumber")
            low = z.get("zoneLowBoundary")
            secs = z.get("secsInZone", 0) or 0
            minutes = round(secs / 60, 1)
            if zone_num is not None:
                zones.append({
                    "zone": zone_num,
                    "low": low,
                    "high": None,  # filled in below
                    "minutes": minutes,
                })

        # Fill in high boundaries from next zone's low
        for i in range(len(zones) - 1):
            zones[i]["high"] = zones[i + 1]["low"]
        if zones:
            zones[-1]["high"] = 220  # max HR cap for last zone

        return zones if zones else None
    except Exception as e:
        log(f"  HR zones fetch failed for {activity_id}: {e}")
        return None


def extract_splits(client: Garmin, activity_id) -> list[dict] | None:
    """Fetch per-lap splits via dedicated API call."""
    try:
        splits_data = client.get_activity_splits(activity_id)
        if not splits_data or not isinstance(splits_data, dict):
            return None

        laps = splits_data.get("lapDTOs", [])
        if not laps or not isinstance(laps, list):
            return None

        splits = []
        for i, lap in enumerate(laps):
            if not isinstance(lap, dict):
                continue

            distance = lap.get("distance", 0) or 0
            if distance < 50:
                continue

            duration_sec = lap.get("movingDuration") or lap.get("duration", 0) or 0
            distance_km = distance / 1000

            pace = None
            if distance_km > 0 and duration_sec > 0:
                pace = round((duration_sec / 60) / distance_km, 2)

            avg_hr = lap.get("averageHR")
            elevation = lap.get("elevationGain")
            cadence = lap.get("averageRunCadence") or lap.get("averageBikingCadenceInRevPerMinute")

            splits.append({
                "km": i + 1,
                "distance_m": round(distance),
                "pace_min_km": pace,
                "avg_hr": round(avg_hr) if avg_hr else None,
                "elevation": round(elevation, 1) if elevation is not None else None,
                "cadence": round(cadence) if cadence else None,
            })

        return splits if splits else None
    except Exception as e:
        log(f"  Splits fetch failed for {activity_id}: {e}")
        return None


def fetch_activities(client: Garmin, since: str) -> list[dict]:
    """Fetch all activities since the given date, including details."""
    today = date.today().isoformat()
    log(f"Fetching activities from {since} to {today}...")

    activities_raw = client.get_activities_by_date(since, today)
    if not activities_raw:
        log("No activities found.")
        return []

    log(f"Found {len(activities_raw)} activities, fetching details...")
    results = []

    for activity in activities_raw:
        if not isinstance(activity, dict):
            continue

        activity_id = activity.get("activityId")
        if activity_id is None:
            continue

        # Map activity type
        raw_type = (
            activity.get("activityType", {}).get("typeKey", "")
            if isinstance(activity.get("activityType"), dict)
            else str(activity.get("activityType", ""))
        )
        mapped_type = map_garmin_activity_type(raw_type)

        # Base fields from summary
        distance_m = activity.get("distance") or 0
        distance_km = round(distance_m / 1000, 3) if distance_m else None

        duration_sec = activity.get("duration") or activity.get("elapsedDuration") or 0

        # Pace / speed
        if mapped_type == "run" and distance_km and duration_sec:
            pace_or_speed = round((duration_sec / 60) / distance_km, 2)
        elif distance_km and duration_sec:
            pace_or_speed = round(distance_km / (duration_sec / 3600), 2)
        else:
            pace_or_speed = None

        record: dict = {
            "activity_id": activity_id,
            "date": (activity.get("startTimeLocal") or "")[:10],
            "start_time": activity.get("startTimeLocal"),
            "type": mapped_type,
            "distance_km": distance_km,
            "duration_sec": round(duration_sec) if duration_sec else None,
            "avg_hr": activity.get("averageHR"),
            "max_hr": activity.get("maxHR"),
            "calories": activity.get("calories"),
            "elevation": activity.get("elevationGain"),
            "training_effect_aerobic": activity.get("aerobicTrainingEffect"),
            "training_effect_anaerobic": activity.get("anaerobicTrainingEffect"),
            "vo2_max": activity.get("vO2MaxValue"),
            "avg_respiration": activity.get("avgRespirationRate"),
            "pace_or_speed": pace_or_speed,
            # Detail fields filled in below
            "avg_cadence": None,
            "avg_stride_length": None,
            "ground_contact_time": None,
            "recovery_time": None,
            "hr_zones": None,
            "splits": None,
        }

        # Fetch per-activity detail
        try:
            detail = client.get_activity(activity_id)
            if isinstance(detail, dict):
                summary_dto = detail.get("summaryDTO", {}) or {}
                record["avg_cadence"] = (
                    summary_dto.get("averageRunningCadenceInStepsPerMinute")
                    or summary_dto.get("averageBikingCadenceInRevPerMinute")
                    or detail.get("averageRunCadence")
                    or detail.get("averageCadence")
                )
                record["avg_stride_length"] = summary_dto.get("strideLength") or detail.get("avgStrideLength")
                record["ground_contact_time"] = summary_dto.get("groundContactTime") or detail.get("groundContactTime")
                record["recovery_time"] = (
                    detail.get("recoveryTime")
                    or summary_dto.get("recoveryTimeInHours")
                )
                record["hr_zones"] = extract_hr_zones(client, activity_id)
                record["splits"] = extract_splits(client, activity_id)
        except Exception as e:
            log(f"  Detail fetch failed for activity {activity_id}: {e}")

        results.append(record)

    log(f"Done. Fetched details for {len(results)} activities.")
    return results
