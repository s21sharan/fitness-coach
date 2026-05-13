"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Split {
  km: number;
  distance_m: number | null;
  pace_min_km: number | null;
  avg_hr: number | null;
  elevation: number | null;
  cadence: number | null;
}

interface HrZone {
  zone: number;
  low: number;
  high: number;
  minutes: number;
}

interface ActivityData {
  activity_id: string;
  type: string;
  date: string;
  distance: number;
  duration: number;
  avg_hr: number | null;
  max_hr: number | null;
  pace_or_speed: number | null;
  calories: number | null;
  elevation: number | null;
  training_effect_aerobic: number | null;
  training_effect_anaerobic: number | null;
  vo2_max: number | null;
  recovery_time_min: number | null;
  avg_respiration: number | null;
  avg_cadence: number | null;
  avg_stride_length: number | null;
  ground_contact_time: number | null;
  hr_zones: HrZone[] | null;
  splits: Split[] | null;
  source: string | null;
}

interface ActivityDetailModalProps {
  open: boolean;
  onClose: () => void;
  activity: ActivityData | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ZONE_COLORS = ["#93c5fd", "#86efac", "#fde047", "#fb923c", "#f87171"];
const ZONE_NAMES = ["Recovery", "Aerobic", "Tempo", "Threshold", "Anaerobic"];

const ACTIVITY_ICONS: Record<string, string> = {
  run: "🏃",
  running: "🏃",
  ride: "🚴",
  cycling: "🚴",
  bike: "🚴",
  swim: "🏊",
  swimming: "🏊",
};

function getActivityIcon(type: string): string {
  return ACTIVITY_ICONS[type.toLowerCase()] ?? "⚡";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtSec(s: number): string {
  const totalSec = Math.round(s);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function fmtPace(p: number): string {
  const totalSec = Math.round(p * 60);
  const m = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function fmtZoneTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}m` : `${m}m`;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: "#6b7280",
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "32px 0",
        color: "#9ca3af",
        fontSize: 14,
      }}
    >
      {message}
    </div>
  );
}

// ─── Timeline Tab ─────────────────────────────────────────────────────────────

function TimelineTab({ splits }: { splits: Split[] | null }) {
  if (!splits || splits.length < 2) {
    return <EmptyState message="No split data available" />;
  }

  const hasCadence = splits.some((s) => s.cadence != null);
  const hasElevation = splits.some((s) => s.elevation != null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Pace Chart */}
      <div>
        <SectionLabel>Pace per km</SectionLabel>
        <ResponsiveContainer width="100%" height={160}>
          <ComposedChart data={splits} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="km"
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}km`}
            />
            <YAxis
              reversed
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => fmtPace(v)}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
              labelFormatter={(v: number) => `km ${v}`}
              formatter={(val: number) => [fmtPace(val) + "/km", "Pace"]}
            />
            <Line
              dataKey="pace_min_km"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* HR Chart */}
      <div>
        <SectionLabel>Heart Rate per km</SectionLabel>
        <ResponsiveContainer width="100%" height={140}>
          <ComposedChart data={splits} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="km"
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}km`}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
              labelFormatter={(v: number) => `km ${v}`}
              formatter={(val: number) => [`${val} bpm`, "HR"]}
            />
            <defs>
              <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              dataKey="avg_hr"
              stroke="#ef4444"
              strokeWidth={2}
              fill="url(#hrGrad)"
              dot={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Cadence Chart (only if data exists) */}
      {hasCadence && (
        <div>
          <SectionLabel>Cadence per km</SectionLabel>
          <ResponsiveContainer width="100%" height={120}>
            <ComposedChart data={splits} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="km"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v}km`}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
                labelFormatter={(v: number) => `km ${v}`}
                formatter={(val: number) => [`${val} spm`, "Cadence"]}
              />
              <Line
                dataKey="cadence"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Elevation Chart (only if data exists) */}
      {hasElevation && (
        <div>
          <SectionLabel>Elevation per km</SectionLabel>
          <ResponsiveContainer width="100%" height={120}>
            <ComposedChart data={splits} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="km"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v}km`}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
                labelFormatter={(v: number) => `km ${v}`}
                formatter={(val: number) => [`${val} m`, "Elevation"]}
              />
              <defs>
                <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                dataKey="elevation"
                stroke="#a78bfa"
                strokeWidth={2}
                fill="url(#elevGrad)"
                dot={false}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── HR Tab ───────────────────────────────────────────────────────────────────

function HrTab({ zones }: { zones: HrZone[] | null }) {
  if (!zones || zones.length === 0) {
    return <EmptyState message="No HR zone data" />;
  }

  const totalMins = zones.reduce((s, z) => s + z.minutes, 0) || 1;
  const zoneData = zones.map((z, i) => ({
    ...z,
    name: ZONE_NAMES[i] ?? `Zone ${z.zone}`,
    color: ZONE_COLORS[i] ?? "#9ca3af",
    percent: Math.round((z.minutes / totalMins) * 100),
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Zone table */}
      <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
        <thead>
          <tr
            style={{
              color: "#9ca3af",
              fontWeight: 600,
              borderBottom: "1px solid #f3f4f6",
            }}
          >
            <td style={{ padding: "5px 0" }}>Zone</td>
            <td>Name</td>
            <td>HR Range</td>
            <td style={{ textAlign: "right" }}>Time</td>
            <td style={{ textAlign: "right" }}>%</td>
            <td style={{ width: 100 }}></td>
          </tr>
        </thead>
        <tbody>
          {zoneData.map((z) => (
            <tr key={z.zone} style={{ borderBottom: "1px solid #f9fafb" }}>
              <td
                style={{
                  padding: "7px 0",
                  fontWeight: 700,
                  color: "#374151",
                }}
              >
                Z{z.zone}
              </td>
              <td style={{ color: "#374151", fontWeight: 600 }}>{z.name}</td>
              <td style={{ color: "#6b7280" }}>
                {z.low}–{z.high} bpm
              </td>
              <td style={{ textAlign: "right", fontWeight: 600 }}>
                {fmtZoneTime(z.minutes)}
              </td>
              <td style={{ textAlign: "right", fontWeight: 600 }}>
                {z.percent}%
              </td>
              <td style={{ paddingLeft: 8 }}>
                <div
                  style={{
                    height: 8,
                    borderRadius: 4,
                    background: "#f3f4f6",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${z.percent}%`,
                      height: "100%",
                      background: z.color,
                      borderRadius: 4,
                    }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Bar chart */}
      <ResponsiveContainer width="100%" height={180}>
        <BarChart
          data={zoneData}
          margin={{ top: 5, right: 5, bottom: 5, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis
            dataKey="zone"
            tickFormatter={(v: number) => `Z${v}`}
            tick={{ fontSize: 10, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}m`}
          />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
            formatter={(val: number, _name: string, entry: { payload: typeof zoneData[0] }) => [
              `${fmtZoneTime(val)} (${entry.payload.percent}%)`,
              entry.payload.name,
            ]}
            labelFormatter={(v: number) => `Zone ${v}`}
          />
          <Bar dataKey="minutes" radius={[4, 4, 0, 0]}>
            {zoneData.map((z, i) => (
              <Cell key={i} fill={z.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Data Tab ─────────────────────────────────────────────────────────────────

function DataTab({
  activity,
  splits,
}: {
  activity: ActivityData;
  splits: Split[] | null;
}) {
  const stats: { label: string; value: string | null }[] = [
    {
      label: "Training Effect Aerobic",
      value:
        activity.training_effect_aerobic != null
          ? activity.training_effect_aerobic.toFixed(1)
          : null,
    },
    {
      label: "Training Effect Anaerobic",
      value:
        activity.training_effect_anaerobic != null
          ? activity.training_effect_anaerobic.toFixed(1)
          : null,
    },
    {
      label: "VO2 Max",
      value: activity.vo2_max != null ? activity.vo2_max.toFixed(1) : null,
    },
    {
      label: "Recovery Time",
      value:
        activity.recovery_time_min != null
          ? `${Math.round(activity.recovery_time_min / 60)}h`
          : null,
    },
    {
      label: "Respiration",
      value:
        activity.avg_respiration != null
          ? `${activity.avg_respiration.toFixed(1)} brpm`
          : null,
    },
    {
      label: "Cadence",
      value:
        activity.avg_cadence != null
          ? `${Math.round(activity.avg_cadence)} spm`
          : null,
    },
    {
      label: "Stride Length",
      value:
        activity.avg_stride_length != null
          ? `${activity.avg_stride_length.toFixed(2)} m`
          : null,
    },
    {
      label: "Ground Contact",
      value:
        activity.ground_contact_time != null
          ? `${Math.round(activity.ground_contact_time)} ms`
          : null,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Stats grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
        }}
      >
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              background: "#f9fafb",
              borderRadius: 10,
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: "#6b7280",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 6,
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: s.value ? "#0F1B22" : "#d1d5db",
              }}
            >
              {s.value ?? "—"}
            </div>
          </div>
        ))}
      </div>

      {/* Source badge */}
      {activity.source && (
        <div>
          <span
            style={{
              display: "inline-block",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "capitalize",
              padding: "3px 10px",
              borderRadius: 20,
              background: "#f3f4f6",
              color: "#6b7280",
              border: "1px solid #e5e7eb",
            }}
          >
            Source: {activity.source}
          </span>
        </div>
      )}

      {/* Splits table */}
      {splits && splits.length > 0 && (
        <div>
          <SectionLabel>Splits</SectionLabel>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  color: "#9ca3af",
                  fontWeight: 600,
                  borderBottom: "1px solid #f3f4f6",
                }}
              >
                <td style={{ padding: "5px 0" }}>km</td>
                <td>Pace</td>
                <td>HR</td>
                <td>Elevation</td>
                <td>Cadence</td>
              </tr>
            </thead>
            <tbody>
              {splits.map((s, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom:
                      i < splits.length - 1 ? "1px solid #f9fafb" : "none",
                  }}
                >
                  <td
                    style={{
                      padding: "7px 0",
                      fontWeight: 700,
                      color: "#374151",
                    }}
                  >
                    {s.km}
                  </td>
                  <td style={{ color: "#374151" }}>
                    {s.pace_min_km != null ? fmtPace(s.pace_min_km) + "/km" : "—"}
                  </td>
                  <td style={{ color: "#374151" }}>
                    {s.avg_hr != null ? `${s.avg_hr} bpm` : "—"}
                  </td>
                  <td style={{ color: "#374151" }}>
                    {s.elevation != null ? `${s.elevation} m` : "—"}
                  </td>
                  <td style={{ color: "#374151" }}>
                    {s.cadence != null ? `${s.cadence} spm` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ActivityDetailModal({
  open,
  onClose,
  activity,
}: ActivityDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"timeline" | "hr" | "data">(
    "timeline"
  );

  const handleEsc = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [open, handleEsc]);

  // Reset tab when a new activity is shown
  useEffect(() => {
    if (open) setActiveTab("timeline");
  }, [open, activity?.activity_id]);

  if (!open || !activity) return null;

  const icon = getActivityIcon(activity.type);
  const typeName =
    activity.type.charAt(0).toUpperCase() + activity.type.slice(1).toLowerCase();
  const distanceKm = (activity.distance / 1000).toFixed(2);

  const tabs: { key: "timeline" | "hr" | "data"; label: string }[] = [
    { key: "timeline", label: "Timeline" },
    { key: "hr", label: "HR" },
    { key: "data", label: "Data" },
  ];

  const metrics: { label: string; value: string | null }[] = [
    { label: "Distance", value: `${distanceKm} km` },
    { label: "Duration", value: fmtSec(activity.duration) },
    {
      label: "Pace",
      value:
        activity.pace_or_speed != null
          ? fmtPace(activity.pace_or_speed) + "/km"
          : null,
    },
    {
      label: "Avg HR",
      value: activity.avg_hr != null ? `${activity.avg_hr} bpm` : null,
    },
    {
      label: "Max HR",
      value: activity.max_hr != null ? `${activity.max_hr} bpm` : null,
    },
    {
      label: "Calories",
      value: activity.calories != null ? `${activity.calories} kcal` : null,
    },
    {
      label: "Elevation",
      value: activity.elevation != null ? `${activity.elevation} m` : null,
    },
  ].filter((m) => m.value != null);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          width: "min(95vw, 800px)",
          maxHeight: "85vh",
          overflow: "auto",
          padding: "28px 32px",
          boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 22 }}>{icon}</span>
              <h2
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 800,
                  color: "#0F1B22",
                  lineHeight: 1.2,
                }}
              >
                {typeName}
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
              {formatDate(activity.date)}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: "#f3f4f6",
              border: "none",
              cursor: "pointer",
              fontSize: 20,
              color: "#6b7280",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* ── Key Metrics Row ── */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "6px 20px",
            marginBottom: 22,
            padding: "12px 16px",
            background: "#f9fafb",
            borderRadius: 10,
          }}
        >
          {metrics.map((m) => (
            <div
              key={m.label}
              style={{ display: "flex", alignItems: "center", gap: 5 }}
            >
              <span style={{ fontSize: 12, color: "#6b7280" }}>{m.label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0F1B22" }}>
                {m.value}
              </span>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div
          style={{
            display: "flex",
            gap: 0,
            borderBottom: "2px solid #f3f4f6",
            marginBottom: 20,
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: 600,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: activeTab === tab.key ? "#2563eb" : "#6b7280",
                borderBottom:
                  activeTab === tab.key
                    ? "2px solid #2563eb"
                    : "2px solid transparent",
                marginBottom: -2,
                transition: "color 0.15s, border-color 0.15s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        {activeTab === "timeline" && (
          <TimelineTab splits={activity.splits} />
        )}
        {activeTab === "hr" && <HrTab zones={activity.hr_zones} />}
        {activeTab === "data" && (
          <DataTab activity={activity} splits={activity.splits} />
        )}
      </div>
    </div>
  );
}
