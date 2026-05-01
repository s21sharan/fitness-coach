import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CaloriesCard } from "@/components/dashboard/calories-card";

describe("CaloriesCard", () => {
  it("renders calories with progress bar", () => {
    render(<CaloriesCard calories={1800} target={2400} protein={142} />);
    expect(screen.getByText("1,800")).toBeDefined();
    expect(screen.getByText(/2,400/)).toBeDefined();
    expect(screen.getByText(/142g protein/)).toBeDefined();
  });

  it("renders no data state", () => {
    render(<CaloriesCard calories={null} target={2000} protein={null} />);
    expect(screen.getByText("No data today")).toBeDefined();
  });
});
