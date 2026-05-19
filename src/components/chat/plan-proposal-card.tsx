"use client";

import { useMemo, useState } from "react";
import { colorForSession, sportForSession, type SessionSport } from "@/lib/training/session-colors";
import { PlannedWorkoutModal, type PlannedWorkoutModalData } from "@/components/calendar/planned-workout-modal";
import type { SessionContract, SessionDay, WeekBlock } from "@/lib/training/schemas";
import type { WorkoutContractV1 } from "@/lib/training/workout-contract";

interface DayLayout {
  day: string;
  session: string;
  notes: string | null;
}

interface WeekLayout {
  week_number: number;
  week_focus: string;
  days: DayLayout[];
}

interface PlanProposalData {
  success: boolean;
  proposed?: boolean;
  split_type: string;
  reasoning: string;
  weekly_layout: DayLayout[];
  week_layouts?: WeekLayout[];
  raw_blocks?: WeekBlock[];
  raw_layout?: unknown[];
  plan_config?: unknown;
  body_goal?: string;
  race_type?: string | null;
  risks?: string[];
  // Legacy fields for already-saved plans
  plan_id?: string;
  weeks_generated?: number;
  starts?: string;
}

function formatSplitType(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const SPORT_GLYPH: Record<SessionSport, string> = {
  run: "Run",
  bike: "Bike",
  swim: "Swim",
  strength: "Lift",
  rest: "Rest",
  other: "Other",
};

// Compute a tentative date for a proposed cell. Used only for the modal header.
// We assume the proposal starts next Monday — same convention the accept route uses.
function startOfNextMondayYmd(): string {
  const now = new Date();
  const day = now.getDay(); // Sun=0..Sat=6
  const offset = day === 0 ? 1 : 8 - day;
  const m = new Date(now);
  m.setDate(now.getDate() + offset);
  return m.toISOString().slice(0, 10);
}

function addDays(ymd: string, days: number): string {
  const d = new Date(ymd + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const DAY_OFFSET: Record<string, number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
};

function sessionContractToModalData(opts: {
  date: string;
  slot: "am" | "pm";
  sc: SessionContract;
}): PlannedWorkoutModalData {
  return {
    plannedId: "proposal",
    date: opts.date,
    sessionType: opts.sc.name,
    aiNotes: opts.sc.rationale ?? null,
    slot: opts.slot,
    status: "scheduled",
    skipReason: null,
    completionNote: null,
    linkedActual: null,
    targets: {
      contract: opts.sc.contract as unknown as WorkoutContractV1,
    },
  };
}

export function PlanProposalCard({ data }: { data: PlanProposalData }) {
  const [status, setStatus] = useState<"pending" | "accepting" | "accepted" | "error">("pending");
  const [selected, setSelected] = useState<PlannedWorkoutModalData | null>(null);

  // Pre-compute a fast lookup from (weekIdx, dayLabel) → list of SessionContract+slot+date.
  // The proposal renders from week_layouts (simplified strings), but the modal needs the
  // full contract — we pull it from raw_blocks. If raw_blocks is missing we just skip the
  // click-through.
  const startDate = useMemo(() => startOfNextMondayYmd(), []);
  const sessionsByCell = useMemo(() => {
    const map = new Map<string, Array<{ slot: "am" | "pm"; date: string; sc: SessionContract }>>();
    const blocks = data.raw_blocks;
    if (!blocks) return map;
    blocks.forEach((week: WeekBlock, weekIdx: number) => {
      week.days.forEach((day: SessionDay) => {
        const cellKey = `${weekIdx}|${day.day_label}`;
        const dayOffset = (DAY_OFFSET[day.day_label] ?? 0) + weekIdx * 7;
        const date = addDays(startDate, dayOffset);
        const entries: Array<{ slot: "am" | "pm"; date: string; sc: SessionContract }> = [];
        if (day.am_session) entries.push({ slot: "am", date, sc: day.am_session });
        if (day.pm_session) entries.push({ slot: "pm", date, sc: day.pm_session });
        if (entries.length > 0) map.set(cellKey, entries);
      });
    });
    return map;
  }, [data.raw_blocks, startDate]);

  if (!data.success) {
    return (
      <div style={{
        background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 16,
        padding: 16, fontSize: 13, color: "#991b1b",
      }}>
        Failed to generate plan. Please try again.
      </div>
    );
  }

  const handleAccept = async () => {
    setStatus("accepting");
    try {
      const res = await fetch("/api/plan/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          split_type: data.split_type,
          body_goal: data.body_goal,
          race_type: data.race_type,
          plan_config: data.plan_config,
          weekly_layout: data.raw_layout,
          raw_blocks: data.raw_blocks,
        }),
      });
      setStatus(res.ok ? "accepted" : "error");
    } catch {
      setStatus("error");
    }
  };

  const weeks = data.week_layouts && data.week_layouts.length > 0
    ? data.week_layouts
    : [{ week_number: 1, week_focus: "", days: data.weekly_layout }];

  return (
    <div style={{
      background: "linear-gradient(135deg, #0F1B22 0%, #1a2d3a 100%)",
      borderRadius: 20, padding: 24, color: "#fff",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: -40, right: -30, width: 140, height: 140, borderRadius: "50%", background: "#F6B7A6", opacity: 0.08, filter: "blur(40px)" }} />
      <div style={{ position: "absolute", bottom: -30, left: -20, width: 120, height: 120, borderRadius: "50%", background: "#B7DDEA", opacity: 0.08, filter: "blur(40px)" }} />

      <div style={{ position: "relative" }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#F6B7A6", marginBottom: 6 }}>
          {status === "accepted" ? "Plan Active" : "Proposed Training Plan"}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>
          {formatSplitType(data.split_type)}
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 16 }}>
          {weeks.length} week{weeks.length === 1 ? "" : "s"} · {status === "accepted" ? "added to your calendar" : "tap a day to inspect"}
        </div>
      </div>

      <div style={{
        position: "relative", fontSize: 13, lineHeight: 1.55,
        color: "rgba(255,255,255,0.7)", marginBottom: 18,
        padding: "12px 14px", background: "rgba(255,255,255,0.05)",
        borderRadius: 12, borderLeft: "3px solid #F6B7A6",
      }}>
        {data.reasoning}
      </div>

      {data.risks && data.risks.length > 0 && (
        <div style={{
          position: "relative", fontSize: 12, lineHeight: 1.5,
          color: "rgba(255,255,255,0.55)", marginBottom: 16,
          padding: "10px 14px", background: "rgba(255,255,255,0.04)",
          borderRadius: 10,
        }}>
          {data.risks.map((risk, i) => (
            <div key={i} style={{ marginBottom: i < data.risks!.length - 1 ? 4 : 0 }}>
              {risk}
            </div>
          ))}
        </div>
      )}

      <div style={{ position: "relative", marginBottom: 20 }}>
        {weeks.map((week, weekIdx) => (
          <div key={week.week_number} style={{ marginBottom: 14 }}>
            {weeks.length > 1 && (
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
                textTransform: "uppercase", color: "rgba(255,255,255,0.45)",
                marginBottom: 6,
              }}>
                Week {week.week_number}
                {week.week_focus && (
                  <span style={{ fontWeight: 500, marginLeft: 8, fontSize: 10, letterSpacing: "0.04em", textTransform: "none", color: "rgba(255,255,255,0.55)" }}>
                    {week.week_focus}
                  </span>
                )}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
              {week.days.map((d, i) => {
                const color = colorForSession(d.session);
                const sport = sportForSession(d.session);
                const isRest = sport === "rest";
                const cellEntries = sessionsByCell.get(`${weekIdx}|${d.day}`);
                const isClickable = !isRest && (cellEntries?.length ?? 0) > 0;

                const inner = (
                  <>
                    <div style={{
                      fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                      letterSpacing: "0.08em", color: "rgba(255,255,255,0.45)",
                      marginBottom: 6,
                    }}>
                      {d.day}
                    </div>
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      marginBottom: 4,
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: 999,
                        background: color.accent, flexShrink: 0,
                      }} />
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                        textTransform: "uppercase", color: color.text, opacity: 0.85,
                      }}>
                        {SPORT_GLYPH[sport]}
                      </span>
                    </div>
                    <div style={{
                      fontSize: 11, fontWeight: 600, color: color.text,
                      lineHeight: 1.25, minHeight: 26,
                    }}>
                      {d.session.length > 28 ? d.session.slice(0, 25) + "…" : d.session}
                    </div>
                    {d.notes && (
                      <div style={{
                        fontSize: 9, color: color.text, opacity: 0.55,
                        marginTop: 4, lineHeight: 1.35,
                      }}>
                        {d.notes.length > 36 ? d.notes.slice(0, 36) + "…" : d.notes}
                      </div>
                    )}
                  </>
                );

                const cellStyle: React.CSSProperties = {
                  background: color.bg,
                  borderRadius: 10,
                  padding: "10px 8px",
                  border: `1px solid ${isRest ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.08)"}`,
                  textAlign: "left",
                  position: "relative",
                  cursor: isClickable ? "pointer" : "default",
                  width: "100%",
                  color: "inherit",
                  fontFamily: "inherit",
                  transition: "transform 0.12s ease, border-color 0.12s ease",
                };

                if (isClickable && cellEntries) {
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        // For now show the first entry; PM info is hinted in the modal slot field.
                        const entry = cellEntries[0];
                        setSelected(sessionContractToModalData(entry));
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                      }}
                      style={cellStyle}
                    >
                      {inner}
                    </button>
                  );
                }
                return (
                  <div key={i} style={cellStyle}>
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={{ position: "relative", display: "flex", gap: 10 }}>
        {status === "accepted" ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 20px", borderRadius: 999,
            background: "#10b981", color: "#fff",
            fontSize: 13, fontWeight: 800,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L20 7" />
            </svg>
            Plan accepted — added to your calendar
          </div>
        ) : status === "error" ? (
          <>
            <div style={{ fontSize: 12, color: "#fca5a5", padding: "10px 0" }}>
              Failed to save. Try again.
            </div>
            <button onClick={handleAccept} style={{
              background: "#F6B7A6", color: "#0F1B22", border: "none",
              borderRadius: 999, padding: "10px 22px", fontSize: 13, fontWeight: 800, cursor: "pointer",
            }}>
              Retry
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleAccept}
              disabled={status === "accepting"}
              style={{
                background: "#F6B7A6", color: "#0F1B22", border: "none",
                borderRadius: 999, padding: "10px 22px",
                fontSize: 13, fontWeight: 800, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8,
                opacity: status === "accepting" ? 0.7 : 1,
              }}
            >
              {status === "accepting" ? (
                <>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.3)", borderTopColor: "#0F1B22", animation: "spin 0.7s linear infinite" }} />
                  Saving...
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                  Accept plan
                </>
              )}
            </button>
            <button
              style={{
                background: "rgba(255,255,255,0.08)", color: "#fff",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 999, padding: "10px 18px",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}
              onClick={() => {
                const input = document.querySelector<HTMLInputElement>("input[placeholder]");
                if (input) input.focus();
              }}
            >
              Make changes
            </button>
          </>
        )}
      </div>

      {selected && (
        <PlannedWorkoutModal
          data={selected}
          open={true}
          onClose={() => setSelected(null)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
