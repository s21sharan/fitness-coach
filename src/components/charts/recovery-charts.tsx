"use client";

import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Bar, Cell,
} from "recharts";
import { chartColors, tooltipStyle, tooltipItemStyle, tooltipLabelStyle, gridProps, axisProps } from "./chart-theme";

export interface RecoveryPoint {
  date: string;
  hrv: number | null;
  sleep_hours: number | null;
  resting_hr: number | null;
  body_battery: number | null;
  stress_level: number | null;
  steps: number | null;
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ─── Generic trend line ─── */

interface TrendChartProps {
  data: RecoveryPoint[];
  dataKey: keyof RecoveryPoint;
  color: string;
  label: string;
  unit: string;
  compact?: boolean;
  domain?: [number, number];
}

export function RecoveryTrendChart({ data, dataKey, color, label, unit, compact = false, domain }: TrendChartProps) {
  const filtered = data.filter((d) => d[dataKey] != null);
  if (filtered.length < 3) return <div style={{ color: chartColors.textFaint, fontSize: 11, padding: 8 }}>No {label} data</div>;

  const current = filtered[filtered.length - 1][dataKey] as number;
  const previous = filtered.length > 1 ? (filtered[filtered.length - 2][dataKey] as number) : current;
  const delta = current - previous;
  const h = compact ? 96 : 240;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: compact ? 10 : 12, fontWeight: 700, color: chartColors.textMuted, letterSpacing: "0.02em" }}>{label}</span>
        <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: compact ? 16 : 20, fontWeight: 800, color, letterSpacing: "-0.02em" }}>{current}{unit}</span>
          {delta !== 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, color: delta > 0 ? chartColors.formPositive : chartColors.formNegative }}>
              {delta > 0 ? "▲" : "▼"} {Math.abs(Math.round(delta * 10) / 10)}
            </span>
          )}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={h}>
        <AreaChart data={filtered} margin={{ top: 4, right: 4, bottom: 2, left: compact ? -24 : 0 }}>
          <defs>
            <linearGradient id={`grad-${String(dataKey)}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {!compact && <CartesianGrid {...gridProps} />}
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={compact ? false : axisProps.tick}
            interval={compact ? 999 : Math.floor(filtered.length / 5)}
            axisLine={false}
            tickLine={false}
          />
          {!compact && (
            <YAxis
              {...axisProps}
              domain={domain || ["auto", "auto"]}
            />
          )}
          {!compact && (
            <Tooltip
              contentStyle={tooltipStyle}
              itemStyle={tooltipItemStyle}
              labelStyle={tooltipLabelStyle}
              labelFormatter={formatDate}
              formatter={(val: number) => [`${val}${unit}`, label]}
              cursor={{ stroke: chartColors.gridStrong, strokeWidth: 1 }}
            />
          )}
          <Area
            dataKey={dataKey}
            stroke={color}
            strokeWidth={compact ? 2 : 2.5}
            fill={`url(#grad-${String(dataKey)})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff", fill: color }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─── HR Zone Distribution ─── */

export interface HrZoneData {
  zone: string;
  label: string;
  range: string;
  minutes: number;
  percent: number;
  color: string;
}

const ZONE_COLORS = chartColors.zones;
const ZONE_LABELS = ["Z1 Recovery", "Z2 Aerobic", "Z3 Tempo", "Z4 Threshold", "Z5 Anaerobic"];
const ZONE_RANGES = ["< 120 bpm", "120-140", "140-155", "155-170", "170+"];

export function computeHrZones(cardio: { avg_hr: number | null; duration: number }[]): HrZoneData[] {
  const mins = [0, 0, 0, 0, 0];
  for (const c of cardio) {
    if (c.avg_hr && c.duration) {
      const m = c.duration / 60;
      const z = c.avg_hr < 120 ? 0 : c.avg_hr < 140 ? 1 : c.avg_hr < 155 ? 2 : c.avg_hr < 170 ? 3 : 4;
      mins[z] += m;
    }
  }
  const total = mins.reduce((a, b) => a + b, 0) || 1;
  return mins.map((m, i) => ({
    zone: `Z${i + 1}`,
    label: ZONE_LABELS[i],
    range: ZONE_RANGES[i],
    minutes: Math.round(m),
    percent: Math.round(m / total * 100),
    color: ZONE_COLORS[i],
  }));
}

export function HrZoneChart({ zones, compact = false }: { zones: HrZoneData[]; compact?: boolean }) {
  const h = compact ? 96 : 260;
  const totalMins = zones.reduce((s, z) => s + z.minutes, 0);

  if (totalMins === 0) return <div style={{ color: chartColors.textFaint, fontSize: 11, padding: 8 }}>No HR zone data</div>;

  return (
    <div>
      {!compact && (
        <div style={{ marginBottom: 14 }}>
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: chartColors.textFaint, fontWeight: 700, borderBottom: `1px solid ${chartColors.grid}`, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 9 }}>
                <td style={{ padding: "6px 0" }}>Zone</td>
                <td>HR Range</td>
                <td style={{ textAlign: "right" }}>Time</td>
                <td style={{ textAlign: "right" }}>%</td>
                <td style={{ width: 120 }}></td>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.zone} style={{ borderBottom: `1px solid ${chartColors.grid}` }}>
                  <td style={{ padding: "6px 0", fontWeight: 700, color: chartColors.textPrimary, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: z.color }} />
                    {z.zone}
                  </td>
                  <td style={{ color: chartColors.textMuted }}>{z.range}</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{fmtZoneTime(z.minutes)}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: chartColors.textPrimary }}>{z.percent}%</td>
                  <td>
                    <div style={{ height: 8, borderRadius: 999, background: chartColors.grid, overflow: "hidden" }}>
                      <div style={{ width: `${z.percent}%`, height: "100%", background: z.color, borderRadius: 999 }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ResponsiveContainer width="100%" height={h}>
        <BarChart data={zones} margin={{ top: 6, right: 6, bottom: 4, left: compact ? -24 : 0 }} barCategoryGap="22%">
          {!compact && <CartesianGrid {...gridProps} />}
          <XAxis dataKey="zone" tick={{ fontSize: 10, fill: chartColors.textMuted, fontWeight: 700 }} axisLine={false} tickLine={false} />
          {!compact && (
            <YAxis {...axisProps} />
          )}
          {!compact && (
            <Tooltip
              contentStyle={tooltipStyle}
              itemStyle={tooltipItemStyle}
              labelStyle={tooltipLabelStyle}
              cursor={{ fill: chartColors.grid, opacity: 0.4 }}
              formatter={(val: number, _name: string, entry: { payload: HrZoneData }) => [`${val} min (${entry.payload.percent}%)`, entry.payload.label]}
            />
          )}
          <Bar dataKey="minutes" radius={[6, 6, 0, 0]}>
            {zones.map((z, i) => <Cell key={i} fill={z.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function fmtZoneTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}m` : `${m}m`;
}

/* ─── Training Load Bar Chart ─── */

export interface LoadPoint {
  date: string;
  load: number;
  type: string;
}

export function TrainingLoadChart({ data, compact = false }: { data: LoadPoint[]; compact?: boolean }) {
  if (data.length === 0) return <div style={{ color: chartColors.textFaint, fontSize: 11, padding: 8 }}>No training data</div>;

  const weekMap = new Map<string, number>();
  for (const d of data) {
    const date = new Date(d.date + "T00:00:00");
    const day = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
    const weekKey = monday.toISOString().slice(0, 10);
    weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + d.load);
  }

  const weekData = Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([week, load]) => ({ week, load }));

  const h = compact ? 112 : 220;

  // In compact mode, show every 3rd date label to avoid crowding
  const compactTickIndices = new Set<number>();
  if (compact && weekData.length > 0) {
    compactTickIndices.add(0);
    compactTickIndices.add(Math.floor(weekData.length / 2));
    compactTickIndices.add(weekData.length - 1);
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={h}>
        <BarChart data={weekData} margin={{ top: 6, right: compact ? 4 : 6, bottom: compact ? 2 : 4, left: compact ? 4 : 0 }} barCategoryGap="22%">
          <defs>
            <linearGradient id="grad-load" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartColors.load} stopOpacity={1} />
              <stop offset="100%" stopColor={chartColors.load} stopOpacity={0.55} />
            </linearGradient>
          </defs>
          {!compact && <CartesianGrid {...gridProps} />}
          <XAxis
            dataKey="week"
            tickFormatter={(w: string, i: number) => {
              if (compact && !compactTickIndices.has(i)) return "";
              const d = new Date(w + "T00:00:00");
              return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            }}
            tick={{ fontSize: compact ? 9 : 10, fill: chartColors.textFaint, fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
            interval={0}
            padding={{ left: compact ? 8 : 0, right: compact ? 8 : 0 }}
          />
          {!compact && <YAxis {...axisProps} />}
          {!compact && (
            <Tooltip
              contentStyle={tooltipStyle}
              itemStyle={tooltipItemStyle}
              labelStyle={tooltipLabelStyle}
              cursor={{ fill: chartColors.grid, opacity: 0.4 }}
              formatter={(val: number) => [`${val}`, "Load"]}
              labelFormatter={(w: string) => `Week of ${new Date(w + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
            />
          )}
          <Bar dataKey="load" fill="url(#grad-load)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
