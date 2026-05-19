"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getUnitPreferences,
  distanceLabel,
  paceLabel,
  type DistanceUnit,
} from "@/lib/units";
import type { ContractStep } from "@/lib/training/workout-contract";

const KM_PER_MI = 1.609344;
const M_PER_MI = 1609.344;

type Sport = "run" | "bike" | "swim" | "strength" | "other";
type Slot = "am" | "pm" | "full";
type LeafStepType = "warmup" | "work" | "recovery" | "cooldown" | "rest";

const LEAF_STEP_OPTIONS: Array<{ value: LeafStepType; label: string }> = [
  { value: "warmup", label: "Warm-up" },
  { value: "work", label: "Work" },
  { value: "recovery", label: "Recovery" },
  { value: "cooldown", label: "Cool-down" },
  { value: "rest", label: "Rest" },
];

interface PlanSessionModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  defaultDate?: string;
}

interface UiLeafStep {
  uid: string;
  type: LeafStepType;
  label: string;
  // Duration entered as min + sec parts.
  durMin: string;
  durSec: string;
  // Distance in user's preferred unit; converted to meters on submit.
  distance: string;
  // Pace entered as min + sec per unit; converted to sec/km on submit.
  paceMin: string;
  paceSec: string;
  // 1..5; "" = no zone.
  hrZone: string;
  // Strength-only fields.
  exerciseName: string;
  sets: string;
  reps: string;
  weight: string;
  rpe: string;
}

// A top-level entry in the intervals editor: either a leaf step or a repeat
// block containing leaf children. Repeats are NOT nestable in the UI.
interface UiBlock {
  uid: string;
  kind: "step" | "repeat";
  step?: UiLeafStep;
  // For kind === "repeat":
  repeats?: string;
  label?: string;
  children?: UiLeafStep[];
}

interface FormState {
  sport: Sport;
  date: string;
  sessionType: string;
  slot: Slot;
  aiNotes: string;
  durationMin: string;
  distance: string;        // in user's preferred unit
  paceMin: string;         // minutes part of pace
  paceSec: string;         // seconds part of pace
  hrZone: string;
  hrMax: string;
  muscleFocus: string;     // strength only
  intervalsOpen: boolean;
  blocks: UiBlock[];
}

function todayLocalYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function emptyState(defaultDate?: string): FormState {
  return {
    sport: "run",
    date: defaultDate ?? todayLocalYmd(),
    sessionType: "",
    slot: "full",
    aiNotes: "",
    durationMin: "",
    distance: "",
    paceMin: "",
    paceSec: "",
    hrZone: "",
    hrMax: "",
    muscleFocus: "",
    intervalsOpen: false,
    blocks: [],
  };
}

// useId() is React-only; for stable test snapshots we want predictable ids
// so a monotonically-increasing counter keyed by component lifetime is fine.
let uidCounter = 0;
function nextUid(): string {
  uidCounter += 1;
  return `b${uidCounter}`;
}

function emptyLeafStep(defaultType: LeafStepType = "work"): UiLeafStep {
  return {
    uid: nextUid(),
    type: defaultType,
    label: "",
    durMin: "",
    durSec: "",
    distance: "",
    paceMin: "",
    paceSec: "",
    hrZone: "",
    exerciseName: "",
    sets: "",
    reps: "",
    weight: "",
    rpe: "",
  };
}

function emptyRepeatBlock(): UiBlock {
  return {
    uid: nextUid(),
    kind: "repeat",
    repeats: "4",
    label: "",
    children: [emptyLeafStep("work"), emptyLeafStep("recovery")],
  };
}

function emptyStepBlock(): UiBlock {
  return {
    uid: nextUid(),
    kind: "step",
    step: emptyLeafStep(),
  };
}

function parseIntOrNull(s: string): number | null {
  if (s.trim() === "") return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}
function parseFloatOrNull(s: string): number | null {
  if (s.trim() === "") return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}
function distanceToKm(value: number, unit: DistanceUnit): number {
  return unit === "mi" ? value * KM_PER_MI : value;
}

