"use client";

import { useEffect, useState } from "react";
import { BrandMark } from "@/components/app/brand-mark";

interface IntegrationStatus {
  provider: string;
  connected: boolean;
  status: string;
  lastSyncedAt: string | null;
  connectedAt: string | null;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function SyncStatus() {
  const [integrations, setIntegrations] = useState<IntegrationStatus[] | null>(null);

  useEffect(() => {
    fetch("/api/integrations/status")
      .then((r) => r.json())
      .then((d) => {
        if (d.integrations) setIntegrations(d.integrations);
      })
      .catch(() => {});
  }, []);

  const connected = integrations ? integrations.filter((i) => i.connected) : [];
  const allSynced = connected.length > 0 && connected.every((i) => i.status === "active");
  const lastSync = connected.reduce<string | null>((latest, i) => {
    if (!i.lastSyncedAt) return latest;
    if (!latest) return i.lastSyncedAt;
    return i.lastSyncedAt > latest ? i.lastSyncedAt : latest;
  }, null);

  const statusText = integrations === null
    ? "Checking…"
    : connected.length === 0
    ? "No integrations"
    : allSynced
    ? "All synced"
    : "Syncing…";

  const dotColor = allSynced ? "var(--mint-deep)" : "var(--lemon-deep)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 18px",
        background: "rgba(255,255,255,0.6)",
        border: "1px solid var(--line)",
        borderRadius: 18,
        marginBottom: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: dotColor,
            boxShadow: `0 0 0 3px rgba(126,190,124,0.3)`,
            animation: "pulse-dot 2.4s infinite",
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 700 }}>{statusText}</span>
      </div>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>·</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
        {(["macrofactor", "hevy", "strava", "garmin", "gcal"] as const).map((n) => {
          const integration = integrations?.find((i) => i.provider === n);
          const dimmed = integration != null && !integration.connected;
          return (
            <div key={n} style={dimmed ? { opacity: 0.35 } : undefined}>
              <BrandMark name={n} size={22} />
            </div>
          );
        })}
        <span
          style={{
            fontSize: 12,
            color: "var(--muted)",
            fontWeight: 600,
            marginLeft: 6,
          }}
        >
          {lastSync ? `Last sync ${timeAgo(lastSync)}` : connected.length > 0 ? "Syncing…" : ""}
        </span>
      </div>
      <button className="btn-ghost" style={{ padding: "6px 12px", fontSize: 12 }}>
        Manage
      </button>
    </div>
  );
}
