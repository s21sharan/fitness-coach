import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WeekSummary } from "@/components/review/week-summary";

describe("WeekSummary", () => {
  it("renders AI summary and stats", () => {
    render(
      <WeekSummary
        checkIn={{
          id: "ci-1",
          week_start_date: "2026-04-28",
          compliance_pct: 83,
          avg_calories: 2400,
          avg_protein: 175,
          avg_sleep_hours: 7.2,
          avg_hrv: 48,
          ai_summary: "Great week overall. Hit 5 of 6 sessions.",
          risk_flags: ["Sleep dipped below 7h on Thursday"],
          adjustments: [{ type: "volume", description: "Reduce volume 10%", affected_days: [0, 2] }],
          user_approved: true,
        }}
      />,
    );
    expect(screen.getByText(/Great week overall/)).toBeDefined();
    expect(screen.getByText("83%")).toBeDefined();
    expect(screen.getByText("2400")).toBeDefined();
    expect(screen.getByText(/Sleep dipped/)).toBeDefined();
  });

  it("renders empty state when no check-in", () => {
    render(<WeekSummary checkIn={null} />);
    expect(screen.getByText(/first weekly review/i)).toBeDefined();
  });
});
