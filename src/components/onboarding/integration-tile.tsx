"use client";

import { BrandMark } from "@/components/app/brand-mark";

export type IntegrationState = "live" | "placeholder" | "connected";

interface IntegrationTileProps {
  provider: string;     // matches BrandMark name
  name: string;
  category: string;
  state: IntegrationState;
  onConnect?: () => void;
}

export function IntegrationTile({
  provider,
  name,
  category,
  state,
  onConnect,
}: IntegrationTileProps) {
  const isConnected = state === "connected";
  const isPlaceholder = state === "placeholder";

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "var(--r-lg)",
        border: isConnected ? "2px solid var(--mint-deep)" : "1px solid var(--line)",
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        position: "relative",
        opacity: isPlaceholder ? 0.7 : 1,
      }}
    >
      {isConnected && (
        <span
          style={{
            position: "absolute",
            top: 10,
            right: 10,
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

      <BrandMark name={provider} size={36} />

      <div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>
          {name}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>
          {category}
        </p>
      </div>

      {!isConnected && (
        <button
          type="button"
          onClick={!isPlaceholder ? onConnect : undefined}
          disabled={isPlaceholder}
          style={{
            marginTop: "auto",
            padding: "7px 14px",
            borderRadius: 999,
            border: "1.5px solid var(--line)",
            background: "transparent",
            fontSize: 12,
            fontWeight: 700,
            color: isPlaceholder ? "var(--muted)" : "var(--ink)",
            cursor: isPlaceholder ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            alignSelf: "flex-start",
          }}
        >
          {isPlaceholder ? "Coming soon" : "Connect"}
        </button>
      )}
    </div>
  );
}
