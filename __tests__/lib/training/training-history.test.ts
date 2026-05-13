import { describe, it, expect } from "vitest";
import { buildTrainingHistory, type TrainingHistory } from "@/lib/training/training-history";

const makeWorkout = (date: string, exercises: Array<{ name: string; sets: Array<{ weight_kg: number; reps: number; rpe: number | null }> }>) => ({
  date,
  workout_id: `w-${date}`,
  name: "Test",
  duration_minutes: 60,
  exercises,
});

describe("buildTrainingHistory", () => {
  it("computes muscle volume from exercises", () => {
    const workouts = [
      makeWorkout("2026-05-10", [
        { name: "Bench Press (Barbell)", sets: [{ weight_kg: 80, reps: 8, rpe: 7 }, { weight_kg: 80, reps: 8, rpe: 8 }] },
      ]),
    ];
    const result = buildTrainingHistory(workouts);
    expect(result.muscleVolume.chest.sets).toBe(2);
    expect(result.muscleVolume.chest.volume).toBe(80 * 8 * 2);
  });

  it("tracks exercise history with best set and session count", () => {
    const workouts = [
      makeWorkout("2026-05-08", [
        { name: "Bench Press (Barbell)", sets: [{ weight_kg: 80, reps: 6, rpe: 8 }] },
      ]),
      makeWorkout("2026-05-10", [
        { name: "Bench Press (Barbell)", sets: [{ weight_kg: 85, reps: 6, rpe: 9 }] },
      ]),
    ];
    const result = buildTrainingHistory(workouts);
    const bench = result.exerciseHistory.find(e => e.name === "Bench Press (Barbell)");
    expect(bench).toBeDefined();
    expect(bench!.sessions).toBe(2);
    expect(bench!.bestWeight).toBe(85);
    expect(bench!.bestReps).toBe(6);
    expect(bench!.lastRpe).toBe(9);
    expect(bench!.progression).toBe("up");
  });

  it("detects weight plateau (same weight across sessions)", () => {
    const workouts = [
      makeWorkout("2026-05-06", [
        { name: "Squat (Barbell)", sets: [{ weight_kg: 100, reps: 5, rpe: 8 }] },
      ]),
      makeWorkout("2026-05-08", [
        { name: "Squat (Barbell)", sets: [{ weight_kg: 100, reps: 5, rpe: 8 }] },
      ]),
      makeWorkout("2026-05-10", [
        { name: "Squat (Barbell)", sets: [{ weight_kg: 100, reps: 5, rpe: 8 }] },
      ]),
    ];
    const result = buildTrainingHistory(workouts);
    const squat = result.exerciseHistory.find(e => e.name === "Squat (Barbell)");
    expect(squat!.progression).toBe("plateau");
  });

  it("identifies muscles with zero volume", () => {
    const workouts = [
      makeWorkout("2026-05-10", [
        { name: "Bench Press (Barbell)", sets: [{ weight_kg: 80, reps: 8, rpe: 7 }] },
      ]),
    ];
    const result = buildTrainingHistory(workouts);
    expect(result.muscleVolume.calves.sets).toBe(0);
    expect(result.muscleVolume.core.sets).toBe(0);
  });

  it("returns empty structures when no workouts", () => {
    const result = buildTrainingHistory([]);
    expect(result.exerciseHistory).toEqual([]);
    expect(result.muscleVolume.chest.sets).toBe(0);
  });
});
