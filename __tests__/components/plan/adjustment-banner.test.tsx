import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdjustmentBanner } from "@/components/plan/adjustment-banner";

describe("AdjustmentBanner", () => {
  it("renders pending adjustment with summary", () => {
    render(
      <AdjustmentBanner
        checkIn={{
          id: "ci-1",
          ai_summary: "Your HRV has been trending down. I suggest reducing volume by 15%.",
          risk_flags: ["Sleep averaging 6.2h"],
          adjustments: [{ type: "volume", description: "Reduce volume 15%", affected_days: [0, 2, 4] }],
        }}
        onReview={() => {}}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText(/HRV has been trending down/)).toBeDefined();
    expect(screen.getByRole("button", { name: /Review Changes/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Dismiss/i })).toBeDefined();
  });

  it("returns null when no check-in", () => {
    const { container } = render(
      <AdjustmentBanner checkIn={null} onReview={() => {}} onDismiss={() => {}} />,
    );
    expect(container.innerHTML).toBe("");
  });
});
