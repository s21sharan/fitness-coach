"use client";

import type { AthleteContextProfile, RecoveryContext } from "@/lib/onboarding/types";
import { inputStyle, labelStyle } from "./shared-styles";

interface ScreenRecoveryProps {
  profile: AthleteContextProfile;
  onUpdate: (updates: Partial<AthleteContextProfile>) => void;
}

export const SCREEN_RECOVERY_TITLE = "Recovery context.";
export const SCREEN_RECOVERY_SUBTITLE =
  "Sleep and life stress drive how hard we can ramp. Same mileage hits very differently across people.";

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
        <label
          style={{
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
          }}
        >
          <input
            type="checkbox"
            checked={r.physical_job}
            onChange={(e) => set({ physical_job: e.target.checked })}
          />
          Physical job (counts as training stress — e.g. trades, nursing, warehouse)
        </label>
      </div>
    </div>
  );
}

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
