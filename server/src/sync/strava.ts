import { supabase } from "../db.js";
import { config } from "../config.js";
import { StravaClient, type StravaActivity } from "../integrations/strava-client.js";
import { StravaTokenManager } from "../integrations/token-manager.js";
import { getActiveIntegrations, logSync, updateSyncTimestamp, markIntegrationError } from "./base.js";
import { reconcileUserActivities } from "./reconcile.js";
import type { ActivityCategory } from "./providers.js";

const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);
const BIKE_TYPES = new Set(["Ride", "GravelRide", "VirtualRide", "EBikeRide", "EMountainBikeRide", "MountainBikeRide"]);
const SWIM_TYPES = new Set(["Swim"]);
// Strava's strength-coded sport_types. "Workout" is generic but lifters
// commonly use it for gym sessions; we still map it to strength so the
// reconciler can compare against Hevy. If the user's gym session was
// actually some other indoor session, the reconciler simply won't find
// a Hevy match and the row stays as-is.
const STRENGTH_TYPES = new Set(["WeightTraining", "Crossfit", "Workout"]);

export function mapSportType(sportType: string): ActivityCategory {
  if (RUN_TYPES.has(sportType)) return "run";
  if (BIKE_TYPES.has(sportType)) return "bike";
  if (SWIM_TYPES.has(sportType)) return "swim";
  if (STRENGTH_TYPES.has(sportType)) return "strength";
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
    // start_date_local is the activity's local calendar time at the activity location.
    date: activity.start_date_local.slice(0, 10),
    activity_id: String(activity.id),
    type,
    distance: Math.round(distanceKm * 100) / 100,
    duration: activity.moving_time,
    avg_hr: activity.has_heartrate && activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
    calories: activity.calories ?? null,
    pace_or_speed: paceOrSpeed ? Math.round(paceOrSpeed * 100) / 100 : null,
    elevation: activity.total_elevation_gain ?? null,
    start_time: activity.start_date || null,
    source: "strava" as const,
    synced_at: new Date().toISOString(),
  };
}

export async function syncStravaForUser(userId: string, sinceEpoch?: number): Promise<number> {
  const tokenManager = new StravaTokenManager(userId, config.stravaClientId, config.stravaClientSecret);
  const client = new StravaClient(tokenManager);

  // Use `??` so a caller can pass `0` (epoch) for a full backfill without
  // silently falling back to the default. The default covers 30 days so
  // first-time syncs (last_synced_at null) don't dribble in one day at a
  // time — the cron-style "incremental" callers always pass a sinceEpoch.
  const after = sinceEpoch ?? Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
  // SummaryActivity from /athlete/activities already includes everything we
  // store except `calories`. Skipping the per-activity getActivity() call cuts
  // the backfill from N+1 requests to ~ceil(N/30), which keeps us well under
  // Strava's 200/15min limit.
  const activities = await client.getAllActivitiesSince(after);

  const rows = activities.map((a) => normalizeActivity(userId, a));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("cardio_logs")
      .upsert(rows, { onConflict: "user_id,activity_id" });

    if (error) throw error;

    const dates = rows.map((r) => r.date).sort();
    await reconcileUserActivities(userId, { from: dates[0], to: dates[dates.length - 1] });
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

  await reconcileUserActivities(userId, { from: row.date, to: row.date });
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
