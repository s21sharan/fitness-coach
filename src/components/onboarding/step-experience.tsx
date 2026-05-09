"use client";

import type { OnboardingData, Experience } from "@/lib/onboarding/types";
import { OptionCard } from "./option-card";

interface StepExperienceProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

export const STEP_EXPERIENCE_TITLE = "How experienced are you?";
export const STEP_EXPERIENCE_SUBTITLE =
  "Be honest — this calibrates volume, intensity, and how aggressive your plan can be.";

const EXPERIENCE_CARDS: {
  value: Experience;
  emoji: string;
  label: string;
  sub: string;
  color: "coral" | "mint" | "sky" | "lemon";
}[] = [
  { value: "beginner", emoji: "🌱", label: "Beginner", sub: "< 1 year consistent lifting", color: "mint" },
  { value: "intermediate", emoji: "🔥", label: "Intermediate", sub: "1–3 years consistent lifting", color: "coral" },
  { value: "advanced", emoji: "⚡", label: "Advanced", sub: "3+ years consistent lifting", color: "sky" },
];

export function StepExperience({ data, onUpdate }: StepExperienceProps) {
  return (
    <div style={{ maxWidth: 520, margin: "0 auto", width: "100%" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14,
        }}
      >
        {EXPERIENCE_CARDS.map((card) => (
          <OptionCard
            key={card.value}
            emoji={card.emoji}
            label={card.label}
            sub={card.sub}
            selected={data.experience === card.value}
            color={card.color}
            size="lg"
            onClick={() => onUpdate({ experience: card.value })}
          />
        ))}
      </div>
    </div>
  );
}
