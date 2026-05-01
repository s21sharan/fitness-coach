import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageBubble } from "@/components/chat/message-bubble";

describe("MessageBubble", () => {
  it("renders user message", () => {
    render(<MessageBubble role="user" content="Should I train today?" />);
    expect(screen.getByText("Should I train today?")).toBeDefined();
  });

  it("renders assistant message with Coach avatar", () => {
    render(<MessageBubble role="assistant" content="Let me check your recovery data." />);
    expect(screen.getByText("Let me check your recovery data.")).toBeDefined();
    expect(screen.getByText("C")).toBeDefined();
  });
});
