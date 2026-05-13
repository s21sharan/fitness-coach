import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScreenStrength } from "@/components/onboarding/screen-strength";
import { getDefaultAthleteProfile, type AthleteContextProfile } from "@/lib/onboarding/types";

function renderScreen(profile: AthleteContextProfile = getDefaultAthleteProfile()) {
  const onUpdate = vi.fn();
  const utils = render(<ScreenStrength profile={profile} onUpdate={onUpdate} />);
  return { ...utils, onUpdate };
}

describe("ScreenStrength", () => {
  it("does not surface a separate lifting-goal section (handled on goals screen)", () => {
    renderScreen();
    expect(screen.queryByText(/Lifting goal/i)).toBeNull();
  });

  it("shows the split, leg-interference, movement style, and key lift sections", () => {
    renderScreen();
    expect(screen.getByText(/Preferred split/i)).toBeDefined();
    expect(screen.getByText(/Lower-body tolerance/i)).toBeDefined();
    expect(screen.getByText(/Movement style/i)).toBeDefined();
    expect(screen.getByText(/Key lifts/i)).toBeDefined();
  });

  it("captures movement style multi-select", () => {
    const { onUpdate } = renderScreen();
    fireEvent.click(screen.getByText(/Unilateral/));
    const call = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0];
    expect(call.sports.lift.sport_specific.movement_style).toContain("unilateral");
  });
});
