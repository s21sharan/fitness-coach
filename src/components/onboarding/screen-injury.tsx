"use client";

import type {
  AthleteContextProfile,
  AthleteInjury,
  InjuryArea,
} from "@/lib/onboarding/types";
import {
  INJURY_AREAS,
  INJURY_TRIGGERS,
  makeId,
} from "@/lib/onboarding/types";
import { inputStyle, labelStyle } from "./shared-styles";

interface ScreenInjuryProps {
  profile: AthleteContextProfile;
  onUpdate: (updates: Partial<AthleteContextProfile>) => void;
}

export const SCREEN_INJURY_TITLE = "Injury history & current niggles.";
export const SCREEN_INJURY_SUBTITLE =
  "We use this to set rules (avoid hills, swap impact, etc.) and to keep ramp gentle on flagged areas.";

export function ScreenInjury({ profile, onUpdate }: ScreenInjuryProps) {
  const setForArea = (area: InjuryArea, patch: Partial<AthleteInjury>) => {
    const existing = profile.injuries.find((i) => i.area === area);
    if (!existing) {
      onUpdate({
        injuries: [
          ...profile.injuries,
          {
            id: makeId(),
            area,
            current_pain_level: 0,
            history: true,
            triggers: [],
            affecting_training: false,
            ...patch,
          },
        ],
      });
    } else {
      onUpdate({
        injuries: profile.injuries.map((i) => (i.id === existing.id ? { ...i, ...patch } : i)),
      });
    }
  };

  const removeArea = (area: InjuryArea) => {
    onUpdate({ injuries: profile.injuries.filter((i) => i.area !== area) });
  };

  const isSelected = (area: InjuryArea) => profile.injuries.some((i) => i.area === area);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <p style={{ ...labelStyle, marginBottom: 10 }}>Areas with history or current pain</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {INJURY_AREAS.map((opt) => {
            const selected = isSelected(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => (selected ? removeArea(opt.value) : setForArea(opt.value, {}))}
                style={{
                  padding: "7px 14px",
                  borderRadius: 999,
                  border: selected ? "2px solid var(--ink)" : "1.5px solid var(--line)",
                  background: selected ? "var(--coral-soft)" : "#fff",
                  color: "var(--ink)",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {profile.injuries.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, textAlign: "center" }}>
          No injuries — great. You can skip this screen.
        </p>
      )}

      {profile.injuries.map((injury) => (
        <div
          key={injury.id}
          style={{
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-lg)",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: "var(--ink)" }}>
            {INJURY_AREAS.find((a) => a.value === injury.area)?.label ?? injury.area}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Current pain (0-10)</label>
              <input
                type="number"
                min={0}
                max={10}
                value={injury.current_pain_level}
                onChange={(e) =>
                  setForArea(injury.area as InjuryArea, {
                    current_pain_level: e.target.value ? Math.min(10, Math.max(0, Number(e.target.value))) : 0,
                  })
                }
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ ...labelStyle, marginBottom: 9 }}>Affecting training now?</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() =>
                      setForArea(injury.area as InjuryArea, { affecting_training: v })
                    }
                    style={{
                      flex: 1,
                      padding: "9px 0",
                      borderRadius: "var(--r-md)",
                      border: injury.affecting_training === v ? "2px solid var(--ink)" : "1.5px solid var(--line)",
                      background: injury.affecting_training === v ? "var(--ink)" : "#fff",
                      color: injury.affecting_training === v ? "#fff" : "var(--ink)",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: "inherit",
                    }}
                  >
                    {v ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <p style={labelStyle}>Triggers</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {INJURY_TRIGGERS.map((trigger) => {
                const selected = injury.triggers.includes(trigger);
                return (
                  <button
                    key={trigger}
                    type="button"
                    onClick={() =>
                      setForArea(injury.area as InjuryArea, {
                        triggers: selected
                          ? injury.triggers.filter((t) => t !== trigger)
                          : [...injury.triggers, trigger],
                      })
                    }
                    style={{
                      padding: "5px 11px",
                      borderRadius: 999,
                      border: selected ? "2px solid var(--ink)" : "1.5px solid var(--line)",
                      background: selected ? "var(--ink)" : "#fff",
                      color: selected ? "#fff" : "var(--ink)",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {trigger.replace(/_/g, " ")}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
