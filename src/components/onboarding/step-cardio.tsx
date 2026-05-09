"use client";

import type { OnboardingData, CardioType } from "@/lib/onboarding/types";
import { CARDIO_TYPES } from "@/lib/onboarding/types";
import { OptionCard } from "./option-card";

interface StepCardioProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

export const STEP_CARDIO_TITLE = "Do you do any cardio?";
export const STEP_CARDIO_SUBTITLE =
  "We'll weave it into your weekly plan so recovery is never compromised.";

const CARDIO_EMOJIS: Record<string, string> = {
  running: "🏃",
  cycling: "🚴",
  swimming: "🏊",
};

export function StepCardio({ data, onUpdate }: StepCardioProps) {
  const toggleCardioType = (type: CardioType) => {
    const current = data.cardioTypes;
    if (current.includes(type)) {
      onUpdate({ cardioTypes: current.filter((t) => t !== type), doesCardio: true });
    } else {
      onUpdate({ cardioTypes: [...current, type], doesCardio: true });
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", width: "100%" }}>
      {/* Yes / No */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
        <OptionCard
          emoji="✅"
          label="Yes"
          sub="I run, bike, or swim"
          selected={data.doesCardio === true}
          color="mint"
          size="lg"
          onClick={() => onUpdate({ doesCardio: true })}
        />
        <OptionCard
          emoji="🏋️"
          label="No"
          sub="Weights only"
          selected={data.doesCardio === false && data.cardioTypes.length === 0}
          color="sky"
          size="lg"
          onClick={() => onUpdate({ doesCardio: false, cardioTypes: [] })}
        />
      </div>

      {/* Type selection */}
      {data.doesCardio && (
        <div>
          <p
            style={{
              fontSize: 12,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--muted)",
              marginBottom: 10,
            }}
          >
            What type? (select all that apply)
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {CARDIO_TYPES.map((type, i) => (
              <OptionCard
                key={type.value}
                emoji={CARDIO_EMOJIS[type.value] ?? "🏃"}
                label={type.label}
                selected={data.cardioTypes.includes(type.value)}
                color={["coral", "mint", "sky"][i % 3] as "coral" | "mint" | "sky"}
                size="md"
                onClick={() => toggleCardioType(type.value)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
