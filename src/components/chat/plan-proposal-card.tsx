"use client";

import { useState } from "react";

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
  raw_blocks?: unknown[];
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

const SESSION_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  chest:  { bg: "#fef9c3", border: "#eab308", text: "#854d0e" },
  back:   { bg: "#fef9c3", border: "#eab308", text: "#854d0e" },
  arm:    { bg: "#fce7f3", border: "#ec4899", text: "#9d174d" },
  shoulder: { bg: "#fce7f3", border: "#ec4899", text: "#9d174d" },
  legs:   { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af" },
  leg:    { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af" },
  run:    { bg: "#dcfce7", border: "#22c55e", text: "#166534" },
  swim:   { bg: "#e0e7ff", border: "#6366f1", text: "#3730a3" },
  bike:   { bg: "#ffedd5", border: "#f97316", text: "#9a3412" },
  brick:  { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" },
  rest:   { bg: "#f3f4f6", border: "#d1d5db", text: "#6b7280" },
};

function getSessionColor(session: string) {
  const lower = session.toLowerCase();
  for (const [key, color] of Object.entries(SESSION_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return { bg: "#f0fdf4", border: "#86efac", text: "#166534" };
}

function formatSplitType(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function PlanProposalCard({ data }: { data: PlanProposalData }) {
  const [status, setStatus] = useState<"pending" | "accepting" | "accepted" | "error">("pending");

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
      if (res.ok) {
        setStatus("accepted");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <div style={{
      background: "linear-gradient(135deg, #0F1B22 0%, #1a2d3a 100%)",
      borderRadius: 20, padding: 24, color: "#fff",
      position: "relative", overflow: "hidden",
    }}>
      {/* Decorative blobs */}
      <div style={{ position: "absolute", top: -40, right: -30, width: 140, height: 140, borderRadius: "50%", background: "#F6B7A6", opacity: 0.15, filter: "blur(40px)" }} />
      <div style={{ position: "absolute", bottom: -30, left: -20, width: 120, height: 120, borderRadius: "50%", background: "#B7DDEA", opacity: 0.15, filter: "blur(40px)" }} />

      {/* Header */}
      <div style={{ position: "relative" }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#F6B7A6", marginBottom: 6 }}>
          {status === "accepted" ? "✅ Plan Active" : "✨ Proposed Training Plan"}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>
          {formatSplitType(data.split_type)}
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 16 }}>
          {data.week_layouts ? `${data.week_layouts.length} weeks` : "2 weeks"} · {status === "accepted" ? "added to your calendar" : "awaiting your approval"}
        </div>
      </div>

      {/* Reasoning */}
      <div style={{
        position: "relative", fontSize: 13, lineHeight: 1.55,
        color: "rgba(255,255,255,0.7)", marginBottom: 20,
        padding: "12px 14px", background: "rgba(255,255,255,0.06)",
        borderRadius: 12, borderLeft: "3px solid #F6B7A6",
      }}>
        {data.reasoning}
      </div>

      {/* Risks */}
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

      {/* Weekly layout grid */}
      <div style={{ position: "relative", marginBottom: 20 }}>
        {(data.week_layouts && data.week_layouts.length > 0
          ? data.week_layouts
          : [{ week_number: 1, week_focus: "", days: data.weekly_layout }]
        ).map((week) => (
          <div key={week.week_number} style={{ position: "relative", marginBottom: 16 }}>
            {data.week_layouts && data.week_layouts.length > 1 && (
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>
                Week {week.week_number}
                {week.week_focus && (
                  <span style={{ fontWeight: 400, marginLeft: 8, fontSize: 10 }}>{week.week_focus}</span>
                )}
              </div>
            )}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6,
            }}>
              {week.days.map((d, i) => {
                const color = getSessionColor(d.session);
                return (
                  <div key={i} style={{
                    background: color.bg, borderRadius: 10,
                    padding: "10px 6px", textAlign: "center",
                    border: `1.5px solid ${color.border}`,
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: color.text, opacity: 0.7, marginBottom: 4 }}>
                      {d.day}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: color.text, lineHeight: 1.2, minHeight: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {d.session.length > 25 ? d.session.slice(0, 22) + "\u2026" : d.session}
                    </div>
                    {d.notes && (
                      <div style={{ fontSize: 8, color: color.text, opacity: 0.6, marginTop: 4, lineHeight: 1.3 }}>
                        {d.notes.length > 30 ? d.notes.slice(0, 30) + "\u2026" : d.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ position: "relative", display: "flex", gap: 10 }}>
        {status === "accepted" ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 20px", borderRadius: 999,
            background: "#22c55e", color: "#fff",
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
                background: "rgba(255,255,255,0.1)", color: "#fff",
                border: "1px solid rgba(255,255,255,0.15)",
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
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
