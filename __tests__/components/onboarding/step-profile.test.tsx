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
    expect(screen.getByPlaceholderText("175")).toBeDefined(); // weight
    expect(screen.getByPlaceholderText("25")).toBeDefined(); // age
    expect(screen.getByText("Sex")).toBeDefined();
  });

  it("renders sex toggle options", () => {
    render(<StepProfile data={getDefaultOnboardingData()} onUpdate={() => {}} />);
    expect(screen.getByText("Male")).toBeDefined();
    expect(screen.getByText("Female")).toBeDefined();
    expect(screen.getByText("Other")).toBeDefined();
  });

  it("calls onUpdate with cm when feet/inches change", () => {
    const onUpdate = vi.fn();
    render(<StepProfile data={getDefaultOnboardingData()} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByPlaceholderText("5"), { target: { value: "5" } });
    // 5ft 0in = 60 inches = 152.4cm -> rounds to 152
    expect(onUpdate).toHaveBeenCalledWith({ height: 152 });
  });

  it("calls onUpdate when weight changes", () => {
    const onUpdate = vi.fn();
    render(<StepProfile data={getDefaultOnboardingData()} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByPlaceholderText("175"), { target: { value: "180" } });
    expect(onUpdate).toHaveBeenCalledWith({ weight: 180 });
  });

  it("calls onUpdate when age changes", () => {
    const onUpdate = vi.fn();
    render(<StepProfile data={getDefaultOnboardingData()} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByPlaceholderText("25"), { target: { value: "25" } });
    expect(onUpdate).toHaveBeenCalledWith({ age: 25 });
  });

  it("calls onUpdate when sex is selected", () => {
    const onUpdate = vi.fn();
    render(<StepProfile data={getDefaultOnboardingData()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByText("Male"));
    expect(onUpdate).toHaveBeenCalledWith({ sex: "M" });
  });

  it("highlights selected sex", () => {
    const data = { ...getDefaultOnboardingData(), sex: "F" as const };
    render(<StepProfile data={data} onUpdate={() => {}} />);
    const femaleBtn = screen.getByText("Female").closest("button") as HTMLButtonElement;
    expect(femaleBtn.style.background).toBe("var(--ink)");
  });
});
