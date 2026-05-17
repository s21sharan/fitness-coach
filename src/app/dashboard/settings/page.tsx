"use client";

import { useEffect, useState, useCallback } from "react";
import { IntegrationCard } from "@/components/settings/integration-card";
import { CredentialsModal } from "@/components/settings/credentials-modal";
import { ApiKeyModal } from "@/components/settings/api-key-modal";
import { BetaAcknowledgeModal } from "@/components/settings/beta-acknowledge-modal";
import { Topbar } from "@/components/topbar";
import { Icon } from "@/components/app/icon";
import { getUnitPreferences, saveUnitPreferences, type DistanceUnit, type WeightUnit, type UnitPreferences } from "@/lib/units";
import { getCheckinPreferences, saveCheckinPreferences, type CheckinPreferences } from "@/lib/checkin-preferences";
import { isBetaAcknowledged, setBetaAcknowledged } from "@/lib/beta-features";
import { TrainingZonesPanel } from "@/components/settings/training-zones-panel";

interface IntegrationStatus {
  provider: string;
  connected: boolean;
  status: string;
  lastSyncedAt: string | null;
}

const INTEGRATIONS = [
  { provider: "hevy", name: "Hevy", category: "Workouts", type: "api-key" },
  { provider: "strava", name: "Strava", category: "Cardio", type: "oauth" },
] as const;

const BETA_INTEGRATIONS = [
  { provider: "garmin", name: "Garmin", category: "Recovery & HR", type: "credentials" },
] as const;

const COMING_SOON = [
  { provider: "apple", name: "Apple Health", category: "Daily health metrics" },
  { provider: "gcal", name: "Google Calendar", category: "Schedule & availability" },
  { provider: "whoop", name: "Whoop", category: "Recovery & strain" },
  { provider: "oura", name: "Oura", category: "Sleep & readiness" },
  { provider: "trainingpeaks", name: "TrainingPeaks", category: "Workouts & metrics" },
  { provider: "zwift", name: "Zwift", category: "Indoor cycling" },
  { provider: "wahoo", name: "Wahoo", category: "Bike computer" },
  { provider: "myfitnesspal", name: "MyFitnessPal", category: "Nutrition tracking" },
] as const;

const NAV_ITEMS = [
  { id: "integrations", label: "Integrations" },
  { id: "preferences", label: "Preferences" },
  { id: "zones", label: "Training Zones" },
  { id: "account", label: "Account" },
  { id: "goals", label: "Goals & body" },
  { id: "notifications", label: "Notifications" },
  { id: "privacy", label: "Privacy & data" },
  { id: "subscription", label: "Subscription" },
];

