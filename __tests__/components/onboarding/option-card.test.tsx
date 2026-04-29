import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OptionCard } from "@/components/onboarding/option-card";

describe("OptionCard", () => {
  it("renders label and description", () => {
    render(
      <OptionCard label="Gain Muscle" description="Build lean mass" selected={false} onClick={() => {}} />
    );
    expect(screen.getByText("Gain Muscle")).toBeDefined();
    expect(screen.getByText("Build lean mass")).toBeDefined();
  });

  it("shows selected state", () => {
    const { container } = render(
      <OptionCard label="Gain Muscle" selected={true} onClick={() => {}} />
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("border-black");
  });

  it("shows unselected state", () => {
    const { container } = render(
      <OptionCard label="Gain Muscle" selected={false} onClick={() => {}} />
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).not.toContain("border-black");
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<OptionCard label="Gain Muscle" selected={false} onClick={onClick} />);
    fireEvent.click(screen.getByText("Gain Muscle"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
