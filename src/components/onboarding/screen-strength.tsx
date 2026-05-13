"use client";

import type {
  AthleteContextProfile,
  MovementStyle,
  SportEntry,
} from "@/lib/onboarding/types";
import {
  SPLIT_PREFERENCES,
  LEG_INTERFERENCE_OPTIONS,
  MOVEMENT_STYLES,
} from "@/lib/onboarding/types";
import { labelStyle } from "./shared-styles";

interface ScreenStrengthProps {
  profile: AthleteContextProfile;
  onUpdate: (updates: Partial<AthleteContextProfile>) => void;
}

export const SCREEN_STRENGTH_TITLE = "Lifting setup.";
export const SCREEN_STRENGTH_SUBTITLE =
  "How you like to lift. This is the central hybrid-athlete question — your overall goals live on a previous screen.";

// Compound + accessory lifts the user might prioritize.
const KEY_LIFTS = [
  "back_squat",
  "front_squat",
  "deadlift",
  "rdl",
  "bench",
  "incline_bench",
  "ohp",
  "row",
  "pullups",
  "dips",
  "split_squat",
  "lunge",
  "hip_thrust",
  "calf_raise",
] as const;

const KEY_LIFT_LABELS: Record<(typeof KEY_LIFTS)[number], string> = {
  back_squat: "Back squat",
  front_squat: "Front squat",
  deadlift: "Deadlift",
  rdl: "RDL",
  bench: "Bench press",
  incline_bench: "Incline bench",
  ohp: "Overhead press",
  row: "Row",
  pullups: "Pullups",
  dips: "Dips",
  split_squat: "Split squat",
  lunge: "Lunges",
  hip_thrust: "Hip thrust",
  calf_raise: "Calf raise",
};

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

  const toggleKeyLift = (k: string) => {
    const cur = ss.key_lifts ?? [];
    const next = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k];
    setSS({ key_lifts: next });
  };

  const toggleMovementStyle = (style: MovementStyle) => {
    const cur = ss.movement_style ?? [];
    const next = cur.includes(style) ? cur.filter((x) => x !== style) : [...cur, style];
    setSS({ movement_style: next });
  };

  return (
    <div style={{ maxWidth: 660, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 22 }}>
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

      <Section title="Movement style — pick what you like">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {MOVEMENT_STYLES.map((opt) => {
            const selected = (ss.movement_style ?? []).includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleMovementStyle(opt.value)}
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: "var(--r-md)",
                  border: selected ? "2px solid var(--ink)" : "1.5px solid var(--line)",
                  background: selected ? "var(--coral-soft)" : "#fff",
                  color: "var(--ink)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <p style={{ margin: 0, fontWeight: 800, fontSize: 13 }}>{opt.label}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--muted)" }}>{opt.description}</p>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Key lifts you care about (optional)">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {KEY_LIFTS.map((k) => {
            const selected = (ss.key_lifts ?? []).includes(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggleKeyLift(k)}
                style={{
                  padding: "7px 13px",
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
                {KEY_LIFT_LABELS[k]}
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
