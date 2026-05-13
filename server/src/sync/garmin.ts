import { supabase } from "../db.js";
import { config } from "../config.js";
import { decrypt } from "../utils/encryption.js";
import { getActiveIntegrations, logSync, updateSyncTimestamp, markIntegrationError } from "./base.js";

interface GarminMetric {
  date: string;
  value?: number;
  hours?: number;
  score?: number;
}

interface GarminEnergyMetric {
  date: string;
  total_kcal: number | null;
  active_kcal: number | null;
  bmr_kcal: number | null;
}

interface GarminSyncResponse {
  dates: string[];
  resting_hr: GarminMetric[];
  hrv: GarminMetric[];
  sleep: GarminMetric[];
  body_battery: GarminMetric[];
  stress: GarminMetric[];
  steps: GarminMetric[];
  energy?: GarminEnergyMetric[];
}

function findMetric(metrics: GarminMetric[], date: string): GarminMetric | undefined {
  return metrics.find((m) => m.date === date);
}

export function normalizeGarminData(userId: string, data: GarminSyncResponse) {
  return data.dates.map((date) => {
    const hr = findMetric(data.resting_hr, date);
    const hrv = findMetric(data.hrv, date);
    const sleep = findMetric(data.sleep, date);
    const battery = findMetric(data.body_battery, date);
    const stress = findMetric(data.stress, date);
    const steps = findMetric(data.steps, date);

    return {
      user_id: userId,
      date,
      resting_hr: hr?.value ?? null,
      hrv: hrv?.value ?? null,
      sleep_hours: sleep?.hours ?? null,
      sleep_score: sleep?.score ?? null,
      body_battery: battery?.value ?? null,
      stress_level: stress?.value ?? null,
      steps: steps?.value ?? null,
      synced_at: new Date().toISOString(),
    };
  });
}

