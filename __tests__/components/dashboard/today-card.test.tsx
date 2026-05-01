import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TodayCard } from "@/components/dashboard/today-card";

describe("TodayCard", () => {
  it("renders today's session", () => {
    render(
      <TodayCard sessionType="Push" aiNotes="HRV 52 — push hard today" recovery={{ hrv: 52, sleep_hours: 7.8, body_battery: 75 }} />,
    );
    expect(screen.getByText("Push")).toBeDefined();
    expect(screen.getByText(/HRV 52/)).toBeDefined();
  });

  it("renders rest day", () => {
    render(<TodayCard sessionType="Rest" aiNotes={null} recovery={null} />);
    expect(screen.getByText("Rest Day")).toBeDefined();
  });

  it("renders no plan state", () => {
    render(<TodayCard sessionType={null} aiNotes={null} recovery={null} />);
    expect(screen.getByText(/No session planned/i)).toBeDefined();
  });
});
