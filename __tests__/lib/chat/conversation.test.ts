import { describe, it, expect } from "vitest";
import { formatMessagesForAI, convertDBToUIMessage } from "@/lib/chat/conversation";

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

  describe("convertDBToUIMessage", () => {
    it("converts a user message to UIMessage format", () => {
      const dbMsg = {
        id: "abc-123",
        role: "user",
        content: "How is my training?",
        tool_calls: null,
        created_at: "2026-05-10T14:30:00Z",
      };
      const result = convertDBToUIMessage(dbMsg);
      expect(result.id).toBe("abc-123");
      expect(result.role).toBe("user");
      expect(result.parts).toEqual([{ type: "text", text: "How is my training?" }]);
      expect(result.createdAt).toEqual(new Date("2026-05-10T14:30:00Z"));
    });

    it("converts an assistant message to UIMessage format", () => {
      const dbMsg = {
        id: "def-456",
        role: "assistant",
        content: "Your recovery looks great today.",
        tool_calls: [{ name: "get_recovery", args: {} }],
        created_at: "2026-05-10T14:30:05Z",
      };
      const result = convertDBToUIMessage(dbMsg);
      expect(result.id).toBe("def-456");
      expect(result.role).toBe("assistant");
      expect(result.parts).toEqual([{ type: "text", text: "Your recovery looks great today." }]);
      expect(result.createdAt).toEqual(new Date("2026-05-10T14:30:05Z"));
    });

    it("handles empty content gracefully", () => {
      const dbMsg = {
        id: "ghi-789",
        role: "assistant",
        content: "",
        tool_calls: null,
        created_at: "2026-05-10T14:31:00Z",
      };
      const result = convertDBToUIMessage(dbMsg);
      expect(result.parts).toEqual([{ type: "text", text: "" }]);
    });

    it("converts multiple messages preserving order", () => {
      const dbMessages = [
        { id: "1", role: "user", content: "First", tool_calls: null, created_at: "2026-05-10T10:00:00Z" },
        { id: "2", role: "assistant", content: "Response", tool_calls: null, created_at: "2026-05-10T10:00:05Z" },
        { id: "3", role: "user", content: "Follow up", tool_calls: null, created_at: "2026-05-10T10:01:00Z" },
      ];
      const results = dbMessages.map(convertDBToUIMessage);
      expect(results).toHaveLength(3);
      expect(results[0].id).toBe("1");
      expect(results[1].id).toBe("2");
      expect(results[2].id).toBe("3");
    });
  });
});
