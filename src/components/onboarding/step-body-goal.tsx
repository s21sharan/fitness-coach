"use client";

import type { OnboardingData } from "@/lib/onboarding/types";
import { OptionCard } from "./option-card";

interface StepBodyGoalProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

export const STEP_BODY_GOAL_TITLE = "What's your body goal right now?";
export const STEP_BODY_GOAL_SUBTITLE = "You can change this anytime — your plan adapts.";

const GOAL_CARDS = [
  { value: "lose_weight" as const, emoji: "📉", label: "Cut", sub: "Lose body fat", color: "coral" as const },
  { value: "gain_muscle" as const, emoji: "📈", label: "Bulk", sub: "Build muscle & size", color: "mint" as const },
  { value: "maintain" as const, emoji: "⚖️", label: "Recomp", sub: "Build muscle, lose fat", color: "sky" as const },
];

export function StepBodyGoal({ data, onUpdate }: StepBodyGoalProps) {
  return (
    <div style={{ maxWidth: 520, margin: "0 auto", width: "100%" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14,
          marginBottom: 14,
        }}
      >
        {GOAL_CARDS.map((card) => (
          <OptionCard
            key={card.value}
            emoji={card.emoji}
            label={card.label}
            sub={card.sub}
            selected={data.bodyGoal === card.value}
            color={card.color}
            size="lg"
            onClick={() => onUpdate({ bodyGoal: card.value })}
          />
        ))}
      </div>

      {/* Custom goal row */}
      <button
        type="button"
        onClick={() => onUpdate({ bodyGoal: "other" })}
        style={{
          width: "100%",
          padding: "14px 20px",
          borderRadius: "var(--r-lg)",
          border: data.bodyGoal === "other"
            ? "2px solid var(--ink)"
            : "1.5px dashed var(--line)",
          background: data.bodyGoal === "other" ? "var(--lemon)" : "transparent",
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
          fontFamily: "inherit",
          transition: "all 0.15s",
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "1.5px dashed var(--muted)",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
            <path d="M7 2v10M2 7h10" stroke="var(--muted)" strokeWidth={1.8} strokeLinecap="round" />
          </svg>
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
          Custom goal
        </span>
      </button>

      {data.bodyGoal === "other" && (
        <input
          type="text"
          value={data.bodyGoalOther}
          onChange={(e) => onUpdate({ bodyGoalOther: e.target.value })}
          placeholder="Describe your goal..."
          style={{
            marginTop: 10,
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
          }}
        />
      )}
    </div>
  );
}