async function fetchFromGarminService(email: string, password: string, since: string): Promise<GarminSyncResponse> {
  const res = await fetch(`${config.garminServiceUrl}/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, since }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error(`Garmin service error: ${(err as { error: string }).error}`);
  }

  return res.json() as Promise<GarminSyncResponse>;
}

export function normalizeGarminEnergy(userId: string, data: GarminSyncResponse) {
  const energy = data.energy ?? [];
  return energy
    .filter((e) => e.total_kcal != null || e.active_kcal != null || e.bmr_kcal != null)
    .map((e) => ({
      user_id: userId,
      date: e.date,
      wearable_kcal: e.total_kcal,
      active_kcal: e.active_kcal,
      bmr_kcal: e.bmr_kcal,
      // tdee_kcal / correction_k are filled by the TDEE engine in a later phase;
      // for now mirror wearable_kcal so callers have a usable figure.
      tdee_kcal: e.total_kcal,
      correction_k: 1,
      source: "wearable" as const,
      updated_at: new Date().toISOString(),
    }));
}

export async function syncGarminForUser(
  userId: string,
  credentials: { email: string; password: string },
  since?: string,
): Promise<number> {
  const email = decrypt(credentials.email, config.encryptionKey);
  const password = decrypt(credentials.password, config.encryptionKey);

  const sinceDate = since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const data = await fetchFromGarminService(email, password, sinceDate);
  const rows = normalizeGarminData(userId, data);

  if (rows.length > 0) {
    const { error } = await supabase
      .from("recovery_logs")
      .upsert(rows, { onConflict: "user_id,date" });

    if (error) throw error;
  }

  const energyRows = normalizeGarminEnergy(userId, data);
  if (energyRows.length > 0) {
    const { error } = await supabase
      .from("expenditure_daily")
      .upsert(energyRows, { onConflict: "user_id,date" });

    if (error) throw error;
  }

  return rows.length;
}

export async function syncAllGarmin(): Promise<void> {
  const integrations = await getActiveIntegrations("garmin");

  for (const integration of integrations) {
    try {
      const creds = integration.credentials as { email: string; password: string };
      const since = integration.last_synced_at
        ? new Date(integration.last_synced_at).toISOString().slice(0, 10)
        : undefined;

      const count = await syncGarminForUser(integration.user_id, creds, since);
      await updateSyncTimestamp(integration.user_id, "garmin");
      await logSync({ userId: integration.user_id, provider: "garmin", recordsSynced: count });
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unknown error";
      await logSync({ userId: integration.user_id, provider: "garmin", recordsSynced: 0, error });
      await markIntegrationError(integration.user_id, "garmin");
    }
  }
}

interface GarminActivity {
  activity_id: string;
  date: string;
  start_time: string | null;
  type: string;
  distance_km: number;
  duration_sec: number;
  avg_hr: number | null;
  max_hr: number | null;
  calories: number | null;
  elevation: number | null;
  pace_or_speed: number | null;
  training_effect_aerobic: number | null;
  training_effect_anaerobic: number | null;
  vo2_max: number | null;
  recovery_time_min: number | null;
  avg_respiration: number | null;
  avg_cadence: number | null;
  avg_stride_length: number | null;
  ground_contact_time: number | null;
  hr_zones: unknown[] | null;
  splits: unknown[] | null;
}

export function isMatchingActivity(
  strava: { start_time: string | null; type: string; duration: number },
  garmin: { start_time: string | null; type: string; duration_sec: number },
): boolean {
  if (!strava.start_time || !garmin.start_time) return false;
  if (strava.type !== garmin.type) return false;
  const stravaTime = new Date(strava.start_time).getTime();
  const garminTime = new Date(garmin.start_time).getTime();
  if (Math.abs(stravaTime - garminTime) > 10 * 60 * 1000) return false;
  const durationRatio = strava.duration / garmin.duration_sec;
  if (durationRatio < 0.8 || durationRatio > 1.2) return false;
  return true;
}

async function fetchGarminActivities(email: string, password: string, since: string): Promise<GarminActivity[]> {
  const res = await fetch(`${config.garminServiceUrl}/sync-activities`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, since }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error(`Garmin activity sync error: ${(err as { error: string }).error}`);
  }
  const data = await res.json() as { activities: GarminActivity[] };
  return data.activities;
}

export async function syncGarminActivitiesForUser(
  userId: string,
  credentials: { email: string; password: string },
  since?: string,
): Promise<number> {
  const email = decrypt(credentials.email, config.encryptionKey);
  const password = decrypt(credentials.password, config.encryptionKey);
  const sinceDate = since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const garminActivities = await fetchGarminActivities(email, password, sinceDate);
  if (garminActivities.length === 0) return 0;

  const dates = garminActivities.map((a) => a.date);
  const minDate = dates.sort()[0];
  const maxDate = [...dates].sort().reverse()[0];

  const { data: existingRows } = await supabase
    .from("cardio_logs")
    .select("id, date, activity_id, type, duration, start_time, source")
    .eq("user_id", userId)
    .gte("date", minDate)
    .lte("date", maxDate);

  const existing = existingRows || [];
  let synced = 0;

  for (const garmin of garminActivities) {
    const match = existing.find((s) =>
      s.date === garmin.date && isMatchingActivity(
        { start_time: s.start_time, type: s.type, duration: s.duration },
        { start_time: garmin.start_time, type: garmin.type, duration_sec: garmin.duration_sec },
      )
    );

    if (match) {
      const { error } = await supabase
        .from("cardio_logs")
        .update({
          max_hr: garmin.max_hr,
          training_effect_aerobic: garmin.training_effect_aerobic,
          training_effect_anaerobic: garmin.training_effect_anaerobic,
          vo2_max: garmin.vo2_max,
          recovery_time_min: garmin.recovery_time_min,
          avg_respiration: garmin.avg_respiration,
          avg_cadence: garmin.avg_cadence,
          avg_stride_length: garmin.avg_stride_length,
          ground_contact_time: garmin.ground_contact_time,
          hr_zones: garmin.hr_zones,
          splits: garmin.splits,
          avg_hr: garmin.avg_hr ?? undefined,
          source: "merged",
          synced_at: new Date().toISOString(),
        })
        .eq("id", match.id);
      if (!error) synced++;
    } else {
      const { error } = await supabase
        .from("cardio_logs")
        .upsert({
          user_id: userId,
          date: garmin.date,
          activity_id: `garmin_${garmin.activity_id}`,
          start_time: garmin.start_time,
          type: garmin.type,
          distance: garmin.distance_km,
          duration: garmin.duration_sec,
          avg_hr: garmin.avg_hr,
          max_hr: garmin.max_hr,
          calories: garmin.calories,
          elevation: garmin.elevation,
          pace_or_speed: garmin.pace_or_speed,
          training_effect_aerobic: garmin.training_effect_aerobic,
          training_effect_anaerobic: garmin.training_effect_anaerobic,
          vo2_max: garmin.vo2_max,
          recovery_time_min: garmin.recovery_time_min,
          avg_respiration: garmin.avg_respiration,
          avg_cadence: garmin.avg_cadence,
          avg_stride_length: garmin.avg_stride_length,
          ground_contact_time: garmin.ground_contact_time,
          hr_zones: garmin.hr_zones,
          splits: garmin.splits,
          source: "garmin",
          synced_at: new Date().toISOString(),
        }, { onConflict: "user_id,activity_id" });
      if (!error) synced++;
    }
  }

  return synced;
}

export async function syncAllGarminActivities(): Promise<void> {
  const integrations = await getActiveIntegrations("garmin");

  for (const integration of integrations) {
    try {
      const creds = integration.credentials as { email: string; password: string };
      const since = integration.last_synced_at
        ? new Date(integration.last_synced_at).toISOString().slice(0, 10)
        : undefined;
      const count = await syncGarminActivitiesForUser(integration.user_id, creds, since);
      await logSync({ userId: integration.user_id, provider: "garmin", recordsSynced: count });
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unknown error";
      await logSync({ userId: integration.user_id, provider: "garmin", recordsSynced: 0, error });
    }
  }
}