function distanceToMeters(value: number, unit: DistanceUnit): number {
  return unit === "mi" ? value * M_PER_MI : value * 1000;
}

// Step-level pace input → sec/km. Mirrors paceToMinPerKm but emits seconds
// for the contract's pace_sec_per_km field.
function paceToSecPerKm(paceMin: number, paceSec: number, unit: DistanceUnit): number {
  const decimalMinPerUnit = paceMin + paceSec / 60;
  const minPerKm = unit === "mi" ? decimalMinPerUnit * (1 / 0.621371) : decimalMinPerUnit;
  return minPerKm * 60;
}

function serializeLeafStep(s: UiLeafStep, sport: Sport, distUnit: DistanceUnit): ContractStep | null {
  const step: ContractStep = { type: s.type };
  const label = s.label.trim();
  if (label) step.label = label;

  const durMin = parseFloatOrNull(s.durMin) ?? 0;
  const durSec = parseFloatOrNull(s.durSec) ?? 0;
  const totalSec = Math.round(durMin * 60 + durSec);
  if (totalSec > 0) step.duration_sec = totalSec;

  const dist = parseFloatOrNull(s.distance);
  if (dist != null && dist > 0) step.distance_m = Math.round(distanceToMeters(dist, distUnit));

  const zone = parseIntOrNull(s.hrZone);
  if (zone === 1 || zone === 2 || zone === 3 || zone === 4 || zone === 5) step.target_hr_zone = zone;

  const paceMin = parseFloatOrNull(s.paceMin);
  if (paceMin != null && paceMin > 0) {
    const paceSec = parseFloatOrNull(s.paceSec) ?? 0;
    step.pace_sec_per_km = Math.round(paceToSecPerKm(paceMin, paceSec, distUnit));
  }

  if (sport === "strength") {
    const ex = s.exerciseName.trim();
    if (ex) step.exercise_name = ex;
    const sets = parseIntOrNull(s.sets);
    if (sets != null && sets > 0) step.sets = sets;
    const reps = parseIntOrNull(s.reps);
    if (reps != null && reps > 0) step.reps = reps;
    const weight = parseFloatOrNull(s.weight);
    if (weight != null && weight > 0) step.weight_kg = Math.round(weight * 100) / 100;
    const rpe = parseFloatOrNull(s.rpe);
    if (rpe != null && rpe > 0) step.rpe = rpe;
  }

  // A step with only its type is useless — drop it.
  const hasContent =
    step.label != null ||
    step.duration_sec != null ||
    step.distance_m != null ||
    step.target_hr_zone != null ||
    step.pace_sec_per_km != null ||
    step.exercise_name != null ||
    step.sets != null ||
    step.reps != null ||
    step.weight_kg != null ||
    step.rpe != null;
  return hasContent ? step : null;
}

function serializeBlocks(blocks: UiBlock[], sport: Sport, distUnit: DistanceUnit): ContractStep[] {
  const out: ContractStep[] = [];
  for (const b of blocks) {
    if (b.kind === "step" && b.step) {
      const s = serializeLeafStep(b.step, sport, distUnit);
      if (s) out.push(s);
    } else if (b.kind === "repeat") {
      const repeats = parseIntOrNull(b.repeats ?? "");
      const children = (b.children ?? [])
        .map((c) => serializeLeafStep(c, sport, distUnit))
        .filter((c): c is ContractStep => c !== null);
      if (!repeats || repeats < 1 || children.length === 0) continue;
      const repeatStep: ContractStep = { type: "repeat", repeats, steps: children };
      const lbl = (b.label ?? "").trim();
      if (lbl) repeatStep.label = lbl;
      out.push(repeatStep);
    }
  }
  return out;
}

// Pace input is in the user's preferred unit (min:sec per mi or km). Store
// in min/km always. min:sec/mi → divide by 0.621371 to convert.
function paceToMinPerKm(paceMin: number, paceSec: number, unit: DistanceUnit): number {
  const decimal = paceMin + paceSec / 60;
  return unit === "mi" ? decimal * (1 / 0.621371) : decimal;
}

