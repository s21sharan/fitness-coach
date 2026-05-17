"use client";

import { useCallback, useEffect } from "react";
import {
  estimateDurationMin,
  type ContractStep,
  type WorkoutContractV1,
} from "@/lib/training/workout-contract";
import { getUnitPreferences } from "@/lib/units";

export interface PlannedWorkoutModalData {
  date: string;
  sessionType: string;
  aiNotes: string | null;
  slot: "am" | "pm" | null;
  targets: {
    contract?: WorkoutContractV1 | null;
    target_distance_km?: number | null;
    target_duration_min?: number | null;
    target_pace_min_km?: number | null;
    target_hr_zone?: number | null;
    target_hr_max?: number | null;
    muscle_focus?: string | null;
  } | null;
}

interface PlannedWorkoutModalProps {
  data: PlannedWorkoutModalData;
  open: boolean;
  onClose: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatDurationSec(sec: number | undefined | null): string | null {
  if (!sec || sec <= 0) return null;
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${m}m`;
}

function formatDurationMin(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDistance(distanceM: number | undefined | null, unit: "mi" | "km"): string | null {
  if (!distanceM || distanceM <= 0) return null;
  const km = distanceM / 1000;
  if (unit === "mi") {
    const mi = km * 0.621371;
    return mi >= 1 ? `${mi.toFixed(2)} mi` : `${distanceM} m`;
  }
  return km >= 1 ? `${km.toFixed(2)} km` : `${distanceM} m`;
}

function formatPace(paceSecPerKm: number | undefined | null, unit: "mi" | "km"): string | null {
  if (!paceSecPerKm || paceSecPerKm <= 0) return null;
  const per = unit === "mi" ? paceSecPerKm / 0.621371 : paceSecPerKm;
  const m = Math.floor(per / 60);
  const s = Math.round(per % 60);
  return `${m}:${String(s).padStart(2, "0")}/${unit}`;
}

const STEP_META: Record<ContractStep["type"], { icon: string; label: string; bg: string; border: string }> = {
  warmup:   { icon: "🔥", label: "Warm-up",  bg: "#fef3c7", border: "#f59e0b" },
  work:     { icon: "⚡", label: "Work",      bg: "#dbeafe", border: "#3b82f6" },
  recovery: { icon: "🚶", label: "Recovery", bg: "#e0f2fe", border: "#0ea5e9" },
  cooldown: { icon: "🌬️", label: "Cool-down", bg: "#ecfccb", border: "#84cc16" },
  rest:     { icon: "⏸️", label: "Rest",      bg: "#f3f4f6", border: "#9ca3af" },
  repeat:   { icon: "🔁", label: "Repeat",   bg: "#ede9fe", border: "#8b5cf6" },
};

function getSessionIcon(sessionType: string): string {
  const lower = sessionType.toLowerCase();
  if (/run|jog|tempo|threshold|marathon|mile|track/.test(lower)) return "🏃";
  if (/bike|ride|cycling|trainer|zwift|spin/.test(lower)) return "🚴";
  if (/swim|pool|css|drill|stroke/.test(lower)) return "🏊";
  if (/lift|push|pull|legs|upper|lower|strength|squat|dead|bench/.test(lower)) return "🏋️";
  if (/rest|recovery|off/.test(lower)) return "😴";
  return "🏋️";
}

function StepDetails({ step, unit }: { step: ContractStep; unit: "mi" | "km" }) {
  const bits: string[] = [];
  const dur = formatDurationSec(step.duration_sec);
  const dist = formatDistance(step.distance_m, unit);
  if (dist) bits.push(dist);
  if (dur) bits.push(dur);
  if (step.target_hr_zone != null) bits.push(`Z${step.target_hr_zone}`);
  const pace = formatPace(step.pace_sec_per_km, unit);
  if (pace) bits.push(pace);
  if (step.ftp_percent != null) bits.push(`${step.ftp_percent}% FTP`);
  if (step.exercise_name) bits.push(step.exercise_name);
  if (step.sets != null && step.reps != null) {
    const setRep = `${step.sets}×${step.reps}`;
    bits.push(step.weight_kg != null ? `${setRep} @ ${step.weight_kg}kg` : setRep);
  } else if (step.reps != null) {
    bits.push(`${step.reps} reps`);
  }
  if (step.rpe != null) bits.push(`RPE ${step.rpe}`);

  return (
    <div style={{ fontSize: 11, color: "#6b7280", display: "flex", flexWrap: "wrap", gap: 8 }}>
      {bits.map((b, i) => (
        <span key={i} style={{ background: "#fff", padding: "2px 7px", borderRadius: 6, border: "1px solid #e5e7eb" }}>
          {b}
        </span>
      ))}
    </div>
  );
}

function StepRow({ step, depth = 0, unit }: { step: ContractStep; depth?: number; unit: "mi" | "km" }) {
  const meta = STEP_META[step.type];

  if (step.type === "repeat" && step.steps && step.steps.length > 0) {
    const repeats = step.repeats ?? 1;
    return (
      <div style={{ marginLeft: depth * 14 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: meta.bg,
            border: `1px solid ${meta.border}`,
            borderRadius: 8,
            padding: "5px 10px",
            fontSize: 11,
            fontWeight: 700,
            color: "#111827",
            marginBottom: 8,
          }}
        >
          <span>{meta.icon}</span>
          <span>Repeat {repeats}×{step.label ? ` — ${step.label}` : ""}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 12, borderLeft: `2px solid ${meta.border}`, marginLeft: 6 }}>
          {step.steps.map((child, i) => (
            <StepRow key={i} step={child} depth={depth + 1} unit={unit} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        marginLeft: depth * 14,
        background: meta.bg,
        border: `1px solid ${meta.border}40`,
        borderRadius: 8,
        padding: "8px 12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 14 }}>{meta.icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
          {step.label ?? meta.label}
        </span>
        {step.label && step.label !== meta.label && (
          <span style={{ fontSize: 9, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {meta.label}
          </span>
        )}
      </div>
      <StepDetails step={step} unit={unit} />
    </div>
  );
}

// ─── Modal ──────────────────────────────────────────────────────────────────

export function PlannedWorkoutModal({ data, open, onClose }: PlannedWorkoutModalProps) {
  const handleEsc = useCallback((e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }, [onClose]);

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

  const unit = getUnitPreferences().distance;
  if (!open) return null;

  const contract = data.targets?.contract;
  const steps = contract?.steps ?? [];
  const totalMin = contract ? estimateDurationMin(contract.steps) : data.targets?.target_duration_min ?? null;

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
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18, gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 11,
              background: "#fffbeb", border: "1.5px solid #f59e0b",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22,
            }}>{getSessionIcon(data.sessionType)}</div>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0F1B22", lineHeight: 1.2, letterSpacing: "-0.02em" }}>
                {data.sessionType}
              </h2>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6b7280" }}>
                {formatDate(data.date)}
                {data.slot && <> · {data.slot.toUpperCase()}</>}
                {totalMin && <> · {formatDurationMin(totalMin)}</>}
                <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#92400e", background: "#fef3c7", padding: "1px 7px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.04em" }}>Planned</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 30, height: 30, borderRadius: 8,
              background: "#f3f4f6", border: "none", cursor: "pointer",
              fontSize: 18, color: "#6b7280",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* Rationale */}
        {data.aiNotes && (
          <div style={{
            background: "#f9fafb", borderLeft: "3px solid #d1d5db",
            padding: "10px 14px", borderRadius: 8,
            fontSize: 13, color: "#374151", lineHeight: 1.55,
            marginBottom: 18,
          }}>
            {data.aiNotes}
          </div>
        )}

        {/* Target summary */}
        {data.targets && (data.targets.target_distance_km != null || data.targets.target_duration_min != null || data.targets.target_pace_min_km != null || data.targets.target_hr_zone != null) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
            {data.targets.target_distance_km != null && (
              <Tag label={`Distance: ${unit === "mi" ? (data.targets.target_distance_km * 0.621371).toFixed(2) + " mi" : data.targets.target_distance_km + " km"}`} />
            )}
            {data.targets.target_duration_min != null && (
              <Tag label={`Duration: ${formatDurationMin(data.targets.target_duration_min)}`} />
            )}
            {data.targets.target_pace_min_km != null && (
              <Tag label={`Pace target: ${data.targets.target_pace_min_km.toFixed(2)} min/km`} />
            )}
            {data.targets.target_hr_zone != null && <Tag label={`HR zone Z${data.targets.target_hr_zone}`} />}
          </div>
        )}

        {/* Steps */}
        {steps.length > 0 ? (
          <>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
              Workout structure
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {steps.map((step, i) => (
                <StepRow key={i} step={step} unit={unit} />
              ))}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: "#6b7280", padding: "8px 0" }}>
            No structured intervals attached — this session was scheduled without a detailed contract.
          </div>
        )}
      </div>
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, color: "#374151",
      background: "#f3f4f6", padding: "4px 10px", borderRadius: 999,
    }}>
      {label}
    </span>
  );
}
