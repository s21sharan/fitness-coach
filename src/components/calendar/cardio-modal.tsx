"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine,
} from "recharts";
import { chartColors, tooltipStyle, tooltipItemStyle, tooltipLabelStyle, gridProps, axisProps } from "@/components/charts/chart-theme";
import { TYPE_COLORS, ZONE_COLORS, estimateLoad, hrZone, fmtSec, cType, fmtMin, type ZoneBoundary } from "@/lib/training/calendar-data";
import { fmtDist as fmtDistUnit, fmtPace as fmtPaceUnit, distanceLabel, type UnitPreferences } from "@/lib/units";
import type { CardioLog } from "@/lib/hooks/use-dashboard-data";

interface CardioModalProps {
  cardio: CardioLog;
  allCardio: CardioLog[];
  units: UnitPreferences;
  hrZoneBoundaries?: ZoneBoundary[] | null;
  open: boolean;
  onClose: () => void;
}

const ZONE_LABELS = ["Recovery", "Aerobic", "Tempo", "Threshold", "Anaerobic"];

function zoneRangeStr(boundaries: ZoneBoundary[] | null | undefined, i: number): string {
  const bs = boundaries && boundaries.length === 5
    ? boundaries
    : [
        { zone: 1, low: 0, high: 120 },
        { zone: 2, low: 120, high: 140 },
        { zone: 3, low: 140, high: 155 },
        { zone: 4, low: 155, high: 170 },
        { zone: 5, low: 170, high: 250 },
      ];
  const b = bs[i];
  if (i === 0) return `< ${b.high} bpm`;
  if (i === 4) return `${b.low}+ bpm`;
  return `${b.low}-${b.high} bpm`;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function effortLabel(zone: number): string {
  if (zone <= 0) return "Unknown";
  return ZONE_LABELS[zone - 1] ?? "Unknown";
}

// Intensity factor: avg_hr / Z4 lower bound (default 170 if no zones).
function intensityFactor(avgHr: number | null, boundaries: ZoneBoundary[] | null | undefined): number {
  if (!avgHr) return 0;
  const threshold = boundaries && boundaries.length === 5 ? boundaries[3].low : 170;
  return Math.round((avgHr / threshold) * 100) / 100;
}

export function CardioModal({ cardio, allCardio, units, hrZoneBoundaries, open, onClose }: CardioModalProps) {
  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

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

  const type = cType(cardio.type);
  const color = TYPE_COLORS[type];
  const zone = hrZone(cardio.avg_hr, hrZoneBoundaries);
  const load = estimateLoad(cardio.avg_hr, cardio.duration);
  const ifactor = intensityFactor(cardio.avg_hr, hrZoneBoundaries);
  const effort = effortLabel(zone);

  // Comparison: last 8 activities of the same type (including this one)
  const recent = useMemo(() => {
    const sameType = allCardio.filter((c) => cType(c.type) === type);
    return [...sameType]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-8)
      .map((c) => ({
        date: c.date,
        load: estimateLoad(c.avg_hr, c.duration),
        duration: Math.round(c.duration / 60),
        distance: c.distance,
        isThis: c.activity_id === cardio.activity_id,
        avgHr: c.avg_hr,
      }));
  }, [allCardio, cardio.activity_id, type]);

  // Stats vs same-type average
  const stats = useMemo(() => {
    const sameType = allCardio.filter((c) => cType(c.type) === type && c.activity_id !== cardio.activity_id);
    if (sameType.length === 0) return null;
    const avgDuration = sameType.reduce((s, c) => s + c.duration, 0) / sameType.length;
    const avgDistance = sameType.reduce((s, c) => s + (c.distance || 0), 0) / sameType.length;
    const hrSamples = sameType.filter((c) => c.avg_hr != null);
    const avgHrAvg = hrSamples.length > 0 ? hrSamples.reduce((s, c) => s + (c.avg_hr || 0), 0) / hrSamples.length : null;
    const avgLoad = sameType.reduce((s, c) => s + estimateLoad(c.avg_hr, c.duration), 0) / sameType.length;
    return {
      durationDelta: cardio.duration - avgDuration,
      distanceDelta: (cardio.distance || 0) - avgDistance,
      hrDelta: cardio.avg_hr != null && avgHrAvg != null ? cardio.avg_hr - avgHrAvg : null,
      loadDelta: load - avgLoad,
      count: sameType.length,
    };
  }, [allCardio, cardio, type, load]);

  if (!open) return null;

  const distLabel = cardio.distance > 0 ? `${fmtDistUnit(cardio.distance, units.distance)} ${distanceLabel(units.distance)}` : null;
  const paceLabel = cardio.pace_or_speed != null && cardio.pace_or_speed > 0 ? fmtPaceUnit(cardio.pace_or_speed, units.distance) : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 14,
          width: "min(95vw, 880px)", maxHeight: "90vh", overflow: "auto",
          padding: "26px 30px",
          boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22, gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 12,
              background: color.bg, border: `1.5px solid ${color.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26,
            }}>{color.icon}</div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>
                {color.label}
              </div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0F1B22", lineHeight: 1.2, letterSpacing: "-0.02em" }}>
                {distLabel || fmtSec(cardio.duration)}
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>
                {formatDate(cardio.date)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 34, height: 34, borderRadius: 8,
              background: "#f3f4f6", border: "none", cursor: "pointer",
              fontSize: 20, color: "#6b7280",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* Key metrics grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 10,
          marginBottom: 24,
        }}>
          <Metric label="Duration" value={fmtSec(cardio.duration)} accent={color.border} />
          {distLabel && <Metric label="Distance" value={distLabel} accent={color.border} />}
          {paceLabel && <Metric label="Pace" value={paceLabel} accent="#6366f1" />}
          {cardio.avg_hr != null && <Metric label="Avg HR" value={`${cardio.avg_hr} bpm`} accent="#ef4444" />}
          {cardio.calories != null && cardio.calories > 0 && <Metric label="Calories" value={Math.round(cardio.calories).toLocaleString()} accent="#f97316" />}
          {cardio.elevation != null && cardio.elevation > 0 && <Metric label="Elevation" value={`↑${Math.round(cardio.elevation)} m`} accent="#10b981" />}
        </div>

        {/* HR Zone classification */}
        {cardio.avg_hr != null && zone > 0 && (
          <Section title="Heart Rate Zone">
            <div style={{ display: "flex", gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
              <div style={{
                background: ZONE_COLORS[zone - 1] + "22",
                border: `1.5px solid ${ZONE_COLORS[zone - 1]}`,
                borderRadius: 10,
                padding: "14px 18px",
                minWidth: 180,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>Zone</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: ZONE_COLORS[zone - 1], letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                  Z{zone} · {ZONE_LABELS[zone - 1]}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                  {zoneRangeStr(hrZoneBoundaries, zone - 1)} · session avg {cardio.avg_hr} bpm
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 240 }}>
                <ZoneScale activeZone={zone} avgHr={cardio.avg_hr} boundaries={hrZoneBoundaries} />
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8, lineHeight: 1.4 }}>
                  {Array.isArray(cardio.hr_zones) && cardio.hr_zones.length > 0
                    ? "Zones synced from Garmin (per-second time-in-zone)."
                    : "Single-zone classification from average HR. Strava activities don't carry per-second HR."}
                </div>
              </div>
            </div>
          </Section>
        )}

        {/* Performance / load */}
        <Section title="Performance">
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
          }}>
            <PerfCard label="Training load" value={`${load}`} sub="TRIMP-style" hint="duration × HR intensity²" />
            <PerfCard
              label="Intensity factor"
              value={ifactor > 0 ? ifactor.toFixed(2) : "—"}
              sub={`vs ${hrZoneBoundaries?.length === 5 ? hrZoneBoundaries[3].low : 170} bpm threshold`}
              hint="<0.75 easy · 0.85+ hard"
            />
            <PerfCard label="Effort" value={effort} sub="from avg HR" />
            {stats && (
              <PerfCard
                label={`vs your ${color.label.toLowerCase()} avg`}
                value={stats.loadDelta >= 0 ? `+${Math.round(stats.loadDelta)}` : `${Math.round(stats.loadDelta)}`}
                sub={`load over last ${stats.count}`}
                color={stats.loadDelta >= 0 ? "#22c55e" : "#ef4444"}
              />
            )}
          </div>
        </Section>

        {/* Comparison chart */}
        {recent.length > 1 && (
          <Section title={`Recent ${color.label.toLowerCase()} sessions`}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={recent} margin={{ top: 8, right: 8, bottom: 4, left: -10 }} barCategoryGap="24%">
                <defs>
                  <linearGradient id="grad-cardio-load" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color.border} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={color.border} stopOpacity={0.45} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  tick={axisProps.tick}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis {...axisProps} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
                  cursor={{ fill: chartColors.grid, opacity: 0.4 }}
                  formatter={(val: number) => [`${val}`, "Load"]}
                  labelFormatter={(d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                />
                <Bar dataKey="load" radius={[6, 6, 0, 0]}>
                  {recent.map((r, i) => (
                    <Cell key={i} fill={r.isThis ? color.border : "url(#grad-cardio-load)"} />
                  ))}
                </Bar>
                <ReferenceLine y={load} stroke={color.border} strokeDasharray="4 3" strokeWidth={1.5} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6, lineHeight: 1.4 }}>
              This session highlighted in solid color. Dashed line = this session{"'"}s load for reference.
            </div>
          </Section>
        )}

        {/* Stats vs average breakdown */}
        {stats && (
          <Section title={`Compared to your last ${stats.count} ${color.label.toLowerCase()} sessions`}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
              <Delta label="Duration" delta={stats.durationDelta} format={(v) => fmtMin(Math.round(v / 60))} positiveIsGood />
              {cardio.distance > 0 && (
                <Delta
                  label="Distance"
                  delta={stats.distanceDelta}
                  format={(v) => `${fmtDistUnit(Math.abs(v), units.distance)} ${distanceLabel(units.distance)}`}
                  positiveIsGood
                />
              )}
              {stats.hrDelta != null && (
                <Delta label="Avg HR" delta={stats.hrDelta} format={(v) => `${Math.round(v)} bpm`} />
              )}
              <Delta label="Training load" delta={stats.loadDelta} format={(v) => `${Math.round(v)}`} positiveIsGood />
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{
      background: "#f9fafb", borderRadius: 10,
      padding: "12px 14px",
      borderTop: `3px solid ${accent}`,
    }}>
      <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: "#0F1B22", letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{
        fontSize: 11, fontWeight: 700, color: "#6b7280",
        textTransform: "uppercase", letterSpacing: "0.07em",
        margin: "0 0 12px",
      }}>{title}</h3>
      {children}
    </div>
  );
}

function PerfCard({ label, value, sub, hint, color }: { label: string; value: string; sub?: string; hint?: string; color?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || "#0F1B22", letterSpacing: "-0.02em", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>{sub}</div>}
      {hint && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function Delta({ label, delta, format, positiveIsGood }: { label: string; delta: number; format: (v: number) => string; positiveIsGood?: boolean }) {
  const isPositive = delta > 0;
  const isGood = positiveIsGood ? isPositive : !isPositive;
  const color = delta === 0 ? "#6b7280" : isGood ? "#22c55e" : "#ef4444";
  const arrow = delta === 0 ? "·" : isPositive ? "▲" : "▼";
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 16, fontWeight: 800, color }}>{arrow}</span>
        <span style={{ fontSize: 16, fontWeight: 800, color }}>{format(Math.abs(delta))}</span>
      </div>
    </div>
  );
}

function ZoneScale({ activeZone, avgHr, boundaries }: { activeZone: number; avgHr: number; boundaries?: ZoneBoundary[] | null }) {
  const bs = boundaries && boundaries.length === 5 ? boundaries : [
    { zone: 1, low: 100, high: 120 },
    { zone: 2, low: 120, high: 140 },
    { zone: 3, low: 140, high: 155 },
    { zone: 4, low: 155, high: 170 },
    { zone: 5, low: 170, high: 190 },
  ];
  const minHr = Math.max(60, bs[0].low > 0 ? bs[0].low : bs[1].low - 20);
  const maxHr = bs[4].high < 250 ? bs[4].high : Math.max(bs[4].low + 20, 190);
  const pct = Math.min(100, Math.max(0, ((avgHr - minHr) / (maxHr - minHr)) * 100));
  return (
    <div>
      <div style={{ display: "flex", height: 18, borderRadius: 6, overflow: "hidden", border: "1px solid #e5e7eb", position: "relative" }}>
        {ZONE_COLORS.map((c, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              background: c,
              opacity: i === activeZone - 1 ? 1 : 0.35,
              borderRight: i < 4 ? "1px solid rgba(255,255,255,0.6)" : "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 800, color: "#0F1B22",
            }}
          >
            Z{i + 1}
          </div>
        ))}
        <div style={{
          position: "absolute", top: -3, bottom: -3,
          left: `${pct}%`, width: 2,
          background: "#0F1B22",
          boxShadow: "0 0 0 2px rgba(255,255,255,0.9)",
          borderRadius: 2,
          transform: "translateX(-1px)",
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 9, color: "#9ca3af", fontWeight: 600 }}>
        <span>{minHr}</span>
        <span>{bs[1].low}</span>
        <span>{bs[2].low}</span>
        <span>{bs[3].low}</span>
        <span>{bs[4].low}</span>
        <span>{maxHr} bpm</span>
      </div>
    </div>
  );
}
