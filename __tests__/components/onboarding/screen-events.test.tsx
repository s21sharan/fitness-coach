import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScreenEvents } from "@/components/onboarding/screen-events";
import { getDefaultAthleteProfile, type AthleteContextProfile } from "@/lib/onboarding/types";

function renderScreen(profile: AthleteContextProfile = getDefaultAthleteProfile()) {
  const onUpdate = vi.fn();
  const utils = render(<ScreenEvents profile={profile} onUpdate={onUpdate} />);
  return { ...utils, onUpdate };
}

describe("ScreenEvents", () => {
  it("shows the no-event toggle", () => {
    renderScreen();
    expect(screen.getByText(/don't have an event yet/)).toBeDefined();
  });

  it("adds a blank event when clicking add", () => {
    const { onUpdate } = renderScreen();
    fireEvent.click(screen.getByText("+ Add event"));
    expect(onUpdate).toHaveBeenCalled();
    const call = onUpdate.mock.calls[0][0];
    expect(call.events).toHaveLength(1);
    expect(call.events[0].name).toBe("");
    expect(call.events[0].priority).toBe("A");
  });

  it("toggles no_event flag", () => {
    const { onUpdate } = renderScreen();
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    const call = onUpdate.mock.calls[0][0];
    expect(call.no_event).toBe(true);
  });

  it("renders existing events", () => {
    const profile = {
      ...getDefaultAthleteProfile(),
      events: [
        {
          id: "e1",
          name: "Hometown 10K",
          sport_type: "running",
          distance: "10K",
          event_date: "2026-08-01",
          priority: "B" as const,
          goal_type: "pr",
          goal_time: "40:00",
          course_notes: null,
          travel: false,
        },
      ],
    };
    renderScreen(profile);
    expect(screen.getByDisplayValue("Hometown 10K")).toBeDefined();
  });

  it("shows running distance presets when running sport is chosen", () => {
    const profile = {
      ...getDefaultAthleteProfile(),
      events: [
        {
          id: "e1",
          name: "Test",
          sport_type: "running",
          distance: null,
          event_date: null,
          priority: "A" as const,
          goal_type: "finish",
          goal_time: null,
          course_notes: null,
          travel: false,
        },
      ],
    };
    renderScreen(profile);
    expect(screen.getByText("Marathon")).toBeDefined();
    expect(screen.getByText("Half marathon")).toBeDefined();
  });

  it("shows triathlon distance presets when triathlon is chosen", () => {
    const profile = {
      ...getDefaultAthleteProfile(),
      events: [
        {
          id: "e1",
          name: "Test",
          sport_type: "triathlon",
          distance: null,
          event_date: null,
          priority: "A" as const,
          goal_type: "finish",
          goal_time: null,
          course_notes: null,
          travel: false,
        },
      ],
    };
    renderScreen(profile);
    expect(screen.getByText("70.3 / Half-Iron")).toBeDefined();
    expect(screen.getByText("140.6 / Ironman")).toBeDefined();
  });
});
