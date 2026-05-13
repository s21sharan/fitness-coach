"use client";

import type {
  AthleteContextProfile,
  AthleteInjury,
  BodyArea,
} from "@/lib/onboarding/types";
import {
  BODY_AREAS,
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
  "Pick the general area, then describe the specific issue. We use this to set ramp rules.";

export function ScreenInjury({ profile, onUpdate }: ScreenInjuryProps) {
  const setForArea = (area: BodyArea, patch: Partial<AthleteInjury>) => {
    const existing = profile.injuries.find((i) => i.area === area);
    if (!existing) {
      onUpdate({
        injuries: [
          ...profile.injuries,
          {
            id: makeId(),
            area,
            description: null,
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

  const removeArea = (area: BodyArea) => {
    onUpdate({ injuries: profile.injuries.filter((i) => i.area !== area) });
  };

  const isSelected = (area: BodyArea) => profile.injuries.some((i) => i.area === area);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <p style={{ ...labelStyle, marginBottom: 10 }}>Areas with history or current pain</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {BODY_AREAS.map((opt) => {
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
                title={opt.example}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {profile.injuries.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, textAlign: "center" }}>
          No areas selected — great, you can skip this screen.
        </p>
      )}

      {profile.injuries.map((injury) => {
        const areaMeta = BODY_AREAS.find((a) => a.value === injury.area);
        return (
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
              {areaMeta?.label ?? injury.area}
            </p>

            <div>
              <label style={labelStyle}>What's the specific issue?</label>
              <input
                type="text"
                value={injury.description ?? ""}
                onChange={(e) =>
                  setForArea(injury.area as BodyArea, { description: e.target.value || null })
                }
                placeholder={areaMeta?.example ?? "Describe the issue"}
                style={inputStyle}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Current pain (0-10)</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={injury.current_pain_level}
                  onChange={(e) =>
                    setForArea(injury.area as BodyArea, {
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
                        setForArea(injury.area as BodyArea, { affecting_training: v })
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
              <p style={labelStyle}>Triggers (optional)</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {INJURY_TRIGGERS.map((trigger) => {
                  const selected = injury.triggers.includes(trigger);
                  return (
                    <button
                      key={trigger}
                      type="button"
                      onClick={() =>
                        setForArea(injury.area as BodyArea, {
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
        );
      })}
    </div>
  );
}
