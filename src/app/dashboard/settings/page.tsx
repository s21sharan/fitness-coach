"use client";

import { useEffect, useState, useCallback } from "react";
import { IntegrationCard } from "@/components/settings/integration-card";
import { CredentialsModal } from "@/components/settings/credentials-modal";
import { ApiKeyModal } from "@/components/settings/api-key-modal";
import { Topbar } from "@/components/topbar";
import { Icon } from "@/components/app/icon";

interface IntegrationStatus {
  provider: string;
  connected: boolean;
  status: string;
  lastSyncedAt: string | null;
}

const INTEGRATIONS = [
  { provider: "macrofactor", name: "MacroFactor", category: "Nutrition", type: "credentials" },
  { provider: "hevy", name: "Hevy", category: "Workouts", type: "api-key" },
  { provider: "strava", name: "Strava", category: "Cardio", type: "oauth" },
  { provider: "garmin", name: "Garmin", category: "Recovery & HR", type: "credentials" },
  { provider: "gcal", name: "Google Calendar", category: "Schedule", type: "oauth" },
  { provider: "apple", name: "Apple Health", category: "Health metrics", type: "native" },
] as const;

const NAV_ITEMS = [
  { id: "integrations", label: "Integrations" },
  { id: "account", label: "Account" },
  { id: "goals", label: "Goals & body" },
  { id: "notifications", label: "Notifications" },
  { id: "privacy", label: "Privacy & data" },
  { id: "subscription", label: "Subscription" },
];

export default function SettingsPage() {
  const [statuses, setStatuses] = useState<IntegrationStatus[]>([]);
  const [modal, setModal] = useState<{ provider: string; type: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState("integrations");

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
      window.location.href = `/api/integrations/${provider}/authorize`;
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

  const connectedCount = INTEGRATIONS.filter((i) => {
    const s = statuses.find((st) => st.provider === i.provider);
    return s?.connected ?? false;
  }).length;

  return (
    <>
      <Topbar title="Settings" subtitle="Integrations & account" />

      <div className="main">
        {toastMessage && (
          <div
            style={{
              marginBottom: 16,
              borderRadius: "var(--r-md)",
              border: "1px solid var(--mint)",
              background: "var(--mint-soft)",
              padding: "10px 14px",
              fontSize: 13,
              color: "var(--ink-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
                color: "var(--muted)",
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Two-column grid: nav + content */}
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20, alignItems: "start" }}>
          {/* Left nav */}
          <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {NAV_ITEMS.map((item) => {
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveNav(item.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: isActive ? "1px solid var(--line)" : "1px solid transparent",
                    background: isActive ? "var(--surface)" : "transparent",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? "var(--ink)" : "var(--ink-2)",
                    textAlign: "left",
                  }}
                >
                  <span>{item.label}</span>
                  {item.id === "integrations" && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        background: "var(--mint-soft)",
                        color: "var(--mint-deep)",
                        borderRadius: 999,
                        padding: "1px 7px",
                      }}
                    >
                      {connectedCount}/6
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right content */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Header card */}
            <div
              className="card"
              style={{
                background: "linear-gradient(135deg, var(--sky-soft) 0%, var(--surface) 100%)",
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: "var(--ink)",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  color: "var(--coral)",
                }}
              >
                <Icon name="plug" size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: "var(--ink)", marginBottom: 2 }}>
                  Your connected apps
                </div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>
                  The more Hybro sees, the better it coaches. {connectedCount} of 6 connected.
                </div>
              </div>
              <button type="button" className="btn-ink" style={{ flexShrink: 0 }}>
                <Icon name="plus" size={15} />
                Add
              </button>
            </div>

            {/* Integration cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {INTEGRATIONS.map((integration) => {
                const status = statuses.find((s) => s.provider === integration.provider);
                return (
                  <IntegrationCard
                    key={integration.provider}
                    provider={integration.provider}
                    name={integration.name}
                    category={integration.category}
                    connected={status?.connected ?? false}
                    lastSyncedAt={status?.lastSyncedAt ?? null}
                    onConnect={() => handleConnect(integration.provider, integration.type)}
                    onDisconnect={() => handleDisconnect(integration.provider)}
                  />
                );
              })}
            </div>
          </div>
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
    </>
  );
}
