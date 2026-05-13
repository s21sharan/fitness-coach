import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ rpc: mockRpc }),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: {
    textEmbeddingModel: (model: string) => ({ modelId: model }),
  },
}));

vi.mock("ai", async () => {
  const actual = await vi.importActual("ai");
  return {
    ...actual,
    embed: vi.fn().mockResolvedValue({
      embedding: [0.1, 0.2, 0.3],
    }),
  };
});

import { getSearchResearchTool } from "@/lib/chat/tools/search-research";

describe("getSearchResearchTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a tool object with correct description and schema", () => {
    const t = getSearchResearchTool();
    expect(t).toBeDefined();
    expect(typeof t).toBe("object");
  });

  it("execute returns formatted results from RPC", async () => {
    const mockData = [
      {
        title: "Hypertrophy and Rep Ranges",
        authors: "Schoenfeld BJ",
        year: 2021,
        journal: "J Strength Cond Res",
        doi: "10.1234/jscr.2021",
        content: "Training across a range of repetitions...",
        section: "Results",
        similarity: 0.85,
      },
      {
        title: "Sleep and Recovery",
        authors: "Watson AM",
        year: 2017,
        journal: "Curr Sports Med Rep",
        doi: "10.1234/csmr.2017",
        content: "Sleep deprivation impairs recovery...",
        section: "Discussion",
        similarity: 0.72,
      },
    ];

    mockRpc.mockResolvedValue({ data: mockData, error: null });

    const t = getSearchResearchTool();
    const result = await (t as { execute: (args: { query: string; max_results?: number }) => Promise<{ results: unknown[] }> }).execute({
      query: "hypertrophy rep ranges",
      max_results: 5,
    });

    expect(mockRpc).toHaveBeenCalledWith("match_research_chunks", {
      query_embedding: [0.1, 0.2, 0.3],
      match_threshold: 0.3,
      match_count: 5,
    });

    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toEqual({
      title: "Hypertrophy and Rep Ranges",
      authors: "Schoenfeld BJ",
      year: 2021,
      journal: "J Strength Cond Res",
      doi: "10.1234/jscr.2021",
      excerpt: "Training across a range of repetitions...",
      section: "Results",
      similarity: 0.85,
    });
  });

  it("clamps max_results to 1-10", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const t = getSearchResearchTool();
    const exec = (t as { execute: (args: { query: string; max_results?: number }) => Promise<{ results: unknown[] }> }).execute;

    await exec({ query: "test", max_results: 20 });
    expect(mockRpc).toHaveBeenCalledWith("match_research_chunks", expect.objectContaining({ match_count: 10 }));

    mockRpc.mockClear();
    await exec({ query: "test", max_results: 0 });
    expect(mockRpc).toHaveBeenCalledWith("match_research_chunks", expect.objectContaining({ match_count: 1 }));
  });

  it("returns error when RPC fails", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "RPC not found" } });

    const t = getSearchResearchTool();
    const result = await (t as { execute: (args: { query: string; max_results?: number }) => Promise<{ results: unknown[]; error?: string }> }).execute({
      query: "test query",
    });

    expect(result.results).toEqual([]);
    expect(result.error).toBe("RPC not found");
  });
});
