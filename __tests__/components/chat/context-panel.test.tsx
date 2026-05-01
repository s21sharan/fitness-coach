import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContextPanel } from "@/components/chat/context-panel";

describe("ContextPanel", () => {
  it("renders Live context section with rows", () => {
    render(<ContextPanel />);
    expect(screen.getByText("Live context")).toBeDefined();
    expect(screen.getByText("HRV")).toBeDefined();
    expect(screen.getByText("38")).toBeDefined();
    expect(screen.getByText("↓ 18 from baseline")).toBeDefined();
    expect(screen.getByText("Sleep")).toBeDefined();
    expect(screen.getByText("5h 40m")).toBeDefined();
    expect(screen.getByText("Calories")).toBeDefined();
    expect(screen.getByText("Protein")).toBeDefined();
  });

  it("renders Try asking section with 4 prompts", () => {
    render(<ContextPanel />);
    expect(screen.getByText("Try asking")).toBeDefined();
    expect(screen.getByText("Plan my week")).toBeDefined();
    expect(screen.getByText("What should I eat?")).toBeDefined();
    expect(screen.getByText("Why is bench stalling?")).toBeDefined();
    expect(screen.getByText("Am I overtraining?")).toBeDefined();
  });

  it("calls onPromptSelect when a prompt is clicked", () => {
    const onPromptSelect = vi.fn();
    render(<ContextPanel onPromptSelect={onPromptSelect} />);
    fireEvent.click(screen.getByText("Plan my week"));
    expect(onPromptSelect).toHaveBeenCalledWith("Plan my week");
  });
});
