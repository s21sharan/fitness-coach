"use client";

import { inputStyle, labelStyle } from "./shared-styles";
import type { AthleteContextProfile, Sex } from "@/lib/onboarding/types";

interface ScreenWelcomeProps {
  profile: AthleteContextProfile;
  onUpdate: (updates: Partial<AthleteContextProfile>) => void;
}

export const SCREEN_WELCOME_TITLE = "Let's build your athlete profile.";
export const SCREEN_WELCOME_SUBTITLE =
  "Your plan should fit your life, not just your race. We'll learn your sports, goals, current training, recovery, schedule, and strength priorities so your AI coach can build a plan that adapts like a real coach.";

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: "M", label: "Male" },
  { value: "F", label: "Female" },
  { value: "Other", label: "Other" },
];

export function ScreenWelcome({ profile, onUpdate }: ScreenWelcomeProps) {
  const basic = profile.basic;
  const totalInches = basic.height_cm ? Math.round(basic.height_cm / 2.54) : null;
  const feet = totalInches !== null ? Math.floor(totalInches / 12) : null;
  const inches = totalInches !== null ? totalInches % 12 : null;

  const setHeight = (newFeet: number | null, newInches: number | null) => {
    const f = newFeet ?? feet ?? 0;
    const i = newInches ?? inches ?? 0;
    const total = f * 12 + i;
    onUpdate({
      basic: {
        ...basic,
        height_cm: total > 0 ? Math.round(total * 2.54) : null,
      },
    });
  };

  return (
    <div style={{ maxWidth: 540, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          background: "#fff",
          borderRadius: "var(--r-lg)",
          border: "1px solid var(--line)",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>
          A few basics first
        </p>

        <div>
          <label style={labelStyle}>Height</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="number"
              min={3}
              max={8}
              value={feet ?? ""}
              onChange={(e) =>
                setHeight(e.target.value ? Number(e.target.value) : null, inches)
              }
              placeholder="5"
              style={{ ...inputStyle, flex: 1 }}
            />
            <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>ft</span>
            <input
              type="number"
              min={0}
              max={11}
              value={inches ?? ""}
              onChange={(e) =>
                setHeight(feet, e.target.value ? Number(e.target.value) : null)
              }
              placeholder="10"
              style={{ ...inputStyle, flex: 1 }}
            />
            <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>in</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Weight (lbs)</label>
            <input
              type="number"
              value={basic.weight_lbs ?? ""}
              onChange={(e) =>
                onUpdate({
                  basic: {
                    ...basic,
                    weight_lbs: e.target.value ? Number(e.target.value) : null,
                  },
                })
              }
              placeholder="175"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Age</label>
            <input
              type="number"
              value={basic.age ?? ""}
              onChange={(e) =>
                onUpdate({
                  basic: {
                    ...basic,
                    age: e.target.value ? Number(e.target.value) : null,
                  },
                })
              }
              placeholder="30"
              style={inputStyle}
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Sex</label>
          <div style={{ display: "flex", gap: 10 }}>
            {SEX_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onUpdate({ basic: { ...basic, sex: opt.value } })}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  borderRadius: "var(--r-md)",
                  border: basic.sex === opt.value ? "2px solid var(--ink)" : "1.5px solid var(--line)",
                  background: basic.sex === opt.value ? "var(--ink)" : "#fff",
                  color: basic.sex === opt.value ? "#fff" : "var(--ink)",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
