"use client";

import type { AthleteContextProfile } from "@/lib/onboarding/types";
import { BODY_GOALS_DETAILED } from "@/lib/onboarding/types";
import { inputStyle, labelStyle } from "./shared-styles";

interface ScreenBodyNutritionProps {
  profile: AthleteContextProfile;
  onUpdate: (updates: Partial<AthleteContextProfile>) => void;
}

export const SCREEN_BODY_NUTRITION_TITLE = "Body & nutrition.";
export const SCREEN_BODY_NUTRITION_SUBTITLE =
  "Body composition goal lives separately from performance goals — we'll flag conflicts.";

const TRACKING_OPTIONS: { value: AthleteContextProfile["body_nutrition"]["tracking_app"]; label: string }[] = [
  { value: "macrofactor", label: "MacroFactor" },
  { value: "myfitnesspal", label: "MyFitnessPal" },
  { value: "cronometer", label: "Cronometer" },
  { value: "none", label: "None" },
  { value: "other", label: "Other" },
];

const FUEL_OPTIONS: { value: AthleteContextProfile["body_nutrition"]["fuel_workouts_when_cutting"]; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "sometimes", label: "Sometimes" },
  { value: "avoid_around_workouts", label: "I avoid calories around workouts" },
  { value: "not_sure", label: "Not sure" },
];

export function ScreenBodyNutrition({ profile, onUpdate }: ScreenBodyNutritionProps) {
  const bn = profile.body_nutrition;

  const set = (patch: Partial<typeof bn>) => onUpdate({ body_nutrition: { ...bn, ...patch } });

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 22 }}>
      <div>
        <p style={{ ...labelStyle, marginBottom: 10 }}>Body goal</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {BODY_GOALS_DETAILED.map((opt) => {
            const selected = bn.body_goal === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => set({ body_goal: opt.value })}
                style={{
                  padding: "12px 14px",
                  borderRadius: "var(--r-md)",
                  border: selected ? "2px solid var(--ink)" : "1.5px solid var(--line)",
                  background: selected ? "var(--coral-soft)" : "#fff",
                  textAlign: "left",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: "var(--ink)" }}>{opt.label}</p>
                <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--muted)" }}>{opt.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>Goal weight (lbs) — optional</label>
          <input
            type="number"
            value={bn.goal_weight_lbs ?? ""}
            onChange={(e) => set({ goal_weight_lbs: e.target.value ? Number(e.target.value) : null })}
            placeholder="180"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Target rate (lbs/wk)</label>
          <input
            type="number"
            step={0.1}
            value={bn.target_rate_lbs_per_week ?? ""}
            onChange={(e) =>
              set({ target_rate_lbs_per_week: e.target.value ? Number(e.target.value) : null })
            }
            placeholder="0.5"
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>Diet style</label>
          <input
            type="text"
            value={bn.diet_style ?? ""}
            onChange={(e) => set({ diet_style: e.target.value || null })}
            placeholder="Omnivore, vegetarian…"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Protein target (g)</label>
          <input
            type="number"
            value={bn.protein_target_g ?? ""}
            onChange={(e) => set({ protein_target_g: e.target.value ? Number(e.target.value) : null })}
            placeholder="180"
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <p style={{ ...labelStyle, marginBottom: 10 }}>Fuel workouts even when cutting?</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {FUEL_OPTIONS.map((opt) => {
            const chosen = bn.fuel_workouts_when_cutting === opt.value;
            return (
              <button
                key={opt.value as string}
                type="button"
                onClick={() => set({ fuel_workouts_when_cutting: opt.value })}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: chosen ? "2px solid var(--ink)" : "1.5px solid var(--line)",
                  background: chosen ? "var(--ink)" : "#fff",
                  color: chosen ? "#fff" : "var(--ink)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "inherit",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p style={{ ...labelStyle, marginBottom: 10 }}>Tracking app</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {TRACKING_OPTIONS.map((opt) => {
            const chosen = bn.tracking_app === opt.value;
            return (
              <button
                key={opt.value as string}
                type="button"
                onClick={() => set({ tracking_app: opt.value })}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: chosen ? "2px solid var(--ink)" : "1.5px solid var(--line)",
                  background: chosen ? "var(--ink)" : "#fff",
                  color: chosen ? "#fff" : "var(--ink)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "inherit",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label style={labelStyle}>Notes (optional)</label>
        <textarea
          value={bn.notes}
          onChange={(e) => set({ notes: e.target.value })}
          rows={2}
          placeholder="Appetite issues, fueling habits, race-day nutrition…"
          style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
        />
      </div>
    </div>
  );
}
