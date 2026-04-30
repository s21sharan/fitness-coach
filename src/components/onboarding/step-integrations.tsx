"use client";

import { useState, useEffect, useCallback } from "react";
import type { OnboardingData } from "@/lib/onboarding/types";
import { CredentialsModal } from "@/components/settings/credentials-modal";
import { ApiKeyModal } from "@/components/settings/api-key-modal";

interface StepIntegrationsProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

interface IntegrationStatus {
  provider: string;
  connected: boolean;
  status: string;
}

const integrations = [
  { provider: "macrofactor", name: "MacroFactor", description: "Nutrition tracking & macros", type: "credentials" },
  { provider: "hevy", name: "Hevy", description: "Strength training & workouts", type: "api-key" },
  { provider: "strava", name: "Strava", description: "Running, cycling & swimming", type: "oauth" },
  { provider: "garmin", name: "Garmin", description: "Recovery, sleep & HRV", type: "credentials" },
] as const;

export function StepIntegrations({ data, onUpdate }: StepIntegrationsProps) {
  const [statuses, setStatuses] = useState<IntegrationStatus[]>([]);
  const [modal, setModal] = useState<{ provider: string; type: string } | null>(null);

  const fetchStatuses = useCallback(async () => {
    const res = await fetch("/api/integrations/status");
    if (res.ok) {
      const result = await res.json();
      setStatuses(result.integrations);
    }
  }, []);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  const handleConnect = (provider: string, type: string) => {
    if (type === "oauth") {
      window.location.href = "/api/integrations/strava/authorize";
    } else {
      setModal({ provider, type });
    }
  };

  const handleCredentialsSubmit = async (provider: string, email: string, password: string) => {
    const res = await fetch(`/api/integrations/${provider}/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Connection failed");
    }
    await fetchStatuses();
  };

  const handleApiKeySubmit = async (provider: string, apiKey: string) => {
    const res = await fetch(`/api/integrations/${provider}/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Connection failed");
    }
    await fetchStatuses();
  };

  const connectedCount = statuses.filter((s) => s.connected).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Connect your apps</h2>
        <p className="mt-1 text-gray-500">
          Connect at least one app so Hybro can see your data. More connections = better coaching.
        </p>
      </div>

      <div className="space-y-3">
        {integrations.map((integration) => {
          const status = statuses.find((s) => s.provider === integration.provider);
          const isConnected = status?.connected ?? false;

          return (
            <div
              key={integration.provider}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div>
                <p className="font-medium">{integration.name}</p>
                <p className="text-sm text-gray-500">{integration.description}</p>
              </div>
              {isConnected ? (
                <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                  Connected
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleConnect(integration.provider, integration.type)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  Connect
                </button>
              )}
            </div>
          );
        })}
      </div>

      {connectedCount > 0 && (
        <p className="text-center text-sm text-green-600">
          {connectedCount} app{connectedCount > 1 ? "s" : ""} connected
        </p>
      )}
      {connectedCount === 0 && (
        <p className="text-center text-sm text-gray-400">
          Connect at least one app to continue.
        </p>
      )}

      {modal?.type === "credentials" && (
        <CredentialsModal
          provider={modal.provider}
          title={integrations.find((i) => i.provider === modal.provider)?.name ?? ""}
          open={true}
          onClose={() => setModal(null)}
          onSubmit={(email, password) => handleCredentialsSubmit(modal.provider, email, password)}
        />
      )}
      {modal?.type === "api-key" && (
        <ApiKeyModal
          provider={modal.provider}
          title={integrations.find((i) => i.provider === modal.provider)?.name ?? ""}
          helpUrl="https://hevy.com/settings?developer"
          open={true}
          onClose={() => setModal(null)}
          onSubmit={(apiKey) => handleApiKeySubmit(modal.provider, apiKey)}
        />
      )}
    </div>
  );
}
