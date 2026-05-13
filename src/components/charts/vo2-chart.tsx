"use client";

import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";
import { chartColors, tooltipStyle, tooltipItemStyle, tooltipLabelStyle, gridProps, axisProps } from "./chart-theme";
import type { Vo2Point } from "@/lib/training/calendar-data";

interface Props {
  data: Vo2Point[];
  compact?: boolean;
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function latest(data: Vo2Point[], key: "run" | "bike"): number | null {
  for (let i = data.length - 1; i >= 0; i--) {
    const v = data[i][key];
    if (v != null) return v;
  }
  return null;
}

function first(data: Vo2Point[], key: "run" | "bike"): number | null {
  for (let i = 0; i < data.length; i++) {
    const v = data[i][key];
    if (v != null) return v;
  }
  return null;
}

export function Vo2Chart({ data, compact = false }: Props) {
  const hasRun = data.some((p) => p.run != null);
  const hasBike = data.some((p) => p.bike != null);

  if (!hasRun && !hasBike) {
    return <div style={{ color: chartColors.textFaint, fontSize: 11, padding: 8 }}>No VO2 max data yet — sync Garmin activities to populate.</div>;
  }

  const h = compact ? 96 : 240;
  const runColor = chartColors.byType.run;
  const bikeColor = chartColors.byType.bike;

  const runCurrent = latest(data, "run");
  const bikeCurrent = latest(data, "bike");
  const runDelta = runCurrent != null && first(data, "run") != null ? runCurrent - (first(data, "run") as number) : 0;
  const bikeDelta = bikeCurrent != null && first(data, "bike") != null ? bikeCurrent - (first(data, "bike") as number) : 0;

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: compact ? 10 : 12, fontWeight: 700, color: chartColors.textMuted, letterSpacing: "0.02em" }}>VO2 MAX</span>
        <div style={{ display: "inline-flex", gap: 12 }}>
          {hasRun && runCurrent != null && (
            <SportValue label="Run" color={runColor} value={runCurrent} delta={runDelta} compact={compact} />
          )}
          {hasBike && bikeCurrent != null && (
            <SportValue label="Bike" color={bikeColor} value={bikeCurrent} delta={bikeDelta} compact={compact} />
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={h}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 2, left: compact ? -24 : 0 }}>
          <defs>
            <linearGradient id="grad-vo2-run" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={runColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={runColor} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="grad-vo2-bike" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={bikeColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={bikeColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          {!compact && <CartesianGrid {...gridProps} />}
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={compact ? false : axisProps.tick}
            interval={compact ? 999 : Math.max(1, Math.floor(data.length / 5))}
            axisLine={false}
            tickLine={false}
          />
          {!compact && <YAxis {...axisProps} domain={["auto", "auto"]} />}
          {!compact && (
            <Tooltip
              contentStyle={tooltipStyle}
              itemStyle={tooltipItemStyle}
              labelStyle={tooltipLabelStyle}
              labelFormatter={formatDate}
              cursor={{ stroke: chartColors.gridStrong, strokeWidth: 1 }}
            />
          )}
          {hasRun && (
            <Area
              dataKey="run"
              name="Run"
              stroke={runColor}
              strokeWidth={compact ? 2 : 2.5}
              fill="url(#grad-vo2-run)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff", fill: runColor }}
              connectNulls
            />
          )}
          {hasBike && (
            <Area
              dataKey="bike"
              name="Bike"
              stroke={bikeColor}
              strokeWidth={compact ? 2 : 2.5}
              fill="url(#grad-vo2-bike)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff", fill: bikeColor }}
              connectNulls
            />
          )}
          {!compact && hasRun && hasBike && (
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function SportValue({ label, color, value, delta, compact }: { label: string; color: string; value: number; delta: number; compact: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: chartColors.textFaint, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
      <span style={{ fontSize: compact ? 16 : 20, fontWeight: 800, color, letterSpacing: "-0.02em" }}>{Math.round(value * 10) / 10}</span>
      {Math.abs(delta) >= 0.1 && (
        <span style={{ fontSize: 10, fontWeight: 700, color: delta > 0 ? chartColors.formPositive : chartColors.formNegative }}>
          {delta > 0 ? "▲" : "▼"} {Math.abs(Math.round(delta * 10) / 10)}
        </span>
      )}
    </span>
  );
}
