"use client";

import { useState } from "react";

interface BlockProposalData {
  success: boolean;
  block_id: string;
  block_type: string;
  block_label: string;
  block_number: number;
  week_count: number;
  start_date: string;
  end_date: string;
  narrative: string;
  risks: string[];
  week_layouts: Array<{
    week_number: number;
    week_focus: string;
    days: Array<{
      day_label: string;
      am_session: string | null;
      pm_session: string | null;
      is_rest: boolean;
    }>;
  }>;
  raw_blocks: unknown[];
}

const SESSION_COLORS: Record<string, string> = {
  push: "#ef4444",
  pull: "#3b82f6",
  legs: "#22c55e",
  upper: "#8b5cf6",
  lower: "#f59e0b",
  run: "#06b6d4",
  ride: "#f97316",
  swim: "#0ea5e9",
  rest: "#d1d5db",
};

function getSessionColor(session: string | null): string {
  if (!session) return SESSION_COLORS.rest;
  const lower = session.toLowerCase();
  for (const [key, color] of Object.entries(SESSION_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return "#6b7280";
}

const BLOCK_TYPE_LABELS: Record<string, string> = {
  base: "Base",
  build: "Build",
  peak: "Peak",
  taper: "Taper",
  accumulation: "Accumulation",
  intensification: "Intensification",
  deload: "Deload",
};

export function BlockProposalCard({ data }: { data: BlockProposalData }) {
  const [accepted, setAccepted] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const res = await fetch("/api/block/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          block_id: data.block_id,
          raw_blocks: data.raw_blocks,
        }),
      });
      if (res.ok) setAccepted(true);
    } finally {
      setAccepting(false);
    }
  };

  if (accepted) {
    return (
      <div style={{
        padding: 16, borderRadius: 12, background: "#f0fdf4",
        border: "1px solid #bbf7d0", fontSize: 13, color: "#15803d",
      }}>
        {data.block_label} accepted and scheduled.
      </div>
    );
  }

  const typeLabel = BLOCK_TYPE_LABELS[data.block_type] || data.block_type;

  return (
    <div style={{
      borderRadius: 12, border: "1px solid #e5e7eb",
      background: "#fff", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px",
        background: "linear-gradient(135deg, #f8fafc, #f1f5f9)",
        borderBottom: "1px solid #e5e7eb",
      }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>
          {typeLabel} Block
          <span style={{ fontWeight: 400, color: "#6b7280", marginLeft: 8 }}>
            {data.week_count} week{data.week_count !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
          {data.narrative}
        </div>
      </div>

      {/* Week layouts */}
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {data.week_layouts.map((week) => (
          <div key={week.week_number}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
              Week {week.week_number}: {week.week_focus}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {week.days.map((day) => {
                const session = day.am_session || day.pm_session;
                const hasTwoSessions = day.am_session && day.pm_session;
                return (
                  <div key={day.day_label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 3 }}>
                      {day.day_label}
                    </div>
                    <div style={{
                      height: hasTwoSessions ? 32 : 20,
                      borderRadius: 4,
                      background: day.is_rest ? "#f3f4f6" : getSessionColor(session),
                      opacity: day.is_rest ? 0.5 : 0.8,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                    }}>
                      {hasTwoSessions && (
                        <div style={{
                          height: "50%", borderRadius: "4px 4px 0 0",
                          background: getSessionColor(day.am_session),
                          opacity: 0.9,
                        }} />
                      )}
                    </div>
                    <div style={{
                      fontSize: 9, color: "#6b7280", marginTop: 2,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {day.is_rest ? "Rest" : (session || "").split("\u2014")[0].trim().slice(0, 12)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Risks */}
      {data.risks.length > 0 && (
        <div style={{ padding: "0 16px 12px", fontSize: 11, color: "#92400e" }}>
          {data.risks.map((risk, i) => (
            <div key={i} style={{ marginBottom: 2 }}>{"\u26A0"} {risk}</div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{
        padding: "12px 16px", borderTop: "1px solid #e5e7eb",
        display: "flex", gap: 8,
      }}>
        <button
          onClick={handleAccept}
          disabled={accepting}
          className="btn-coral"
          style={{ padding: "8px 16px", fontSize: 13 }}
        >
          {accepting ? "Accepting..." : "Accept Block"}
        </button>
        <button
          onClick={() => {
            const input = document.querySelector<HTMLInputElement>("input[type=text]");
            input?.focus();
          }}
          style={{
            padding: "8px 16px", fontSize: 13, borderRadius: 8,
            border: "1px solid #e5e7eb", background: "#fff",
            color: "#374151", cursor: "pointer",
          }}
        >
          Make changes
        </button>
      </div>
    </div>
  );
}
