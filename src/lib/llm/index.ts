import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import type { LLMProvider } from "./types";

export type { LLMProvider, CompleteOptions, ExtractOptions } from "./types";

let cached: LLMProvider | null = null;
let cachedKey = "";

export function getLLMProvider(): LLMProvider {
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? "";
  const openaiKey = process.env.OPENAI_API_KEY ?? "";
  const preferred = (process.env.LLM_PROVIDER ?? "").toLowerCase();

  // Explicit selection wins. Falls through to the default precedence when
  // the chosen provider isn't actually configured.
  if (preferred === "openai" && openaiKey) {
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    const key = `openai::${model}::${openaiKey.slice(-6)}`;
    if (cached && cachedKey === key) return cached;
    cached = new OpenAIProvider({ apiKey: openaiKey, model });
    cachedKey = key;
    return cached;
  }
  if (preferred === "anthropic" && anthropicKey) {
    const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
    const key = `anthropic::${model}::${anthropicKey.slice(-6)}`;
    if (cached && cachedKey === key) return cached;
    cached = new AnthropicProvider({ apiKey: anthropicKey, model });
    cachedKey = key;
    return cached;
  }

  // Default precedence: Anthropic, then OpenAI.
  if (anthropicKey) {
    const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
    const key = `anthropic::${model}::${anthropicKey.slice(-6)}`;
    if (cached && cachedKey === key) return cached;
    cached = new AnthropicProvider({ apiKey: anthropicKey, model });
    cachedKey = key;
    return cached;
  }

  if (openaiKey) {
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    const key = `openai::${model}::${openaiKey.slice(-6)}`;
    if (cached && cachedKey === key) return cached;
    cached = new OpenAIProvider({ apiKey: openaiKey, model });
    cachedKey = key;
    return cached;
  }

  throw new Error("No LLM API key configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.");
}

export function isLLMConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
}

// Test-only: swap the provider used by getLLMProvider.
export function __setLLMProviderForTesting(provider: LLMProvider | null) {
  cached = provider;
  cachedKey = provider ? "__test__" : "";
}
