"use client";

import { useCallback, useEffect, useState } from "react";
import type { AthleteContextProfile } from "@/lib/onboarding/types";
import { IntegrationTile, type IntegrationState } from "./integration-tile";
import { CredentialsModal } from "@/components/settings/credentials-modal";
import { ApiKeyModal } from "@/components/settings/api-key-modal";

interface ScreenConnectProps {
  profile: AthleteContextProfile;
  onUpdate: (updates: Partial<AthleteContextProfile>) => void;
}

export const SCREEN_CONNECT_TITLE = "Connect your apps.";
export const SCREEN_CONNECT_SUBTITLE =
  "We import your last 8-12 weeks so you don't have to manually enter your training history. The more we see, the better we coach.";

interface IntegrationStatus {
  provider: string;
  connected: boolean;
  status: string;
}

const LIVE_INTEGRATIONS = [
  { provider: "macrofactor", name: "MacroFactor", category: "Nutrition & macros", type: "credentials" as const },
  { provider: "hevy", name: "Hevy", category: "Strength workouts", type: "api-key" as const },
  { provider: "strava", name: "Strava", category: "Running / cycling / swim", type: "oauth" as const },
] as const;

const PLACEHOLDER_INTEGRATIONS = [
  { provider: "apple", name: "Apple Health", category: "Daily health metrics" },
  { provider: "gcal", name: "Google Calendar", category: "Schedule & availability" },
  { provider: "whoop", name: "Whoop", category: "Recovery & strain" },
  { provider: "oura", name: "Oura", category: "Sleep & readiness" },
] as const;

const FURTHER_PLACEHOLDERS = [
  { provider: "trainingpeaks", name: "TrainingPeaks", category: "Workouts & metrics" },
  { provider: "zwift", name: "Zwift", category: "Indoor cycling" },
  { provider: "wahoo", name: "Wahoo", category: "Bike computer" },
  { provider: "myfitnesspal", name: "MyFitnessPal", category: "Nutrition tracking" },
] as const;

// `_profile` / `_onUpdate` accepted for symmetry with other screens; this screen
// doesn't write to the profile because integration state is stored server-side.
export function ScreenConnect({ profile: _profile, onUpdate: _onUpdate }: ScreenConnectProps) {
  const [statuses, setStatuses] = useState<IntegrationStatus[]>([]);
  const [modal, setModal] = useState<{ provider: string; type: string } | null>(null);

  const fetchStatuses = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/status");
      if (!res.ok) return;
      const result = await res.json();
      setStatuses(result.integrations ?? []);
    } catch (err) {
      console.error("Failed to fetch integration status:", err);
    }
  }, []);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  const stateFor = (provider: string): IntegrationState => {
    const status = statuses.find((s) => s.provider === provider);
    return status?.connected ? "connected" : "live";
  };

  const handleConnect = (provider: string, type: string) => {
    if (type === "oauth") {
      window.location.href = "/api/integrations/strava/authorize";
      return;
    }
    setModal({ provider, type });
  };

  const submitCredentials = async (provider: string, email: string, password: string) => {
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

  const submitApiKey = async (provider: string, apiKey: string) => {
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
    <div style={{ maxWidth: 600, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 20 }}>
      <Group title="Connect now">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {LIVE_INTEGRATIONS.map((i) => (
            <IntegrationTile
              key={i.provider}
              provider={i.provider}
              name={i.name}
              category={i.category}
              state={stateFor(i.provider)}
              onConnect={() => handleConnect(i.provider, i.type)}
            />
          ))}
        </div>
      </Group>

      <Group title="Coming soon">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {PLACEHOLDER_INTEGRATIONS.map((i) => (
            <IntegrationTile
              key={i.provider}
              provider={i.provider}
              name={i.name}
              category={i.category}
              state="placeholder"
            />
          ))}
        </div>
      </Group>

      <Group title="Other apps we'll add later">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {FURTHER_PLACEHOLDERS.map((i) => (
            <IntegrationTile
              key={i.provider}
              provider={i.provider}
              name={i.name}
              category={i.category}
              state="placeholder"
            />
          ))}
        </div>
      </Group>

      <p style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", margin: 0 }}>
        Skip is fine — you can connect more in Settings later.
      </p>

      {modal?.type === "credentials" && (
        <CredentialsModal
          provider={modal.provider}
          title={LIVE_INTEGRATIONS.find((i) => i.provider === modal.provider)?.name ?? ""}
          open={true}
          onClose={() => setModal(null)}
          onSubmit={(email, password) => submitCredentials(modal.provider, email, password)}
        />
      )}
      {modal?.type === "api-key" && (
        <ApiKeyModal
          provider={modal.provider}
          title={LIVE_INTEGRATIONS.find((i) => i.provider === modal.provider)?.name ?? ""}
          helpUrl="https://hevy.com/settings?developer"
          open={true}
          onClose={() => setModal(null)}
          onSubmit={(apiKey) => submitApiKey(modal.provider, apiKey)}
        />
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p
        style={{
          margin: "0 0 10px",
          fontSize: 11,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--muted)",
        }}
      >
        {title}
      </p>
      {children}
    </div>
  );
}
