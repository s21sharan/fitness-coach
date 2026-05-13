"use client";

export interface Integration {
  provider: string;
  status: string;
  last_synced_at: string | null;
}

interface ConnectionBarProps {
  integrations: Integration[];
  syncing: string | null;
  onSync: (provider: string) => void;
  fixingDates: boolean;
  onFixDates: () => void;
}

const PROVIDERS = [
  { key: "hevy", label: "Hevy", color: "#0F1B22" },
  { key: "strava", label: "Strava", color: "#FC4C02" },
  { key: "garmin", label: "Garmin", color: "#0091D5" },
];

export function ConnectionBar({ integrations, syncing, onSync, fixingDates, onFixDates }: ConnectionBarProps) {
  return (
    <div style={{
      display: "flex", gap: 14, padding: "10px 14px", marginBottom: 14,
      fontSize: 11, alignItems: "center",
      background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
      boxShadow: "0 1px 2px rgba(15, 27, 34, 0.03)",
    }}>
      {PROVIDERS.map((p) => {
        const int = integrations.find((i) => i.provider === p.key);
        const connected = !!int;
        const isSyncing = syncing === p.key;
        return (
          <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: connected ? p.color : "#d1d5db",
              boxShadow: connected ? `0 0 0 3px ${p.color}22` : "none",
              display: "inline-block",
            }} />
            <span style={{ fontWeight: 700, color: connected ? "#111827" : "#9ca3af" }}>{p.label}</span>
            {connected && int.last_synced_at && (
              <span style={{ color: "#9ca3af", fontSize: 10, fontWeight: 500 }}>
                {new Date(int.last_synced_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            )}
            {connected && (
              <button
                onClick={() => onSync(p.key)}
                disabled={isSyncing}
                style={{
                  background: isSyncing ? "#eef2ff" : "#f3f4f6",
                  border: "none", borderRadius: 6,
                  padding: "3px 9px", fontSize: 10, fontWeight: 700,
                  cursor: isSyncing ? "wait" : "pointer",
                  color: isSyncing ? "#4338ca" : "#374151",
                }}
              >
                {isSyncing ? "Syncing…" : "Sync"}
              </button>
            )}
          </div>
        );
      })}
      <button
        onClick={onFixDates}
        disabled={fixingDates}
        title="Re-sync all Hevy & Strava activities using your local timezone. Use this once if calendar dates are shifted."
        style={{
          marginLeft: "auto",
          background: "#fef3c7", border: "1px solid #fcd34d",
          borderRadius: 6, padding: "4px 11px",
          fontSize: 10, fontWeight: 700,
          cursor: fixingDates ? "wait" : "pointer",
          color: "#92400e",
        }}
      >
        {fixingDates ? "Fixing dates…" : "Fix calendar dates"}
      </button>
    </div>
  );
}
