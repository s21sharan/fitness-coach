"use client";

import type { OnboardingData } from "@/lib/onboarding/types";
import { BODY_GOALS } from "@/lib/onboarding/types";
import { OptionCard } from "./option-card";

interface StepBodyGoalProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

export function StepBodyGoal({ data, onUpdate }: StepBodyGoalProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">What&apos;s your body goal?</h2>
        <p className="mt-1 text-gray-500">This helps us set your calorie and training targets.</p>
      </div>

      <div className="space-y-3">
        {BODY_GOALS.map((goal) => (
          <OptionCard
            key={goal.value}
            label={goal.label}
            selected={data.bodyGoal === goal.value}
            onClick={() => onUpdate({ bodyGoal: goal.value })}
          />
        ))}
      </div>

      {data.bodyGoal === "other" && (
        <div>
          <input
            type="text"
            value={data.bodyGoalOther}
            onChange={(e) => onUpdate({ bodyGoalOther: e.target.value })}
            placeholder="Describe your goal..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-black focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}
