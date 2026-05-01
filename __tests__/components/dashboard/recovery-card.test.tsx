import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecoveryCard } from "@/components/dashboard/recovery-card";

describe("RecoveryCard", () => {
  it("renders good readiness", () => {
    render(<RecoveryCard hrv={52} sleepHours={7.8} bodyBattery={75} readiness="good" />);
    expect(screen.getByText("Good")).toBeDefined();
    expect(screen.getByText(/52/)).toBeDefined();
    expect(screen.getByText(/7.8h/)).toBeDefined();
  });

  it("renders low readiness", () => {
    render(<RecoveryCard hrv={28} sleepHours={5.2} bodyBattery={30} readiness="low" />);
    expect(screen.getByText("Low")).toBeDefined();
  });

  it("renders no data state", () => {
    render(<RecoveryCard hrv={null} sleepHours={null} bodyBattery={null} readiness={null} />);
    expect(screen.getByText("No data today")).toBeDefined();
  });
});
