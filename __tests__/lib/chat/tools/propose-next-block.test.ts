import { describe, it, expect, vi } from "vitest";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: null })),
              })),
            })),
          })),
          single: vi.fn(() => Promise.resolve({ data: null })),
        })),
      })),
    })),
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: null })),
              })),
            })),
          })),
        })),
      })),
    })),
  })),
}));

vi.mock("@/lib/training/generate-plan", () => ({
  generateMultiWeekPlan: vi.fn(),
}));

describe("proposeNextBlockTool", () => {
  it("exports a tool function", async () => {
    const { proposeNextBlockTool } = await import("@/lib/chat/tools/propose-next-block");
    const tool = proposeNextBlockTool("user-123");
    expect(tool).toBeDefined();
    expect(tool.description).toContain("block");
  });
});
