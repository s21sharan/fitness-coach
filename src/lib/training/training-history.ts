import { computeMuscleVolume, MUSCLE_GROUPS } from "@/lib/exercise-muscles";

interface WorkoutInput {
  date: string;
  exercises: Array<{
    name: string;
    sets: Array<{ weight_kg: number; reps: number; rpe: number | null }>;
  }>;
}

export interface ExerciseHistoryEntry {
  name: string;
  sessions: number;
  bestWeight: number;
  bestReps: number;
  totalSets: number;
  lastRpe: number | null;
  progression: "up" | "down" | "plateau" | "single";
}

export interface TrainingHistory {
  muscleVolume: Record<string, { sets: number; volume: number }>;
  exerciseHistory: ExerciseHistoryEntry[];
}

export function buildTrainingHistory(workouts: WorkoutInput[]): TrainingHistory {
  // Aggregate all exercises for muscle volume
  const allExercises: Array<{ name: string; sets: Array<{ weight_kg: number; reps: number }> }> = [];
  for (const w of workouts) {
    if (!Array.isArray(w.exercises)) continue;
    for (const ex of w.exercises) {
      allExercises.push({ name: ex.name, sets: ex.sets });
    }
  }
  const rawVolume = computeMuscleVolume(allExercises);

  // Ensure all 11 muscle groups are present (even with 0)
  const muscleVolume: Record<string, { sets: number; volume: number }> = {};
  for (const g of MUSCLE_GROUPS) {
    muscleVolume[g] = rawVolume[g] ?? { sets: 0, volume: 0 };
  }

  // Build per-exercise history
  const exerciseMap = new Map<
    string,
    {
      sessionWeights: number[];
      totalSets: number;
      bestWeight: number;
      bestReps: number;
      lastRpe: number | null;
    }
  >();

  // Sort workouts by date ascending so "last" RPE is most recent
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));

  for (const w of sorted) {
    if (!Array.isArray(w.exercises)) continue;
    for (const ex of w.exercises) {
      if (!exerciseMap.has(ex.name)) {
        exerciseMap.set(ex.name, {
          sessionWeights: [],
          totalSets: 0,
          bestWeight: 0,
          bestReps: 0,
          lastRpe: null,
        });
      }
      const entry = exerciseMap.get(ex.name)!;
      entry.totalSets += ex.sets.length;

      let sessionMax = 0;
      for (const s of ex.sets) {
        if (
          s.weight_kg > entry.bestWeight ||
          (s.weight_kg === entry.bestWeight && s.reps > entry.bestReps)
        ) {
          entry.bestWeight = s.weight_kg;
          entry.bestReps = s.reps;
        }
        if (s.weight_kg > sessionMax) sessionMax = s.weight_kg;
        if (s.rpe != null) entry.lastRpe = s.rpe;
      }
      entry.sessionWeights.push(sessionMax);
    }
  }

  const exerciseHistory: ExerciseHistoryEntry[] = [];
  for (const [name, data] of exerciseMap) {
    let progression: ExerciseHistoryEntry["progression"] = "single";
    if (data.sessionWeights.length >= 2) {
      const first = data.sessionWeights[0];
      const last = data.sessionWeights[data.sessionWeights.length - 1];
      const allSame = data.sessionWeights.every((w) => w === first);
      if (allSame) {
        progression = "plateau";
      } else if (last > first) {
        progression = "up";
      } else {
        progression = "down";
      }
    }

    exerciseHistory.push({
      name,
      sessions: data.sessionWeights.length,
      bestWeight: data.bestWeight,
      bestReps: data.bestReps,
      totalSets: data.totalSets,
      lastRpe: data.lastRpe,
      progression,
    });
  }

  return { muscleVolume, exerciseHistory };
}
