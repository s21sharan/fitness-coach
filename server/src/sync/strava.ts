import { supabase } from "../db.js";
import { config } from "../config.js";
import { StravaClient, type StravaActivity } from "../integrations/strava-client.js";
import { StravaTokenManager } from "../integrations/token-manager.js";
import { getActiveIntegrations, logSync, updateSyncTimestamp, markIntegrationError } from "./base.js";

const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);
const BIKE_TYPES = new Set(["Ride", "GravelRide", "VirtualRide", "EBikeRide", "EMountainBikeRide", "MountainBikeRide"]);
const SWIM_TYPES = new Set(["Swim"]);

export function mapSportType(sportType: string): "run" | "bike" | "swim" | "other" {
  if (RUN_TYPES.has(sportType)) return "run";
  if (BIKE_TYPES.has(sportType)) return "bike";
  if (SWIM_TYPES.has(sportType)) return "swim";
  return "other";
}

export function normalizeActivity(userId: string, activity: StravaActivity) {
  const type = mapSportType(activity.sport_type);
  const distanceKm = activity.distance / 1000;

  let paceOrSpeed: number | null = null;
  if (activity.distance > 0 && activity.moving_time > 0) {
    if (type === "run") {
      paceOrSpeed = (activity.moving_time / 60) / distanceKm;
    } else {
      paceOrSpeed = distanceKm / (activity.moving_time / 3600);
    }
  }

  return {
    user_id: userId,
    date: activity.start_date.slice(0, 10),
    activity_id: String(activity.id),
    type,
    distance: Math.round(distanceKm * 100) / 100,
    duration: activity.moving_time,
    avg_hr: activity.has_heartrate ? (activity.average_heartrate ?? null) : null,
    calories: activity.calories ?? null,
    pace_or_speed: paceOrSpeed ? Math.round(paceOrSpeed * 100) / 100 : null,
    elevation: activity.total_elevation_gain ?? null,
    synced_at: new Date().toISOString(),
  };
}

export async function syncStravaForUser(userId: string, sinceEpoch?: number): Promise<number> {
  const tokenManager = new StravaTokenManager(userId, config.stravaClientId, config.stravaClientSecret);
  const client = new StravaClient(tokenManager);

  const after = sinceEpoch || Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
  const activities = await client.getAllActivitiesSince(after);

  const detailed: StravaActivity[] = [];
  for (const a of activities) {
    const detail = await client.getActivity(a.id);
    detailed.push(detail);
  }

  const rows = detailed.map((a) => normalizeActivity(userId, a));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("cardio_logs")
      .upsert(rows, { onConflict: "user_id,activity_id" });

    if (error) throw error;
  }

  return rows.length;
}

export async function syncStravaActivity(userId: string, activityId: number): Promise<void> {
  const tokenManager = new StravaTokenManager(userId, config.stravaClientId, config.stravaClientSecret);
  const client = new StravaClient(tokenManager);

  const activity = await client.getActivity(activityId);
  const row = normalizeActivity(userId, activity);

  const { error } = await supabase
    .from("cardio_logs")
    .upsert([row], { onConflict: "user_id,activity_id" });

  if (error) throw error;
}

export async function syncAllStrava(): Promise<void> {
  const integrations = await getActiveIntegrations("strava");

  for (const integration of integrations) {
    try {
      const sinceEpoch = integration.last_synced_at
        ? Math.floor(new Date(integration.last_synced_at).getTime() / 1000)
        : undefined;

      const count = await syncStravaForUser(integration.user_id, sinceEpoch);
      await updateSyncTimestamp(integration.user_id, "strava");
      await logSync({ userId: integration.user_id, provider: "strava", recordsSynced: count });
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unknown error";
      await logSync({ userId: integration.user_id, provider: "strava", recordsSynced: 0, error });
      await markIntegrationError(integration.user_id, "strava");
    }
  }
}
