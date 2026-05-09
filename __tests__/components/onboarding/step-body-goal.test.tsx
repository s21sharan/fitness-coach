import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StepBodyGoal } from "@/components/onboarding/step-body-goal";
import { getDefaultOnboardingData } from "@/lib/onboarding/types";

describe("StepBodyGoal", () => {
  it("renders all body goal cards", () => {
    render(<StepBodyGoal data={getDefaultOnboardingData()} onUpdate={() => {}} />);
    expect(screen.getByText("Cut")).toBeDefined();
    expect(screen.getByText("Bulk")).toBeDefined();
    expect(screen.getByText("Recomp")).toBeDefined();
    expect(screen.getByText("Custom goal")).toBeDefined();
  });

  it("calls onUpdate with lose_weight when Cut is selected", () => {
    const onUpdate = vi.fn();
    render(<StepBodyGoal data={getDefaultOnboardingData()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByText("Cut"));
    expect(onUpdate).toHaveBeenCalledWith({ bodyGoal: "lose_weight" });
  });

  it("calls onUpdate with gain_muscle when Bulk is selected", () => {
    const onUpdate = vi.fn();
    render(<StepBodyGoal data={getDefaultOnboardingData()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByText("Bulk"));
    expect(onUpdate).toHaveBeenCalledWith({ bodyGoal: "gain_muscle" });
  });

  it("calls onUpdate with maintain when Recomp is selected", () => {
    const onUpdate = vi.fn();
    render(<StepBodyGoal data={getDefaultOnboardingData()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByText("Recomp"));
    expect(onUpdate).toHaveBeenCalledWith({ bodyGoal: "maintain" });
  });

  it("calls onUpdate with other when Custom goal is clicked", () => {
    const onUpdate = vi.fn();
    render(<StepBodyGoal data={getDefaultOnboardingData()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByText("Custom goal"));
    expect(onUpdate).toHaveBeenCalledWith({ bodyGoal: "other" });
  });

  it("shows text input when other is selected", () => {
    const data = getDefaultOnboardingData();
    data.bodyGoal = "other";
    render(<StepBodyGoal data={data} onUpdate={() => {}} />);
    expect(screen.getByPlaceholderText("Describe your goal...")).toBeDefined();
  });
});
