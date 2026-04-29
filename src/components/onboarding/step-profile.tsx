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
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">About You</h2>
        <p className="mt-1 text-gray-500">Basic info to personalize your plan.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="height" className="block text-sm font-medium text-gray-700">
            Height (cm)
          </label>
          <input
            id="height"
            type="number"
            value={data.height ?? ""}
            onChange={(e) => onUpdate({ height: e.target.value ? Number(e.target.value) : null })}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-black focus:outline-none"
            placeholder="178"
          />
        </div>
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
