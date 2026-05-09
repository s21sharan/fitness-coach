import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "@/components/review/stat-card";

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="Compliance" value="83%" delta="+5%" tone="mint" sub="This week" />);
    expect(screen.getByText("Compliance")).toBeDefined();
    expect(screen.getByText("83%")).toBeDefined();
  });

  it("renders delta and sub text", () => {
    render(<StatCard label="Calories" value="2400" delta="-100" tone="coral" sub="daily avg" />);
    expect(screen.getByText("-100")).toBeDefined();
    expect(screen.getByText("daily avg")).toBeDefined();
  });
});
