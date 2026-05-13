import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScreenInjury } from "@/components/onboarding/screen-injury";
import { getDefaultAthleteProfile, type AthleteContextProfile } from "@/lib/onboarding/types";

function renderScreen(profile: AthleteContextProfile = getDefaultAthleteProfile()) {
  const onUpdate = vi.fn();
  const utils = render(<ScreenInjury profile={profile} onUpdate={onUpdate} />);
  return { ...utils, onUpdate };
}

describe("ScreenInjury (body areas)", () => {
  it("shows general body-area chips", () => {
    renderScreen();
    expect(screen.getByText(/Foot \/ ankle/i)).toBeDefined();
    expect(screen.getByText(/Knee/i)).toBeDefined();
    expect(screen.getByText(/Lower back/i)).toBeDefined();
  });

  it("opens a description card after selecting an area", () => {
    const profile = {
      ...getDefaultAthleteProfile(),
      injuries: [
        {
          id: "i1",
          area: "foot_ankle",
          description: null,
          current_pain_level: 0,
          history: true,
          triggers: [],
          affecting_training: false,
        },
      ],
    };
    renderScreen(profile);
    expect(screen.getByText(/specific issue/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/plantar/i)).toBeDefined();
  });

  it("updates the description when typing", () => {
    const profile = {
      ...getDefaultAthleteProfile(),
      injuries: [
        {
          id: "i1",
          area: "foot_ankle",
          description: null,
          current_pain_level: 0,
          history: true,
          triggers: [],
          affecting_training: false,
        },
      ],
    };
    const { onUpdate } = renderScreen(profile);
    const input = screen.getByPlaceholderText(/plantar/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "plantar fasciitis" } });
    const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0];
    expect(lastCall.injuries[0].description).toBe("plantar fasciitis");
  });
});
