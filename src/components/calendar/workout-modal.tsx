"use client";

import { useEffect, useCallback } from "react";
import { mapExerciseToMuscles, computeMuscleVolume } from "@/lib/exercise-muscles";
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

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
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

function formatVolume(kg: number, unit: "kg" | "lbs"): string {
  const val = convertWeight(kg, unit);
  return val.toLocaleString("en-US", { maximumFractionDigits: 0 }) + " " + weightLabel(unit);
}

// Epley formula: weight × (1 + reps/30)
function epley1RM(weightKg: number, reps: number): number {
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
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

export function WorkoutModal({ workout, open, onClose }: WorkoutModalProps) {
  const handleEsc = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

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

  if (!open) return null;

  const unitPrefs = getUnitPreferences();
  const weightUnit = unitPrefs.weight;

  // Normalize exercises — guard against unknown shape
  const exercises: ExerciseData[] = Array.isArray(workout.exercises)
    ? (workout.exercises as ExerciseData[])
    : [];

  // --- Computed metrics ---
  let totalVolumeKg = 0;
  let workingSets = 0;
  let rpeSum = 0;
  let rpeCount = 0;

  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (s.type === "normal") {
        totalVolumeKg += s.weight_kg * s.reps;
        workingSets++;
      }
      if (s.rpe != null) {
        rpeSum += s.rpe;
        rpeCount++;
      }
    }
  }

  const avgRpe = rpeCount > 0 ? (rpeSum / rpeCount).toFixed(1) : null;
  const muscleVolume = exercises.length > 0 ? computeMuscleVolume(exercises) : {};
  const maxMuscleVolume = Math.max(...Object.values(muscleVolume).map((v) => v.volume), 1);

  // Per-exercise stats
  const exerciseRows = exercises.map((ex) => {
    const { primary } = mapExerciseToMuscles(ex.name);
    const muscleTag = primary[0] ?? "other";

    let bestWeightKg = 0;
    let bestReps = 0;
    let totalSets = 0;
    let totalReps = 0;
    let exVolumeKg = 0;

    for (const s of ex.sets) {
      totalSets++;
      totalReps += s.reps;
      exVolumeKg += s.weight_kg * s.reps;

      const score = s.weight_kg * s.reps;
      const bestScore = bestWeightKg * bestReps;
      if (score > bestScore || (score === bestScore && s.weight_kg > bestWeightKg)) {
        bestWeightKg = s.weight_kg;
        bestReps = s.reps;
      }
    }

    const e1rmKg = epley1RM(bestWeightKg, bestReps);

    return {
      name: ex.name,
      muscleTag,
      bestWeightKg,
      bestReps,
      totalSets,
      totalReps,
      exVolumeKg,
      e1rmKg,
    };
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          width: "min(95vw, 760px)",
          maxHeight: "90vh",
          overflow: "auto",
          padding: "28px 32px",
          boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 800,
                color: "#0F1B22",
                lineHeight: 1.2,
              }}
            >
              {workout.name}
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>
              {formatDate(workout.date)}
              {workout.duration_minutes > 0 && (
                <span style={{ marginLeft: 10 }}>
                  <span style={{ color: "#d1d5db" }}>·</span>
                  {"  "}
                  {formatDuration(workout.duration_minutes)}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: "#f3f4f6",
              border: "none",
              cursor: "pointer",
              fontSize: 20,
              color: "#6b7280",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* ── Key Metrics Row ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            marginBottom: 28,
          }}
        >
          {[
            {
              label: "Total Volume",
              value: formatVolume(totalVolumeKg, weightUnit),
              accent: "#eab308",
            },
            {
              label: "Working Sets",
              value: String(workingSets),
              accent: "#3b82f6",
            },
            {
              label: "Exercises",
              value: String(exercises.length),
              accent: "#10b981",
            },
            {
              label: "Avg RPE",
              value: avgRpe ?? "—",
              accent: "#ef4444",
            },
          ].map((card) => (
            <div
              key={card.label}
              style={{
                background: "#f9fafb",
                borderRadius: 10,
                padding: "14px 16px",
                borderTop: `3px solid ${card.accent}`,
              }}
            >
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                {card.label}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#0F1B22" }}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* ── Exercise Breakdown ── */}
        {exerciseRows.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <h3
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#6b7280",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                margin: "0 0 12px",
              }}
            >
              Exercise Breakdown
            </h3>

            {/* Table header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1.2fr 1fr 1.2fr 1.1fr",
                gap: 8,
                padding: "6px 10px",
                background: "#f3f4f6",
                borderRadius: 8,
                marginBottom: 4,
              }}
            >
              {["Exercise", "Muscle", "Best Set", "Sets × Reps", "Volume", "E1RM"].map((h) => (
                <div
                  key={h}
                  style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}
                >
                  {h}
                </div>
              ))}
            </div>

            {/* Table rows */}
            {exerciseRows.map((row, i) => {
              const muscleColor = MUSCLE_COLORS[row.muscleTag] ?? "#9ca3af";
              return (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1.2fr 1fr 1.2fr 1.1fr",
                    gap: 8,
                    padding: "10px 10px",
                    borderBottom: i < exerciseRows.length - 1 ? "1px solid #f3f4f6" : "none",
                    alignItems: "center",
                  }}
                >
                  {/* Name */}
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0F1B22" }}>{row.name}</div>

                  {/* Muscle tag */}
                  <div>
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "capitalize",
                        padding: "2px 7px",
                        borderRadius: 20,
                        background: muscleColor + "20",
                        color: muscleColor,
                        border: `1px solid ${muscleColor}40`,
                      }}
                    >
                      {row.muscleTag}
                    </span>
                  </div>

                  {/* Best set */}
                  <div style={{ fontSize: 13, color: "#374151" }}>
                    {formatVolume(row.bestWeightKg, weightUnit).replace(/ (kg|lbs)$/, "")} {weightUnit} × {row.bestReps}
                  </div>

                  {/* Sets × total reps */}
                  <div style={{ fontSize: 13, color: "#374151" }}>
                    {row.totalSets} × {row.totalReps}
                  </div>

                  {/* Volume */}
                  <div style={{ fontSize: 13, color: "#374151" }}>
                    {formatVolume(row.exVolumeKg, weightUnit)}
                  </div>

                  {/* E1RM */}
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#eab308" }}>
                    {formatVolume(row.e1rmKg, weightUnit)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Muscle Groups Hit ── */}
        {Object.keys(muscleVolume).length > 0 && (
          <div>
            <h3
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#6b7280",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                margin: "0 0 14px",
              }}
            >
              Muscles Trained
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(muscleVolume)
                .sort((a, b) => b[1].volume - a[1].volume)
                .map(([muscle, data]) => {
                  const color = MUSCLE_COLORS[muscle] ?? "#9ca3af";
                  const pct = Math.round((data.volume / maxMuscleVolume) * 100);
                  const displayVolume = formatVolume(data.volume, weightUnit);
                  return (
                    <div key={muscle} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {/* Label */}
                      <div
                        style={{
                          width: 88,
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#374151",
                          textTransform: "capitalize",
                          flexShrink: 0,
                        }}
                      >
                        {muscle}
                      </div>

                      {/* Bar track */}
                      <div
                        style={{
                          flex: 1,
                          height: 8,
                          background: "#f3f4f6",
                          borderRadius: 4,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: "100%",
                            background: color,
                            borderRadius: 4,
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>

                      {/* Stats */}
                      <div
                        style={{
                          width: 110,
                          fontSize: 11,
                          color: "#6b7280",
                          textAlign: "right",
                          flexShrink: 0,
                        }}
                      >
                        {data.sets} sets · {displayVolume}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {exercises.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "32px 0",
              color: "#9ca3af",
              fontSize: 14,
            }}
          >
            No exercise data available for this workout.
          </div>
        )}
      </div>
    </div>
  );
}
