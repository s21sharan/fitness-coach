import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CheckInHistory } from "@/components/review/check-in-history";

describe("CheckInHistory", () => {
  it("renders list of past check-ins", () => {
    render(
      <CheckInHistory
        history={[
          { id: "1", week_start_date: "2026-04-21", compliance_pct: 100, avg_calories: 2500, avg_protein: 180, avg_sleep_hours: 7.5, avg_hrv: 50, ai_summary: "Perfect compliance. All sessions hit.", risk_flags: null, adjustments: null, user_approved: true, created_at: "" },
          { id: "2", week_start_date: "2026-04-14", compliance_pct: 67, avg_calories: 2200, avg_protein: 160, avg_sleep_hours: 6.5, avg_hrv: 42, ai_summary: "Missed 2 sessions due to travel.", risk_flags: ["Low sleep"], adjustments: null, user_approved: true, created_at: "" },
        ]}
      />,
    );
    expect(screen.getByText(/Apr 21/)).toBeDefined();
    expect(screen.getByText(/Apr 14/)).toBeDefined();
    expect(screen.getByText("100%")).toBeDefined();
    expect(screen.getByText("67%")).toBeDefined();
  });

  it("renders empty state", () => {
    render(<CheckInHistory history={[]} />);
    expect(screen.getByText(/No previous/i)).toBeDefined();
  });
});
