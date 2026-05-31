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
import { RaceAutocomplete, type RaceSearchResult } from "@/components/shared/race-autocomplete";

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
  { id: "events", label: "Races & Events" },
  { id: "zones", label: "Training Zones" },
  { id: "account", label: "Account" },
  { id: "goals", label: "Goals & body" },
  { id: "notifications", label: "Notifications" },
  { id: "privacy", label: "Privacy & data" },
  { id: "usage", label: "AI Usage" },
  { id: "subscription", label: "Subscription" },
];

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    chat: "AI Coach",
    insights: "Chart Insights",
    daily_summary: "Daily Summary",
    plan_regenerate: "Plan Generation",
    title_gen: "Title Generation",
  };
  return labels[source] || source;
}

function sourceColor(source: string): string {
  const colors: Record<string, string> = {
    chat: "var(--coral)",
    insights: "var(--sky)",
    daily_summary: "var(--mint)",
    plan_regenerate: "#a78bfa",
    title_gen: "var(--lemon)",
  };
  return colors[source] || "#9ca3af";
}

// Rough cost estimate: Sonnet input $3/MTok, output $15/MTok; Haiku input $0.80/MTok, output $4/MTok
function estimateCost(bySource: Record<string, { input: number; output: number; count: number }>): string {
  let cost = 0;
  for (const [source, data] of Object.entries(bySource)) {
    if (source === "title_gen") {
      cost += (data.input / 1_000_000) * 0.8 + (data.output / 1_000_000) * 4;
    } else {
      cost += (data.input / 1_000_000) * 3 + (data.output / 1_000_000) * 15;
    }
  }
  return cost < 0.01 ? "<0.01" : cost.toFixed(2);
}

