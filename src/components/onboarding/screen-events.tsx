"use client";

import type { AthleteContextProfile } from "@/lib/onboarding/types";
import { EventList } from "./event-list";

interface ScreenEventsProps {
  profile: AthleteContextProfile;
  onUpdate: (updates: Partial<AthleteContextProfile>) => void;
}

export const SCREEN_EVENTS_TITLE = "Anything you're training toward?";
export const SCREEN_EVENTS_SUBTITLE =
  "Add the races or events on your radar. Skip if you're just base-building.";

export function ScreenEvents({ profile, onUpdate }: ScreenEventsProps) {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
      <EventList
        events={profile.events}
        onChange={(events) => onUpdate({ events, no_event: events.length === 0 ? profile.no_event : false })}
      />

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: 12,
          borderRadius: "var(--r-md)",
          border: "1px solid var(--line)",
          background: profile.no_event ? "var(--coral-soft)" : "#fff",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={profile.no_event}
          onChange={(e) =>
            onUpdate({
              no_event: e.target.checked,
              events: e.target.checked ? [] : profile.events,
            })
          }
        />
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
          I don't have an event yet — focus on base & body comp
        </span>
      </label>
    </div>
  );
}
