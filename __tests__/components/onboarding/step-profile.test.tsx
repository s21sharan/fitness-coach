import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StepProfile } from "@/components/onboarding/step-profile";
import { getDefaultOnboardingData } from "@/lib/onboarding/types";

describe("StepProfile", () => {
  it("renders all profile fields", () => {
    render(<StepProfile data={getDefaultOnboardingData()} onUpdate={() => {}} />);
    expect(screen.getByText("Height")).toBeDefined();
    expect(screen.getByPlaceholderText("5")).toBeDefined(); // feet
    expect(screen.getByPlaceholderText("10")).toBeDefined(); // inches
    expect(screen.getByLabelText("Weight (lbs)")).toBeDefined();
    expect(screen.getByLabelText("Age")).toBeDefined();
    expect(screen.getByText("Sex")).toBeDefined();
  });

  it("calls onUpdate with cm when feet/inches change", () => {
    const onUpdate = vi.fn();
    render(<StepProfile data={getDefaultOnboardingData()} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByPlaceholderText("5"), { target: { value: "5" } });
    // 5ft 0in = 60 inches = 152.4cm -> rounds to 152
    expect(onUpdate).toHaveBeenCalledWith({ height: 152 });
  });

  it("shows total inches when height is set", () => {
    const data = getDefaultOnboardingData();
    data.height = 178; // ~70 inches = 5'10"
    render(<StepProfile data={data} onUpdate={() => {}} />);
    expect(screen.getByText("70 inches total")).toBeDefined();
  });

  it("calls onUpdate when age changes", () => {
    const onUpdate = vi.fn();
    render(<StepProfile data={getDefaultOnboardingData()} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByLabelText("Age"), { target: { value: "25" } });
    expect(onUpdate).toHaveBeenCalledWith({ age: 25 });
  });
});
