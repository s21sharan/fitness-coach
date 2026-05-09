"use client";

import type { OnboardingData, Emphasis } from "@/lib/onboarding/types";
import { OptionCard } from "./option-card";

interface StepEmphasisProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

export const STEP_EMPHASIS_TITLE = "Anything to emphasize?";
export const STEP_EMPHASIS_SUBTITLE =
  "Lagging body parts or focus areas — pick one and we'll bias your split.";

const EMPHASIS_CARDS: { value: Emphasis; emoji: string; label: string; color: "coral" | "mint" | "sky" | "lemon" }[] = [
  { value: "arms", emoji: "💪", label: "Arms", color: "coral" },
  { value: "shoulders", emoji: "🤸", label: "Shoulders", color: "mint" },
  { value: "chest", emoji: "🏋️", label: "Chest", color: "sky" },
  { value: "back", emoji: "🦾", label: "Back", color: "lemon" },
  { value: "legs", emoji: "🦵", label: "Legs", color: "coral" },
  { value: "glutes", emoji: "🍑", label: "Glutes", color: "mint" },
  { value: "none", emoji: "⚖️", label: "Balanced", color: "sky" },
];

export function StepEmphasis({ data, onUpdate }: StepEmphasisProps) {
  return (
    <div style={{ maxWidth: 520, margin: "0 auto", width: "100%" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
        }}
      >
        {EMPHASIS_CARDS.map((card) => (
          <OptionCard
            key={card.value}
            emoji={card.emoji}
            label={card.label}
            selected={data.emphasis === card.value}
            color={card.color}
            size="md"
            onClick={() => onUpdate({ emphasis: card.value })}
          />
        ))}
      </div>
    </div>
  );
}
