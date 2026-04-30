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

interface GarminSyncResponse {
  dates: string[];
  resting_hr: GarminMetric[];
  hrv: GarminMetric[];
  sleep: GarminMetric[];
  body_battery: GarminMetric[];
  stress: GarminMetric[];
  steps: GarminMetric[];
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
