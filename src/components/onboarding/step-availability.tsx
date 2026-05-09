"use client";

import type { OnboardingData } from "@/lib/onboarding/types";

interface StepAvailabilityProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

export const STEP_AVAILABILITY_TITLE = "How many days per week can you train?";
export const STEP_AVAILABILITY_SUBTITLE =
  "Pick a number — we'll fit lifts and cardio realistically.";

const DAY_OPTIONS = [3, 4, 5, 6];

function getSuggestedLiftingDays(days: number, trainingForRace: boolean): number {
  if (!trainingForRace) return days;
  if (days <= 4) return 2;
  if (days <= 5) return 3;
  return Math.min(4, days - 2);
}

export function StepAvailability({ data, onUpdate }: StepAvailabilityProps) {
  return (
    <div style={{ maxWidth: 520, margin: "0 auto", width: "100%" }}>
      {/* Day pills */}
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 28 }}>
        {DAY_OPTIONS.map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => {
              const suggested = getSuggestedLiftingDays(days, data.trainingForRace);
              onUpdate({ daysPerWeek: days, liftingDays: suggested });
            }}
            style={{
              width: 72,
              height: 72,
              borderRadius: "var(--r-lg)",
              border: data.daysPerWeek === days
                ? "2px solid var(--ink)"
                : "1.5px solid var(--line)",
              background: data.daysPerWeek === days ? "var(--ink)" : "#fff",
              color: data.daysPerWeek === days ? "#fff" : "var(--ink)",
              fontSize: 26,
              fontWeight: 800,
              cursor: "pointer",
              transition: "all 0.15s",
              transform: data.daysPerWeek === days ? "translateY(-3px)" : "none",
              boxShadow: data.daysPerWeek === days
                ? "0 8px 24px rgba(15,27,34,0.18)"
                : "none",
              fontFamily: "inherit",
            }}
          >
            {days}
          </button>
        ))}
      </div>

      {/* Lift/cardio split card */}
      {data.daysPerWeek && data.trainingForRace && (
        <div
          style={{
            background: "#fff",
            borderRadius: "var(--r-lg)",
            border: "1px solid var(--line)",
            padding: "20px 24px",
          }}
        >
          <label
            htmlFor="liftingDays"
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--muted)",
              marginBottom: 12,
            }}
          >
            Lifting days (of {data.daysPerWeek})
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              id="liftingDays"
              type="number"
              min={1}
              max={data.daysPerWeek}
              value={data.liftingDays ?? ""}
              onChange={(e) =>
                onUpdate({ liftingDays: e.target.value ? Number(e.target.value) : null })
              }
              style={{
                width: 80,
                borderRadius: "var(--r-md)",
                border: "1.5px solid var(--line)",
                padding: "10px 14px",
                fontSize: 20,
                fontWeight: 800,
                color: "var(--ink)",
                background: "#fff",
                outline: "none",
                fontFamily: "inherit",
                textAlign: "center",
              }}
            />
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                {data.liftingDays ?? "—"} lift · {data.daysPerWeek && data.liftingDays
                  ? data.daysPerWeek - data.liftingDays
                  : "—"} cardio
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>
                Suggested: {getSuggestedLiftingDays(data.daysPerWeek, data.trainingForRace)} lifting days
              </p>
            </div>
          </div>
        </div>
      )}

      {data.daysPerWeek && !data.trainingForRace && (
        <p style={{ textAlign: "center", fontSize: 14, color: "var(--muted)", marginTop: 8 }}>
          All {data.daysPerWeek} days for strength training
        </p>
      )}
    </div>
  );
}