// ─── styles ─────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  fontSize: 13,
  color: "#0f172a",
  background: "#fff",
  outline: "none",
  fontFamily: "inherit",
};
const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#64748b",
  marginBottom: 4,
  display: "block",
};

const SPORT_PILLS: Array<{ key: Sport; label: string }> = [
  { key: "run", label: "Run" },
  { key: "bike", label: "Bike" },
  { key: "swim", label: "Swim" },
  { key: "strength", label: "Strength" },
  { key: "other", label: "Other" },
];

const SLOT_PILLS: Array<{ key: Slot; label: string }> = [
  { key: "full", label: "All day" },
  { key: "am", label: "AM" },
  { key: "pm", label: "PM" },
];

// Keep the old export name so existing imports don't break.
export function ManualWorkoutModal(props: PlanSessionModalProps) {
  return <PlanSessionModal {...props} />;
}

export function PlanSessionModal({ open, onClose, onCreated, defaultDate }: PlanSessionModalProps) {
  const [form, setForm] = useState<FormState>(() => emptyState(defaultDate));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape" && !submitting) onClose();
  }, [onClose, submitting]);

  useEffect(() => {
    if (open) {
      setForm(emptyState(defaultDate));
      setSubmitting(false);
      setError(null);
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [open, handleEsc, defaultDate]);

  const distUnit = useMemo(() => getUnitPreferences().distance, []);

  const isCardio = form.sport === "run" || form.sport === "bike" || form.sport === "swim";
  const isStrength = form.sport === "strength";

  // Require at least a name and SOMETHING that defines the session — duration
  // or distance. Otherwise it's an empty placeholder.
  const hasTarget =
    parseIntOrNull(form.durationMin) != null ||
    parseFloatOrNull(form.distance) != null;
  const canSubmit =
    !submitting &&
    form.sessionType.trim() !== "" &&
    form.date !== "" &&
    hasTarget;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);

    const distVal = parseFloatOrNull(form.distance);
    const distanceKm = distVal != null && distVal > 0
      ? Math.round(distanceToKm(distVal, distUnit) * 100) / 100
      : null;

    const paceMinPart = parseFloatOrNull(form.paceMin);
    const paceSecPart = parseFloatOrNull(form.paceSec) ?? 0;
    const paceMinPerKm = paceMinPart != null && paceMinPart > 0
      ? Math.round(paceToMinPerKm(paceMinPart, paceSecPart, distUnit) * 100) / 100
      : null;

    const steps = form.intervalsOpen
      ? serializeBlocks(form.blocks, form.sport, distUnit)
      : [];

    const body = {
      date: form.date,
      sport: form.sport,
      session_type: form.sessionType.trim(),
      slot: form.slot,
      ai_notes: form.aiNotes.trim() || null,
      target_duration_min: parseIntOrNull(form.durationMin),
      target_distance_km: distanceKm,
      target_pace_min_km: paceMinPerKm,
      target_hr_zone: parseIntOrNull(form.hrZone),
      target_hr_max: parseIntOrNull(form.hrMax),
      muscle_focus: isStrength && form.muscleFocus.trim() !== ""
        ? form.muscleFocus.trim()
        : null,
      steps: steps.length > 0 ? steps : undefined,
    };

    try {
      const res = await fetch("/api/plan/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError((j as { error?: string }).error ?? `Failed (${res.status})`);
        setSubmitting(false);
        return;
      }
      onCreated?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      onClick={() => { if (!submitting) onClose(); }}
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
          padding: "24px 28px 28px",
          boxShadow: "0 25px 60px rgba(15,23,42,0.25)",
          border: "1px solid #e2e8f0",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 20 }}>
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "#64748b", marginBottom: 6,
            }}>
              Plan session
            </div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.015em" }}>
              Add a planned workout
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            disabled={submitting}
            style={{
              width: 30, height: 30, borderRadius: 8,
              background: "transparent", border: "none",
              cursor: submitting ? "wait" : "pointer",
              fontSize: 20, color: "#94a3b8",
              display: "flex", alignItems: "center", justifyContent: "center",
              lineHeight: 1,
            }}
          >×</button>
        </div>

        {/* Sport + date + slot */}
        <div style={{ marginBottom: 16 }}>
          <span style={labelStyle}>Sport</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {SPORT_PILLS.map((p) => (
              <Pill
                key={p.key}
                label={p.label}
                active={form.sport === p.key}
                onClick={() => setForm((s) => ({ ...s, sport: p.key }))}
              />
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <Field label="Date *">
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((s) => ({ ...s, date: e.target.value }))}
              aria-label="Date"
              style={inputStyle}
            />
          </Field>
          <div>
            <span style={labelStyle}>Slot</span>
            <div style={{ display: "flex", gap: 6 }}>
              {SLOT_PILLS.map((p) => (
                <Pill
                  key={p.key}
                  label={p.label}
                  active={form.slot === p.key}
                  onClick={() => setForm((s) => ({ ...s, slot: p.key }))}
                />
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <Field label="Session name *">
            <input
              type="text"
              placeholder={isStrength ? "Push day" : isCardio ? "Easy Z2 run" : "Mobility"}
              value={form.sessionType}
              onChange={(e) => setForm((s) => ({ ...s, sessionType: e.target.value }))}
              aria-label="Session name"
              style={inputStyle}
            />
          </Field>
        </div>

        {/* Targets */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <Field label="Duration (min)">
            <input
              type="number" inputMode="numeric" min="0"
              placeholder="45"
              value={form.durationMin}
              onChange={(e) => setForm((s) => ({ ...s, durationMin: e.target.value }))}
              aria-label="Target duration in minutes"
              style={inputStyle}
            />
          </Field>
          {isCardio && (
            <Field label={`Distance (${distanceLabel(distUnit)})`}>
              <input
                type="number" inputMode="decimal" step="0.01" min="0"
                placeholder="0"
                value={form.distance}
                onChange={(e) => setForm((s) => ({ ...s, distance: e.target.value }))}
                aria-label={`Target distance in ${distanceLabel(distUnit)}`}
                style={inputStyle}
              />
            </Field>
          )}
        </div>

        {isCardio && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <span style={labelStyle}>Target pace ({paceLabel(distUnit).replace("/", "")}/{distUnit})</span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <input
                  type="number" inputMode="numeric" min="0"
                  placeholder="min"
                  value={form.paceMin}
                  onChange={(e) => setForm((s) => ({ ...s, paceMin: e.target.value }))}
                  aria-label="Pace minutes"
                  style={inputStyle}
                />
                <input
                  type="number" inputMode="numeric" min="0" max="59"
                  placeholder="sec"
                  value={form.paceSec}
                  onChange={(e) => setForm((s) => ({ ...s, paceSec: e.target.value }))}
                  aria-label="Pace seconds"
                  style={inputStyle}
                />
              </div>
            </div>
            <Field label="HR zone">
              <select
                value={form.hrZone}
                onChange={(e) => setForm((s) => ({ ...s, hrZone: e.target.value }))}
                aria-label="Target HR zone"
                style={inputStyle}
              >
                <option value="">—</option>
                <option value="1">Z1 — recovery</option>
                <option value="2">Z2 — easy</option>
                <option value="3">Z3 — steady</option>
                <option value="4">Z4 — threshold</option>
                <option value="5">Z5 — VO2/max</option>
              </select>
            </Field>
            <Field label="HR max (bpm)">
              <input
                type="number" inputMode="numeric" min="0"
                placeholder="bpm"
                value={form.hrMax}
                onChange={(e) => setForm((s) => ({ ...s, hrMax: e.target.value }))}
                aria-label="Target max HR"
                style={inputStyle}
              />
            </Field>
          </div>
        )}

        {isStrength && (
          <div style={{ marginBottom: 16 }}>
            <Field label="Muscle focus">
              <input
                type="text"
                placeholder="chest, triceps, shoulders"
                value={form.muscleFocus}
                onChange={(e) => setForm((s) => ({ ...s, muscleFocus: e.target.value }))}
                aria-label="Muscle focus"
                style={inputStyle}
              />
            </Field>
          </div>
        )}

        {/* Intervals editor */}
        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 14, marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => setForm((s) => ({ ...s, intervalsOpen: !s.intervalsOpen }))}
            aria-label="Toggle structured intervals"
            aria-expanded={form.intervalsOpen}
            style={{
              background: "none", border: "none", padding: 0,
              color: "#64748b", fontSize: 12, fontWeight: 700,
              cursor: "pointer", letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {form.intervalsOpen ? "− Hide structured intervals" : "+ Add structured intervals (optional)"}
          </button>

          {form.intervalsOpen && (
            <IntervalsEditor
              blocks={form.blocks}
              sport={form.sport}
              distUnit={distUnit}
              onChange={(blocks) => setForm((s) => ({ ...s, blocks }))}
            />
          )}
        </div>

        <div style={{ marginBottom: 4 }}>
          <Field label="Notes (optional)">
            <textarea
              placeholder="Why are you scheduling this? Any context for yourself or your coach."
              value={form.aiNotes}
              onChange={(e) => setForm((s) => ({ ...s, aiNotes: e.target.value }))}
              aria-label="Notes"
              style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
            />
          </Field>
        </div>

        {error && (
          <div style={{
            marginTop: 16,
            padding: "10px 12px",
            borderRadius: 8,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            fontSize: 12,
          }}>{error}</div>
        )}

        <div style={{
          marginTop: 22, paddingTop: 18,
          borderTop: "1px solid #f1f5f9",
          display: "flex", justifyContent: "flex-end", gap: 8,
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              background: "#fff",
              color: "#475569",
              fontSize: 13,
              fontWeight: 600,
              border: "1px solid #cbd5e1",
              cursor: submitting ? "wait" : "pointer",
            }}
          >Cancel</button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              background: canSubmit ? "#0f172a" : "#cbd5e1",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              border: "none",
              cursor: !canSubmit ? "not-allowed" : submitting ? "wait" : "pointer",
            }}
          >{submitting ? "Saving…" : "Add to plan"}</button>
        </div>
      </div>
    </div>
  );
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "7px 14px",
        borderRadius: 999,
        border: active ? "1px solid #0f172a" : "1px solid #e2e8f0",
        background: active ? "#0f172a" : "#fff",
        color: active ? "#fff" : "#475569",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        letterSpacing: "0.01em",
      }}
    >{label}</button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span style={labelStyle}>{label}</span>
      {children}
    </div>
  );
}

