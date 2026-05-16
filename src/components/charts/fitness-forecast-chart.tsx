"use client";

import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import type { FitnessForecast } from "@/lib/training/predictions";
import { chartColors, tooltipStyle, tooltipItemStyle, tooltipLabelStyle, gridProps, axisProps } from "./chart-theme";

interface FitnessForecastChartProps {
  forecast: FitnessForecast;
  historyWindowDays?: number;
  compact?: boolean;
}

function formatDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface Row {
  date: string;
  ctl_hist: number | null;
  atl_hist: number | null;
  tsb_hist: number | null;
  ctl_proj: number | null;
  atl_proj: number | null;
  tsb_proj: number | null;
}

export function FitnessForecastChart({ forecast, historyWindowDays = 42, compact = false }: FitnessForecastChartProps) {
  if (forecast.history.length === 0 && forecast.forecast.length === 0) {
    return (
      <div style={{ color: chartColors.textFaint, fontSize: 12, padding: 20 }}>
        Not enough training data yet.
      </div>
    );
  }

  const recentHistory = forecast.history.slice(-historyWindowDays);
  const lastHist = recentHistory[recentHistory.length - 1];

  const rows: Row[] = [
    ...recentHistory.map((p) => ({
      date: p.date,
      ctl_hist: p.ctl, atl_hist: p.atl, tsb_hist: p.tsb,
      ctl_proj: null, atl_proj: null, tsb_proj: null,
    })),
    ...forecast.forecast.map((p, i) => ({
      date: p.date,
      // Anchor projection at last observed point so the dashed line connects.
      ctl_hist: null, atl_hist: null, tsb_hist: null,
      ctl_proj: i === 0 && lastHist ? lastHist.ctl : p.ctl,
      atl_proj: i === 0 && lastHist ? lastHist.atl : p.atl,
      tsb_proj: i === 0 && lastHist ? lastHist.tsb : p.tsb,
    })),
  ];

  // Inject the last history point as projection-anchor (first row of projection slot)
  if (lastHist && forecast.forecast.length > 0) {
    const anchor = rows.find((r) => r.date === lastHist.date);
    if (anchor) {
      anchor.ctl_proj = lastHist.ctl;
      anchor.atl_proj = lastHist.atl;
      anchor.tsb_proj = lastHist.tsb;
    }
  }

  const h = compact ? 140 : 320;

  return (
    <div>
      {!compact && (
        <div style={{ fontSize: 12, color: chartColors.textMuted, marginBottom: 10, lineHeight: 1.5 }}>
          {forecast.notice}
        </div>
      )}
      <ResponsiveContainer width="100%" height={h}>
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 4, left: compact ? -24 : 0 }}>
          <defs>
            <linearGradient id="grad-ctl-fcst" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartColors.fitness} stopOpacity={0.18} />
              <stop offset="100%" stopColor={chartColors.fitness} stopOpacity={0} />
            </linearGradient>
          </defs>
          {!compact && <CartesianGrid {...gridProps} />}
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={compact ? false : axisProps.tick}
            interval={compact ? 999 : Math.floor(rows.length / 6)}
            axisLine={false}
            tickLine={false}
          />
          {!compact && <YAxis {...axisProps} />}
          {!compact && (
            <Tooltip
              contentStyle={tooltipStyle}
              itemStyle={tooltipItemStyle}
              labelStyle={tooltipLabelStyle}
              labelFormatter={formatDate}
              cursor={{ stroke: chartColors.gridStrong, strokeWidth: 1 }}
            />
          )}
          <ReferenceLine y={0} stroke={chartColors.gridStrong} strokeDasharray="3 4" />
          {lastHist && (
            <ReferenceLine
              x={lastHist.date}
              stroke={chartColors.gridStrong}
              strokeDasharray="3 4"
              label={!compact ? { value: "today", position: "top", fontSize: 10, fill: chartColors.textFaint } : undefined}
            />
          )}
          <Area dataKey="ctl_hist" fill="url(#grad-ctl-fcst)" stroke="none" isAnimationActive={false} />
          <Line dataKey="ctl_hist" stroke={chartColors.fitness} strokeWidth={compact ? 2 : 2.4} dot={false} name="Fitness" connectNulls isAnimationActive={false} />
          <Line dataKey="atl_hist" stroke={chartColors.fatigue} strokeWidth={compact ? 1.6 : 2} dot={false} name="Fatigue" connectNulls isAnimationActive={false} />
          <Line dataKey="tsb_hist" stroke={chartColors.formPositive} strokeWidth={compact ? 1.3 : 1.6} dot={false} name="Form" connectNulls isAnimationActive={false} />
          <Line dataKey="ctl_proj" stroke={chartColors.fitness} strokeDasharray="4 3" strokeWidth={compact ? 1.8 : 2.2} dot={false} legendType="none" connectNulls isAnimationActive={false} />
          <Line dataKey="atl_proj" stroke={chartColors.fatigue} strokeDasharray="4 3" strokeWidth={compact ? 1.4 : 1.8} dot={false} legendType="none" connectNulls isAnimationActive={false} />
          <Line dataKey="tsb_proj" stroke={chartColors.formPositive} strokeDasharray="4 3" strokeWidth={compact ? 1.2 : 1.4} dot={false} legendType="none" connectNulls isAnimationActive={false} />
          {!compact && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
