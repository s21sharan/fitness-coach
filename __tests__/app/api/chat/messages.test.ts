import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(() => Promise.resolve({ userId: "test-user-123" })),
}));

const mockDeleteEq = vi.fn(() => Promise.resolve({ error: null }));
const mockDelete = vi.fn(() => ({ eq: mockDeleteEq }));
const mockSelectMessages = vi.fn();
const mockSingle = vi.fn();

const mockFrom = vi.fn((table: string) => {
  if (table === "chat_conversations") {
    return {
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              single: mockSingle,
            }),
          }),
        }),
      }),
    };
  }
  if (table === "chat_messages") {
    return {
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: mockSelectMessages,
          }),
        }),
      }),
      delete: mockDelete,
    };
  }
  return {};
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

beforeEach(() => {
  mockSingle.mockReset();
  mockDelete.mockClear();
  mockDeleteEq.mockReset().mockReturnValue(Promise.resolve({ error: null }));
  mockSelectMessages.mockReset();
});

describe("GET /api/chat/messages", () => {
  it("returns 401 when unauthenticated", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userId: null });
    const { GET } = await import("@/app/api/chat/messages/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns empty messages when no conversation exists", async () => {
    mockSingle.mockResolvedValueOnce({ data: null });
    const { GET } = await import("@/app/api/chat/messages/route");
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.messages).toEqual([]);
  });

  it("returns messages for existing conversation", async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: "conv-1" } });
    const msgs = [
      { id: "m1", role: "user", content: "Hello", tool_calls: null, created_at: "2026-05-10T10:00:00Z" },
      { id: "m2", role: "assistant", content: "Hi!", tool_calls: null, created_at: "2026-05-10T10:00:05Z" },
    ];
    mockSelectMessages.mockResolvedValueOnce({ data: msgs });
    const { GET } = await import("@/app/api/chat/messages/route");
    const res = await GET();
    const body = await res.json();
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].content).toBe("Hello");
  });
});

describe("DELETE /api/chat/messages", () => {
  it("returns 401 when unauthenticated", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userId: null });
    const { DELETE } = await import("@/app/api/chat/messages/route");
    const res = await DELETE();
    expect(res.status).toBe(401);
  });

  it("returns success when no conversation exists", async () => {
    mockSingle.mockResolvedValueOnce({ data: null });
    const { DELETE } = await import("@/app/api/chat/messages/route");
    const res = await DELETE();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("deletes messages and returns success", async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: "conv-1" } });
    const { DELETE } = await import("@/app/api/chat/messages/route");
    const res = await DELETE();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeleteEq).toHaveBeenCalledWith("conversation_id", "conv-1");
  });

  it("returns 500 on delete error", async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: "conv-1" } });
    mockDeleteEq.mockResolvedValueOnce({ error: { message: "DB error" } });
    const { DELETE } = await import("@/app/api/chat/messages/route");
    const res = await DELETE();
    expect(res.status).toBe(500);
  });
});
