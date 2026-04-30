import { supabase } from "../db.js";
import { config } from "../config.js";
import { HevyClient, type HevyWorkout } from "../integrations/hevy-client.js";
import { decrypt } from "../utils/encryption.js";
import { getActiveIntegrations, logSync, updateSyncTimestamp, markIntegrationError } from "./base.js";

interface NormalizedExercise {
  name: string;
  sets: { index: number; type: string; weight_kg: number | null; reps: number | null; rpe: number | null }[];
}

export function normalizeWorkout(userId: string, workout: HevyWorkout) {
  const startMs = new Date(workout.start_time).getTime();
  const endMs = new Date(workout.end_time).getTime();
  const durationMinutes = Math.round((endMs - startMs) / 60_000);

  const exercises: NormalizedExercise[] = workout.exercises.map((ex) => ({
    name: ex.title,
    sets: ex.sets.map((s) => ({
      index: s.index,
      type: s.type,
      weight_kg: s.weight_kg,
      reps: s.reps,
      rpe: s.rpe,
    })),
  }));

  return {
    user_id: userId,
    date: workout.start_time.slice(0, 10),
    workout_id: workout.id,
    name: workout.title,
    duration_minutes: durationMinutes,
    exercises,
    synced_at: new Date().toISOString(),
  };
}

export async function syncHevyForUser(userId: string, apiKeyEncrypted: string, since?: string): Promise<number> {
  const apiKey = decrypt(apiKeyEncrypted, config.encryptionKey);
  const client = new HevyClient(apiKey);

  let workouts: HevyWorkout[];

  if (since) {
    const events = await client.getWorkoutEvents(since);
    workouts = events
      .filter((e) => e.type === "updated" && e.workout)
      .map((e) => e.workout!);

    const deletedIds = events
      .filter((e) => e.type === "deleted" && e.id)
      .map((e) => e.id!);

    if (deletedIds.length > 0) {
      await supabase
        .from("workout_logs")
        .delete()
        .eq("user_id", userId)
        .in("workout_id", deletedIds);
    }
  } else {
    workouts = await client.getWorkouts();
  }

  const rows = workouts.map((w) => normalizeWorkout(userId, w));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("workout_logs")
      .upsert(rows, { onConflict: "user_id,workout_id" });

    if (error) throw error;
  }

  return rows.length;
}

export async function syncAllHevy(): Promise<void> {
  const integrations = await getActiveIntegrations("hevy");

  for (const integration of integrations) {
    try {
      const since = integration.last_synced_at || undefined;
      const count = await syncHevyForUser(integration.user_id, integration.access_token!, since);
      await updateSyncTimestamp(integration.user_id, "hevy");
      await logSync({ userId: integration.user_id, provider: "hevy", recordsSynced: count });
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unknown error";
      await logSync({ userId: integration.user_id, provider: "hevy", recordsSynced: 0, error });
      await markIntegrationError(integration.user_id, "hevy");
    }
  }
}
