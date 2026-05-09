"use client";

import type { OnboardingData } from "@/lib/onboarding/types";
import { RACE_TYPES } from "@/lib/onboarding/types";
import { OptionCard } from "./option-card";

interface StepRaceDetailsProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

export const STEP_RACE_DETAILS_TITLE = "What race are you training for?";
export const STEP_RACE_DETAILS_SUBTITLE =
  "We'll structure your cardio and lifting around your event date.";

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

const RACE_COLORS = ["coral", "mint", "sky", "lemon", "coral"] as const;

export function StepRaceDetails({ data, onUpdate }: StepRaceDetailsProps) {
  const runningRaces = RACE_TYPES.filter((r) => r.category === "running");
  const triathlonRaces = RACE_TYPES.filter((r) => r.category === "triathlon");
  const otherRaces = RACE_TYPES.filter((r) => r.category === "other");

  return (
    <div
      style={{
        maxWidth: 560,
        margin: "0 auto",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      {/* Running */}
      <div>
        <p style={{ ...labelStyle, marginBottom: 10 }}>Running</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {runningRaces.map((race, i) => (
            <OptionCard
              key={race.value}
              emoji={["🏃", "🏃", "🏅", "🏆", "⛰️"][i] ?? "🏁"}
              label={race.label}
              selected={data.raceType === race.value}
              color={RACE_COLORS[i % RACE_COLORS.length]}
              size="md"
              onClick={() => onUpdate({ raceType: race.value })}
            />
          ))}
        </div>
      </div>

      {/* Triathlon */}
      <div>
        <p style={{ ...labelStyle, marginBottom: 10 }}>Triathlon</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          {triathlonRaces.map((race, i) => (
            <OptionCard
              key={race.value}
              emoji={["🏊", "🚴", "🔱", "🌊"][i] ?? "🏁"}
              label={race.label}
              selected={data.raceType === race.value}
              color={RACE_COLORS[i % RACE_COLORS.length]}
              size="md"
              onClick={() => onUpdate({ raceType: race.value })}
            />
          ))}
        </div>
      </div>

      {/* Other */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
        {otherRaces.map((race) => (
          <OptionCard
            key={race.value}
            emoji="🎯"
            label={race.label}
            selected={data.raceType === race.value}
            color="sky"
            size="md"
            onClick={() => onUpdate({ raceType: race.value })}
          />
        ))}
      </div>

      {data.raceType === "other" && (
        <input
          type="text"
          value={data.raceTypeOther}
          onChange={(e) => onUpdate({ raceTypeOther: e.target.value })}
          placeholder="What race?"
          style={inputStyle}
        />
      )}

      {/* Race date + goal time */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <label htmlFor="raceDate" style={labelStyle}>Race date (optional)</label>
          <input
            id="raceDate"
            type="date"
            value={data.raceDate ?? ""}
            onChange={(e) => onUpdate({ raceDate: e.target.value || null })}
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="goalTime" style={labelStyle}>Goal time (optional)</label>
          <input
            id="goalTime"
            type="text"
            value={data.goalTime ?? ""}
            onChange={(e) => onUpdate({ goalTime: e.target.value || null })}
            placeholder="e.g. sub 4:00:00"
            style={inputStyle}
          />
        </div>
      </div>
    </div>
  );
}
