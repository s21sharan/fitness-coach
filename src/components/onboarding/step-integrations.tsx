"use client";

import { useState, useEffect, useCallback } from "react";
import type { OnboardingData } from "@/lib/onboarding/types";
import { CredentialsModal } from "@/components/settings/credentials-modal";
import { ApiKeyModal } from "@/components/settings/api-key-modal";
import { BrandMark } from "@/components/app/brand-mark";

interface StepIntegrationsProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

interface IntegrationStatus {
  provider: string;
  connected: boolean;
  status: string;
}

export const STEP_INTEGRATIONS_TITLE = "Connect your apps.";
export const STEP_INTEGRATIONS_SUBTITLE =
  "The more Hybro sees, the better it coaches. You can always add more later.";

const integrations = [
  { provider: "macrofactor", name: "MacroFactor", category: "Nutrition & macros", type: "credentials" },
  { provider: "hevy", name: "Hevy", category: "Strength workouts", type: "api-key" },
  { provider: "strava", name: "Strava", category: "Running & cycling", type: "oauth" },
  { provider: "garmin", name: "Garmin", category: "Recovery & sleep", type: "credentials" },
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

  return (
    <div style={{ maxWidth: 580, margin: "0 auto", width: "100%" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
        }}
      >
        {integrations.map((integration) => {
          const status = statuses.find((s) => s.provider === integration.provider);
          const isConnected = status?.connected ?? false;

          return (
            <div
              key={integration.provider}
              style={{
                background: "#fff",
                borderRadius: "var(--r-lg)",
                border: isConnected ? "2px solid var(--mint-deep)" : "1px solid var(--line)",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                position: "relative",
                transition: "border-color 0.2s",
              }}
            >
              {isConnected && (
                <span
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "var(--mint-deep)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <svg width={11} height={11} viewBox="0 0 11 11" fill="none">
                    <path
                      d="M2 5.5l2.5 2.5 4.5-4.5"
                      stroke="#fff"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              )}

              <BrandMark name={integration.provider} size={36} />

              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 800,
                    color: "var(--ink)",
                  }}
                >
                  {integration.name}
                </p>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: 12,
                    color: "var(--muted)",
                    fontWeight: 500,
                  }}
                >
                  {integration.category}
                </p>
              </div>

              {!isConnected && (
                <button
                  type="button"
                  onClick={() => handleConnect(integration.provider, integration.type)}
                  style={{
                    marginTop: "auto",
                    padding: "8px 16px",
                    borderRadius: 999,
                    border: "1.5px solid var(--line)",
                    background: "transparent",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--ink)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "background 0.15s",
                    alignSelf: "flex-start",
                  }}
                >
                  Connect
                </button>
              )}
            </div>
          );
        })}
      </div>

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
