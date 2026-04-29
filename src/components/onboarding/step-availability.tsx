"use client";

import type { OnboardingData } from "@/lib/onboarding/types";
import { OptionCard } from "./option-card";

interface StepAvailabilityProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

export function StepAvailability({ data, onUpdate }: StepAvailabilityProps) {
  const dayOptions = [3, 4, 5, 6, 7];

  const suggestedLiftingDays = () => {
    if (!data.daysPerWeek) return null;
    if (!data.trainingForRace) return data.daysPerWeek;
    if (data.daysPerWeek <= 4) return 2;
    if (data.daysPerWeek <= 5) return 3;
    return Math.min(4, data.daysPerWeek - 2);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">How many days can you train?</h2>
        <p className="mt-1 text-gray-500">Total training days per week (lifting + cardio).</p>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {dayOptions.map((days) => (
          <OptionCard
            key={days}
            label={`${days}`}
            selected={data.daysPerWeek === days}
            onClick={() => {
              const suggested = (() => {
                if (!data.trainingForRace) return days;
                if (days <= 4) return 2;
                if (days <= 5) return 3;
                return Math.min(4, days - 2);
              })();
              onUpdate({ daysPerWeek: days, liftingDays: suggested });
            }}
          />
        ))}
      </div>

      {data.daysPerWeek && data.trainingForRace && (
        <div>
          <label htmlFor="liftingDays" className="block text-sm font-medium text-gray-700">
            How many of those for lifting?
          </label>
          <input
            id="liftingDays"
            type="number"
            min={1}
            max={data.daysPerWeek}
            value={data.liftingDays ?? ""}
            onChange={(e) => onUpdate({ liftingDays: e.target.value ? Number(e.target.value) : null })}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-black focus:outline-none"
          />
          <p className="mt-1 text-sm text-gray-400">
            Suggested: {suggestedLiftingDays()} lifting days
          </p>
        </div>
      )}
    </div>
  );
}
