"use client";

import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Bar, Cell,
} from "recharts";

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
  if (filtered.length < 3) return <div style={{ color: "#9ca3af", fontSize: 11, padding: 8 }}>No {label} data</div>;

  const current = filtered[filtered.length - 1][dataKey] as number;
  const h = compact ? 80 : 220;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: compact ? 10 : 12, fontWeight: 700, color: "#6b7280" }}>{label}</span>
        <span style={{ fontSize: compact ? 11 : 14, fontWeight: 800, color }}>{current}{unit}</span>
      </div>
      <ResponsiveContainer width="100%" height={h}>
        <AreaChart data={filtered} margin={{ top: 2, right: 2, bottom: 2, left: compact ? -20 : 0 }}>
          {!compact && <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />}
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: compact ? 0 : 10, fill: "#9ca3af" }}
            interval={compact ? 999 : Math.floor(filtered.length / 5)}
            axisLine={false}
            tickLine={false}
          />
          {!compact && (
            <YAxis
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              domain={domain || ["auto", "auto"]}
            />
          )}
          {!compact && (
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
              labelFormatter={formatDate}
              formatter={(val: number) => [`${val}${unit}`, label]}
            />
          )}
          <defs>
            <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            dataKey={dataKey}
            stroke={color}
            strokeWidth={compact ? 1.5 : 2}
            fill={`url(#grad-${dataKey})`}
            dot={false}
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

const ZONE_COLORS = ["#93c5fd", "#86efac", "#fde047", "#fb923c", "#f87171"];
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
  const h = compact ? 80 : 240;
  const totalMins = zones.reduce((s, z) => s + z.minutes, 0);

  if (totalMins === 0) return <div style={{ color: "#9ca3af", fontSize: 11, padding: 8 }}>No HR zone data</div>;

  return (
    <div>
      {!compact && (
        <div style={{ marginBottom: 12 }}>
          {/* Zone table */}
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "#9ca3af", fontWeight: 600, borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "4px 0" }}>Zone</td>
                <td>HR Range</td>
                <td style={{ textAlign: "right" }}>Time</td>
                <td style={{ textAlign: "right" }}>%</td>
                <td style={{ width: 100 }}></td>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.zone} style={{ borderBottom: "1px solid #f9fafb" }}>
                  <td style={{ padding: "4px 0", fontWeight: 700, color: "#374151" }}>{z.zone}</td>
                  <td style={{ color: "#6b7280" }}>{z.range}</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{fmtZoneTime(z.minutes)}</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{z.percent}%</td>
                  <td>
                    <div style={{ height: 8, borderRadius: 4, background: "#f3f4f6", overflow: "hidden" }}>
                      <div style={{ width: `${z.percent}%`, height: "100%", background: z.color, borderRadius: 4 }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ResponsiveContainer width="100%" height={h}>
        <BarChart data={zones} margin={{ top: 5, right: 5, bottom: 5, left: compact ? -20 : 0 }}>
          {!compact && <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />}
          <XAxis dataKey="zone" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
          {!compact && (
            <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          )}
          {!compact && (
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
              formatter={(val: number, _name: string, entry: { payload: HrZoneData }) => [`${val} min (${entry.payload.percent}%)`, entry.payload.label]}
            />
          )}
          <Bar dataKey="minutes" radius={[4, 4, 0, 0]}>
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
  if (data.length === 0) return <div style={{ color: "#9ca3af", fontSize: 11, padding: 8 }}>No training data</div>;

  // Aggregate by week
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

  const h = compact ? 80 : 200;

  return (
    <div>
      {!compact && (
        <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 4 }}>Weekly Training Load</div>
      )}
      <ResponsiveContainer width="100%" height={h}>
        <BarChart data={weekData} margin={{ top: 5, right: 5, bottom: 5, left: compact ? -20 : 0 }}>
          {!compact && <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />}
          <XAxis
            dataKey="week"
            tickFormatter={(w: string) => new Date(w + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            tick={{ fontSize: compact ? 0 : 10, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
          />
          {!compact && <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />}
          {!compact && (
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
              formatter={(val: number) => [`${val}`, "Load"]}
              labelFormatter={(w: string) => `Week of ${new Date(w + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
            />
          )}
          <Bar dataKey="load" fill="#6366f1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
