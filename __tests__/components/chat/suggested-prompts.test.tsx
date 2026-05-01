import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SuggestedPrompts } from "@/components/chat/suggested-prompts";

describe("SuggestedPrompts", () => {
  it("renders 4 prompt buttons", () => {
    render(<SuggestedPrompts onSelect={() => {}} />);
    expect(screen.getByText("What should I eat for dinner?")).toBeDefined();
    expect(screen.getByText("How's my recovery?")).toBeDefined();
    expect(screen.getByText("Should I train today?")).toBeDefined();
    expect(screen.getByText("Swap today's session")).toBeDefined();
  });

  it("calls onSelect with prompt text when clicked", () => {
    const onSelect = vi.fn();
    render(<SuggestedPrompts onSelect={onSelect} />);
    fireEvent.click(screen.getByText("How's my recovery?"));
    expect(onSelect).toHaveBeenCalledWith("How's my recovery?");
  });
});
