import os
import tempfile
from datetime import date, datetime, timedelta
from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectTooManyRequestsError,
)


def create_client(email: str, password: str) -> Garmin:
    """Create and authenticate a Garmin client."""
    token_dir = os.path.join(tempfile.gettempdir(), "garmin_tokens", email.replace("@", "_at_"))
    os.makedirs(token_dir, exist_ok=True)

    client = Garmin(email=email, password=password)
    client.login(token_dir)
    return client


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

        try:
            hr = client.get_heart_rates(date_str)
            if hr and hr.get("restingHeartRate"):
                resting_hr.append({"date": date_str, "value": hr["restingHeartRate"]})
        except Exception:
            pass

        try:
            hrv = client.get_hrv_data(date_str)
            if hrv and hrv.get("lastNightAvg"):
                hrv_data.append({"date": date_str, "value": round(hrv["lastNightAvg"])})
        except Exception:
            pass

        try:
            sleep = client.get_sleep_data(date_str)
            dto = sleep.get("dailySleepDTO", {})
            score_obj = sleep.get("overallSleepScore", {})
            if dto:
                total_seconds = sum([
                    dto.get("deepSleepSeconds", 0),
                    dto.get("lightSleepSeconds", 0),
                    dto.get("remSleepSeconds", 0),
                ])
                sleep_data.append({
                    "date": date_str,
                    "hours": round(total_seconds / 3600, 1),
                    "score": score_obj.get("value"),
                })
        except Exception:
            pass

        try:
            stress = client.get_all_day_stress(date_str)
            if stress:
                if stress.get("averageStressLevel"):
                    stress_data.append({"date": date_str, "value": stress["averageStressLevel"]})
                bb_values = stress.get("bodyBatteryValuesArray", [])
                if bb_values:
                    max_bb = max(v[1] for v in bb_values if v[1] is not None and v[1] >= 0)
                    body_battery.append({"date": date_str, "value": max_bb})
        except Exception:
            pass

        try:
            summary = client.get_user_summary(date_str)
            if summary and summary.get("steps"):
                steps_data.append({"date": date_str, "value": summary["steps"]})
        except Exception:
            pass

        current += timedelta(days=1)

    return {
        "dates": dates,
        "resting_hr": resting_hr,
        "hrv": hrv_data,
        "sleep": sleep_data,
        "body_battery": body_battery,
        "stress": stress_data,
        "steps": steps_data,
    }
