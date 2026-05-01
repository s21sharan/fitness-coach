import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SuggestedPrompts } from "@/components/chat/suggested-prompts";

describe("SuggestedPrompts", () => {
  it("renders 4 prompt cards", () => {
    render(<SuggestedPrompts onSelect={() => {}} />);
    expect(screen.getByText("Plan my week")).toBeDefined();
    expect(screen.getByText("What should I eat?")).toBeDefined();
    expect(screen.getByText("Why is bench stalling?")).toBeDefined();
    expect(screen.getByText("Am I overtraining?")).toBeDefined();
  });

  it("calls onSelect with prompt text when clicked", () => {
    const onSelect = vi.fn();
    render(<SuggestedPrompts onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Plan my week"));
    expect(onSelect).toHaveBeenCalledWith("Plan my week");
  });
});
