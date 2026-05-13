import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScreenGoals } from "@/components/onboarding/screen-goals";
import { getDefaultAthleteProfile, type AthleteContextProfile } from "@/lib/onboarding/types";

function renderScreen(profile: AthleteContextProfile = getDefaultAthleteProfile()) {
  const onUpdate = vi.fn();
  const utils = render(<ScreenGoals profile={profile} onUpdate={onUpdate} />);
  return { ...utils, onUpdate };
}

describe("ScreenGoals", () => {
  it("renders goal chips", () => {
    renderScreen();
    expect(screen.getByText("Build muscle")).toBeDefined();
    expect(screen.getByText("Build speed")).toBeDefined();
  });

  it("toggles a goal and appends to rank", () => {
    const { onUpdate } = renderScreen();
    fireEvent.click(screen.getByText("Build speed"));
    expect(onUpdate).toHaveBeenCalled();
    const call = onUpdate.mock.calls[0][0];
    expect(call.goal_keys).toContain("build_speed");
    expect(call.goal_rank).toContain("build_speed");
  });

  it("removes goal from rank when deselected", () => {
    const profile = {
      ...getDefaultAthleteProfile(),
      goal_keys: ["build_speed"] as const,
      goal_rank: ["build_speed"] as const,
    };
    const { onUpdate } = renderScreen(profile as unknown as AthleteContextProfile);
    const chips = screen.getAllByText("Build speed");
    const chipButton = (chips[0] as HTMLElement).closest("button") as HTMLElement;
    fireEvent.click(chipButton);
    const call = onUpdate.mock.calls[0][0];
    expect(call.goal_keys).not.toContain("build_speed");
    expect(call.goal_rank).not.toContain("build_speed");
  });

  it("selects a primary optimization", () => {
    const { onUpdate } = renderScreen();
    fireEvent.click(screen.getByText("Race performance"));
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ primary_optimization: "race_performance" })
    );
  });

  it("shows chat capture coach prompt", () => {
    renderScreen();
    expect(screen.getByText(/Coach prompt/)).toBeDefined();
    expect(screen.getByPlaceholderText(/Sub-4 marathon/)).toBeDefined();
  });
});
