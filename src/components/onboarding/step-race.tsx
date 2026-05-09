"use client";

import type { OnboardingData } from "@/lib/onboarding/types";
import { OptionCard } from "./option-card";

interface StepRaceProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

export const STEP_RACE_TITLE = "Are you training for a race?";
export const STEP_RACE_SUBTITLE =
  "This is separate from your body goal — you can train for a race and still build muscle.";

export function StepRace({ data, onUpdate }: StepRaceProps) {
  return (
    <div style={{ maxWidth: 520, margin: "0 auto", width: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <OptionCard
          emoji="🏁"
          label="Yes"
          sub="I have a race coming up"
          selected={data.trainingForRace === true}
          color="coral"
          size="lg"
          onClick={() => onUpdate({ trainingForRace: true })}
        />
        <OptionCard
          emoji="🏋️"
          label="No"
          sub="Not training for a race"
          selected={data.trainingForRace === false}
          color="mint"
          size="lg"
          onClick={() => onUpdate({ trainingForRace: false })}
        />
      </div>
    </div>
  );
}
