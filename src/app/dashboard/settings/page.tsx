"use client";

import { useEffect, useState, useCallback } from "react";
import { IntegrationCard } from "@/components/settings/integration-card";
import { CredentialsModal } from "@/components/settings/credentials-modal";
import { ApiKeyModal } from "@/components/settings/api-key-modal";

interface IntegrationStatus {
  provider: string;
  connected: boolean;
  status: string;
  lastSyncedAt: string | null;
}

const INTEGRATIONS = [
  { provider: "macrofactor", name: "MacroFactor", description: "Nutrition tracking & macros", type: "credentials" },
  { provider: "hevy", name: "Hevy", description: "Strength training & workouts", type: "api-key" },
  { provider: "strava", name: "Strava", description: "Running, cycling & swimming", type: "oauth" },
  { provider: "garmin", name: "Garmin", description: "Recovery, sleep & HRV", type: "credentials" },
] as const;

export default function SettingsPage() {
  const [statuses, setStatuses] = useState<IntegrationStatus[]>([]);
  const [modal, setModal] = useState<{ provider: string; type: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchStatuses = useCallback(async () => {
    const res = await fetch("/api/integrations/status");
    if (res.ok) {
      const data = await res.json();
      setStatuses(data.integrations);
    }
  }, []);

  useEffect(() => {
    fetchStatuses();

    const params = new URLSearchParams(window.location.search);
    if (params.get("strava") === "success") {
      setToastMessage("Strava connected successfully!");
      window.history.replaceState({}, "", "/dashboard/settings");
    } else if (params.get("strava") === "error") {
      setToastMessage("Failed to connect Strava. Please try again.");
      window.history.replaceState({}, "", "/dashboard/settings");
    }
  }, [fetchStatuses]);

  const handleConnect = (provider: string, type: string) => {
    if (type === "oauth") {
      window.location.href = "/api/integrations/strava/authorize";
    } else {
      setModal({ provider, type });
    }
  };

  const handleDisconnect = async (provider: string) => {
    const res = await fetch(`/api/integrations/${provider}/disconnect`, { method: "DELETE" });
    if (res.ok) {
      await fetchStatuses();
      setToastMessage(`${provider} disconnected.`);
    }
  };

  const handleCredentialsSubmit = async (provider: string, email: string, password: string) => {
    const res = await fetch(`/api/integrations/${provider}/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Connection failed");
    }
    await fetchStatuses();
    setToastMessage(`${provider} connected!`);
  };

  const handleApiKeySubmit = async (provider: string, apiKey: string) => {
    const res = await fetch(`/api/integrations/${provider}/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Connection failed");
    }
    await fetchStatuses();
    setToastMessage(`${provider} connected!`);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {toastMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {toastMessage}
          <button onClick={() => setToastMessage(null)} className="ml-2 font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="rounded-lg border bg-white p-6">
        <h2 className="text-lg font-semibold">Integrations</h2>
        <p className="mt-1 text-sm text-gray-500">
          Connect your fitness apps so Hybro can see your data.
        </p>
        <div className="mt-4 space-y-3">
          {INTEGRATIONS.map((integration) => {
            const status = statuses.find((s) => s.provider === integration.provider);
            return (
              <IntegrationCard
                key={integration.provider}
                name={integration.name}
                description={integration.description}
                provider={integration.provider}
                connected={status?.connected ?? false}
                status={status?.status ?? "disconnected"}
                lastSyncedAt={status?.lastSyncedAt ?? null}
                onConnect={() => handleConnect(integration.provider, integration.type)}
                onDisconnect={() => handleDisconnect(integration.provider)}
              />
            );
          })}
        </div>
      </div>

      {modal?.type === "credentials" && (
        <CredentialsModal
          provider={modal.provider}
          title={INTEGRATIONS.find((i) => i.provider === modal.provider)?.name ?? ""}
          open={true}
          onClose={() => setModal(null)}
          onSubmit={(email, password) => handleCredentialsSubmit(modal.provider, email, password)}
        />
      )}

      {modal?.type === "api-key" && (
        <ApiKeyModal
          provider={modal.provider}
          title={INTEGRATIONS.find((i) => i.provider === modal.provider)?.name ?? ""}
          helpUrl="https://hevy.com/settings?developer"
          open={true}
          onClose={() => setModal(null)}
          onSubmit={(apiKey) => handleApiKeySubmit(modal.provider, apiKey)}
        />
      )}
    </div>
  );
}
