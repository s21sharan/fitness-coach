import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(() => Promise.resolve({ userId: "test-user-123" })),
}));

const mockInsert = vi.fn(() => Promise.resolve({ error: null }));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({
    from: () => ({ insert: mockInsert }),
  }),
}));

const mockExtract = vi.fn();

vi.mock("@/lib/llm", () => ({
  getLLMProvider: () => ({
    name: "mock",
    complete: vi.fn(),
    extractJSON: mockExtract,
  }),
  isLLMConfigured: () => true,
}));

beforeEach(() => {
  mockInsert.mockClear();
  mockExtract.mockReset();
});

describe("POST /api/coach/extract", () => {
  it("rejects unauthenticated", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userId: null });
    const { POST } = await import("@/app/api/coach/extract/route");
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ insertion_point: "goals", raw_text: "hi" }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("rejects invalid insertion_point", async () => {
    const { POST } = await import("@/app/api/coach/extract/route");
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ insertion_point: "nope", raw_text: "hi" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("calls LLM and persists to athlete_chat_notes", async () => {
    mockExtract.mockResolvedValueOnce({
      constraints: ["pool morning only"],
      rules: ["pool_morning_only"],
    });
    const { POST } = await import("@/app/api/coach/extract/route");
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({
          insertion_point: "availability",
          raw_text: "I can only swim in the morning",
        }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.extracted.rules).toContain("pool_morning_only");
    expect(mockExtract).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const insertedArg = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertedArg.user_id).toBe("test-user-123");
    expect(insertedArg.insertion_point).toBe("availability");
  });

  it("falls back to heuristic extraction if LLM throws", async () => {
    mockExtract.mockRejectedValueOnce(new Error("boom"));
    const { POST } = await import("@/app/api/coach/extract/route");
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({
          insertion_point: "goals",
          raw_text: "I want to run faster",
        }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.extracted).toBeDefined();
  });
});
