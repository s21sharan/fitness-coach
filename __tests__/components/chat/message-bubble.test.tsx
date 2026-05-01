import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageBubble, TypingIndicator } from "@/components/chat/message-bubble";

describe("MessageBubble", () => {
  it("renders user message", () => {
    render(<MessageBubble role="user" content="Should I train today?" />);
    expect(screen.getByText("Should I train today?")).toBeDefined();
  });

  it("renders assistant message with H avatar", () => {
    render(<MessageBubble role="assistant" content="Let me check your recovery data." />);
    expect(screen.getByText("Let me check your recovery data.")).toBeDefined();
    expect(screen.getByText("H")).toBeDefined();
  });

  it("renders tool pills for assistant messages", () => {
    render(<MessageBubble role="assistant" content="Checking your data." tools={["MacroFactor", "Garmin"]} />);
    expect(screen.getByText(/Read from MacroFactor/)).toBeDefined();
    expect(screen.getByText(/Read from Garmin/)).toBeDefined();
  });

  it("renders action buttons", () => {
    const actions = [{ label: "Yes — shift run", primary: true }, { label: "No, keep tomorrow" }];
    render(<MessageBubble role="assistant" content="Want me to update the plan?" actions={actions} />);
    expect(screen.getByText("Yes — shift run")).toBeDefined();
    expect(screen.getByText("No, keep tomorrow")).toBeDefined();
  });

  it("renders meal cards when kind is meals", () => {
    const meals = [
      { emoji: "🍗", title: "Chicken bowl", macros: "52g P · 620 kcal" },
    ];
    render(<MessageBubble role="assistant" content="" kind="meals" meals={meals} />);
    expect(screen.getByText("Chicken bowl")).toBeDefined();
    expect(screen.getByText("52g P · 620 kcal")).toBeDefined();
  });

  it("renders typing indicator with H avatar", () => {
    render(<TypingIndicator />);
    expect(screen.getByText("H")).toBeDefined();
  });
});
