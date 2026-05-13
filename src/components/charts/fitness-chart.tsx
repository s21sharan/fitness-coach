"use client";

import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Legend,
} from "recharts";
import { chartColors, tooltipStyle, tooltipItemStyle, tooltipLabelStyle, gridProps, axisProps } from "./chart-theme";

export interface FitnessPoint {
  date: string;
  load: number;
  ctl: number;
  atl: number;
  tsb: number;
}

interface FitnessChartProps {
  data: FitnessPoint[];
  compact?: boolean;
}

function formatDate(d: string) {
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function FitnessChart({ data, compact = false }: FitnessChartProps) {
  if (data.length < 7) return <div style={{ color: chartColors.textFaint, fontSize: 12, padding: 20 }}>Not enough data for fitness chart</div>;

  const display = compact ? data.slice(-42) : data;
  const lastP = display[display.length - 1];
  const h = compact ? 140 : 340;
  const formColor = lastP.tsb >= 0 ? chartColors.formPositive : chartColors.formNegative;

  return (
    <div>
      {!compact && (
        <div style={{ display: "flex", gap: 18, marginBottom: 12, fontSize: 12, fontWeight: 600 }}>
          <span style={{ color: chartColors.fitness, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: chartColors.fitness }} /> Fitness <b>{lastP.ctl}</b>
          </span>
          <span style={{ color: chartColors.fatigue, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: chartColors.fatigue }} /> Fatigue <b>{lastP.atl}</b>
          </span>
          <span style={{ color: formColor, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: formColor }} /> Form <b>{lastP.tsb}</b>
          </span>
        </div>
      )}
      <ResponsiveContainer width="100%" height={h}>
        <ComposedChart data={display} margin={{ top: 8, right: 8, bottom: 4, left: compact ? -24 : 0 }}>
          <defs>
            <linearGradient id="grad-ctl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartColors.fitness} stopOpacity={0.22} />
              <stop offset="100%" stopColor={chartColors.fitness} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="grad-tsb-pos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartColors.formPositive} stopOpacity={0.18} />
              <stop offset="100%" stopColor={chartColors.formPositive} stopOpacity={0} />
            </linearGradient>
          </defs>
          {!compact && <CartesianGrid {...gridProps} />}
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={compact ? false : axisProps.tick}
            interval={compact ? 999 : Math.floor(display.length / 6)}
            axisLine={false}
            tickLine={false}
          />
          {!compact && (
            <YAxis {...axisProps} />
          )}
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
          <Area dataKey="tsb" fill="url(#grad-tsb-pos)" stroke="none" />
          <Area dataKey="ctl" fill="url(#grad-ctl)" stroke="none" />
          <Line dataKey="ctl" stroke={chartColors.fitness} strokeWidth={compact ? 2 : 2.5} dot={false} name="Fitness" />
          <Line dataKey="atl" stroke={chartColors.fatigue} strokeWidth={compact ? 1.8 : 2} dot={false} name="Fatigue" />
          <Line dataKey="tsb" stroke={chartColors.formPositive} strokeWidth={compact ? 1.4 : 1.8} dot={false} strokeDasharray="4 3" name="Form" />
          {!compact && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
