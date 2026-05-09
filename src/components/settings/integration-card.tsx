"use client";

import { BrandMark } from "@/components/app/brand-mark";

interface IntegrationCardProps {
  provider: string;
  name: string;
  category: string;
  connected: boolean;
  lastSyncedAt: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onSync?: () => void;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function IntegrationCard({
  provider,
  name,
  category,
  connected,
  lastSyncedAt,
  onConnect,
  onDisconnect,
  onSync,
}: IntegrationCardProps) {
  return (
    <div className="card" style={{ padding: 18, display: "flex", flexDirection: "row", alignItems: "center", gap: 16 }}>
      {/* Brand mark */}
      <BrandMark name={provider} size={44} />

      {/* Middle info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>{name}</span>
          {connected && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: "var(--mint-soft)",
                borderRadius: 999,
                padding: "2px 8px",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--mint-deep)",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--mint-deep)",
                }}
              >
                Connected
              </span>
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
          {category}
          {connected && lastSyncedAt && (
            <span style={{ marginLeft: 6 }}>· Synced {formatTimeAgo(lastSyncedAt)}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {connected ? (
          <>
            {onSync && (
              <button type="button" className="btn-ghost" onClick={onSync}>
                Sync now
              </button>
            )}
            <button
              type="button"
              className="btn-ghost"
              onClick={onDisconnect}
              style={{ color: "var(--coral-deep)" }}
            >
              Disconnect
            </button>
          </>
        ) : (
          <button type="button" className="btn-coral" onClick={onConnect}>
            Connect
          </button>
        )}
      </div>
    </div>
  );
}
