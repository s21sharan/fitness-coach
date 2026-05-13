"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  TYPE_COLORS, weekTotals, fmtSec,
  type DayData,
} from "@/lib/training/calendar-data";
import { fmtDist as fmtDistUnit, distanceLabel, type UnitPreferences } from "@/lib/units";

interface WeekSummaryModalProps {
  days: DayData[] | null;
  weekNum: number;
  units: UnitPreferences;
  onClose: () => void;
}

const TYPE_ORDER = ["run", "bike", "swim", "lift", "other"] as const;

export function WeekSummaryModal({ days, weekNum, units, onClose }: WeekSummaryModalProps) {
  const open = days !== null;

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

  const totals = useMemo(() => (days ? weekTotals(days) : null), [days]);

  if (!open || !days || !totals) return null;

  const start = days[0].dateObj;
  const end = days[6].dateObj;
  const sameMonth = start.getMonth() === end.getMonth();
  const rangeLabel = sameMonth
    ? `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { day: "numeric", year: "numeric" })}`
    : `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const distUnit = distanceLabel(units.distance);
  const fmtDist = (km: number) => fmtDistUnit(km, units.distance);

  const presentTypes = TYPE_ORDER.filter((t) => totals.byType[t] && totals.byType[t].count > 0);

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
          width: "min(96vw, 560px)", maxHeight: "92vh", overflow: "auto",
          padding: "24px 26px",
          boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 14 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
              Week {weekNum}
            </div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0F1B22", lineHeight: 1.2, letterSpacing: "-0.02em" }}>
              {rangeLabel}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 8,
              background: "#f3f4f6", border: "none", cursor: "pointer",
              fontSize: 18, color: "#6b7280",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* Totals */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 10,
          marginBottom: 20,
        }}>
          <Stat label="Time" value={fmtSec(totals.timeSec)} />
          <Stat label="Load" value={`${totals.load}`} />
          <Stat label="Sessions" value={`${totals.workouts + totals.cardioSessions}`} />
          {totals.distKm > 0 && (
            <Stat label="Distance" value={`${fmtDist(totals.distKm)}`} sub={distUnit} />
          )}
          {totals.kcal > 0 && (
            <Stat label="Calories" value={`${totals.kcal.toLocaleString()}`} sub="kcal" />
          )}
          {totals.elevation > 0 && (
            <Stat label="Elevation" value={`${totals.elevation.toLocaleString()}`} sub="m" />
          )}
        </div>

        {/* Per-type breakdown */}
        {presentTypes.length > 0 ? (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
              By activity
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {presentTypes.map((t) => {
                const stats = totals.byType[t];
                const color = TYPE_COLORS[t];
                return (
                  <div
                    key={t}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 12px",
                      background: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: 10,
                    }}
                  >
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      fontSize: 13, fontWeight: 700, color: color.text,
                    }}>
                      <span style={{ fontSize: 16 }}>{color.icon}</span>
                      <span>{color.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", textAlign: "right" }}>
                      {stats.count} {stats.count === 1 ? "session" : "sessions"}
                    </div>
                    <div style={{
                      display: "flex", alignItems: "baseline", gap: 10,
                      fontSize: 12, color: "#374151", fontWeight: 600,
                      justifyContent: "flex-end", minWidth: 140,
                    }}>
                      <span><b style={{ color: "#0F1B22" }}>{fmtSec(stats.timeSec)}</b></span>
                      {stats.distKm > 0 && (
                        <span><b style={{ color: "#0F1B22" }}>{fmtDist(stats.distKm)}</b> <span style={{ color: "#9ca3af" }}>{distUnit}</span></span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "20px 0", color: "#9ca3af", fontSize: 13 }}>
            No activity logged this week.
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: "#f9fafb", borderRadius: 10,
      padding: "10px 12px",
      border: "1px solid #f3f4f6",
    }}>
      <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: "#0F1B22", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
        {value}
        {sub && <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, marginLeft: 4 }}>{sub}</span>}
      </div>
    </div>
  );
}
