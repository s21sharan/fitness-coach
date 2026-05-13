import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/app/onboarding/actions", () => ({
  fetchAggregatedLoad: vi.fn(() =>
    Promise.resolve({ success: true, load: { hasAnyData: false, run: null, bike: null, swim: null, lift: null } })
  ),
}));

import { ScreenSports } from "@/components/onboarding/screen-sports";
import { getDefaultAthleteProfile, type AthleteContextProfile } from "@/lib/onboarding/types";

function renderScreen(profile: AthleteContextProfile = getDefaultAthleteProfile()) {
  const onUpdate = vi.fn();
  const utils = render(<ScreenSports profile={profile} onUpdate={onUpdate} />);
  return { ...utils, onUpdate };
}

describe("ScreenSports (merged)", () => {
  it("lists the four core sports", () => {
    renderScreen();
    expect(screen.getByText("Running")).toBeDefined();
    expect(screen.getByText("Cycling")).toBeDefined();
    expect(screen.getByText("Swimming")).toBeDefined();
    expect(screen.getByText("Lifting")).toBeDefined();
  });

  it("toggles a sport as planned when the toggle is clicked", async () => {
    const { onUpdate } = renderScreen();
    await waitFor(() => {
      expect(screen.getAllByText(/Not training/).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText("Not training")[0]);
    expect(onUpdate).toHaveBeenCalled();
    const call = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0];
    expect(Object.values(call.sports).some((s: { is_planned: boolean }) => s.is_planned)).toBe(true);
  });

  it("does not show target picker when sport is not planned", () => {
    renderScreen();
    // Target presets like "20-30" should not appear until the sport is planned.
    expect(screen.queryByText("20-30")).toBeNull();
  });

  it("shows ramp target buckets for planned sports", () => {
    const profile = {
      ...getDefaultAthleteProfile(),
      sports: {
        ...getDefaultAthleteProfile().sports,
        run: { ...getDefaultAthleteProfile().sports.run, is_planned: true, enabled: true },
      },
    } as AthleteContextProfile;
    renderScreen(profile);
    expect(screen.getByText("20-30")).toBeDefined();
    expect(screen.getByText("70+")).toBeDefined();
    expect(screen.getAllByText("Not sure").length).toBeGreaterThan(0);
  });

  it("does not show 'Primary' or 'Limiter' labels anymore", () => {
    renderScreen();
    expect(screen.queryByText("Primary")).toBeNull();
    expect(screen.queryByText("Limiter")).toBeNull();
  });
});
