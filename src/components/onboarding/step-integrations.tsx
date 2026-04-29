"use client";

import type { OnboardingData } from "@/lib/onboarding/types";

interface StepIntegrationsProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

const integrations = [
  { name: "MacroFactor", description: "Nutrition tracking & macros", icon: "🍎" },
  { name: "Hevy", description: "Strength training & workouts", icon: "🏋️" },
  { name: "Strava", description: "Running, cycling & swimming", icon: "🏃" },
  { name: "Garmin", description: "Recovery, sleep & HRV", icon: "⌚" },
  { name: "Google Calendar", description: "Schedule & availability", icon: "📅" },
];

export function StepIntegrations({ data, onUpdate }: StepIntegrationsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Connect your apps</h2>
        <p className="mt-1 text-gray-500">
          Connect at least one app so Hybro can see your data. More connections = better coaching.
        </p>
      </div>

      <div className="space-y-3">
        {integrations.map((integration) => (
          <div
            key={integration.name}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{integration.icon}</span>
              <div>
                <p className="font-medium">{integration.name}</p>
                <p className="text-sm text-gray-500">{integration.description}</p>
              </div>
            </div>
            <button
              type="button"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Connect
            </button>
          </div>
        ))}
      </div>

      <p className="text-center text-sm text-gray-400">
        You can connect more apps later in Settings.
      </p>
    </div>
  );
}
