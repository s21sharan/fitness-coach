import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar } from "@/components/sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

describe("Sidebar", () => {
  it("renders all navigation links", () => {
    render(<Sidebar />);

    expect(screen.getByText("Today")).toBeDefined();
    expect(screen.getByText("My Plan")).toBeDefined();
    expect(screen.getByText("Coach")).toBeDefined();
    expect(screen.getByText("Weekly Review")).toBeDefined();
    expect(screen.getByText("Settings")).toBeDefined();
  });

  it("highlights the active link", () => {
    render(<Sidebar active="home" />);

    const todayLink = screen.getByText("Today").closest("a");
    expect(todayLink?.className).toContain("active");
  });

  it("renders without open class when closed", () => {
    const { container } = render(<Sidebar open={false} />);
    const aside = container.querySelector("aside");
    expect(aside?.className).not.toContain("open");
  });

  it("renders with open class when open prop is true", () => {
    const { container } = render(<Sidebar open={true} onClose={() => {}} />);
    const aside = container.querySelector("aside");
    expect(aside?.className).toContain("open");
  });

  it("calls onClose when a nav link is clicked", () => {
    const onClose = vi.fn();
    render(<Sidebar onClose={onClose} />);

    const todayLink = screen.getByText("Today").closest("a")!;
    fireEvent.click(todayLink);
    expect(onClose).toHaveBeenCalled();
  });

  it("renders close button when onClose prop is provided", () => {
    const onClose = vi.fn();
    render(<Sidebar open={true} onClose={onClose} />);

    const closeBtn = screen.getByLabelText("Close sidebar");
    expect(closeBtn).toBeDefined();
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
