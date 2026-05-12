"use client";

import type { AthleteContextProfile, SportEntry } from "@/lib/onboarding/types";
import {
  SPLIT_PREFERENCES,
  LEG_INTERFERENCE_OPTIONS,
  LIFTING_GOALS,
} from "@/lib/onboarding/types";
import { labelStyle } from "./shared-styles";

interface ScreenStrengthProps {
  profile: AthleteContextProfile;
  onUpdate: (updates: Partial<AthleteContextProfile>) => void;
}

export const SCREEN_STRENGTH_TITLE = "Lifting setup.";
export const SCREEN_STRENGTH_SUBTITLE =
  "Tell us where to put your lifts. This is the central hybrid-athlete question.";

const KEY_LIFTS = [
  "squat",
  "deadlift",
  "bench",
  "ohp",
  "pullups",
  "olympic",
  "machines",
  "none",
];

export function ScreenStrength({ profile, onUpdate }: ScreenStrengthProps) {
  const lift: SportEntry = profile.sports.lift;
  const ss = lift.sport_specific ?? {};

  const setSS = (patch: Partial<typeof ss>) => {
    onUpdate({
      sports: {
        ...profile.sports,
        lift: { ...lift, sport_specific: { ...ss, ...patch } },
      },
    });
  };

  const toggleKeyLift = (lift_: string) => {
    const cur = ss.key_lifts ?? [];
    const next = cur.includes(lift_) ? cur.filter((k) => k !== lift_) : [...cur, lift_];
    setSS({ key_lifts: next });
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 22 }}>
      <Section title="Lifting goal">
        <PillRow
          options={LIFTING_GOALS}
          selected={ss.lifting_goal ?? null}
          onSelect={(v) => setSS({ lifting_goal: v as typeof ss.lifting_goal })}
        />
      </Section>

      <Section title="Preferred split">
        <PillRow
          options={SPLIT_PREFERENCES}
          selected={ss.split_type ?? null}
          onSelect={(v) => setSS({ split_type: v as typeof ss.split_type })}
        />
      </Section>

      <Section title="Lower-body tolerance">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {LEG_INTERFERENCE_OPTIONS.map((opt) => {
            const selected = ss.leg_interference === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSS({ leg_interference: opt.value })}
                style={{
                  textAlign: "left",
                  padding: "12px 14px",
                  borderRadius: "var(--r-md)",
                  border: selected ? "2px solid var(--ink)" : "1.5px solid var(--line)",
                  background: selected ? "var(--mint-soft)" : "#fff",
                  color: "var(--ink)",
                  fontSize: 13,
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
      </Section>

      <Section title="Key lifts">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {KEY_LIFTS.map((k) => {
            const selected = (ss.key_lifts ?? []).includes(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggleKeyLift(k)}
                style={{
                  padding: "7px 14px",
                  borderRadius: 999,
                  border: selected ? "2px solid var(--ink)" : "1.5px solid var(--line)",
                  background: selected ? "var(--ink)" : "#fff",
                  color: selected ? "#fff" : "var(--ink)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "inherit",
                }}
              >
                {prettyLift(k)}
              </button>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ ...labelStyle, marginBottom: 10 }}>{title}</p>
      {children}
    </div>
  );
}

function PillRow<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: { value: T; label: string }[];
  selected: T | null;
  onSelect: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((opt) => {
        const chosen = selected === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            style={{
              padding: "7px 14px",
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
  );
}

function prettyLift(k: string): string {
  switch (k) {
    case "ohp": return "Overhead press";
    case "olympic": return "Olympic lifts";
    case "pullups": return "Pullups";
    default: return k.charAt(0).toUpperCase() + k.slice(1);
  }
}
