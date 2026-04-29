import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StepBodyGoal } from "@/components/onboarding/step-body-goal";
import { getDefaultOnboardingData } from "@/lib/onboarding/types";

describe("StepBodyGoal", () => {
  it("renders all body goal options", () => {
    render(<StepBodyGoal data={getDefaultOnboardingData()} onUpdate={() => {}} />);
    expect(screen.getByText("Gain Muscle")).toBeDefined();
    expect(screen.getByText("Lose Weight")).toBeDefined();
    expect(screen.getByText("Maintain / Recomp")).toBeDefined();
    expect(screen.getByText("Other")).toBeDefined();
  });

  it("calls onUpdate when an option is selected", () => {
    const onUpdate = vi.fn();
    render(<StepBodyGoal data={getDefaultOnboardingData()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByText("Gain Muscle"));
    expect(onUpdate).toHaveBeenCalledWith({ bodyGoal: "gain_muscle" });
  });

  it("shows text input when Other is selected", () => {
    const data = getDefaultOnboardingData();
    data.bodyGoal = "other";
    render(<StepBodyGoal data={data} onUpdate={() => {}} />);
    expect(screen.getByPlaceholderText("Describe your goal...")).toBeDefined();
  });
});
