"use client";

import { useCallback, useEffect, useState } from "react";
import {
  estimateDurationMin,
  type ContractStep,
  type WorkoutContractV1,
} from "@/lib/training/workout-contract";
import {
  getUnitPreferences,
  type UnitPreferences,
  type DistanceUnit,
  type SwimDistanceUnit,
  convertSwimDistance,
  convertSwimPace,
  swimDistanceLabel,
  swimPaceLabel,
} from "@/lib/units";

export type PlannedWorkoutStatus = "scheduled" | "completed" | "skipped" | "moved";

export interface PlannedWorkoutModalData {
  plannedId: string;
  date: string;
  sessionType: string;
  aiNotes: string | null;
  slot: "am" | "pm" | null;
  status: PlannedWorkoutStatus;
  skipReason: string | null;
  completionNote: string | null;
  linkedActual: { table: "workout_logs" | "cardio_logs"; id: string } | null;
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
  onSkip?: (plannedId: string, reason: string) => Promise<void>;
  onUnmatch?: (plannedId: string) => Promise<void>;
  // Save a reflection note. `markComplete` flips a scheduled session to
  // completed in the same call (used when the athlete completed it
  // outside the synced data sources). Note text is sent to the fact
  // extractor server-side.
  onSaveNote?: (plannedId: string, note: string, markComplete: boolean) => Promise<void>;
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
  return s > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${m}:00`;
}

function formatDurationMin(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

type StepUnits = { unit: DistanceUnit; swimUnit: SwimDistanceUnit; swim: boolean };

function formatDistance(distanceM: number | undefined | null, u: StepUnits): string | null {
  if (!distanceM || distanceM <= 0) return null;
  const km = distanceM / 1000;
  if (u.swim) {
    return `${convertSwimDistance(km, u.swimUnit).toLocaleString()} ${swimDistanceLabel(u.swimUnit)}`;
  }
  if (u.unit === "mi") {
    const mi = km * 0.621371;
    return mi >= 1 ? `${mi.toFixed(2)} mi` : `${distanceM} m`;
  }
  return km >= 1 ? `${km.toFixed(2)} km` : `${distanceM} m`;
}

function formatPace(paceSecPerKm: number | undefined | null, u: StepUnits): string | null {
  if (!paceSecPerKm || paceSecPerKm <= 0) return null;
  if (u.swim) {
    const pace = convertSwimPace(paceSecPerKm / 60, u.swimUnit);
    const m = Math.floor(pace);
    const s = Math.round((pace - m) * 60);
    return `${m}:${String(s).padStart(2, "0")}${swimPaceLabel(u.swimUnit)}`;
  }
  const per = u.unit === "mi" ? paceSecPerKm / 0.621371 : paceSecPerKm;
  const m = Math.floor(per / 60);
  const s = Math.round(per % 60);
  return `${m}:${String(s).padStart(2, "0")}/${u.unit}`;
}

function formatPaceMinPerKm(paceMinPerKm: number | undefined | null, u: StepUnits): string | null {
  if (paceMinPerKm == null || paceMinPerKm <= 0) return null;
  return formatPace(paceMinPerKm * 60, u);
}

// ─── Intensity → color ──────────────────────────────────────────────────────
//
// One color rail per step, picked from HR zone (or step type as fallback).
// Single-hue scale, no decorative pastels.

const ZONE_COLOR: Record<number, string> = {
  1: "#94a3b8", // slate-400  — recovery
  2: "#60a5fa", // blue-400   — easy
  3: "#10b981", // emerald-500 — steady
  4: "#f59e0b", // amber-500  — threshold
  5: "#ef4444", // red-500    — vo2 / max
};

const TYPE_FALLBACK_COLOR: Record<ContractStep["type"], string> = {
  warmup: "#60a5fa",
  work: "#f59e0b",
  recovery: "#94a3b8",
  cooldown: "#60a5fa",
  rest: "#cbd5e1",
  repeat: "#0f172a", // slate-900 — neutral, takes its actual color from children
};

const STEP_LABEL: Record<ContractStep["type"], string> = {
  warmup: "Warm-up",
  work: "Work",
  recovery: "Recovery",
  cooldown: "Cool-down",
  rest: "Rest",
  repeat: "Repeat",
};

function colorForStep(step: ContractStep): string {
  if (step.target_hr_zone != null && ZONE_COLOR[step.target_hr_zone]) {
    return ZONE_COLOR[step.target_hr_zone];
  }
  return TYPE_FALLBACK_COLOR[step.type] ?? "#94a3b8";
}

// Repeat-block rail color: borrow the dominant work step's color so the
// outer rail visually matches what's inside.
function colorForRepeat(step: ContractStep): string {
  const work = step.steps?.find((s) => s.type === "work");
  if (work) return colorForStep(work);
  const any = step.steps?.[0];
  return any ? colorForStep(any) : TYPE_FALLBACK_COLOR.repeat;
}

const STATUS_PILL: Record<PlannedWorkoutStatus, { bg: string; fg: string; label: string }> = {
  scheduled: { bg: "#fef3c7", fg: "#92400e", label: "Planned" },
  completed: { bg: "#dcfce7", fg: "#166534", label: "Completed" },
  skipped: { bg: "#e2e8f0", fg: "#475569", label: "Skipped" },
  moved: { bg: "#dbeafe", fg: "#1e40af", label: "Moved" },
};

function getSportLabel(sessionType: string): string {
  const lower = sessionType.toLowerCase();
  if (/run|jog|tempo|threshold|marathon|mile|track/.test(lower)) return "Run";
  if (/bike|ride|cycling|trainer|zwift|spin/.test(lower)) return "Bike";
  if (/swim|pool|css|drill|stroke/.test(lower)) return "Swim";
  if (/lift|push|pull|legs|upper|lower|strength|squat|dead|bench/.test(lower)) return "Strength";
  if (/rest|recovery|off/.test(lower)) return "Rest";
  return "Session";
}

// ─── Step rendering ─────────────────────────────────────────────────────────

function StepMetaLine({ step, unit }: { step: ContractStep; unit: StepUnits }) {
  const bits: string[] = [];
  const dur = formatDurationSec(step.duration_sec);
  const dist = formatDistance(step.distance_m, unit);
  if (dur) bits.push(dur);
  if (dist) bits.push(dist);
  if (step.target_hr_zone != null) bits.push(`Z${step.target_hr_zone}`);
  const pace = formatPace(step.pace_sec_per_km, unit);
  if (pace) bits.push(pace);
  if (step.ftp_percent != null) bits.push(`${step.ftp_percent}% FTP`);

  if (step.sets != null && step.reps != null) {
    const setRep = `${step.sets}×${step.reps}`;
    bits.push(step.weight_kg != null ? `${setRep} @ ${step.weight_kg}kg` : setRep);
  } else if (step.reps != null) {
    bits.push(`${step.reps} reps`);
  }
  if (step.rpe != null) bits.push(`RPE ${step.rpe}`);

  if (bits.length === 0) return null;

  return (
    <div
      style={{
        fontSize: 12,
        color: "#475569",
        fontVariantNumeric: "tabular-nums",
        fontFamily:
          'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
        letterSpacing: "0.01em",
      }}
    >
      {bits.map((b, i) => (
        <span key={i}>
          {i > 0 && <span style={{ color: "#cbd5e1", margin: "0 8px" }}>·</span>}
          {b}
        </span>
      ))}
    </div>
  );
}

function StepBody({ step, unit }: { step: ContractStep; unit: StepUnits }) {
  // Primary line: step type (small caps) + name. The name is optional for
  // strength rows where exercise_name is in the metadata line.
  const titleParts: string[] = [STEP_LABEL[step.type]];
  if (step.exercise_name) titleParts[0] = step.exercise_name;
  else if (step.label && step.label !== STEP_LABEL[step.type]) titleParts.push(step.label);

  return (
    <div style={{ paddingLeft: 14, paddingTop: 2, paddingBottom: 2 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#64748b",
          marginBottom: 3,
        }}
      >
        {STEP_LABEL[step.type]}
      </div>
      {(step.exercise_name || (step.label && step.label !== STEP_LABEL[step.type])) && (
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#0f172a",
            marginBottom: 4,
            lineHeight: 1.3,
          }}
        >
          {step.exercise_name ?? step.label}
        </div>
      )}
      <StepMetaLine step={step} unit={unit} />
    </div>
  );
}

function StepRow({
  step,
  unit,
  isLast,
}: {
  step: ContractStep;
  unit: StepUnits;
  isLast: boolean;
}) {
  if (step.type === "repeat" && step.steps && step.steps.length > 0) {
    const repeats = step.repeats ?? 1;
    const railColor = colorForRepeat(step);
    return (
      <div style={{ position: "relative", paddingBottom: isLast ? 0 : 18 }}>
        {/* Double rail for repeat blocks */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: isLast ? 0 : 18,
            width: 3,
            background: railColor,
            borderLeft: `3px solid ${railColor}`,
            borderRight: `3px solid ${railColor}`,
            marginLeft: 0,
            opacity: 0.55,
          }}
        />
        <div style={{ paddingLeft: 18 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#64748b",
              marginBottom: 3,
            }}
          >
            Repeat
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#0f172a",
              marginBottom: 10,
              lineHeight: 1.3,
            }}
          >
            {repeats}×{step.label ? ` — ${step.label}` : ""}
          </div>
          {/* Nested children */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {step.steps.map((child, i) => (
              <NestedStep
                key={i}
                step={child}
                unit={unit}
                isLast={i === step.steps!.length - 1}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const railColor = colorForStep(step);
  return (
    <div style={{ position: "relative", paddingBottom: isLast ? 0 : 18 }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: isLast ? 0 : 18,
          width: 3,
          background: railColor,
          borderRadius: 2,
        }}
      />
      <StepBody step={step} unit={unit} />
    </div>
  );
}

// Children inside a repeat block: branch-style rendering with ├ / └ glyphs
// so the structure reads at a glance.
function NestedStep({
  step,
  unit,
  isLast,
}: {
  step: ContractStep;
  unit: StepUnits;
  isLast: boolean;
}) {
  const railColor = colorForStep(step);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "stretch", position: "relative" }}>
      <div
        style={{
          width: 14,
          flexShrink: 0,
          position: "relative",
          fontSize: 12,
          color: "#cbd5e1",
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
          paddingTop: 2,
          lineHeight: 1,
        }}
      >
        {isLast ? "└" : "├"}
      </div>
      <div style={{ position: "relative", flex: 1 }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 2,
            background: railColor,
            borderRadius: 1,
          }}
        />
        <div style={{ paddingLeft: 10 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#64748b",
              marginBottom: 2,
            }}
          >
            {STEP_LABEL[step.type]}
          </div>
          {step.label && step.label !== STEP_LABEL[step.type] && (
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#0f172a",
                marginBottom: 3,
                lineHeight: 1.3,
              }}
            >
              {step.label}
            </div>
          )}
          <StepMetaLine step={step} unit={unit} />
        </div>
      </div>
    </div>
  );
}

// ─── Modal ──────────────────────────────────────────────────────────────────

export function PlannedWorkoutModal({ data, open, onClose, onSkip, onUnmatch, onSaveNote }: PlannedWorkoutModalProps) {
  const handleEsc = useCallback((e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }, [onClose]);

  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState("");
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [busy, setBusy] = useState<"skip" | "unmatch" | "note" | null>(null);

  // Reset transient state whenever a different planned slot is opened so a
  // half-typed reason doesn't bleed across sessions.
  useEffect(() => {
    setShowReason(false);
    setReason("");
    setShowNoteEditor(false);
    setNoteDraft(data.completionNote ?? "");
    setBusy(null);
  }, [data.plannedId, data.completionNote]);

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

  const prefs = getUnitPreferences();
  const sport = getSportLabel(data.sessionType);
  const unit: StepUnits = { unit: prefs.distance, swimUnit: prefs.swimDistance, swim: sport === "Swim" };
  if (!open) return null;

  const statusPill = STATUS_PILL[data.status] ?? STATUS_PILL.scheduled;

  const handleSkip = async () => {
    if (!onSkip || busy) return;
    setBusy("skip");
    try {
      await onSkip(data.plannedId, reason.trim());
      onClose();
    } finally {
      setBusy(null);
    }
  };

  const handleUnmatch = async () => {
    if (!onUnmatch || busy) return;
    setBusy("unmatch");
    try {
      await onUnmatch(data.plannedId);
      onClose();
    } finally {
      setBusy(null);
    }
  };

  const handleSaveNote = async (markComplete: boolean) => {
    if (!onSaveNote || busy) return;
    const trimmed = noteDraft.trim();
    if (!trimmed && !markComplete) return;
    setBusy("note");
    try {
      await onSaveNote(data.plannedId, trimmed, markComplete);
      onClose();
    } finally {
      setBusy(null);
    }
  };

  const contract = data.targets?.contract;
  const steps = contract?.steps ?? [];
  const totalMin = contract ? estimateDurationMin(contract.steps) : data.targets?.target_duration_min ?? null;

  const targetBullets: string[] = [];
  const targetDist = formatDistance(
    data.targets?.target_distance_km != null ? data.targets.target_distance_km * 1000 : null,
    unit,
  );
  if (targetDist) targetBullets.push(targetDist);
  if (data.targets?.target_duration_min != null) {
    targetBullets.push(formatDurationMin(data.targets.target_duration_min));
  }
  const targetPace = formatPaceMinPerKm(data.targets?.target_pace_min_km, unit);
  if (targetPace) targetBullets.push(targetPace);
  if (data.targets?.target_hr_zone != null) targetBullets.push(`Z${data.targets.target_hr_zone}`);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 14,
          width: "min(96vw, 600px)",
          maxHeight: "92vh",
          overflow: "auto",
          padding: "26px 28px 28px",
          boxShadow: "0 25px 60px rgba(15,23,42,0.25)",
          border: "1px solid #e2e8f0",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 14,
            marginBottom: 18,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#64748b",
                marginBottom: 6,
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <span>{getSportLabel(data.sessionType)}</span>
              <span style={{ color: "#cbd5e1" }}>·</span>
              <span>{formatDate(data.date)}</span>
              {data.slot && (
                <>
                  <span style={{ color: "#cbd5e1" }}>·</span>
                  <span>{data.slot.toUpperCase()}</span>
                </>
              )}
              <span
                style={{
                  marginLeft: 4,
                  fontSize: 9,
                  fontWeight: 700,
                  color: statusPill.fg,
                  background: statusPill.bg,
                  padding: "1px 7px",
                  borderRadius: 4,
                  letterSpacing: "0.08em",
                }}
              >
                {statusPill.label}
              </span>
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                color: "#0f172a",
                lineHeight: 1.25,
                letterSpacing: "-0.015em",
              }}
            >
              {data.sessionType}
            </h2>
            {(totalMin != null || targetBullets.length > 0) && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: "#475569",
                  fontVariantNumeric: "tabular-nums",
                  fontFamily:
                    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
                }}
              >
                {[
                  totalMin != null ? formatDurationMin(totalMin) : null,
                  ...targetBullets,
                ]
                  .filter((b): b is string => !!b)
                  .map((b, i, arr) => (
                    <span key={i}>
                      {b}
                      {i < arr.length - 1 && (
                        <span style={{ color: "#cbd5e1", margin: "0 8px" }}>·</span>
                      )}
                    </span>
                  ))}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: 20,
              color: "#94a3b8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Rationale */}
        {data.aiNotes && (
          <div
            style={{
              fontSize: 13,
              color: "#334155",
              lineHeight: 1.55,
              marginBottom: 22,
              paddingLeft: 12,
              borderLeft: "2px solid #e2e8f0",
            }}
          >
            {data.aiNotes}
          </div>
        )}

        {/* Saved skip reason */}
        {data.status === "skipped" && data.skipReason && (
          <div
            style={{
              fontSize: 13,
              color: "#475569",
              lineHeight: 1.55,
              marginBottom: 22,
              padding: "10px 12px",
              background: "#f8fafc",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                marginBottom: 4,
              }}
            >
              Skip reason
            </div>
            {data.skipReason}
          </div>
        )}

        {/* Saved completion note */}
        {data.status === "completed" && data.completionNote && !showNoteEditor && (
          <div
            style={{
              fontSize: 13,
              color: "#334155",
              lineHeight: 1.55,
              marginBottom: 22,
              padding: "10px 12px",
              background: "#f0fdf4",
              borderRadius: 8,
              border: "1px solid #bbf7d0",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#166534",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                marginBottom: 4,
              }}
            >
              How it felt
            </div>
            {data.completionNote}
          </div>
        )}

        {/* Steps */}
        {steps.length > 0 ? (
          <>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                marginBottom: 14,
              }}
            >
              Structure
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {steps.map((step, i) => (
                <StepRow
                  key={i}
                  step={step}
                  unit={unit}
                  isLast={i === steps.length - 1}
                />
              ))}
            </div>
          </>
        ) : (
          <div
            style={{
              fontSize: 12,
              color: "#64748b",
              padding: "12px 14px",
              background: "#f8fafc",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
            }}
          >
            No structured intervals attached — this session was scheduled without a detailed contract.
          </div>
        )}

        {/* Action footer */}
        {(data.status === "scheduled" && (onSkip || onSaveNote)) ||
        (data.status === "completed" && (onUnmatch || onSaveNote)) ? (
          <div
            style={{
              marginTop: 22,
              paddingTop: 18,
              borderTop: "1px solid #f1f5f9",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {/* Reflection note editor — covers both "mark complete with note"
                (scheduled) and "add/edit note" (already completed). */}
            {onSaveNote && showNoteEditor && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                  {data.status === "completed" ? "How did it feel?" : "Mark complete with a note"}
                </div>
                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="How did this session go? Anything to remember — energy, form, soreness, what worked? (your coach reads this to plan around you)"
                  autoFocus
                  style={{
                    width: "100%",
                    minHeight: 80,
                    borderRadius: 10,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    color: "#0f172a",
                    padding: 10,
                    fontSize: 13,
                    resize: "vertical",
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNoteEditor(false);
                      setNoteDraft(data.completionNote ?? "");
                    }}
                    disabled={busy !== null}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      background: "#fff",
                      color: "#0f172a",
                      fontSize: 13,
                      fontWeight: 700,
                      border: "1px solid #cbd5e1",
                      cursor: busy ? "wait" : "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveNote(data.status !== "completed")}
                    disabled={busy !== null || noteDraft.trim().length === 0}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      background: busy === "note" || noteDraft.trim().length === 0 ? "#cbd5e1" : "#166534",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 700,
                      border: "none",
                      cursor: busy || noteDraft.trim().length === 0 ? "wait" : "pointer",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {busy === "note"
                      ? "Saving…"
                      : data.status === "completed"
                        ? "Save note"
                        : "Save & mark complete"}
                  </button>
                </div>
              </div>
            )}
            {/* "Add note" / "Edit note" trigger button when editor isn't shown */}
            {onSaveNote && !showNoteEditor && !showReason && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => {
                    setNoteDraft(data.completionNote ?? "");
                    setShowNoteEditor(true);
                  }}
                  disabled={busy !== null}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    background: "#fff",
                    color: "#0f172a",
                    fontSize: 13,
                    fontWeight: 700,
                    border: "1px solid #cbd5e1",
                    cursor: busy ? "wait" : "pointer",
                  }}
                >
                  {data.status === "completed"
                    ? data.completionNote
                      ? "Edit note"
                      : "Add note"
                    : "Mark complete with note"}
                </button>
              </div>
            )}
            {data.status === "scheduled" && onSkip && !showNoteEditor && (
              showReason ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                    Skip this session?
                  </div>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why are you skipping? (optional — your coach uses this to plan around it)"
                    autoFocus
                    style={{
                      width: "100%",
                      minHeight: 70,
                      borderRadius: 10,
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      color: "#0f172a",
                      padding: 10,
                      fontSize: 13,
                      resize: "vertical",
                      outline: "none",
                      fontFamily: "inherit",
                    }}
                  />
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowReason(false);
                        setReason("");
                      }}
                      disabled={busy !== null}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        background: "#fff",
                        color: "#0f172a",
                        fontSize: 13,
                        fontWeight: 700,
                        border: "1px solid #cbd5e1",
                        cursor: busy ? "wait" : "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSkip}
                      disabled={busy !== null}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        background: busy === "skip" ? "#cbd5e1" : "#0f172a",
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 700,
                        border: "none",
                        cursor: busy ? "wait" : "pointer",
                        letterSpacing: "0.01em",
                      }}
                    >
                      {busy === "skip" ? "Skipping…" : "Confirm skip"}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => setShowReason(true)}
                    disabled={busy !== null}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      background: "#0f172a",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 700,
                      border: "none",
                      cursor: busy ? "wait" : "pointer",
                      letterSpacing: "0.01em",
                    }}
                  >
                    Skip session
                  </button>
                </div>
              )
            )}
            {data.status === "completed" && onUnmatch && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>
                  Auto-matched to a synced activity. Unmatch if this isn't the
                  session you actually planned.
                </div>
                <button
                  type="button"
                  onClick={handleUnmatch}
                  disabled={busy !== null}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    background: "#fff",
                    color: "#0f172a",
                    fontSize: 13,
                    fontWeight: 700,
                    border: "1px solid #cbd5e1",
                    cursor: busy ? "wait" : "pointer",
                    flexShrink: 0,
                  }}
                >
                  {busy === "unmatch" ? "Unmatching…" : "Unmatch"}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
