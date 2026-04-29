"use client";

import type { OnboardingData } from "@/lib/onboarding/types";
import { EMPHASIS_OPTIONS } from "@/lib/onboarding/types";
import { OptionCard } from "./option-card";

interface StepEmphasisProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

export function StepEmphasis({ data, onUpdate }: StepEmphasisProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Any areas you want to emphasize?</h2>
        <p className="mt-1 text-gray-500">This influences your training split selection.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {EMPHASIS_OPTIONS.map((option) => (
          <OptionCard
            key={option.value}
            label={option.label}
            selected={data.emphasis === option.value}
            onClick={() => onUpdate({ emphasis: option.value })}
          />
        ))}
      </div>
    </div>
  );
}
