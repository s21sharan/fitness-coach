"use client";

import type {
  AthleteContextProfile,
  SportEntry,
  SportId,
  TargetPeak,
} from "@/lib/onboarding/types";
import { SportCard } from "./sport-card";
import { inputStyle, labelStyle } from "./shared-styles";

interface ScreenLoadTargetProps {
  profile: AthleteContextProfile;
  onUpdate: (updates: Partial<AthleteContextProfile>) => void;
}

export const SCREEN_LOAD_TARGET_TITLE = "Where do you want to build to?";
export const SCREEN_LOAD_TARGET_SUBTITLE =
  "Your realistic peak for this block. Pick \"Not sure\" and we'll recommend.";

const RUN_TARGETS = [
  { label: "< 20", value: 20 },
  { label: "20-30", value: 30 },
  { label: "30-40", value: 40 },
  { label: "40-50", value: 50 },
  { label: "50-60", value: 60 },
  { label: "60-70", value: 70 },
  { label: "70+", value: 80 },
];

const BIKE_TARGETS = [
  { label: "1-2 hr", value: 2 },
  { label: "3-5 hr", value: 5 },
  { label: "6-8 hr", value: 8 },
  { label: "9-12 hr", value: 12 },
  { label: "12+ hr", value: 14 },
];

const SWIM_TARGETS = [
  { label: "1 sess", value: 1 },
  { label: "2 sess", value: 2 },
  { label: "3 sess", value: 3 },
  { label: "4+ sess", value: 4 },
];

const LIFT_TARGETS = [
  { label: "1-2 sess", value: 2 },
  { label: "3 sess", value: 3 },
  { label: "4 sess", value: 4 },
  { label: "5-6 sess", value: 5 },
];

export function ScreenLoadTarget({ profile, onUpdate }: ScreenLoadTargetProps) {
  const planned = (Object.values(profile.sports) as SportEntry[]).filter((s) => s.is_planned);

  const setTarget = (sport: SportId, patch: Partial<TargetPeak>) => {
    onUpdate({
      sports: {
        ...profile.sports,
        [sport]: {
          ...profile.sports[sport],
          target_peak: { ...(profile.sports[sport].target_peak ?? {}), ...patch },
        },
      },
    });
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
      {planned.map((sport) => {
        const target = sport.target_peak ?? {};
        const buckets = bucketsFor(sport.sport);
        const valueKey = valueKeyFor(sport.sport);
        const currentValue = (target[valueKey] as number | null | undefined) ?? null;

        return (
          <SportCard key={sport.sport} sport={sport.sport}>
            <p style={labelStyle}>Target peak</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {buckets.map((b) => {
                const selected = currentValue === b.value;
                return (
                  <button
                    key={b.label}
                    type="button"
                    onClick={() => setTarget(sport.sport, { [valueKey]: b.value, not_sure: false })}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 999,
                      border: selected ? "2px solid var(--ink)" : "1.5px solid var(--line)",
                      background: selected ? "var(--ink)" : "#fff",
                      color: selected ? "#fff" : "var(--ink)",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: "inherit",
                    }}
                  >
                    {b.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setTarget(sport.sport, { not_sure: true, [valueKey]: null })}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: target.not_sure ? "2px solid var(--ink)" : "1.5px solid var(--line)",
                  background: target.not_sure ? "var(--coral-soft)" : "#fff",
                  color: "var(--ink)",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: "inherit",
                }}
              >
                Not sure
              </button>
            </div>
            {!target.not_sure && (
              <div style={{ marginTop: 12 }}>
                <label style={labelStyle}>Or set a custom number</label>
                <input
                  type="number"
                  value={currentValue ?? ""}
                  onChange={(e) =>
                    setTarget(sport.sport, {
                      [valueKey]: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder={String(buckets[0]?.value ?? "")}
                  style={{ ...inputStyle, maxWidth: 160 }}
                />
              </div>
            )}
          </SportCard>
        );
      })}
    </div>
  );
}

function bucketsFor(sport: SportId): { label: string; value: number }[] {
  switch (sport) {
    case "run":
      return RUN_TARGETS;
    case "bike":
      return BIKE_TARGETS;
    case "swim":
      return SWIM_TARGETS;
    case "lift":
      return LIFT_TARGETS;
    default:
      return [];
  }
}

function valueKeyFor(sport: SportId): keyof TargetPeak {
  switch (sport) {
    case "run":
      return "weekly_miles";
    case "bike":
      return "weekly_hours";
    case "swim":
      return "weekly_sessions";
    case "lift":
      return "weekly_sessions";
    default:
      return "weekly_sessions";
  }
}
