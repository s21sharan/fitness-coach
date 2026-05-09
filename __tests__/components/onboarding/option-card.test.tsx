import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OptionCard } from "@/components/onboarding/option-card";

describe("OptionCard", () => {
  it("renders label", () => {
    render(
      <OptionCard label="Gain Muscle" selected={false} onClick={() => {}} />
    );
    expect(screen.getByText("Gain Muscle")).toBeDefined();
  });

  it("renders sub text when provided", () => {
    render(
      <OptionCard label="Gain Muscle" sub="Build lean mass" selected={false} onClick={() => {}} />
    );
    expect(screen.getByText("Gain Muscle")).toBeDefined();
    expect(screen.getByText("Build lean mass")).toBeDefined();
  });

  it("renders emoji when provided", () => {
    render(
      <OptionCard emoji="💪" label="Arms" selected={false} onClick={() => {}} />
    );
    expect(screen.getByText("💪")).toBeDefined();
  });

  it("shows check badge when selected", () => {
    const { container } = render(
      <OptionCard label="Gain Muscle" selected={true} onClick={() => {}} />
    );
    // Selected card should contain a checkmark SVG
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("does not show check badge when unselected", () => {
    const { container } = render(
      <OptionCard label="Gain Muscle" selected={false} onClick={() => {}} />
    );
    // No SVG checkmark when unselected
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBe(0);
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<OptionCard label="Gain Muscle" selected={false} onClick={onClick} />);
    fireEvent.click(screen.getByText("Gain Muscle"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("applies elevated transform when selected", () => {
    const { container } = render(
      <OptionCard label="Test" selected={true} onClick={() => {}} />
    );
    const btn = container.firstChild as HTMLElement;
    expect(btn.style.transform).toBe("translateY(-3px)");
  });

  it("has no transform when unselected", () => {
    const { container } = render(
      <OptionCard label="Test" selected={false} onClick={() => {}} />
    );
    const btn = container.firstChild as HTMLElement;
    expect(btn.style.transform).toBe("none");
  });
});
