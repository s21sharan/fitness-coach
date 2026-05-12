"use client";

import type { AthleteContextProfile, RecoveryContext } from "@/lib/onboarding/types";
import { inputStyle, labelStyle } from "./shared-styles";

interface ScreenRecoveryProps {
  profile: AthleteContextProfile;
  onUpdate: (updates: Partial<AthleteContextProfile>) => void;
}

export const SCREEN_RECOVERY_TITLE = "Recovery context.";
export const SCREEN_RECOVERY_SUBTITLE =
  "Same mileage can mean very different things for different athletes. This helps us tune intensity.";

const SLEEP_CONSISTENCY = [
  { value: "very_consistent", label: "Very consistent" },
  { value: "mostly_consistent", label: "Mostly consistent" },
  { value: "variable", label: "Variable" },
  { value: "poor", label: "Poor" },
];

const STRESS = [
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" },
  { value: "very_high", label: "Very high" },
];

const SORE_FREQ = [
  { value: "rarely", label: "Rarely" },
  { value: "sometimes", label: "Sometimes" },
  { value: "often", label: "Often" },
  { value: "always", label: "Almost always" },
];

const CONFIDENCE = [
  { value: "always_cooked", label: "Always cooked" },
  { value: "slightly_under", label: "Slightly under-recovered" },
  { value: "usually_ok", label: "Usually okay" },
  { value: "fresh", label: "Fresh most days" },
  { value: "under_training", label: "Not training hard enough" },
];

export function ScreenRecovery({ profile, onUpdate }: ScreenRecoveryProps) {
  const r = profile.recovery;
  const set = (patch: Partial<RecoveryContext>) => onUpdate({ recovery: { ...r, ...patch } });

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>Average sleep (hours)</label>
          <input
            type="number"
            step={0.5}
            value={r.avg_sleep_hours ?? ""}
            onChange={(e) => set({ avg_sleep_hours: e.target.value ? Number(e.target.value) : null })}
            placeholder="7"
            style={inputStyle}
          />
        </div>
        <div>
          <p style={labelStyle}>Sleep consistency</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SLEEP_CONSISTENCY.map((opt) => {
              const chosen = r.sleep_consistency === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set({ sleep_consistency: opt.value as RecoveryContext["sleep_consistency"] })}
                  style={pill(chosen)}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div>
        <p style={labelStyle}>Work / school stress</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {STRESS.map((opt) => {
            const chosen = r.work_stress === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => set({ work_stress: opt.value as RecoveryContext["work_stress"] })}
                style={pill(chosen)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p style={labelStyle}>How often are you sore?</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {SORE_FREQ.map((opt) => {
            const chosen = r.sore_frequency === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => set({ sore_frequency: opt.value as RecoveryContext["sore_frequency"] })}
                style={pill(chosen)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p style={labelStyle}>How recovered do you usually feel?</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {CONFIDENCE.map((opt) => {
            const chosen = r.recovery_confidence === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => set({ recovery_confidence: opt.value as RecoveryContext["recovery_confidence"] })}
                style={pill(chosen)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={checkboxLabel}>
          <input
            type="checkbox"
            checked={r.physical_job}
            onChange={(e) => set({ physical_job: e.target.checked })}
          />
          Physical job (counts as training stress)
        </label>
        <label style={checkboxLabel}>
          <input
            type="checkbox"
            checked={r.has_readiness_data}
            onChange={(e) => set({ has_readiness_data: e.target.checked })}
          />
          I have HRV / readiness data from Garmin, Whoop, or Oura
        </label>
      </div>
    </div>
  );
}

const checkboxLabel: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontSize: 13,
  fontWeight: 600,
  color: "var(--ink-2)",
  padding: 12,
  background: "#fff",
  border: "1px solid var(--line)",
  borderRadius: "var(--r-md)",
  cursor: "pointer",
};

function pill(selected: boolean): React.CSSProperties {
  return {
    padding: "7px 12px",
    borderRadius: 999,
    border: selected ? "2px solid var(--ink)" : "1.5px solid var(--line)",
    background: selected ? "var(--ink)" : "#fff",
    color: selected ? "#fff" : "var(--ink)",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "inherit",
  };
}
