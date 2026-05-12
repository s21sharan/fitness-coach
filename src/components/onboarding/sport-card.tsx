"use client";

import type { ReactNode } from "react";
import { SPORTS, type SportId } from "@/lib/onboarding/types";

interface SportCardProps {
  sport: SportId;
  active?: boolean;
  badge?: string;
  children?: ReactNode;
}

export function SportCard({ sport, active = true, badge, children }: SportCardProps) {
  const meta = SPORTS.find((s) => s.value === sport);

  return (
    <div
      style={{
        background: "#fff",
        border: active ? "2px solid var(--ink)" : "1px solid var(--line)",
        borderRadius: "var(--r-lg)",
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        opacity: active ? 1 : 0.6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 28 }}>{meta?.emoji ?? "🎯"}</span>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>
            {meta?.label ?? sport}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>
            {meta?.description ?? ""}
          </p>
        </div>
        {badge && (
          <span
            style={{
              padding: "3px 10px",
              borderRadius: 999,
              background: "var(--mint-soft)",
              fontSize: 11,
              fontWeight: 700,
              color: "var(--ink)",
            }}
          >
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
