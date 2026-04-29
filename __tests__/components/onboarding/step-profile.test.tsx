import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StepProfile } from "@/components/onboarding/step-profile";
import { getDefaultOnboardingData } from "@/lib/onboarding/types";

describe("StepProfile", () => {
  it("renders all profile fields", () => {
    render(<StepProfile data={getDefaultOnboardingData()} onUpdate={() => {}} />);
    expect(screen.getByLabelText("Height (cm)")).toBeDefined();
    expect(screen.getByLabelText("Weight (lbs)")).toBeDefined();
    expect(screen.getByLabelText("Age")).toBeDefined();
    expect(screen.getByText("Sex")).toBeDefined();
  });

  it("calls onUpdate when a field changes", () => {
    const onUpdate = vi.fn();
    render(<StepProfile data={getDefaultOnboardingData()} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByLabelText("Age"), { target: { value: "25" } });
    expect(onUpdate).toHaveBeenCalledWith({ age: 25 });
  });
});
