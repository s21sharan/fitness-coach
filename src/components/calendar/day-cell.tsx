"use client";

import { PlannedCard, splitAmPmSessions } from "./planned-card";
import { ComplianceBadge, getComplianceStatus } from "./compliance-badge";
import {
  TYPE_COLORS, ZONE_COLORS,
  exerciseSummary, estimateLoad, hrZone, fmtMin, fmtSec, cType, toDS,
  type DayData, type ZoneBoundary,
} from "@/lib/training/calendar-data";
import type { CardioLog, LinkedActual, PlannedWorkout, RecoveryLog, UserHrZones, WorkoutLog } from "@/lib/hooks/use-dashboard-data";
import { fmtCardioDist, fmtCardioPace, cardioDistanceLabel, type UnitPreferences } from "@/lib/units";
import { resolveHrZoneBoundaries } from "@/lib/training/zones";

export type DayCellVariant = "compact" | "tall";

export interface PlannedClickPayload {
  plannedId: string;
  date: string;
  sessionType: string;
  aiNotes: string | null;
  slot: "am" | "pm" | null;
  status: "scheduled" | "completed" | "skipped" | "moved";
  skipReason: string | null;
  completionNote: string | null;
  linkedActual: LinkedActual | null;
  targets: ReturnType<typeof splitAmPmSessions>[number]["targets"];
}

interface DayCellProps {
  day: DayData;
  variant?: DayCellVariant;
  units: UnitPreferences;
  hrZones?: UserHrZones | null;
  linkedActuals?: Record<string, LinkedActual>;
  onWorkoutClick?: (w: WorkoutLog) => void;
  onCardioClick?: (c: CardioLog) => void;
  onPlannedClick?: (p: PlannedClickPayload) => void;
}

function fmtDist(km: number, units: UnitPreferences, type?: string) { return fmtCardioDist(km, type, units); }
function fmtPace(p: number, units: UnitPreferences, type?: string) { return fmtCardioPace(p, type, units); }
function distUnit(units: UnitPreferences, type?: string) { return cardioDistanceLabel(type, units); }

/* ─── Tall (week-view) primitives ─── */

function HrZoneBar({ avgHr, boundaries }: { avgHr: number | null; boundaries?: ZoneBoundary[] | null }) {
  const zone = hrZone(avgHr, boundaries);
  if (!zone) return null;
  return (
    <div style={{ display: "flex", gap: 1, height: 6, borderRadius: 2, overflow: "hidden", marginTop: 5 }}>
      {ZONE_COLORS.map((c, i) => (
        <div key={i} style={{ flex: 1, background: i < zone ? c : "#e5e7eb", opacity: i < zone ? 1 : 0.3 }} />
      ))}
    </div>
  );
}

