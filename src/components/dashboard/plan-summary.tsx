"use client";

import Link from "next/link";
import { Icon } from "@/components/app/icon";

interface PlanSummaryProps {
  splitType?: string | null;
  weekNumber?: number | null;
  sessionsCompleted?: number;
  sessionsTotal?: number;
}

export function PlanSummary({
  splitType,
  weekNumber,
  sessionsCompleted = 0,
  sessionsTotal = 0,
}: PlanSummaryProps) {
  if (!splitType) return null;

  const pct = sessionsTotal > 0 ? Math.round((sessionsCompleted / sessionsTotal) * 100) : 0;

  return (
    <Link
      href="/dashboard/plan"
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <div
        className="card"
        style={{
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginBottom: 14,
          cursor: "pointer",
          transition: "box-shadow .15s",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: "var(--coral)",
            display: "grid",
            placeItems: "center",
            color: "var(--ink)",
            flexShrink: 0,
          }}
        >
          <Icon name="plan" size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: "-0.01em",
            }}
          >
            {splitType}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--muted)",
              fontWeight: 600,
            }}
          >
            {weekNumber != null ? `Week ${weekNumber}` : "Current plan"} · {sessionsCompleted}/{sessionsTotal} sessions this week
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 48,
              height: 6,
              borderRadius: 3,
              background: "var(--line)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: "100%",
                borderRadius: 3,
                background: "var(--mint-deep)",
                transition: "width .3s",
              }}
            />
          </div>
          <Icon name="chevron-right" size={14} />
        </div>
      </div>
    </Link>
  );
}
