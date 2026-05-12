import { OpenAIProvider } from "./openai";
import type { LLMProvider } from "./types";

export type { LLMProvider, CompleteOptions, ExtractOptions } from "./types";

let cached: LLMProvider | null = null;
let cachedKey = "";

export function getLLMProvider(): LLMProvider {
  const providerName = process.env.LLM_PROVIDER ?? "openai";
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const key = `${providerName}::${model}::${apiKey.slice(-6)}`;
  if (cached && cachedKey === key) return cached;

  if (providerName !== "openai") {
    throw new Error(
      `Unsupported LLM_PROVIDER "${providerName}". Only "openai" is implemented today.`
    );
  }
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  cached = new OpenAIProvider({ apiKey, model });
  cachedKey = key;
  return cached;
}

export function isLLMConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

// Test-only: swap the provider used by getLLMProvider.
export function __setLLMProviderForTesting(provider: LLMProvider | null) {
  cached = provider;
  cachedKey = provider ? "__test__" : "";
}
