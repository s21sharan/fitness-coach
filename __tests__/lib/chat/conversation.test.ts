import { describe, it, expect } from "vitest";
import { formatMessagesForAI } from "@/lib/chat/conversation";

describe("conversation", () => {
  describe("formatMessagesForAI", () => {
    it("formats DB messages for AI SDK", () => {
      const dbMessages = [
        { id: "1", role: "user", content: "Hello", tool_calls: null, created_at: "2026-05-01T10:00:00Z" },
        { id: "2", role: "assistant", content: "Hi! How can I help?", tool_calls: null, created_at: "2026-05-01T10:00:05Z" },
      ];
      const formatted = formatMessagesForAI(dbMessages);
      expect(formatted).toHaveLength(2);
      expect(formatted[0]).toEqual({ role: "user", content: "Hello" });
      expect(formatted[1]).toEqual({ role: "assistant", content: "Hi! How can I help?" });
    });

    it("returns empty array for no messages", () => {
      expect(formatMessagesForAI([])).toEqual([]);
    });
  });
});
