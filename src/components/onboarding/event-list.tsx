"use client";

import { useState } from "react";
import {
  type AthleteEvent,
  type EventPriority,
  makeId,
} from "@/lib/onboarding/types";
import { inputStyle, labelStyle } from "./shared-styles";

interface EventListProps {
  events: AthleteEvent[];
  onChange: (events: AthleteEvent[]) => void;
}

const PRIORITIES: { value: EventPriority; label: string; description: string }[] = [
  { value: "A", label: "A", description: "Goal race" },
  { value: "B", label: "B", description: "Tune-up" },
  { value: "C", label: "C", description: "Training day" },
];

const GOAL_TYPES = [
  { value: "finish", label: "Finish" },
  { value: "pr", label: "Set a PR" },
  { value: "time", label: "Hit a time goal" },
  { value: "podium", label: "Podium" },
  { value: "qualify", label: "Qualify" },
  { value: "complete_comfortably", label: "Complete comfortably" },
];

const SPORT_TYPES = [
  { value: "running", label: "Running" },
  { value: "triathlon", label: "Triathlon" },
  { value: "cycling", label: "Cycling" },
  { value: "powerlifting", label: "Powerlifting meet" },
  { value: "hypertrophy", label: "Hypertrophy phase" },
  { value: "other", label: "Other" },
];

export function EventList({ events, onChange }: EventListProps) {
  const [editing, setEditing] = useState<string | null>(null);

  const addEvent = () => {
    const ev: AthleteEvent = {
      id: makeId(),
      name: "",
      sport_type: "running",
      distance: "",
      event_date: null,
      priority: "A",
      goal_type: "finish",
      goal_time: null,
      course_notes: "",
      travel: false,
    };
    onChange([...events, ev]);
    setEditing(ev.id);
  };

  const updateEvent = (id: string, patch: Partial<AthleteEvent>) => {
    onChange(events.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const removeEvent = (id: string) => {
    onChange(events.filter((e) => e.id !== id));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {events.map((ev) => (
        <div
          key={ev.id}
          style={{
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-lg)",
            padding: 18,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <input
              type="text"
              value={ev.name}
              onChange={(e) => updateEvent(ev.id, { name: e.target.value })}
              placeholder="Event name (e.g. SF Marathon)"
              style={{ ...inputStyle, fontSize: 16, fontWeight: 800 }}
              onFocus={() => setEditing(ev.id)}
            />
            <button
              type="button"
              onClick={() => removeEvent(ev.id)}
              style={{
                padding: "8px 10px",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--line)",
                background: "transparent",
                cursor: "pointer",
                color: "var(--muted)",
                fontFamily: "inherit",
                fontSize: 13,
              }}
              aria-label="Remove event"
            >
              ✕
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Sport</label>
              <select
                value={ev.sport_type ?? ""}
                onChange={(e) => updateEvent(ev.id, { sport_type: e.target.value })}
                style={inputStyle}
              >
                {SPORT_TYPES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Distance</label>
              <input
                type="text"
                value={ev.distance ?? ""}
                onChange={(e) => updateEvent(ev.id, { distance: e.target.value })}
                placeholder="marathon / 70.3 / 10K…"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Date</label>
              <input
                type="date"
                value={ev.event_date ?? ""}
                onChange={(e) => updateEvent(ev.id, { event_date: e.target.value || null })}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Goal time</label>
              <input
                type="text"
                value={ev.goal_time ?? ""}
                onChange={(e) => updateEvent(ev.id, { goal_time: e.target.value || null })}
                placeholder="3:50:00"
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Priority</label>
            <div style={{ display: "flex", gap: 8 }}>
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => updateEvent(ev.id, { priority: p.value })}
                  style={{
                    flex: 1,
                    padding: "10px 8px",
                    borderRadius: "var(--r-md)",
                    border: ev.priority === p.value ? "2px solid var(--ink)" : "1.5px solid var(--line)",
                    background: ev.priority === p.value ? "var(--ink)" : "#fff",
                    color: ev.priority === p.value ? "#fff" : "var(--ink)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{p.label}</div>
                  <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.8 }}>{p.description}</div>
                </button>
              ))}
            </div>
          </div>

          {editing === ev.id && (
            <>
              <div>
                <label style={labelStyle}>Goal type</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {GOAL_TYPES.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => updateEvent(ev.id, { goal_type: g.value })}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 999,
                        border: ev.goal_type === g.value ? "2px solid var(--ink)" : "1.5px solid var(--line)",
                        background: ev.goal_type === g.value ? "var(--ink)" : "#fff",
                        color: ev.goal_type === g.value ? "#fff" : "var(--ink)",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={labelStyle}>Course notes (optional)</label>
                <textarea
                  value={ev.course_notes ?? ""}
                  onChange={(e) => updateEvent(ev.id, { course_notes: e.target.value })}
                  rows={2}
                  placeholder="Hilly, hot, altitude…"
                  style={{ ...inputStyle, resize: "vertical", minHeight: 60 }}
                />
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>
                <input
                  type="checkbox"
                  checked={ev.travel}
                  onChange={(e) => updateEvent(ev.id, { travel: e.target.checked })}
                />
                Travel involved
              </label>
            </>
          )}

          {editing !== ev.id && (
            <button
              type="button"
              onClick={() => setEditing(ev.id)}
              style={{
                alignSelf: "flex-start",
                fontSize: 12,
                color: "var(--ink-2)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: 700,
              }}
            >
              + More options
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={addEvent}
        style={{
          padding: "12px 16px",
          borderRadius: "var(--r-md)",
          border: "1.5px dashed var(--line)",
          background: "transparent",
          fontSize: 13,
          fontWeight: 700,
          color: "var(--ink-2)",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        + Add event
      </button>
    </div>
  );
}
