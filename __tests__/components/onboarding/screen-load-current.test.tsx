import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ScreenLoadCurrent } from "@/components/onboarding/screen-load-current";
import { getDefaultAthleteProfile, type AthleteContextProfile } from "@/lib/onboarding/types";

const fetchAgg = vi.fn();

vi.mock("@/app/onboarding/actions", () => ({
  fetchAggregatedLoad: () => fetchAgg(),
}));

beforeEach(() => {
  fetchAgg.mockReset();
});

function profileWithSports(): AthleteContextProfile {
  const p = getDefaultAthleteProfile();
  p.sports.run = { ...p.sports.run, enabled: true, is_planned: true };
  p.sports.lift = { ...p.sports.lift, enabled: true, is_planned: true };
  return p;
}

describe("ScreenLoadCurrent", () => {
  it("renders message when no sports planned", () => {
    fetchAgg.mockResolvedValue({ success: false, load: null });
    const onUpdate = vi.fn();
    render(<ScreenLoadCurrent profile={getDefaultAthleteProfile()} onUpdate={onUpdate} />);
    expect(screen.getByText(/Pick a sport/)).toBeDefined();
  });

  it("pre-fills run volume from synced data", async () => {
    fetchAgg.mockResolvedValue({
      success: true,
      load: {
        windowDays: 56,
        run: { weekly_avg: 25, weekly_peak: 35, longest_session: 10, weeks_observed: 8, unit: "miles" },
        bike: null,
        swim: null,
        lift: null,
        nutrition: null,
        recovery: null,
        hasAnyData: true,
      },
    });
    const onUpdate = vi.fn();
    render(<ScreenLoadCurrent profile={profileWithSports()} onUpdate={onUpdate} />);

    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    const call = onUpdate.mock.calls.find(([arg]) => arg.sports?.run?.current_volume);
    expect(call).toBeDefined();
    expect(call[0].sports.run.current_volume.weekly_miles).toBe(25);
  });

  it("shows manual-entry hint when no synced data", async () => {
    fetchAgg.mockResolvedValue({
      success: true,
      load: {
        windowDays: 56,
        run: null,
        bike: null,
        swim: null,
        lift: null,
        nutrition: null,
        recovery: null,
        hasAnyData: false,
      },
    });
    render(<ScreenLoadCurrent profile={profileWithSports()} onUpdate={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText(/No synced data yet/)).toBeDefined()
    );
  });
});
