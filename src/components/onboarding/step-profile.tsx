"use client";

import type { OnboardingData, Sex } from "@/lib/onboarding/types";
import { OptionCard } from "./option-card";

interface StepProfileProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

const sexOptions: { value: Sex; label: string }[] = [
  { value: "M", label: "Male" },
  { value: "F", label: "Female" },
  { value: "Other", label: "Other" },
];

export function StepProfile({ data, onUpdate }: StepProfileProps) {
  // Convert stored cm to feet/inches for display
  const totalInches = data.height ? Math.round(data.height / 2.54) : null;
  const feet = totalInches ? Math.floor(totalInches / 12) : null;
  const inches = totalInches ? totalInches % 12 : null;

  const handleHeightChange = (newFeet: number | null, newInches: number | null) => {
    const f = newFeet ?? feet ?? 0;
    const i = newInches ?? inches ?? 0;
    const total = f * 12 + i;
    onUpdate({ height: total > 0 ? Math.round(total * 2.54) : null });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">About You</h2>
        <p className="mt-1 text-gray-500">Basic info to personalize your plan.</p>
      </div>

      <div>
        <span className="block text-sm font-medium text-gray-700">Height</span>
        <div className="mt-1 flex items-center gap-2">
          <label htmlFor="feet" className="sr-only">Feet</label>
          <input
            id="feet"
            type="number"
            min={3}
            max={8}
            value={feet ?? ""}
            onChange={(e) => handleHeightChange(e.target.value ? Number(e.target.value) : null, inches)}
            className="w-20 rounded-lg border border-gray-300 px-3 py-2 focus:border-black focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            placeholder="5"
          />
          <span className="text-sm text-gray-500">ft</span>
          <label htmlFor="inches" className="sr-only">Inches</label>
          <input
            id="inches"
            type="number"
            min={0}
            max={11}
            value={inches ?? ""}
            onChange={(e) => handleHeightChange(feet, e.target.value ? Number(e.target.value) : null)}
            className="w-20 rounded-lg border border-gray-300 px-3 py-2 focus:border-black focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            placeholder="10"
          />
          <span className="text-sm text-gray-500">in</span>
        </div>
        {totalInches && (
          <p className="mt-1 text-sm text-gray-400">{totalInches} inches total</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="weight" className="block text-sm font-medium text-gray-700">
            Weight (lbs)
          </label>
          <input
            id="weight"
            type="number"
            value={data.weight ?? ""}
            onChange={(e) => onUpdate({ weight: e.target.value ? Number(e.target.value) : null })}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-black focus:outline-none"
            placeholder="175"
          />
        </div>
        <div>
          <label htmlFor="age" className="block text-sm font-medium text-gray-700">
            Age
          </label>
          <input
            id="age"
            type="number"
            value={data.age ?? ""}
            onChange={(e) => onUpdate({ age: e.target.value ? Number(e.target.value) : null })}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-black focus:outline-none"
            placeholder="25"
          />
        </div>
      </div>

      <div>
        <span className="block text-sm font-medium text-gray-700">Sex</span>
        <div className="mt-2 grid grid-cols-3 gap-3">
          {sexOptions.map((option) => (
            <OptionCard
              key={option.value}
              label={option.label}
              selected={data.sex === option.value}
              onClick={() => onUpdate({ sex: option.value })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
