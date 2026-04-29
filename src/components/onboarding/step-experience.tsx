"use client";

import type { OnboardingData } from "@/lib/onboarding/types";
import { EXPERIENCE_LEVELS } from "@/lib/onboarding/types";
import { OptionCard } from "./option-card";

interface StepExperienceProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

export function StepExperience({ data, onUpdate }: StepExperienceProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">What&apos;s your training experience?</h2>
      </div>

      <div className="space-y-3">
        {EXPERIENCE_LEVELS.map((level) => (
          <OptionCard
            key={level.value}
            label={level.label}
            description={level.description}
            selected={data.experience === level.value}
            onClick={() => onUpdate({ experience: level.value })}
          />
        ))}
      </div>
    </div>
  );
}