function WorkoutCardTall({ w, onClick }: { w: WorkoutLog; onClick?: () => void }) {
  const c = TYPE_COLORS.lift;
  const { totalSets, avgRpe } = exerciseSummary(w.exercises);
  const load = Math.round((w.duration_minutes || 0) * 0.8);
  const exercises = Array.isArray(w.exercises) ? (w.exercises as Array<{ name: string; sets: Array<{ weight_kg: number; reps: number }> }>) : [];

  return (
    <div
      onClick={onClick}
      style={{
        background: c.bg, borderLeft: `3px solid ${c.border}`,
        borderRadius: 8, padding: "9px 11px",
        fontSize: 12, lineHeight: 1.5,
        cursor: onClick ? "pointer" : "default",
        transition: "filter 0.1s",
      }}
      onMouseEnter={(e) => onClick && (e.currentTarget.style.filter = "brightness(0.97)")}
      onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
        <span style={{ fontSize: 14 }}>{c.icon}</span>
        <span style={{ fontWeight: 700, color: c.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>{w.name || "Workout"}</span>
      </div>
      <div style={{ fontWeight: 800, color: c.text, fontSize: 14 }}>{fmtMin(w.duration_minutes)}</div>
      <div style={{ color: "#6b7280", marginTop: 1 }}>
        {totalSets > 0 && <span>Load <b style={{ color: c.text }}>{load}</b> · {totalSets} sets</span>}
      </div>
      {avgRpe != null && (
        <div style={{ marginTop: 3 }}>
          <span style={{ background: c.border, color: "#fff", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 800 }}>RPE {avgRpe}</span>
        </div>
      )}
      {exercises.length > 0 && (
        <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none", color: "#52525b", fontSize: 11, lineHeight: 1.5 }}>
          {exercises.slice(0, 6).map((ex, i) => {
            const setCount = Array.isArray(ex.sets) ? ex.sets.length : 0;
            return (
              <li key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "1px 0", borderTop: i === 0 ? `1px solid ${c.border}33` : "none" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ex.name}</span>
                <span style={{ color: "#9ca3af", flexShrink: 0, fontWeight: 600 }}>{setCount}×</span>
              </li>
            );
          })}
          {exercises.length > 6 && (
            <li style={{ color: "#9ca3af", fontSize: 10, marginTop: 2 }}>+{exercises.length - 6} more</li>
          )}
        </ul>
      )}
      <div style={{ marginTop: 4, fontSize: 10, color: "#9ca3af", fontWeight: 600 }}>{c.label}</div>
    </div>
  );
}

function CardioCardTall({ c: a, units, hrZones, onClick }: { c: CardioLog; units: UnitPreferences; hrZones?: UserHrZones | null; onClick?: () => void }) {
  const t = cType(a.type);
  const cl = TYPE_COLORS[t];
  const load = estimateLoad(a.avg_hr, a.duration);
  const boundaries = resolveHrZoneBoundaries(a.type, hrZones);
  const zone = hrZone(a.avg_hr, boundaries);

  return (
    <div
      onClick={onClick}
      onMouseEnter={(e) => onClick && (e.currentTarget.style.filter = "brightness(0.97)")}
      onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
      style={{
        background: cl.bg, borderLeft: `3px solid ${cl.border}`,
        borderRadius: 8, padding: "9px 11px",
        fontSize: 12, lineHeight: 1.5,
        cursor: onClick ? "pointer" : "default",
        transition: "filter 0.1s",
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
        <span style={{ fontSize: 14 }}>{cl.icon}</span>
        <span style={{ fontWeight: 700, color: cl.text, fontSize: 13, flex: 1 }}>{fmtSec(a.duration)}</span>
        {zone > 0 && (
          <span style={{ fontSize: 10, fontWeight: 800, color: ZONE_COLORS[zone - 1], background: "rgba(255,255,255,0.6)", borderRadius: 4, padding: "1px 5px" }}>Z{zone}</span>
        )}
      </div>
      {a.distance > 0 && (
        <div style={{ fontWeight: 800, color: cl.text, fontSize: 14 }}>
          {fmtDist(a.distance, units, a.type)} {distUnit(units, a.type)}
        </div>
      )}
      <HrZoneBar avgHr={a.avg_hr} boundaries={boundaries} />
      <div style={{ color: "#6b7280", display: "flex", flexWrap: "wrap", gap: "0 7px", marginTop: 3 }}>
        {load > 0 && <span>Load <b style={{ color: cl.text }}>{load}</b></span>}
        {a.pace_or_speed != null && a.pace_or_speed > 0 && <span>Pace {fmtPace(a.pace_or_speed, units, a.type)}</span>}
        {a.avg_hr != null && <span><span style={{ color: "#ef4444" }}>♥</span> {a.avg_hr}</span>}
      </div>
      {(a.calories != null || a.elevation != null) && (
        <div style={{ color: "#9ca3af", display: "flex", gap: 6, marginTop: 1 }}>
          {a.calories != null && a.calories > 0 && <span>{Math.round(a.calories)} kcal</span>}
          {a.elevation != null && a.elevation > 0 && <span>↑{Math.round(a.elevation)}m</span>}
        </div>
      )}
      <div style={{ marginTop: 4, fontSize: 10, color: "#9ca3af", fontWeight: 600 }}>{cl.label}</div>
    </div>
  );
}

function RecoveryBarTall({ r }: { r: RecoveryLog }) {
  const metrics: { icon: string; value: string; label: string; color: string }[] = [];
  if (r.sleep_hours !== null) {
    const c = r.sleep_hours >= 7 ? "#16a34a" : r.sleep_hours >= 6 ? "#ca8a04" : "#dc2626";
    metrics.push({ icon: "😴", value: `${r.sleep_hours}h`, label: "Sleep", color: c });
  }
  if (r.sleep_score !== null) {
    const c = r.sleep_score >= 75 ? "#16a34a" : r.sleep_score >= 50 ? "#ca8a04" : "#dc2626";
    metrics.push({ icon: "💤", value: `${r.sleep_score}`, label: "Score", color: c });
  }
  if (r.resting_hr !== null) {
    const c = r.resting_hr <= 55 ? "#16a34a" : r.resting_hr <= 65 ? "#ca8a04" : "#dc2626";
    metrics.push({ icon: "♥", value: `${r.resting_hr}`, label: "RHR", color: c });
  }
  if (r.hrv !== null) {
    const c = r.hrv >= 50 ? "#16a34a" : r.hrv >= 35 ? "#ca8a04" : "#dc2626";
    metrics.push({ icon: "📊", value: `${r.hrv}`, label: "HRV", color: c });
  }
  if (r.steps !== null && r.steps > 0) {
    metrics.push({
      icon: "👟",
      value: r.steps >= 1000 ? `${(r.steps / 1000).toFixed(1)}k` : `${r.steps}`,
      label: "Steps", color: "#6b7280",
    });
  }
  if (metrics.length === 0) return null;
  const cols = Math.min(metrics.length, 5);
  return (
    <div style={{
      display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 1,
      background: "#f0f9ff", borderRadius: 8, padding: 6, border: "1px solid #e0f2fe",
    }}>
      {metrics.slice(0, cols).map((m, i) => (
        <div key={i} style={{ textAlign: "center", fontSize: 10, lineHeight: 1.2, padding: "3px 0" }}>
          <div style={{ fontSize: 13 }}>{m.icon}</div>
          <div style={{ fontWeight: 800, color: m.color, fontSize: 13 }}>{m.value}</div>
          <div style={{ color: "#94a3b8", fontSize: 9, fontWeight: 600 }}>{m.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Compact (month-view) primitives — minimal chips, no detail ─── */

function ActivityChip({
  icon, label, color, onClick,
}: { icon: string; label: string; color: { bg: string; border: string; text: string }; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "flex-start", gap: 5,
        background: color.bg, borderLeft: `3px solid ${color.border}`,
        borderRadius: 5, padding: "5px 7px",
        fontSize: 12, fontWeight: 700, color: color.text,
        cursor: onClick ? "pointer" : "default",
        lineHeight: 1.3,
      }}
      onMouseEnter={(e) => onClick && (e.currentTarget.style.filter = "brightness(0.96)")}
      onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
    >
      <span style={{ fontSize: 13, flexShrink: 0 }}>{icon}</span>
      <span style={{ wordBreak: "break-word" }}>{label}</span>
    </div>
  );
}

function PlannedPill({ label, isToday, isFuture, onClick }: { label: string; isToday: boolean; isFuture: boolean; onClick?: () => void }) {
  const type = inferTypeFromSession(label);
  const c = TYPE_COLORS[type];
  const dimmed = !isToday && !isFuture;
  return (
    <div
      onClick={onClick}
      onMouseEnter={(e) => onClick && (e.currentTarget.style.filter = "brightness(0.97)")}
      onMouseLeave={(e) => onClick && (e.currentTarget.style.filter = "brightness(1)")}
      style={{
        display: "flex", alignItems: "flex-start", gap: 5,
        background: dimmed ? "#f9fafb" : "#fff",
        border: `1px dashed ${c.border}`,
        borderRadius: 5, padding: "4px 7px",
        fontSize: 11, fontWeight: 700,
        color: dimmed ? "#9ca3af" : c.text,
        lineHeight: 1.3,
        opacity: dimmed ? 0.7 : 1,
        cursor: onClick ? "pointer" : "default",
        transition: "filter .12s ease",
      }}
      title="Planned"
    >
      <span style={{ fontSize: 12, flexShrink: 0 }}>{c.icon}</span>
      <span style={{ wordBreak: "break-word" }}>{label}</span>
    </div>
  );
}

function inferTypeFromSession(session: string): string {
  const s = session.toLowerCase();
  if (s.includes("run")) return "run";
  if (s.includes("bike") || s.includes("ride") || s.includes("cycle")) return "bike";
  if (s.includes("swim")) return "swim";
  if (s.includes("lift") || s.includes("push") || s.includes("pull") || s.includes("leg") || s.includes("upper") || s.includes("lower") || s.includes("full")) return "lift";
  return "other";
}

/* ─── DayCell ─── */

export function DayCell({ day, variant = "compact", units, hrZones, linkedActuals, onWorkoutClick, onCardioClick, onPlannedClick }: DayCellProps) {
  const today = toDS(new Date());
  const isToday = day.date === today;
  const isFuture = day.date > today;
  const isPast = day.date < today;
  const dayNum = day.dateObj.getDate();
  const tall = variant === "tall";

  const compliance = isPast && day.planned
    ? getComplianceStatus(day.planned.session_type, day.workouts, day.cardio)
    : null;

  const plannedStatus = (day.planned?.status ?? "scheduled") as
    | "scheduled"
    | "completed"
    | "skipped"
    | "moved";
  const plannedSkipReason = day.planned?.skip_reason ?? null;
  const plannedCompletionNote = day.planned?.completion_note ?? null;
  const plannedLinkedActual =
    day.planned && linkedActuals ? linkedActuals[day.planned.id] ?? null : null;

  if (tall) {
    return (
      <div style={{
        display: "flex", flexDirection: "column",
        gap: 8, minHeight: 500,
        padding: "4px 6px 10px",
      }}>
        <div style={{
          textAlign: "center", padding: "8px 0 6px",
          borderBottom: isToday ? `2px solid #3b82f6` : `1px solid #f3f4f6`,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {day.dateObj.toLocaleDateString("en-US", { weekday: "short" })}
          </div>
          <div style={{
            fontSize: 16, fontWeight: 800,
            color: isToday ? "#fff" : "#111827",
            background: isToday ? "#3b82f6" : "transparent",
            width: 30, height: 30, borderRadius: "50%",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>{dayNum}</div>
          {compliance && <ComplianceBadge status={compliance} />}
        </div>
        {day.recovery && <RecoveryBarTall r={day.recovery} />}
        {day.workouts.map((w, i) => (
          <WorkoutCardTall key={`w-${i}`} w={w} onClick={onWorkoutClick ? () => onWorkoutClick(w) : undefined} />
        ))}
        {day.cardio.map((c, i) => (
          <CardioCardTall key={`c-${i}`} c={c} units={units} hrZones={hrZones} onClick={onCardioClick ? () => onCardioClick(c) : undefined} />
        ))}
        {day.planned && splitAmPmSessions(
          day.planned.session_type,
          day.planned.ai_notes,
          day.planned.targets,
        ).map((session, i) => (
          <PlannedCard
            key={`planned-${i}`}
            variant={isToday ? "today" : isFuture ? "future" : "past"}
            sessionType={session.label}
            aiNotes={session.aiNotes}
            slot={session.slot}
            targets={session.targets}
            onClick={onPlannedClick && day.planned ? () => onPlannedClick({
              plannedId: day.planned!.id,
              date: day.date,
              sessionType: session.label,
              aiNotes: session.aiNotes,
              slot: session.slot,
              status: plannedStatus,
              skipReason: plannedSkipReason,
              completionNote: plannedCompletionNote,
              linkedActual: plannedLinkedActual,
              targets: session.targets,
            }) : undefined}
          />
        ))}
      </div>
    );
  }

  // Compact (month) — minimal
  const hasActual = day.workouts.length > 0 || day.cardio.length > 0;
  const showPlanned = day.planned && !hasActual && !isPast;

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      gap: 5,
      minHeight: hasActual || showPlanned ? 130 : 70,
      padding: "5px 5px 8px",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
        padding: "2px 0 4px",
        borderBottom: isToday ? "2px solid #3b82f6" : "1px solid #f3f4f6",
      }}>
        <div style={{
          fontSize: 14, fontWeight: 800,
          color: isToday ? "#fff" : isFuture ? "#9ca3af" : "#111827",
          background: isToday ? "#3b82f6" : "transparent",
          width: 26, height: 26, borderRadius: "50%",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>{dayNum}</div>
        {compliance && <ComplianceBadge status={compliance} />}
      </div>
      {day.workouts.map((w, i) => (
        <ActivityChip
          key={`w-${i}`}
          icon={TYPE_COLORS.lift.icon}
          label={fmtMin(w.duration_minutes)}
          color={TYPE_COLORS.lift}
          onClick={onWorkoutClick ? () => onWorkoutClick(w) : undefined}
        />
      ))}
      {day.cardio.map((c, i) => {
        const t = cType(c.type);
        const cl = TYPE_COLORS[t];
        const label = c.distance > 0 ? `${fmtDist(c.distance, units, c.type)} ${distUnit(units, c.type)}` : fmtSec(c.duration);
        return (
          <ActivityChip
            key={`c-${i}`}
            icon={cl.icon}
            label={label}
            color={cl}
            onClick={onCardioClick ? () => onCardioClick(c) : undefined}
          />
        );
      })}
      {showPlanned && day.planned && splitAmPmSessions(
        day.planned.session_type,
        day.planned.ai_notes,
        day.planned.targets,
      ).map((session, i) => (
        <PlannedPill
          key={`pill-${i}`}
          label={session.label}
          isToday={isToday}
          isFuture={isFuture}
          onClick={onPlannedClick && day.planned ? () => onPlannedClick({
            plannedId: day.planned!.id,
            date: day.date,
            sessionType: session.label,
            aiNotes: session.aiNotes,
            slot: session.slot,
            status: plannedStatus,
            skipReason: plannedSkipReason,
            completionNote: plannedCompletionNote,
            linkedActual: plannedLinkedActual,
            targets: session.targets,
          }) : undefined}
        />
      ))}
    </div>
  );
}
