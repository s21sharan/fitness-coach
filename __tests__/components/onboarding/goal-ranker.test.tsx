import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GoalRanker } from "@/components/onboarding/goal-ranker";

describe("GoalRanker", () => {
  it("shows hint when rank is empty", () => {
    render(<GoalRanker rank={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/drag to rank/i)).toBeDefined();
  });

  it("renders rows with numeric positions", () => {
    render(<GoalRanker rank={["build_muscle", "build_speed"]} onChange={vi.fn()} />);
    expect(screen.getByText("1")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();
    expect(screen.getByText(/Build muscle/i)).toBeDefined();
    expect(screen.getByText(/Build speed/i)).toBeDefined();
  });

  it("renders nothing for invalid goal keys", () => {
    render(<GoalRanker rank={["build_muscle"]} onChange={vi.fn()} />);
    expect(screen.getByText(/Build muscle/)).toBeDefined();
  });
});
