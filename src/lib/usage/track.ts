import { createServerClient } from "@/lib/supabase/server";

interface TokenUsageParams {
  userId: string;
  source: "chat" | "insights" | "daily_summary" | "plan_regenerate" | "title_gen";
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Fire-and-forget token usage recording. Never throws — logs errors only.
 */
export function trackTokenUsage(params: TokenUsageParams): void {
  const supabase = createServerClient();
  supabase
    .from("token_usage")
    .insert({
      user_id: params.userId,
      source: params.source,
      model: params.model,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
    })
    .then(({ error }) => {
      if (error) console.error("Failed to track token usage:", error.message);
    });
}