// ─── intervals editor ───────────────────────────────────────────────────────

interface IntervalsEditorProps {
  blocks: UiBlock[];
  sport: Sport;
  distUnit: DistanceUnit;
  onChange: (next: UiBlock[]) => void;
}

function IntervalsEditor({ blocks, sport, distUnit, onChange }: IntervalsEditorProps) {
  const isStrength = sport === "strength";

  const updateBlock = (idx: number, patch: Partial<UiBlock>) => {
    onChange(blocks.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  };
  const removeBlock = (idx: number) => onChange(blocks.filter((_, i) => i !== idx));

  const updateLeafInBlock = (
    blockIdx: number,
    childIdx: number | null,
    patch: Partial<UiLeafStep>,
  ) => {
    onChange(blocks.map((b, i) => {
      if (i !== blockIdx) return b;
      if (b.kind === "step" && b.step && childIdx === null) {
        return { ...b, step: { ...b.step, ...patch } };
      }
      if (b.kind === "repeat" && b.children && childIdx != null) {
        return {
          ...b,
          children: b.children.map((c, j) => (j === childIdx ? { ...c, ...patch } : c)),
        };
      }
      return b;
    }));
  };

  const addChildToRepeat = (blockIdx: number) => {
    onChange(blocks.map((b, i) => {
      if (i !== blockIdx || b.kind !== "repeat") return b;
      return { ...b, children: [...(b.children ?? []), emptyLeafStep("work")] };
    }));
  };

  const removeChildFromRepeat = (blockIdx: number, childIdx: number) => {
    onChange(blocks.map((b, i) => {
      if (i !== blockIdx || b.kind !== "repeat" || !b.children) return b;
      return { ...b, children: b.children.filter((_, j) => j !== childIdx) };
    }));
  };

  return (
    <div style={{ marginTop: 14 }}>
      {blocks.length === 0 && (
        <div style={{
          padding: "10px 12px", borderRadius: 8,
          background: "#f8fafc", border: "1px dashed #cbd5e1",
          color: "#64748b", fontSize: 12,
        }}>
          No intervals yet. Add steps or a repeat block to break the session into specific blocks.
        </div>
      )}

      {blocks.map((block, idx) => (
        <div key={block.uid} style={{ marginBottom: 10 }}>
          {block.kind === "step" && block.step && (
            <LeafStepRow
              step={block.step}
              isStrength={isStrength}
              distUnit={distUnit}
              onChange={(patch) => updateLeafInBlock(idx, null, patch)}
              onRemove={() => removeBlock(idx)}
              ariaPrefix={`Step ${idx + 1}`}
            />
          )}
          {block.kind === "repeat" && (
            <RepeatBlockRow
              repeats={block.repeats ?? ""}
              label={block.label ?? ""}
              children={block.children ?? []}
              isStrength={isStrength}
              distUnit={distUnit}
              ariaPrefix={`Repeat ${idx + 1}`}
              onRepeatsChange={(v) => updateBlock(idx, { repeats: v })}
              onLabelChange={(v) => updateBlock(idx, { label: v })}
              onChildChange={(ci, patch) => updateLeafInBlock(idx, ci, patch)}
              onAddChild={() => addChildToRepeat(idx)}
              onRemoveChild={(ci) => removeChildFromRepeat(idx, ci)}
              onRemove={() => removeBlock(idx)}
            />
          )}
        </div>
      ))}

      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button
          type="button"
          onClick={() => onChange([...blocks, emptyStepBlock()])}
          style={dashedBtn}
        >+ Add step</button>
        <button
          type="button"
          onClick={() => onChange([...blocks, emptyRepeatBlock()])}
          style={dashedBtn}
        >+ Add repeat block</button>
      </div>
    </div>
  );
}

const dashedBtn: React.CSSProperties = {
  background: "none", border: "1px dashed #cbd5e1",
  padding: "6px 12px", borderRadius: 8,
  color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer",
};

interface LeafStepRowProps {
  step: UiLeafStep;
  isStrength: boolean;
  distUnit: DistanceUnit;
  ariaPrefix: string;
  onChange: (patch: Partial<UiLeafStep>) => void;
  onRemove: () => void;
}

function LeafStepRow({ step, isStrength, distUnit, ariaPrefix, onChange, onRemove }: LeafStepRowProps) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
      padding: "10px 12px",
    }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <select
          value={step.type}
          onChange={(e) => onChange({ type: e.target.value as LeafStepType })}
          aria-label={`${ariaPrefix} type`}
          style={{ ...inputStyle, padding: "6px 8px", width: 110, fontSize: 12 }}
        >
          {LEAF_STEP_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder={isStrength ? "Exercise (e.g. Bench Press)" : "Label (e.g. 5K pace)"}
          value={isStrength ? step.exerciseName : step.label}
          onChange={(e) => onChange(isStrength ? { exerciseName: e.target.value } : { label: e.target.value })}
          aria-label={isStrength ? `${ariaPrefix} exercise` : `${ariaPrefix} label`}
          style={{ ...inputStyle, padding: "6px 8px", flex: 1 }}
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${ariaPrefix}`}
          style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 16, cursor: "pointer", padding: "0 4px" }}
        >×</button>
      </div>

      {isStrength ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
          <SmallInput value={step.sets} onChange={(v) => onChange({ sets: v })} placeholder="sets" ariaLabel={`${ariaPrefix} sets`} />
          <SmallInput value={step.reps} onChange={(v) => onChange({ reps: v })} placeholder="reps" ariaLabel={`${ariaPrefix} reps`} />
          <SmallInput value={step.weight} onChange={(v) => onChange({ weight: v })} placeholder="kg" ariaLabel={`${ariaPrefix} weight kg`} step="0.5" />
          <SmallInput value={step.rpe} onChange={(v) => onChange({ rpe: v })} placeholder="RPE" ariaLabel={`${ariaPrefix} RPE`} step="0.5" max="10" />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 6 }}>
          <SmallInput value={step.durMin} onChange={(v) => onChange({ durMin: v })} placeholder="min" ariaLabel={`${ariaPrefix} duration minutes`} />
          <SmallInput value={step.durSec} onChange={(v) => onChange({ durSec: v })} placeholder="sec" max="59" ariaLabel={`${ariaPrefix} duration seconds`} />
          <SmallInput value={step.distance} onChange={(v) => onChange({ distance: v })} placeholder={distanceLabel(distUnit)} step="0.01" ariaLabel={`${ariaPrefix} distance ${distanceLabel(distUnit)}`} />
          <select
            value={step.hrZone}
            onChange={(e) => onChange({ hrZone: e.target.value })}
            aria-label={`${ariaPrefix} HR zone`}
            style={{ ...inputStyle, padding: "6px 4px", fontSize: 11 }}
          >
            <option value="">Zone</option>
            <option value="1">Z1</option>
            <option value="2">Z2</option>
            <option value="3">Z3</option>
            <option value="4">Z4</option>
            <option value="5">Z5</option>
          </select>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            <SmallInput value={step.paceMin} onChange={(v) => onChange({ paceMin: v })} placeholder="pmin" ariaLabel={`${ariaPrefix} pace minutes`} />
            <SmallInput value={step.paceSec} onChange={(v) => onChange({ paceSec: v })} placeholder="psec" max="59" ariaLabel={`${ariaPrefix} pace seconds`} />
          </div>
        </div>
      )}
    </div>
  );
}

interface RepeatBlockRowProps {
  repeats: string;
  label: string;
  children: UiLeafStep[];
  isStrength: boolean;
  distUnit: DistanceUnit;
  ariaPrefix: string;
  onRepeatsChange: (v: string) => void;
  onLabelChange: (v: string) => void;
  onChildChange: (childIdx: number, patch: Partial<UiLeafStep>) => void;
  onAddChild: () => void;
  onRemoveChild: (childIdx: number) => void;
  onRemove: () => void;
}

function RepeatBlockRow({
  repeats, label, children, isStrength, distUnit, ariaPrefix,
  onRepeatsChange, onLabelChange, onChildChange, onAddChild, onRemoveChild, onRemove,
}: RepeatBlockRowProps) {
  return (
    <div style={{
      background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12,
      padding: "12px 14px",
    }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, color: "#64748b",
          textTransform: "uppercase", letterSpacing: "0.12em",
        }}>Repeat</span>
        <input
          type="number" min="1" max="99"
          value={repeats}
          onChange={(e) => onRepeatsChange(e.target.value)}
          aria-label={`${ariaPrefix} count`}
          style={{ ...inputStyle, padding: "5px 8px", width: 60, fontSize: 12 }}
        />
        <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>×</span>
        <input
          type="text"
          placeholder="label (optional)"
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
          aria-label={`${ariaPrefix} label`}
          style={{ ...inputStyle, padding: "5px 8px", flex: 1, fontSize: 12 }}
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${ariaPrefix}`}
          style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 16, cursor: "pointer", padding: "0 4px" }}
        >×</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 12, borderLeft: "2px solid #cbd5e1" }}>
        {children.map((c, ci) => (
          <LeafStepRow
            key={c.uid}
            step={c}
            isStrength={isStrength}
            distUnit={distUnit}
            onChange={(patch) => onChildChange(ci, patch)}
            onRemove={() => onRemoveChild(ci)}
            ariaPrefix={`${ariaPrefix} child ${ci + 1}`}
          />
        ))}
        <button
          type="button"
          onClick={onAddChild}
          style={{ ...dashedBtn, alignSelf: "flex-start", padding: "5px 10px", fontSize: 11 }}
        >+ Add step inside</button>
      </div>
    </div>
  );
}

function SmallInput({
  value, onChange, placeholder, ariaLabel, step, max,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  ariaLabel: string;
  step?: string;
  max?: string;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      min="0"
      step={step}
      max={max}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      style={{ ...inputStyle, padding: "6px 8px", fontSize: 12 }}
    />
  );
}
