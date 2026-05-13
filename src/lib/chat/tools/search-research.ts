import { z } from "zod";
import { tool, embed } from "ai";
import { openai } from "@ai-sdk/openai";
import { createServerClient } from "@/lib/supabase/server";

export function getSearchResearchTool() {
  return tool({
    description:
      "Search exercise science research papers for evidence to support training, nutrition, or recovery recommendations. Returns relevant excerpts with citation info.",
    inputSchema: z.object({
      query: z.string().describe("Search query for research papers"),
      max_results: z
        .number()
        .optional()
        .default(5)
        .describe("Maximum number of results to return (1-10, default 5)"),
    }),
    execute: async ({ query, max_results }) => {
      const count = Math.max(1, Math.min(10, max_results ?? 5));

      const { embedding } = await embed({
        model: openai.textEmbeddingModel("text-embedding-3-small"),
        value: query,
      });

      const supabase = createServerClient();
      const { data, error } = await supabase.rpc("match_research_chunks", {
        query_embedding: embedding,
        match_threshold: 0.3,
        match_count: count,
      });

      if (error) {
        return { results: [], error: error.message };
      }

      const results = (data || []).map(
        (row: {
          title: string;
          authors: string;
          year: number;
          journal: string;
          doi: string;
          content: string;
          section: string;
          similarity: number;
        }) => ({
          title: row.title,
          authors: row.authors,
          year: row.year,
          journal: row.journal,
          doi: row.doi,
          excerpt: row.content,
          section: row.section,
          similarity: row.similarity,
        })
      );

      return { results };
    },
  });
}
