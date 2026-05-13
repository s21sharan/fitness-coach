import type { CSSProperties } from "react";

export const chartColors = {
  fitness: "#3b82f6",
  fatigue: "#f97316",
  formPositive: "#22c55e",
  formNegative: "#ef4444",
  hrv: "#8b5cf6",
  sleep: "#3b82f6",
  rhr: "#ef4444",
  bodyBattery: "#22c55e",
  stress: "#f97316",
  load: "#6366f1",
  zones: ["#93c5fd", "#86efac", "#fde047", "#fb923c", "#f87171"] as const,
  axis: "#9ca3af",
  grid: "#eef0f3",
  gridStrong: "#e5e7eb",
  surface: "#ffffff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textMuted: "#6b7280",
  textFaint: "#9ca3af",
};

export const tooltipStyle: CSSProperties = {
  fontSize: 11,
  borderRadius: 10,
  border: `1px solid ${chartColors.border}`,
  background: "rgba(255,255,255,0.96)",
  backdropFilter: "blur(6px)",
  boxShadow: "0 8px 24px rgba(15, 27, 34, 0.08)",
  padding: "8px 10px",
};

export const tooltipItemStyle: CSSProperties = {
  fontWeight: 600,
  color: chartColors.textPrimary,
};

export const tooltipLabelStyle: CSSProperties = {
  fontSize: 10,
  color: chartColors.textFaint,
  fontWeight: 600,
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

export const gridProps = {
  stroke: chartColors.grid,
  strokeDasharray: "3 4",
  vertical: false,
} as const;

export const axisProps = {
  axisLine: false,
  tickLine: false,
  tick: { fontSize: 10, fill: chartColors.textFaint, fontWeight: 600 } as const,
};
