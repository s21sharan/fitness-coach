"use client";

import { useMemo } from "react";
import {
  type AvailabilityWindow,
  DAY_LABELS,
  makeId,
} from "@/lib/onboarding/types";

interface DayWindowGridProps {
  windows: AvailabilityWindow[];
  onChange: (windows: AvailabilityWindow[]) => void;
}

const DEFAULT_WINDOWS: { id: string; label: string; start: string; end: string }[] = [
  { id: "morning", label: "Morning", start: "06:00", end: "10:00" },
  { id: "midday", label: "Midday", start: "10:00", end: "14:00" },
  { id: "afternoon", label: "Afternoon", start: "14:00", end: "18:00" },
  { id: "evening", label: "Evening", start: "18:00", end: "22:00" },
];

export function DayWindowGrid({ windows, onChange }: DayWindowGridProps) {
  const grid = useMemo(() => buildGrid(windows), [windows]);

  const toggle = (day: number, slot: typeof DEFAULT_WINDOWS[number]) => {
    const existing = windows.find(
      (w) =>
        w.day_of_week === day && w.start_time === slot.start && w.end_time === slot.end
    );
    if (existing) {
      onChange(windows.filter((w) => w.id !== existing.id));
    } else {
      onChange([
        ...windows,
        {
          id: makeId(),
          day_of_week: day,
          start_time: slot.start,
          end_time: slot.end,
          max_duration_min: 90,
          locations: [],
        },
      ]);
    }
  };

  const updateMaxDuration = (day: number, minutes: number | null) => {
    const updated = windows.map((w) =>
      w.day_of_week === day ? { ...w, max_duration_min: minutes } : w
    );
    onChange(updated);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "70px repeat(4, 1fr) 90px",
          gap: 6,
          alignItems: "center",
          fontSize: 11,
          fontWeight: 700,
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        <span></span>
        {DEFAULT_WINDOWS.map((s) => (
          <span key={s.id} style={{ textAlign: "center" }}>{s.label}</span>
        ))}
        <span style={{ textAlign: "center" }}>Max min</span>
      </div>

      {DAY_LABELS.map((dayLabel, day) => {
        const dayWindows = windows.filter((w) => w.day_of_week === day);
        const maxDur = dayWindows[0]?.max_duration_min ?? null;
        return (
          <div
            key={dayLabel}
            style={{
              display: "grid",
              gridTemplateColumns: "70px repeat(4, 1fr) 90px",
              gap: 6,
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "var(--ink)",
              }}
            >
              {dayLabel}
            </span>
            {DEFAULT_WINDOWS.map((slot) => {
              const filled = !!grid[day]?.[slot.id];
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => toggle(day, slot)}
                  style={{
                    height: 36,
                    borderRadius: "var(--r-md)",
                    border: filled ? "2px solid var(--ink)" : "1.5px solid var(--line)",
                    background: filled ? "var(--mint-soft)" : "#fff",
                    color: "var(--ink)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 12,
                    fontWeight: 700,
                    transition: "all 0.12s",
                  }}
                >
                  {filled ? "✓" : "+"}
                </button>
              );
            })}
            <input
              type="number"
              value={maxDur ?? ""}
              onChange={(e) =>
                updateMaxDuration(day, e.target.value ? Number(e.target.value) : null)
              }
              placeholder="90"
              min={15}
              max={360}
              disabled={dayWindows.length === 0}
              style={{
                height: 36,
                width: "100%",
                borderRadius: "var(--r-md)",
                border: "1.5px solid var(--line)",
                padding: "0 8px",
                fontSize: 13,
                fontWeight: 700,
                textAlign: "center",
                background: dayWindows.length === 0 ? "var(--bg-2)" : "#fff",
                outline: "none",
                fontFamily: "inherit",
                color: "var(--ink)",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

function buildGrid(windows: AvailabilityWindow[]) {
  const grid: Record<number, Record<string, boolean>> = {};
  for (const w of windows) {
    const slot = DEFAULT_WINDOWS.find((s) => s.start === w.start_time && s.end === w.end_time);
    if (!slot) continue;
    grid[w.day_of_week] = grid[w.day_of_week] || {};
    grid[w.day_of_week][slot.id] = true;
  }
  return grid;
}
