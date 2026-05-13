import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScreenRecovery } from "@/components/onboarding/screen-recovery";
import { getDefaultAthleteProfile } from "@/lib/onboarding/types";

function renderScreen() {
  const onUpdate = vi.fn();
  const utils = render(<ScreenRecovery profile={getDefaultAthleteProfile()} onUpdate={onUpdate} />);
  return { ...utils, onUpdate };
}

describe("ScreenRecovery (trimmed)", () => {
  it("renders sleep, stress, and physical-job inputs", () => {
    renderScreen();
    expect(screen.getByText(/Average sleep/i)).toBeDefined();
    expect(screen.getByText(/Sleep consistency/i)).toBeDefined();
    expect(screen.getByText(/Work \/ school stress/i)).toBeDefined();
    expect(screen.getByText(/Physical job/i)).toBeDefined();
  });

  it("no longer asks about HRV data, soreness, or recovery confidence", () => {
    renderScreen();
    expect(screen.queryByText(/HRV/i)).toBeNull();
    expect(screen.queryByText(/sore/i)).toBeNull();
    expect(screen.queryByText(/recovered/i)).toBeNull();
  });

  it("toggles physical-job checkbox", () => {
    const { onUpdate } = renderScreen();
    const check = screen.getByLabelText(/Physical job/i);
    fireEvent.click(check);
    const call = onUpdate.mock.calls[0][0];
    expect(call.recovery.physical_job).toBe(true);
  });
});
