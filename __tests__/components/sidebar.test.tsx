import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "@/components/sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

describe("Sidebar", () => {
  it("renders all navigation links", () => {
    render(<Sidebar />);

    expect(screen.getByText("Dashboard")).toBeDefined();
    expect(screen.getByText("My Plan")).toBeDefined();
    expect(screen.getByText("Chat")).toBeDefined();
    expect(screen.getByText("Weekly Review")).toBeDefined();
    expect(screen.getByText("Settings")).toBeDefined();
  });

  it("highlights the active link", () => {
    render(<Sidebar />);

    const dashboardLink = screen.getByText("Dashboard").closest("a");
    expect(dashboardLink?.className).toContain("bg-");
  });
});
