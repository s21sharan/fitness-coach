import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "@/components/review/stat-card";

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="Compliance" value="83%" />);
    expect(screen.getByText("Compliance")).toBeDefined();
    expect(screen.getByText("83%")).toBeDefined();
  });

  it("applies color variant", () => {
    const { container } = render(<StatCard label="Compliance" value="45%" color="red" />);
    expect(container.innerHTML).toContain("text-red");
  });
});
