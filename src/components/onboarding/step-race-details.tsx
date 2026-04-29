"use client";

import type { OnboardingData } from "@/lib/onboarding/types";
import { RACE_TYPES } from "@/lib/onboarding/types";
import { OptionCard } from "./option-card";

interface StepRaceDetailsProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

export function StepRaceDetails({ data, onUpdate }: StepRaceDetailsProps) {
  const runningRaces = RACE_TYPES.filter((r) => r.category === "running");
  const triathlonRaces = RACE_TYPES.filter((r) => r.category === "triathlon");
  const otherRaces = RACE_TYPES.filter((r) => r.category === "other");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">What race are you training for?</h2>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-gray-500">Running</h3>
        <div className="grid grid-cols-3 gap-2">
          {runningRaces.map((race) => (
            <OptionCard
              key={race.value}
              label={race.label}
              selected={data.raceType === race.value}
              onClick={() => onUpdate({ raceType: race.value })}
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-gray-500">Triathlon</h3>
        <div className="grid grid-cols-2 gap-2">
          {triathlonRaces.map((race) => (
            <OptionCard
              key={race.value}
              label={race.label}
              selected={data.raceType === race.value}
              onClick={() => onUpdate({ raceType: race.value })}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {otherRaces.map((race) => (
          <OptionCard
            key={race.value}
            label={race.label}
            selected={data.raceType === race.value}
            onClick={() => onUpdate({ raceType: race.value })}
          />
        ))}
      </div>

      {data.raceType === "other" && (
        <input
          type="text"
          value={data.raceTypeOther}
          onChange={(e) => onUpdate({ raceTypeOther: e.target.value })}
          placeholder="What race?"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-black focus:outline-none"
        />
      )}

      <div>
        <label htmlFor="raceDate" className="block text-sm font-medium text-gray-700">
          Race date (optional)
        </label>
        <input
          id="raceDate"
          type="date"
          value={data.raceDate ?? ""}
          onChange={(e) => onUpdate({ raceDate: e.target.value || null })}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-black focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="goalTime" className="block text-sm font-medium text-gray-700">
          Goal time (optional)
        </label>
        <input
          id="goalTime"
          type="text"
          value={data.goalTime ?? ""}
          onChange={(e) => onUpdate({ goalTime: e.target.value || null })}
          placeholder="e.g. sub 4:00:00"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-black focus:outline-none"
        />
      </div>
    </div>
  );
}
