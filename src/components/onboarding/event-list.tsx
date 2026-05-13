"use client";

import { useState } from "react";
import {
  type AthleteEvent,
  type EventPriority,
  EVENT_DISTANCES,
  EVENT_SPORTS,
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

export function EventList({ events, onChange }: EventListProps) {
  const [editing, setEditing] = useState<string | null>(null);

  const addEvent = () => {
    const ev: AthleteEvent = {
      id: makeId(),
      name: "",
      sport_type: "running",
      distance: null,
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
        <EventCard
          key={ev.id}
          event={ev}
          isEditing={editing === ev.id}
          onEdit={() => setEditing(ev.id)}
          onPatch={(patch) => updateEvent(ev.id, patch)}
          onRemove={() => removeEvent(ev.id)}
        />
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

function EventCard({
  event: ev,
  isEditing,
  onEdit,
  onPatch,
  onRemove,
}: {
  event: AthleteEvent;
  isEditing: boolean;
  onEdit: () => void;
  onPatch: (patch: Partial<AthleteEvent>) => void;
  onRemove: () => void;
}) {
  const distancePresets = EVENT_DISTANCES[ev.sport_type ?? "running"] ?? ["Custom"];
  const usingCustom =
    ev.distance != null &&
    ev.distance !== "" &&
    !distancePresets.includes(ev.distance);

  return (
    <div
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
          onChange={(e) => onPatch({ name: e.target.value })}
          placeholder="Event name (e.g. SF Marathon)"
          style={{ ...inputStyle, fontSize: 16, fontWeight: 800 }}
          onFocus={onEdit}
        />
        <button
          type="button"
          onClick={onRemove}
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

      <div>
        <label style={labelStyle}>Sport</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {EVENT_SPORTS.map((s) => {
            const chosen = ev.sport_type === s.value;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => onPatch({ sport_type: s.value, distance: null })}
                style={{
                  padding: "7px 12px",
                  borderRadius: 999,
                  border: chosen ? "2px solid var(--ink)" : "1.5px solid var(--line)",
                  background: chosen ? "var(--ink)" : "#fff",
                  color: chosen ? "#fff" : "var(--ink)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>{s.emoji}</span>
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label style={labelStyle}>Distance</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {distancePresets.map((d) => {
            const chosen = !usingCustom && ev.distance === d;
            const isCustom = d === "Custom";
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  if (isCustom) {
                    onPatch({ distance: ev.distance && usingCustom ? ev.distance : "" });
                  } else {
                    onPatch({ distance: d });
                  }
                }}
                style={{
                  padding: "7px 13px",
                  borderRadius: 999,
                  border: chosen || (isCustom && usingCustom) ? "2px solid var(--ink)" : "1.5px solid var(--line)",
                  background: chosen || (isCustom && usingCustom) ? "var(--ink)" : "#fff",
                  color: chosen || (isCustom && usingCustom) ? "#fff" : "var(--ink)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "inherit",
                }}
              >
                {d}
              </button>
            );
          })}
        </div>
        {usingCustom && (
          <input
            type="text"
            value={ev.distance ?? ""}
            onChange={(e) => onPatch({ distance: e.target.value })}
            placeholder="Type your distance"
            style={{ ...inputStyle, marginTop: 8 }}
          />
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>Date</label>
          <input
            type="date"
            value={ev.event_date ?? ""}
            onChange={(e) => onPatch({ event_date: e.target.value || null })}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Goal time</label>
          <input
            type="text"
            value={ev.goal_time ?? ""}
            onChange={(e) => onPatch({ goal_time: e.target.value || null })}
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
              onClick={() => onPatch({ priority: p.value })}
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

      {isEditing && (
        <>
          <div>
            <label style={labelStyle}>Goal type</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {GOAL_TYPES.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => onPatch({ goal_type: g.value })}
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
              onChange={(e) => onPatch({ course_notes: e.target.value })}
              rows={2}
              placeholder="Hilly, hot, altitude…"
              style={{ ...inputStyle, resize: "vertical", minHeight: 60 }}
            />
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>
            <input
              type="checkbox"
              checked={ev.travel}
              onChange={(e) => onPatch({ travel: e.target.checked })}
            />
            Travel involved
          </label>
        </>
      )}

      {!isEditing && (
        <button
          type="button"
          onClick={onEdit}
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
  );
}
