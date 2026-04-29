"use client";

import type { OnboardingData } from "@/lib/onboarding/types";
import { OptionCard } from "./option-card";

interface StepRaceProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

export function StepRace({ data, onUpdate }: StepRaceProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Are you training for a race?</h2>
        <p className="mt-1 text-gray-500">
          This is separate from your body goal — you can train for a race and gain muscle.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <OptionCard
          label="Yes"
          description="I have a race coming up"
          selected={data.trainingForRace === true}
          onClick={() => onUpdate({ trainingForRace: true })}
        />
        <OptionCard
          label="No"
          description="Not training for a race"
          selected={data.trainingForRace === false}
          onClick={() => onUpdate({ trainingForRace: false })}
        />
      </div>
    </div>
  );
}
