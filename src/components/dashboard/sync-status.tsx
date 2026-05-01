"use client";

import { BrandMark } from "@/components/app/brand-mark";

export function SyncStatus() {
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
            background: "var(--mint-deep)",
            boxShadow: "0 0 0 3px rgba(126,190,124,0.3)",
            animation: "pulse-dot 2.4s infinite",
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 700 }}>All synced</span>
      </div>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>·</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
        {(["macrofactor", "hevy", "strava", "garmin", "gcal"] as const).map((n) => (
          <BrandMark key={n} name={n} size={22} />
        ))}
        <span
          style={{
            fontSize: 12,
            color: "var(--muted)",
            fontWeight: 600,
            marginLeft: 6,
          }}
        >
          Last sync 2 min ago
        </span>
      </div>
      <button className="btn-ghost" style={{ padding: "6px 12px", fontSize: 12 }}>
        Manage
      </button>
    </div>
  );
}
