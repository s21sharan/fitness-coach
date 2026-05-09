import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WeekSummary } from "@/components/review/week-summary";

describe("WeekSummary", () => {
  it("renders the weekly verdict section", () => {
    render(<WeekSummary />);
    expect(screen.getByText(/This week/)).toBeDefined();
    expect(screen.getByText(/Strong week/)).toBeDefined();
  });

  it("renders the score ring area", () => {
    render(<WeekSummary />);
    expect(screen.getByText("92")).toBeDefined();
    expect(screen.getByText("Score")).toBeDefined();
  });
});
