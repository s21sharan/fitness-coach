"use client";

import { useCallback, useEffect, useMemo } from "react";
import { mapExerciseToMuscles } from "@/lib/exercise-muscles";
import { getUnitPreferences, convertWeight, weightLabel } from "@/lib/units";

interface SetData {
  index: number;
  type: string;
  weight_kg: number;
  reps: number;
  rpe: number | null;
}

interface ExerciseData {
  name: string;
  sets: SetData[];
}

interface WorkoutLog {
  date: string;
  workout_id: string;
  name: string;
  duration_minutes: number;
  exercises: ExerciseData[] | unknown;
}

interface WorkoutModalProps {
  workout: WorkoutLog;
  open: boolean;
  onClose: () => void;
}

const MUSCLE_COLORS: Record<string, string> = {
  chest: "#ef4444",
  back: "#3b82f6",
  shoulders: "#8b5cf6",
  biceps: "#06b6d4",
  triceps: "#f97316",
  quads: "#10b981",
  hamstrings: "#84cc16",
  glutes: "#ec4899",
  calves: "#14b8a6",
  core: "#f59e0b",
  forearms: "#6366f1",
  other: "#9ca3af",
};

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatWeight(kg: number, unit: "kg" | "lbs"): string {
  const val = convertWeight(kg, unit);
  return val.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function WorkoutModal({ workout, open, onClose }: WorkoutModalProps) {
  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [open, handleEsc]);

  const unitPrefs = getUnitPreferences();
  const weightUnit = unitPrefs.weight;
  const unitLabel = weightLabel(weightUnit);

  const exercises: ExerciseData[] = useMemo(() =>
    Array.isArray(workout.exercises) ? (workout.exercises as ExerciseData[]) : [],
  [workout.exercises]);

  const { totalVolumeKg, workingSets, totalSets, avgRpe } = useMemo(() => {
    let totalVolumeKg = 0;
    let workingSets = 0;
    let totalSets = 0;
    const rpes: number[] = [];
    for (const ex of exercises) {
      for (const s of ex.sets) {
        totalSets++;
        if (s.type === "normal") {
          totalVolumeKg += s.weight_kg * s.reps;
          workingSets++;
        }
        if (s.rpe != null) rpes.push(s.rpe);
      }
    }
    const avgRpe = rpes.length > 0 ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
    return { totalVolumeKg, workingSets, totalSets, avgRpe };
  }, [exercises]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 14,
          width: "min(96vw, 640px)", maxHeight: "92vh", overflow: "auto",
          padding: "24px 28px",
          boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 11,
              background: "#fef9c3", border: "1.5px solid #eab308",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22,
            }}>🏋️</div>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0F1B22", lineHeight: 1.2, letterSpacing: "-0.02em" }}>
                {workout.name || "Workout"}
              </h2>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6b7280" }}>
                {formatDate(workout.date)}
                {workout.duration_minutes > 0 && <> · {formatDuration(workout.duration_minutes)}</>}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 8,
              background: "#f3f4f6", border: "none", cursor: "pointer",
              fontSize: 18, color: "#6b7280",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* Metrics */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 10,
          marginBottom: 20,
        }}>
          <Metric label="Volume" value={`${formatWeight(totalVolumeKg, weightUnit)}`} sub={unitLabel} />
          <Metric label="Working Sets" value={`${workingSets}`} sub={totalSets !== workingSets ? `${totalSets} total` : undefined} />
          <Metric label="Avg RPE" value={avgRpe != null ? avgRpe.toFixed(1) : "—"} />
        </div>

        {/* Exercises */}
        {exercises.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {exercises.map((ex, i) => (
              <ExerciseBlock key={i} exercise={ex} weightUnit={weightUnit} />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "32px 0", color: "#9ca3af", fontSize: 13 }}>
            No exercise data available.
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: "#f9fafb", borderRadius: 10,
      padding: "10px 12px",
      border: "1px solid #f3f4f6",
    }}>
      <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <div style={{ display: "baseline", fontSize: 18, fontWeight: 800, color: "#0F1B22", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
        {value}
        {sub && <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, marginLeft: 4 }}>{sub}</span>}
      </div>
    </div>
  );
}

function ExerciseBlock({ exercise, weightUnit }: { exercise: ExerciseData; weightUnit: "kg" | "lbs" }) {
  const { primary } = mapExerciseToMuscles(exercise.name);
  const muscleTag = primary[0] ?? "other";
  const muscleColor = MUSCLE_COLORS[muscleTag] ?? "#9ca3af";

  let volumeKg = 0;
  let workingSets = 0;
  for (const s of exercise.sets) {
    if (s.type === "normal") {
      volumeKg += s.weight_kg * s.reps;
      workingSets++;
    }
  }

  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      padding: "12px 14px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{
            fontSize: 14, fontWeight: 700, color: "#0F1B22",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{exercise.name}</span>
          <span style={{
            display: "inline-block", fontSize: 10, fontWeight: 700,
            textTransform: "capitalize", padding: "2px 7px", borderRadius: 20,
            background: muscleColor + "20", color: muscleColor, border: `1px solid ${muscleColor}40`,
            flexShrink: 0,
          }}>{muscleTag}</span>
        </div>
        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, flexShrink: 0 }}>
          {workingSets} {workingSets === 1 ? "set" : "sets"} · {formatWeight(volumeKg, weightUnit)} {weightLabel(weightUnit)}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {exercise.sets.map((s, i) => (
          <SetRow key={i} setNum={i + 1} set={s} weightUnit={weightUnit} isLast={i === exercise.sets.length - 1} />
        ))}
      </div>
    </div>
  );
}

function SetRow({ setNum, set, weightUnit, isLast }: { setNum: number; set: SetData; weightUnit: "kg" | "lbs"; isLast: boolean }) {
  const isWarmup = set.type !== "normal";
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "48px 1fr 1fr 1fr auto",
      alignItems: "center",
      gap: 12,
      padding: "8px 4px",
      borderBottom: isLast ? "none" : "1px solid #f3f4f6",
      fontSize: 13,
      color: "#0F1B22",
    }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af" }}>Set {setNum}</span>
      <span style={{ fontWeight: 700 }}>
        {formatWeight(set.weight_kg, weightUnit)} <span style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af" }}>{weightLabel(weightUnit)}</span>
      </span>
      <span style={{ color: "#374151" }}>
        <span style={{ color: "#9ca3af" }}>×</span> <span style={{ fontWeight: 700 }}>{set.reps}</span>
      </span>
      <span style={{ color: "#374151" }}>
        {set.rpe != null ? (
          <>
            <span style={{ color: "#9ca3af" }}>@</span> <span style={{ fontWeight: 700 }}>{set.rpe}</span>
          </>
        ) : (
          <span style={{ color: "#d1d5db" }}>—</span>
        )}
      </span>
      <span style={{ minWidth: 48, textAlign: "right" }}>
        {isWarmup && (
          <span style={{
            fontSize: 9, fontWeight: 700, color: "#9ca3af",
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>warmup</span>
        )}
      </span>
    </div>
  );
}
