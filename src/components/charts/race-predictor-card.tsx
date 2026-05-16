"use client";

import { fmtRaceTime, type RacePrediction } from "@/lib/training/predictions";
import { chartColors } from "./chart-theme";

interface RacePredictorChartProps {
  predictions: RacePrediction[];
  compact?: boolean;
}

function formatBasis(p: RacePrediction): string {
  const km = p.basis.distanceKm;
  const dist = km >= 10 ? `${km.toFixed(1)}km` : `${km.toFixed(2)}km`;
  const date = new Date(p.basis.date + "T00:00:00");
  const today = new Date();
  const daysAgo = Math.floor((today.getTime() - date.getTime()) / 86400000);
  const dateLabel =
    daysAgo <= 0 ? "today" :
    daysAgo === 1 ? "yesterday" :
    daysAgo < 14 ? `${daysAgo}d ago` :
    daysAgo < 60 ? `${Math.floor(daysAgo / 7)}w ago` :
    `${Math.floor(daysAgo / 30)}mo ago`;
  return `from ${dist}, ${dateLabel}`;
}

export function RacePredictorChart({ predictions, compact = false }: RacePredictorChartProps) {
  if (predictions.length === 0) {
    return (
      <div style={{ color: chartColors.textFaint, fontSize: 12, padding: 20 }}>
        No recent runs to predict from yet.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 6 : 10 }}>
      {predictions.map((p) => (
        <div
          key={p.label}
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            padding: compact ? "6px 8px" : "10px 12px",
            background: "#f9fafb",
            borderRadius: 8,
            gap: 8,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span style={{ fontSize: compact ? 11 : 12, fontWeight: 700, color: chartColors.textPrimary }}>{p.label}</span>
            <span style={{ fontSize: compact ? 9 : 10, color: chartColors.textFaint, fontWeight: 500 }}>
              {formatBasis(p)}
            </span>
          </div>
          <span
            className="mono"
            style={{
              fontSize: compact ? 14 : 18,
              fontWeight: 800,
              color: chartColors.textPrimary,
              letterSpacing: "-0.02em",
              flexShrink: 0,
            }}
          >
            {fmtRaceTime(p.predictedSec)}
          </span>
        </div>
      ))}
    </div>
  );
}
