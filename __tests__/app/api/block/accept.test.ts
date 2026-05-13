import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(() => Promise.resolve({ userId: "test-user-123" })),
}));

// Mock supabase to avoid real DB calls
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: { message: "not found" } })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
    })),
  })),
}));

vi.mock("@/lib/training/generate-plan", () => ({
  expandBlocksToWorkouts: vi.fn(() => []),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/block/accept", () => {
  it("returns 401 when unauthenticated", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userId: null });
    const { POST } = await import("@/app/api/block/accept/route");
    const res = await POST(new Request("http://x", {
      method: "POST",
      body: JSON.stringify({ block_id: "b1" }),
    }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when block_id is missing", async () => {
    const { POST } = await import("@/app/api/block/accept/route");
    const res = await POST(new Request("http://x", {
      method: "POST",
      body: JSON.stringify({}),
    }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when block not found", async () => {
    const { POST } = await import("@/app/api/block/accept/route");
    const res = await POST(new Request("http://x", {
      method: "POST",
      body: JSON.stringify({ block_id: "nonexistent" }),
    }));
    expect(res.status).toBe(404);
  });
});
