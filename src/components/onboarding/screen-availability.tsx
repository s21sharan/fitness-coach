"use client";

import type {
  AthleteContextProfile,
  AvailabilityRule,
  AvailabilityRuleKey,
} from "@/lib/onboarding/types";
import {
  AVAILABILITY_RULE_OPTIONS,
  makeId,
} from "@/lib/onboarding/types";
import { DayWindowGrid } from "./day-window-grid";
import { ChatCapture } from "./chat-capture";
import { labelStyle } from "./shared-styles";

interface ScreenAvailabilityProps {
  profile: AthleteContextProfile;
  onUpdate: (updates: Partial<AthleteContextProfile>) => void;
}

export const SCREEN_AVAILABILITY_TITLE = "When can you train?";
export const SCREEN_AVAILABILITY_SUBTITLE =
  "Click time windows for each day. Then pick the scheduling rules that matter to you.";

export function ScreenAvailability({ profile, onUpdate }: ScreenAvailabilityProps) {
  const toggleRule = (key: AvailabilityRuleKey) => {
    const existing = profile.availability_rules.find((r) => r.rule_key === key);
    if (existing) {
      onUpdate({
        availability_rules: profile.availability_rules.filter((r) => r.rule_key !== key),
      });
    } else {
      const newRule: AvailabilityRule = { id: makeId(), rule_key: key, params: null };
      onUpdate({ availability_rules: [...profile.availability_rules, newRule] });
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 22 }}>
      <div>
        <p style={{ ...labelStyle, marginBottom: 12 }}>Weekly windows</p>
        <DayWindowGrid
          windows={profile.availability_windows}
          onChange={(w) => onUpdate({ availability_windows: w })}
        />
      </div>

      <div>
        <p style={{ ...labelStyle, marginBottom: 10 }}>Scheduling rules</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {AVAILABILITY_RULE_OPTIONS.map((opt) => {
            const selected = profile.availability_rules.some((r) => r.rule_key === opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleRule(opt.value)}
                style={{
                  padding: "8px 14px",
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
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <ChatCapture
        profile={profile}
        onUpdate={onUpdate}
        insertion_point="availability"
        prompt="Any weird scheduling constraints we should know? Coach is great at parsing this in natural language."
        placeholder='e.g. "Pool only opens 6-10am, lifting MWF after class, long runs Thursday because weekends are unpredictable."'
      />
    </div>
  );
}