export default function SettingsPage() {
  const [statuses, setStatuses] = useState<IntegrationStatus[]>([]);
  const [modal, setModal] = useState<{ provider: string; type: string } | null>(null);
  const [betaPending, setBetaPending] = useState<{ provider: string; type: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState("integrations");
  const [unitPrefs, setUnitPrefs] = useState<UnitPreferences>({ distance: "mi", weight: "lbs" });
  const [checkinPrefs, setCheckinPrefs] = useState<CheckinPreferences>({ enabled: true, frequencyWeeks: 1 });

  const fetchStatuses = useCallback(async () => {
    const res = await fetch("/api/integrations/status");
    if (res.ok) {
      const data = await res.json();
      setStatuses(data.integrations);
    }
  }, []);

  useEffect(() => {
    setUnitPrefs(getUnitPreferences());
    setCheckinPrefs(getCheckinPreferences());
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

  const openConnect = (provider: string, type: string) => {
    if (type === "oauth") {
      window.location.href = `/api/integrations/${provider}/authorize`;
    } else {
      setModal({ provider, type });
    }
  };

  const handleConnect = (provider: string, type: string) => {
    const isBeta = BETA_INTEGRATIONS.some((i) => i.provider === provider);
    if (isBeta && provider === "garmin" && !isBetaAcknowledged("garmin")) {
      setBetaPending({ provider, type });
      return;
    }
    openConnect(provider, type);
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

  const handleUnitChange = (key: keyof UnitPreferences, value: string) => {
    const updated = { ...unitPrefs, [key]: value };
    setUnitPrefs(updated);
    saveUnitPreferences(updated);
    setToastMessage("Preferences saved!");
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
                      {connectedCount}/{INTEGRATIONS.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right content */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {activeNav === "integrations" && (
              <>
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
                      The more Trainer sees, the better it coaches. {connectedCount} of {INTEGRATIONS.length} connected.
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

                {/* Beta */}
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Beta
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {BETA_INTEGRATIONS.map((integration) => {
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
                          betaBadge
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Coming soon */}
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Coming soon
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {COMING_SOON.map((integration) => (
                      <IntegrationCard
                        key={integration.provider}
                        provider={integration.provider}
                        name={integration.name}
                        category={integration.category}
                        connected={false}
                        lastSyncedAt={null}
                        onConnect={() => {}}
                        onDisconnect={() => {}}
                        comingSoon
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeNav === "preferences" && (
              <>
                <div className="card" style={{ padding: 24 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Units & Display</div>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20 }}>
                    Choose how distances and weights are displayed throughout the app.
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    {/* Distance unit */}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Distance</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {([["mi", "Miles"], ["km", "Kilometers"]] as const).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => handleUnitChange("distance", value)}
                            style={{
                              padding: "10px 20px",
                              borderRadius: 10,
                              border: unitPrefs.distance === value ? "2px solid var(--ink)" : "1px solid var(--line)",
                              background: unitPrefs.distance === value ? "var(--ink)" : "var(--surface)",
                              color: unitPrefs.distance === value ? "#fff" : "var(--ink)",
                              fontSize: 13,
                              fontWeight: 700,
                              cursor: "pointer",
                              transition: "all 0.15s",
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                        Affects pace ({unitPrefs.distance === "mi" ? "min/mi" : "min/km"}) and distance display
                      </div>
                    </div>

                    {/* Weight unit */}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Weight</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {([["lbs", "Pounds (lbs)"], ["kg", "Kilograms (kg)"]] as const).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => handleUnitChange("weight", value)}
                            style={{
                              padding: "10px 20px",
                              borderRadius: 10,
                              border: unitPrefs.weight === value ? "2px solid var(--ink)" : "1px solid var(--line)",
                              background: unitPrefs.weight === value ? "var(--ink)" : "var(--surface)",
                              color: unitPrefs.weight === value ? "#fff" : "var(--ink)",
                              fontSize: 13,
                              fontWeight: 700,
                              cursor: "pointer",
                              transition: "all 0.15s",
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                        Affects body weight and lifting weight display
                      </div>
                    </div>
                  </div>

                  {/* Check-in settings */}
                  <div style={{ marginTop: 32 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                      Physique Check-ins
                    </div>
                    <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 16 }}>
                      Your coach will prompt you during chat when it&apos;s time
                    </p>

                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                      <span style={{ fontSize: 13, color: "var(--ink)" }}>Enable weekly check-ins</span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = { ...checkinPrefs, enabled: !checkinPrefs.enabled };
                          setCheckinPrefs(updated);
                          saveCheckinPreferences(updated);
                        }}
                        style={{
                          width: 44, height: 24, borderRadius: 999, border: "none",
                          background: checkinPrefs.enabled ? "var(--coral)" : "#d1d5db",
                          cursor: "pointer", position: "relative", transition: "background 0.2s",
                        }}
                      >
                        <div style={{
                          width: 18, height: 18, borderRadius: "50%", background: "#fff",
                          position: "absolute", top: 3,
                          left: checkinPrefs.enabled ? 23 : 3,
                          transition: "left 0.2s",
                        }} />
                      </button>
                    </div>

                    {checkinPrefs.enabled && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 13, color: "var(--ink-2)" }}>Remind me every</span>
                        <select
                          value={checkinPrefs.frequencyWeeks}
                          onChange={(e) => {
                            const updated = { ...checkinPrefs, frequencyWeeks: Number(e.target.value) };
                            setCheckinPrefs(updated);
                            saveCheckinPreferences(updated);
                          }}
                          style={{
                            padding: "6px 10px", borderRadius: 8, border: "1px solid var(--line)",
                            fontSize: 13, background: "#fff", cursor: "pointer",
                          }}
                        >
                          <option value={1}>1 week</option>
                          <option value={2}>2 weeks</option>
                          <option value={4}>4 weeks</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {activeNav === "zones" && (
              <TrainingZonesPanel onToast={setToastMessage} />
            )}

            {activeNav === "account" && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Account</div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>
                  Manage your account through Clerk. Your profile and authentication are handled securely.
                </div>
                <div style={{ marginTop: 16 }}>
                  <a href="/sign-in" style={{ fontSize: 13, fontWeight: 600, color: "var(--coral-deep)", textDecoration: "none" }}>
                    Manage account →
                  </a>
                </div>
              </div>
            )}

            {activeNav === "goals" && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Goals & Body</div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>
                  Your goals and body profile were set during onboarding. To update them, go through onboarding again.
                </div>
                <div style={{ marginTop: 16 }}>
                  <a href="/onboarding" style={{ fontSize: 13, fontWeight: 600, color: "var(--coral-deep)", textDecoration: "none" }}>
                    Re-do onboarding →
                  </a>
                </div>
              </div>
            )}

            {activeNav === "notifications" && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Notifications</div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>
                  Notification preferences coming soon. Hybro will be able to alert you about weekly check-ins, recovery concerns, and plan adjustments.
                </div>
              </div>
            )}

            {activeNav === "privacy" && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Privacy & Data</div>
                <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
                  Your fitness data is stored securely in Supabase with row-level security. Integration credentials are encrypted with AES-256-GCM. Hybro never shares your data with third parties.
                </div>
                <div style={{ marginTop: 16, fontSize: 13, color: "var(--muted)" }}>
                  To delete your account and all associated data, contact support.
                </div>
              </div>
            )}

            {activeNav === "subscription" && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Subscription</div>
                <div style={{ display: "inline-block", background: "var(--mint-soft)", color: "var(--mint-deep)", padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 800, marginBottom: 12 }}>
                  Free Plan
                </div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>
                  You're on the free plan. All features are currently available during the MVP period.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {modal?.type === "credentials" && (
        <CredentialsModal
          provider={modal.provider}
          title={
            INTEGRATIONS.find((i) => i.provider === modal.provider)?.name ??
            BETA_INTEGRATIONS.find((i) => i.provider === modal.provider)?.name ??
            ""
          }
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

      <BetaAcknowledgeModal
        open={betaPending !== null}
        onClose={() => setBetaPending(null)}
        onAcknowledge={() => {
          if (!betaPending) return;
          setBetaAcknowledged("garmin");
          const target = betaPending;
          setBetaPending(null);
          openConnect(target.provider, target.type);
        }}
      />
    </>
  );
}
