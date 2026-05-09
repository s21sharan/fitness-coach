"use client";

import type { OnboardingData, Sex } from "@/lib/onboarding/types";

interface StepProfileProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

export const STEP_PROFILE_TITLE = "Let's start with the basics.";
export const STEP_PROFILE_SUBTITLE =
  "A few details so your coach can dial in your nutrition and training targets.";

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: "var(--r-md)",
  border: "1.5px solid var(--line)",
  padding: "12px 14px",
  fontSize: 15,
  fontWeight: 600,
  color: "var(--ink)",
  background: "#fff",
  outline: "none",
  fontFamily: "inherit",
  WebkitAppearance: "none",
  MozAppearance: "textfield",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--muted)",
  marginBottom: 6,
};

export function StepProfile({ data, onUpdate }: StepProfileProps) {
  const totalInches = data.height ? Math.round(data.height / 2.54) : null;
  const feet = totalInches ? Math.floor(totalInches / 12) : null;
  const inches = totalInches ? totalInches % 12 : null;

  const handleHeightChange = (newFeet: number | null, newInches: number | null) => {
    const f = newFeet ?? feet ?? 0;
    const i = newInches ?? inches ?? 0;
    const total = f * 12 + i;
    onUpdate({ height: total > 0 ? Math.round(total * 2.54) : null });
  };

  const sexOptions: { value: Sex; label: string }[] = [
    { value: "M", label: "Male" },
    { value: "F", label: "Female" },
    { value: "Other", label: "Other" },
  ];

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", width: "100%" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        {/* Height */}
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Height</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <input
                type="number"
                min={3}
                max={8}
                value={feet ?? ""}
                onChange={(e) =>
                  handleHeightChange(
                    e.target.value ? Number(e.target.value) : null,
                    inches
                  )
                }
                placeholder="5"
                style={inputStyle}
              />
            </div>
            <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>ft</span>
            <div style={{ position: "relative", flex: 1 }}>
              <input
                type="number"
                min={0}
                max={11}
                value={inches ?? ""}
                onChange={(e) =>
                  handleHeightChange(
                    feet,
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                placeholder="10"
                style={inputStyle}
              />
            </div>
            <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>in</span>
          </div>
        </div>

        {/* Weight */}
        <div>
          <label htmlFor="ob-weight" style={labelStyle}>Weight</label>
          <div style={{ position: "relative" }}>
            <input
              id="ob-weight"
              type="number"
              value={data.weight ?? ""}
              onChange={(e) =>
                onUpdate({ weight: e.target.value ? Number(e.target.value) : null })
              }
              placeholder="175"
              style={inputStyle}
            />
            <span
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 12,
                color: "var(--muted)",
                fontWeight: 600,
                pointerEvents: "none",
              }}
            >
              lbs
            </span>
          </div>
        </div>

        {/* Age */}
        <div>
          <label htmlFor="ob-age" style={labelStyle}>Age</label>
          <input
            id="ob-age"
            type="number"
            value={data.age ?? ""}
            onChange={(e) =>
              onUpdate({ age: e.target.value ? Number(e.target.value) : null })
            }
            placeholder="25"
            style={inputStyle}
          />
        </div>

        {/* Sex */}
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Sex</label>
          <div style={{ display: "flex", gap: 10 }}>
            {sexOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onUpdate({ sex: opt.value })}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  borderRadius: "var(--r-md)",
                  border: data.sex === opt.value
                    ? "2px solid var(--ink)"
                    : "1.5px solid var(--line)",
                  background: data.sex === opt.value ? "var(--ink)" : "#fff",
                  color: data.sex === opt.value ? "#fff" : "var(--ink)",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  fontFamily: "inherit",
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
