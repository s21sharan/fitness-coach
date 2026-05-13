"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import { mapExerciseToMuscles, computeMuscleVolume } from "@/lib/exercise-muscles";
import { getUnitPreferences, convertWeight, weightLabel } from "@/lib/units";
import { chartColors, tooltipStyle, tooltipItemStyle, tooltipLabelStyle, gridProps, axisProps } from "@/components/charts/chart-theme";

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

const EXERCISE_PALETTE = [
  "#eab308", "#3b82f6", "#ef4444", "#10b981", "#8b5cf6",
  "#f97316", "#06b6d4", "#ec4899", "#84cc16", "#6366f1",
];

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
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

function formatWeightOnly(kg: number, unit: "kg" | "lbs"): string {
  const val = convertWeight(kg, unit);
  return val.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

// Epley formula
function epley1RM(weightKg: number, reps: number): number {
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
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

  const exercises: ExerciseData[] = useMemo(() =>
    Array.isArray(workout.exercises) ? (workout.exercises as ExerciseData[]) : [],
  [workout.exercises]);

  // Color map per exercise for charts
  const exerciseColors = useMemo(() => {
    const map: Record<string, string> = {};
    exercises.forEach((ex, i) => { map[ex.name] = EXERCISE_PALETTE[i % EXERCISE_PALETTE.length]; });
    return map;
  }, [exercises]);

  // Computed metrics
  const { totalVolumeKg, workingSets, totalSets, rpes, sessionLoad } = useMemo(() => {
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
    const avgRpeNum = rpes.length > 0 ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
    // Estimated training load: duration × intensity (RPE-derived) — simple proxy
    const intensity = avgRpeNum != null ? avgRpeNum / 10 : 0.7;
    const sessionLoad = Math.round((workout.duration_minutes || 0) * intensity * 1.2);
    return { totalVolumeKg, workingSets, totalSets, rpes, sessionLoad };
  }, [exercises, workout.duration_minutes]);

  const avgRpe = rpes.length > 0 ? (rpes.reduce((a, b) => a + b, 0) / rpes.length) : null;
  const muscleVolume = useMemo(() => exercises.length > 0 ? computeMuscleVolume(exercises) : {}, [exercises]);
  const maxMuscleVolume = useMemo(() => Math.max(...Object.values(muscleVolume).map((v) => v.volume), 1), [muscleVolume]);

  // Per-set series for the session load curve
  const sessionSets = useMemo(() => {
    const points: { setNum: number; exercise: string; volume: number; weightKg: number; reps: number; rpe: number | null; type: string }[] = [];
    let n = 0;
    for (const ex of exercises) {
      for (const s of ex.sets) {
        n++;
        points.push({
          setNum: n,
          exercise: ex.name,
          volume: convertWeight(s.weight_kg * s.reps, weightUnit),
          weightKg: s.weight_kg,
          reps: s.reps,
          rpe: s.rpe,
          type: s.type,
        });
      }
    }
    return points;
  }, [exercises, weightUnit]);

  // Volume per exercise (top 8)
  const volumeByExercise = useMemo(() => {
    const map = new Map<string, { volume: number; sets: number }>();
    for (const ex of exercises) {
      let v = 0;
      let s = 0;
      for (const set of ex.sets) {
        if (set.type === "normal") { v += set.weight_kg * set.reps; s++; }
      }
      map.set(ex.name, { volume: v, sets: s });
    }
    return Array.from(map.entries())
      .map(([name, info]) => ({ name, volume: convertWeight(info.volume, weightUnit), sets: info.sets }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 8);
  }, [exercises, weightUnit]);

  // RPE distribution
  const rpeBuckets = useMemo(() => {
    const buckets = [5, 6, 7, 8, 9, 10].map((rpe) => ({ rpe, count: 0 }));
    for (const r of rpes) {
      const rounded = Math.min(10, Math.max(5, Math.round(r)));
      const b = buckets.find((b) => b.rpe === rounded);
      if (b) b.count++;
    }
    return buckets;
  }, [rpes]);

  // Per-exercise stats for the breakdown table
  const exerciseRows = useMemo(() => exercises.map((ex) => {
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
    return { name: ex.name, muscleTag, bestWeightKg, bestReps, totalSets, totalReps, exVolumeKg, e1rmKg };
  }), [exercises]);

  const volumeDensity = workout.duration_minutes > 0
    ? Math.round(convertWeight(totalVolumeKg, weightUnit) / workout.duration_minutes)
    : 0;

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
          width: "min(96vw, 920px)", maxHeight: "92vh", overflow: "auto",
          padding: "26px 30px",
          boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22, gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 12,
              background: "#fef9c3", border: "1.5px solid #eab308",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26,
            }}>🏋️</div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>
                Strength
              </div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0F1B22", lineHeight: 1.2, letterSpacing: "-0.02em" }}>
                {workout.name || "Workout"}
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>
                {formatDate(workout.date)}
                {workout.duration_minutes > 0 && <> · {formatDuration(workout.duration_minutes)}</>}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 34, height: 34, borderRadius: 8,
              background: "#f3f4f6", border: "none", cursor: "pointer",
              fontSize: 20, color: "#6b7280",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* Key metrics */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
          marginBottom: 24,
        }}>
          <Metric label="Total Volume" value={formatVolume(totalVolumeKg, weightUnit)} accent="#eab308" />
          <Metric label="Working Sets" value={`${workingSets}`} sub={`${totalSets} total`} accent="#3b82f6" />
          <Metric label="Exercises" value={`${exercises.length}`} accent="#10b981" />
          <Metric label="Avg RPE" value={avgRpe != null ? avgRpe.toFixed(1) : "—"} accent="#ef4444" />
          {volumeDensity > 0 && (
            <Metric label="Volume / min" value={`${volumeDensity.toLocaleString()} ${weightLabel(weightUnit)}`} accent="#8b5cf6" />
          )}
          <Metric label="Est. Load" value={`${sessionLoad}`} sub="duration × RPE" accent="#f97316" />
        </div>

        {/* Session load curve */}
        {sessionSets.length > 0 && (
          <Section title="Session pacing — set by set">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={sessionSets} margin={{ top: 8, right: 8, bottom: 4, left: -8 }} barCategoryGap="14%">
                <CartesianGrid {...gridProps} />
                <XAxis
                  dataKey="setNum"
                  tick={{ ...axisProps.tick, fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: "set #", position: "insideBottom", offset: -2, fill: chartColors.textFaint, fontSize: 10 }}
                />
                <YAxis
                  {...axisProps}
                  label={{ value: `volume (${weightLabel(weightUnit)})`, angle: -90, position: "insideLeft", fill: chartColors.textFaint, fontSize: 10, dy: 40 }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
                  cursor={{ fill: chartColors.grid, opacity: 0.4 }}
                  formatter={(_val: number, _name: string, entry: { payload: typeof sessionSets[0] }) => {
                    const p = entry.payload;
                    return [
                      `${formatWeightOnly(p.weightKg, weightUnit)} ${weightLabel(weightUnit)} × ${p.reps}${p.rpe ? ` @${p.rpe}` : ""}`,
                      p.exercise,
                    ];
                  }}
                  labelFormatter={(setNum: number) => `Set ${setNum}`}
                />
                <Bar dataKey="volume" radius={[5, 5, 0, 0]}>
                  {sessionSets.map((s, i) => (
                    <Cell key={i} fill={exerciseColors[s.exercise] || "#9ca3af"} opacity={s.type === "normal" ? 1 : 0.55} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <ExerciseLegend exercises={exercises.map((e) => e.name)} colors={exerciseColors} />
          </Section>
        )}

        {/* Volume by exercise */}
        {volumeByExercise.length > 1 && (
          <Section title="Volume by exercise">
            <ResponsiveContainer width="100%" height={Math.max(180, volumeByExercise.length * 36)}>
              <BarChart data={volumeByExercise} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                <CartesianGrid {...gridProps} horizontal={false} />
                <XAxis type="number" {...axisProps} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ ...axisProps.tick, fontSize: 11, fontWeight: 700, fill: "#374151" }}
                  axisLine={false}
                  tickLine={false}
                  width={150}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
                  cursor={{ fill: chartColors.grid, opacity: 0.4 }}
                  formatter={(val: number, _n: string, entry: { payload: typeof volumeByExercise[0] }) => [
                    `${Math.round(val).toLocaleString()} ${weightLabel(weightUnit)}`,
                    `${entry.payload.sets} working sets`,
                  ]}
                />
                <Bar dataKey="volume" radius={[0, 6, 6, 0]}>
                  {volumeByExercise.map((e, i) => (
                    <Cell key={i} fill={exerciseColors[e.name] || "#9ca3af"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Section>
        )}

        {/* RPE distribution */}
        {rpes.length > 0 && (
          <Section title="RPE distribution">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={rpeBuckets} margin={{ top: 8, right: 8, bottom: 4, left: -8 }} barCategoryGap="28%">
                <CartesianGrid {...gridProps} />
                <XAxis
                  dataKey="rpe"
                  tick={axisProps.tick}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `RPE ${v}`}
                />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
                  cursor={{ fill: chartColors.grid, opacity: 0.4 }}
                  formatter={(val: number) => [`${val} sets`, "Count"]}
                  labelFormatter={(v: number) => `RPE ${v}`}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {rpeBuckets.map((b, i) => {
                    const intensity = (b.rpe - 5) / 5; // 0..1
                    const color = `rgb(${Math.round(239 - intensity * 100)}, ${Math.round(150 + intensity * 30)}, ${Math.round(100 - intensity * 60)})`;
                    return <Cell key={i} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
              RPE 6-7 = building · RPE 8-9 = working · RPE 10 = max effort
            </div>
          </Section>
        )}

        {/* Muscle groups */}
        {Object.keys(muscleVolume).length > 0 && (
          <Section title="Muscles trained">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(muscleVolume)
                .sort((a, b) => b[1].volume - a[1].volume)
                .map(([muscle, data]) => {
                  const color = MUSCLE_COLORS[muscle] ?? "#9ca3af";
                  const pct = Math.round((data.volume / maxMuscleVolume) * 100);
                  return (
                    <div key={muscle} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 90, fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "capitalize", flexShrink: 0 }}>
                        {muscle}
                      </div>
                      <div style={{ flex: 1, height: 10, background: "#f3f4f6", borderRadius: 999, overflow: "hidden" }}>
                        <div style={{
                          width: `${pct}%`, height: "100%",
                          background: `linear-gradient(90deg, ${color}cc, ${color})`,
                          borderRadius: 999,
                          transition: "width 0.3s ease",
                        }} />
                      </div>
                      <div style={{ width: 130, fontSize: 11, color: "#6b7280", textAlign: "right", flexShrink: 0, fontWeight: 600 }}>
                        {data.sets} sets · {formatVolume(data.volume, weightUnit)}
                      </div>
                    </div>
                  );
                })}
            </div>
          </Section>
        )}

        {/* Exercise breakdown table */}
        {exerciseRows.length > 0 && (
          <Section title="Exercise breakdown">
            <div style={{
              display: "grid", gridTemplateColumns: "2fr 1fr 1.2fr 1fr 1.2fr 1.1fr",
              gap: 8, padding: "6px 10px",
              background: "#f3f4f6", borderRadius: 8, marginBottom: 4,
            }}>
              {["Exercise", "Muscle", "Best Set", "Sets × Reps", "Volume", "E1RM"].map((h) => (
                <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</div>
              ))}
            </div>
            {exerciseRows.map((row, i) => {
              const muscleColor = MUSCLE_COLORS[row.muscleTag] ?? "#9ca3af";
              return (
                <div
                  key={i}
                  style={{
                    display: "grid", gridTemplateColumns: "2fr 1fr 1.2fr 1fr 1.2fr 1.1fr",
                    gap: 8, padding: "10px 10px",
                    borderBottom: i < exerciseRows.length - 1 ? "1px solid #f3f4f6" : "none",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#0F1B22" }}>
                    <span style={{ width: 6, height: 18, borderRadius: 2, background: exerciseColors[row.name] || "#d1d5db", flexShrink: 0 }} />
                    {row.name}
                  </div>
                  <div>
                    <span style={{
                      display: "inline-block", fontSize: 10, fontWeight: 700,
                      textTransform: "capitalize", padding: "2px 7px", borderRadius: 20,
                      background: muscleColor + "20", color: muscleColor, border: `1px solid ${muscleColor}40`,
                    }}>{row.muscleTag}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#374151" }}>
                    {formatWeightOnly(row.bestWeightKg, weightUnit)} {weightLabel(weightUnit)} × {row.bestReps}
                  </div>
                  <div style={{ fontSize: 13, color: "#374151" }}>{row.totalSets} × {row.totalReps}</div>
                  <div style={{ fontSize: 13, color: "#374151" }}>{formatVolume(row.exVolumeKg, weightUnit)}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#eab308" }}>{formatVolume(row.e1rmKg, weightUnit)}</div>
                </div>
              );
            })}
          </Section>
        )}

        {exercises.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 0", color: "#9ca3af", fontSize: 14 }}>
            No exercise data available for this workout.
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <h3 style={{
        fontSize: 11, fontWeight: 700, color: "#6b7280",
        textTransform: "uppercase", letterSpacing: "0.07em",
        margin: "0 0 12px",
      }}>{title}</h3>
      {children}
    </div>
  );
}

function Metric({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div style={{
      background: "#f9fafb", borderRadius: 10,
      padding: "12px 14px",
      borderTop: `3px solid ${accent}`,
    }}>
      <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: "#0F1B22", letterSpacing: "-0.02em", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3, fontWeight: 600 }}>{sub}</div>}
    </div>
  );
}

function ExerciseLegend({ exercises, colors }: { exercises: string[]; colors: Record<string, string> }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8, fontSize: 11, color: "#6b7280" }}>
      {exercises.map((name) => (
        <span key={name} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: colors[name] || "#9ca3af", display: "inline-block" }} />
          {name}
        </span>
      ))}
    </div>
  );
}
