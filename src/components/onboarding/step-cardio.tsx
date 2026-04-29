"use client";

import type { OnboardingData, CardioType } from "@/lib/onboarding/types";
import { CARDIO_TYPES } from "@/lib/onboarding/types";
import { OptionCard } from "./option-card";

interface StepCardioProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Do you do any cardio?</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <OptionCard
          label="Yes"
          selected={data.doesCardio === true}
          onClick={() => onUpdate({ doesCardio: true })}
        />
        <OptionCard
          label="No"
          selected={data.doesCardio === false && data.cardioTypes.length === 0}
          onClick={() => onUpdate({ doesCardio: false, cardioTypes: [] })}
        />
      </div>

      {data.doesCardio && (
        <div>
          <p className="mb-2 text-sm font-medium text-gray-500">What type? (select all that apply)</p>
          <div className="grid grid-cols-3 gap-3">
            {CARDIO_TYPES.map((type) => (
              <OptionCard
                key={type.value}
                label={type.label}
                selected={data.cardioTypes.includes(type.value)}
                onClick={() => toggleCardioType(type.value)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
