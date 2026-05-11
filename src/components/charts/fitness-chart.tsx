"use client";

import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Legend,
} from "recharts";

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
  if (data.length < 7) return <div style={{ color: "#9ca3af", fontSize: 12, padding: 20 }}>Not enough data for fitness chart</div>;

  const display = compact ? data.slice(-42) : data;
  const lastP = display[display.length - 1];
  const h = compact ? 120 : 320;

  return (
    <div>
      {!compact && (
        <div style={{ display: "flex", gap: 16, marginBottom: 8, fontSize: 12, fontWeight: 600 }}>
          <span style={{ color: "#3b82f6" }}>Fitness (CTL) {lastP.ctl}</span>
          <span style={{ color: "#f97316" }}>Fatigue (ATL) {lastP.atl}</span>
          <span style={{ color: lastP.tsb >= 0 ? "#22c55e" : "#ef4444" }}>Form (TSB) {lastP.tsb}</span>
        </div>
      )}
      <ResponsiveContainer width="100%" height={h}>
        <ComposedChart data={display} margin={{ top: 5, right: 5, bottom: 5, left: compact ? -20 : 0 }}>
          {!compact && <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />}
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: compact ? 0 : 10, fill: "#9ca3af" }}
            interval={compact ? 999 : Math.floor(display.length / 6)}
            axisLine={false}
            tickLine={false}
          />
          {!compact && (
            <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          )}
          {!compact && (
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
              labelFormatter={formatDate}
            />
          )}
          <ReferenceLine y={0} stroke="#e5e7eb" strokeDasharray="3 3" />
          {/* TSB fill zones */}
          <Area dataKey="tsb" fill="#dcfce7" stroke="none" fillOpacity={0.5} />
          <Line dataKey="ctl" stroke="#3b82f6" strokeWidth={compact ? 1.5 : 2} dot={false} name="Fitness" />
          <Line dataKey="atl" stroke="#f97316" strokeWidth={compact ? 1.5 : 2} dot={false} name="Fatigue" />
          <Line dataKey="tsb" stroke="#22c55e" strokeWidth={compact ? 1 : 1.5} dot={false} strokeDasharray="4 2" name="Form" />
          {!compact && <Legend wrapperStyle={{ fontSize: 11 }} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
