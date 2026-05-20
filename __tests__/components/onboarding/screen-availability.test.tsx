import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScreenAvailability } from "@/components/onboarding/screen-availability";
import { getDefaultAthleteProfile, type AthleteContextProfile } from "@/lib/onboarding/types";

function renderScreen(profile: AthleteContextProfile = getDefaultAthleteProfile()) {
  const onUpdate = vi.fn();
  const utils = render(<ScreenAvailability profile={profile} onUpdate={onUpdate} />);
  return { ...utils, onUpdate };
}

describe("ScreenAvailability", () => {
  it("renders all 7 day rows", () => {
    renderScreen();
    expect(screen.getByText("Mon")).toBeDefined();
    expect(screen.getByText("Sun")).toBeDefined();
  });

  it("toggles an AM block on click", () => {
    const { onUpdate } = renderScreen();
    const amButtons = screen.getAllByText("AM");
    fireEvent.click(amButtons[0]);
    expect(onUpdate).toHaveBeenCalled();
    const call = onUpdate.mock.calls[0][0];
    expect(call.availability_windows).toHaveLength(1);
    expect(call.availability_windows[0].day_of_week).toBe(0);
    expect(call.availability_windows[0].start_time).toBe("06:00");
  });

  it("toggles a scheduling rule", () => {
    const { onUpdate } = renderScreen();
    fireEvent.click(screen.getByText("Keep one full rest day"));
    const call = onUpdate.mock.calls[0][0];
    expect(call.availability_rules[0].rule_key).toBe("keep_one_rest_day");
  });

  it("removes a previously selected rule", () => {
    const profile = {
      ...getDefaultAthleteProfile(),
      availability_rules: [{ id: "r1", rule_key: "keep_one_rest_day", params: null }],
    };
    const { onUpdate } = renderScreen(profile);
    fireEvent.click(screen.getByText("Keep one full rest day"));
    const call = onUpdate.mock.calls[0][0];
    expect(call.availability_rules).toEqual([]);
  });

  it("renders the coach prompt for availability", () => {
    renderScreen();
    expect(screen.getByText(/weird scheduling constraints/)).toBeDefined();
  });
});