export default function SettingsPage() {
  const [statuses, setStatuses] = useState<IntegrationStatus[]>([]);
  const [modal, setModal] = useState<{ provider: string; type: string } | null>(null);
  const [betaPending, setBetaPending] = useState<{ provider: string; type: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState("integrations");
  const [unitPrefs, setUnitPrefs] = useState<UnitPreferences>({ distance: "mi", weight: "lbs", swimDistance: "m" });
  const [checkinPrefs, setCheckinPrefs] = useState<CheckinPreferences>({ enabled: true, frequencyWeeks: 1 });
  const [events, setEvents] = useState<Array<{
    id: string;
    name: string;
    sport_type: string | null;
    distance: string | null;
    event_date: string | null;
    priority: string | null;
    goal_type: string | null;
    goal_time: string | null;
    course_notes: string | null;
    travel: boolean;
  }>>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [usageData, setUsageData] = useState<{
    month: string;
    totalInput: number;
    totalOutput: number;
    totalTokens: number;
    requestCount: number;
    bySource: Record<string, { input: number; output: number; count: number }>;
    daily: Array<{ date: string; input: number; output: number }>;
  } | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [subscription, setSubscription] = useState<{
    active: boolean;
    status?: string;
    trialEnd?: string | null;
    periodEnd?: string | null;
    cancelAtPeriodEnd?: boolean;
  } | null>(null);
  const [subLoading, setSubLoading] = useState(true);

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

  useEffect(() => {
    fetch("/api/stripe/status")
      .then((r) => r.json())
      .then(setSubscription)
      .catch(() => setSubscription({ active: false }))
      .finally(() => setSubLoading(false));
  }, []);

  useEffect(() => {
    if (activeNav === "usage") {
      setUsageLoading(true);
      fetch("/api/usage")
        .then((r) => r.json())
        .then((d) => setUsageData(d))
        .catch(() => setUsageData(null))
        .finally(() => setUsageLoading(false));
    }
  }, [activeNav]);

  useEffect(() => {
    if (activeNav === "events") {
      setEventsLoading(true);
      fetch("/api/events?include_past=true")
        .then((r) => r.json())
        .then((d) => setEvents(d.events || []))
        .catch(() => setEvents([]))
        .finally(() => setEventsLoading(false));
    }
  }, [activeNav]);

  const addEvent = async () => {
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", event_date: new Date().toISOString().slice(0, 10), priority: "A", sport_type: "running" }),
    });
    if (res.ok) {
      const { event } = await res.json();
      setEvents((prev) => [...prev, event]);
      setEditingEventId(event.id);
    }
  };

  const updateEvent = async (id: string, patch: Record<string, unknown>) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    await fetch(`/api/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  };

  const deleteEvent = async (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    await fetch(`/api/events/${id}`, { method: "DELETE" });
  };

  const handleManageSubscription = async () => {
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  };

  const handleResubscribe = async () => {
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnUrl: "/dashboard/settings", includeTrial: false }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  };

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
        {new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("expired") === "true" && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12,
            padding: "12px 16px", marginBottom: 16,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#dc2626" }}>
              Your subscription has expired. Go to the Subscription tab to resubscribe.
            </span>
          </div>
        )}

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
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Distance (run & bike)</div>
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
                        Affects pace ({unitPrefs.distance === "mi" ? "min/mi" : "min/km"}) and distance for runs & rides
                      </div>
                    </div>

                    {/* Swim distance unit */}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Swim distance</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {([["m", "Meters"], ["yd", "Yards"]] as const).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => handleUnitChange("swimDistance", value)}
                            style={{
                              padding: "10px 20px",
                              borderRadius: 10,
                              border: unitPrefs.swimDistance === value ? "2px solid var(--ink)" : "1px solid var(--line)",
                              background: unitPrefs.swimDistance === value ? "var(--ink)" : "var(--surface)",
                              color: unitPrefs.swimDistance === value ? "#fff" : "var(--ink)",
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
                        Affects swim pace ({unitPrefs.swimDistance === "yd" ? "min/100yd" : "min/100m"}) and swim distance display
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

            {activeNav === "events" && (
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", marginBottom: 4 }}>Races & Events</h2>
                <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>Manage your upcoming races and goal events.</p>

                {eventsLoading ? (
                  <div style={{ color: "#9ca3af", fontSize: 13 }}>Loading events...</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {events.map((ev) => {
                      const isEditing = editingEventId === ev.id;
                      return (
                        <div key={ev.id} style={{
                          background: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: 12,
                          padding: 18,
                          display: "flex",
                          flexDirection: "column",
                          gap: 12,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1 }}>
                              <RaceAutocomplete
                                value={ev.name}
                                onChange={(name) => updateEvent(ev.id, { name })}
                                onSelectRace={(race: RaceSearchResult) => {
                                  updateEvent(ev.id, {
                                    name: race.name,
                                    event_date: race.date,
                                    sport_type: race.sport_type,
                                    distance: race.distance,
                                  });
                                }}
                                placeholder="Search races or type a name..."
                                inputStyle={{ fontSize: 15, fontWeight: 700 }}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => deleteEvent(ev.id)}
                              style={{
                                padding: "8px 10px",
                                borderRadius: 8,
                                border: "1px solid #e5e7eb",
                                background: "transparent",
                                cursor: "pointer",
                                color: "#9ca3af",
                                fontFamily: "inherit",
                                fontSize: 13,
                              }}
                            >
                              ✕
                            </button>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 4, display: "block" }}>Date</label>
                              <input
                                type="date"
                                value={ev.event_date ?? ""}
                                onChange={(e) => updateEvent(ev.id, { event_date: e.target.value || null })}
                                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit" }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 4, display: "block" }}>Goal time</label>
                              <input
                                type="text"
                                value={ev.goal_time ?? ""}
                                onChange={(e) => updateEvent(ev.id, { goal_time: e.target.value || null })}
                                placeholder="3:50:00"
                                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit" }}
                              />
                            </div>
                          </div>

                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 4, display: "block" }}>Priority</label>
                            <div style={{ display: "flex", gap: 8 }}>
                              {(["A", "B", "C"] as const).map((p) => (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={() => updateEvent(ev.id, { priority: p })}
                                  style={{
                                    flex: 1,
                                    padding: "8px",
                                    borderRadius: 8,
                                    border: ev.priority === p ? "2px solid #111827" : "1.5px solid #e5e7eb",
                                    background: ev.priority === p ? "#111827" : "#fff",
                                    color: ev.priority === p ? "#fff" : "#111827",
                                    cursor: "pointer",
                                    fontFamily: "inherit",
                                    fontWeight: 700,
                                    fontSize: 13,
                                  }}
                                >
                                  {p} — {p === "A" ? "Goal" : p === "B" ? "Tune-up" : "Training"}
                                </button>
                              ))}
                            </div>
                          </div>

                          {!isEditing && (
                            <button
                              type="button"
                              onClick={() => setEditingEventId(ev.id)}
                              style={{ alignSelf: "flex-start", fontSize: 12, color: "#6b7280", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}
                            >
                              + More options
                            </button>
                          )}

                          {isEditing && (
                            <>
                              <div>
                                <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 4, display: "block" }}>Course notes</label>
                                <textarea
                                  value={ev.course_notes ?? ""}
                                  onChange={(e) => updateEvent(ev.id, { course_notes: e.target.value })}
                                  rows={2}
                                  placeholder="Hilly, hot, altitude…"
                                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
                                />
                              </div>
                              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#374151" }}>
                                <input
                                  type="checkbox"
                                  checked={ev.travel}
                                  onChange={(e) => updateEvent(ev.id, { travel: e.target.checked })}
                                />
                                Travel involved
                              </label>
                            </>
                          )}
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={addEvent}
                      style={{
                        padding: "12px 16px",
                        borderRadius: 10,
                        border: "1.5px dashed #d1d5db",
                        background: "transparent",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#6b7280",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      + Add race
                    </button>
                  </div>
                )}
              </div>
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

            {activeNav === "usage" && (
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", marginBottom: 4 }}>AI Usage</h2>
                <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20 }}>
                  Token usage for AI coach, insights, and other AI features this month.
                </p>

                {usageLoading ? (
                  <div style={{ color: "var(--muted)", fontSize: 13 }}>Loading usage data...</div>
                ) : !usageData ? (
                  <div className="card" style={{ padding: 24 }}>
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>No usage data available yet.</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Month header */}
                    <div className="card" style={{
                      padding: 24,
                      background: "linear-gradient(135deg, var(--sky-soft) 0%, var(--surface) 100%)",
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>
                        {new Date(usageData.month + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                        <div>
                          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--ink)" }}>
                            {formatTokenCount(usageData.totalTokens)}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Total tokens</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--ink)" }}>
                            {usageData.requestCount}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>API calls</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--ink)" }}>
                            ${estimateCost(usageData.bySource)}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Est. cost</div>
                        </div>
                      </div>
                    </div>

                    {/* Breakdown by source */}
                    <div className="card" style={{ padding: 24 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)", marginBottom: 16 }}>
                        Breakdown by feature
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {Object.entries(usageData.bySource).map(([source, data]) => {
                          const total = data.input + data.output;
                          const pct = usageData.totalTokens > 0 ? (total / usageData.totalTokens) * 100 : 0;
                          return (
                            <div key={source}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <div style={{
                                    width: 8, height: 8, borderRadius: "50%",
                                    background: sourceColor(source),
                                  }} />
                                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                                    {sourceLabel(source)}
                                  </span>
                                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                                    {data.count} {data.count === 1 ? "call" : "calls"}
                                  </span>
                                </div>
                                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>
                                  {formatTokenCount(total)}
                                </span>
                              </div>
                              <div style={{
                                height: 6, borderRadius: 3,
                                background: "var(--line)",
                                overflow: "hidden",
                              }}>
                                <div style={{
                                  height: "100%", borderRadius: 3,
                                  background: sourceColor(source),
                                  width: `${Math.max(pct, 1)}%`,
                                  transition: "width 0.3s ease",
                                }} />
                              </div>
                              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                                <span style={{ fontSize: 11, color: "var(--muted)" }}>
                                  In: {formatTokenCount(data.input)}
                                </span>
                                <span style={{ fontSize: 11, color: "var(--muted)" }}>
                                  Out: {formatTokenCount(data.output)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                        {Object.keys(usageData.bySource).length === 0 && (
                          <div style={{ fontSize: 13, color: "var(--muted)" }}>
                            No AI usage recorded yet this month. Start chatting with your coach!
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Daily activity */}
                    {usageData.daily.length > 0 && (
                      <div className="card" style={{ padding: 24 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)", marginBottom: 16 }}>
                          Daily activity
                        </div>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80 }}>
                          {usageData.daily.map((day) => {
                            const total = day.input + day.output;
                            const maxTotal = Math.max(...usageData.daily.map((d) => d.input + d.output));
                            const height = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
                            return (
                              <div
                                key={day.date}
                                title={`${day.date}: ${formatTokenCount(total)} tokens`}
                                style={{
                                  flex: 1,
                                  minWidth: 4,
                                  maxWidth: 24,
                                  height: `${Math.max(height, 4)}%`,
                                  background: "var(--coral)",
                                  borderRadius: "3px 3px 0 0",
                                  opacity: 0.8,
                                  cursor: "default",
                                }}
                              />
                            );
                          })}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                          <span style={{ fontSize: 10, color: "var(--muted)" }}>{usageData.daily[0]?.date}</span>
                          <span style={{ fontSize: 10, color: "var(--muted)" }}>{usageData.daily[usageData.daily.length - 1]?.date}</span>
                        </div>
                      </div>
                    )}

                    {/* Input vs Output breakdown */}
                    <div className="card" style={{ padding: 24 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)", marginBottom: 16 }}>
                        Token split
                      </div>
                      <div style={{ display: "flex", gap: 16 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 4, textTransform: "uppercase" }}>Input</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)" }}>{formatTokenCount(usageData.totalInput)}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>
                            {usageData.totalTokens > 0 ? Math.round((usageData.totalInput / usageData.totalTokens) * 100) : 0}% of total
                          </div>
                        </div>
                        <div style={{ width: 1, background: "var(--line)" }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 4, textTransform: "uppercase" }}>Output</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)" }}>{formatTokenCount(usageData.totalOutput)}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>
                            {usageData.totalTokens > 0 ? Math.round((usageData.totalOutput / usageData.totalTokens) * 100) : 0}% of total
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeNav === "subscription" && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Subscription</div>

                {subLoading ? (
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>Loading...</div>
                ) : !subscription?.active ? (
                  <>
                    <div style={{ display: "inline-block", background: "#fef2f2", color: "#dc2626", padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 800, marginBottom: 12 }}>
                      No Active Plan
                    </div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
                      Your subscription has expired. Resubscribe to access your training data and AI coach.
                    </div>
                    <button
                      type="button"
                      onClick={handleResubscribe}
                      style={{
                        padding: "10px 20px",
                        borderRadius: 10,
                        border: "none",
                        background: "var(--coral)",
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Resubscribe — $11.99/mo
                    </button>
                  </>
                ) : subscription.status === "trialing" ? (
                  <>
                    <div style={{ display: "inline-block", background: "var(--sky-soft)", color: "var(--sky-deep, #2563eb)", padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 800, marginBottom: 12 }}>
                      Free Trial
                    </div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
                      Your free trial ends on {subscription.trialEnd ? new Date(subscription.trialEnd).toLocaleDateString() : "—"}. Your card will be charged $11.99/mo after.
                    </div>
                    <button
                      type="button"
                      onClick={handleManageSubscription}
                      style={{
                        padding: "10px 20px",
                        borderRadius: 10,
                        border: "1px solid var(--line)",
                        background: "transparent",
                        color: "var(--ink)",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Cancel Trial
                    </button>
                  </>
                ) : subscription.cancelAtPeriodEnd ? (
                  <>
                    <div style={{ display: "inline-block", background: "#fefce8", color: "#a16207", padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 800, marginBottom: 12 }}>
                      Pro Plan — Cancelling
                    </div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
                      Your access continues until {subscription.periodEnd ? new Date(subscription.periodEnd).toLocaleDateString() : "—"}. After that, your subscription will end.
                    </div>
                    <button
                      type="button"
                      onClick={handleManageSubscription}
                      style={{
                        padding: "10px 20px",
                        borderRadius: 10,
                        border: "none",
                        background: "var(--coral)",
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Resume Subscription
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ display: "inline-block", background: "var(--mint-soft)", color: "var(--mint-deep)", padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 800, marginBottom: 12 }}>
                      Pro Plan
                    </div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
                      $11.99/mo — Next billing date: {subscription.periodEnd ? new Date(subscription.periodEnd).toLocaleDateString() : "—"}
                    </div>
                    <button
                      type="button"
                      onClick={handleManageSubscription}
                      style={{
                        padding: "10px 20px",
                        borderRadius: 10,
                        border: "1px solid var(--line)",
                        background: "transparent",
                        color: "var(--ink)",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Manage Subscription
                    </button>
                  </>
                )}
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
