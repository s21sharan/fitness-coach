import OpenAI from "openai";
import type { z } from "zod";
import type {
  CompleteOptions,
  ExtractOptions,
  LLMProvider,
} from "./types";

interface OpenAIProviderConfig {
  apiKey: string;
  model?: string;
  baseURL?: string;
}

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  private client: OpenAI;
  private model: string;

  constructor(cfg: OpenAIProviderConfig) {
    this.client = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL });
    this.model = cfg.model ?? "gpt-4o-mini";
  }

  async complete(opts: CompleteOptions): Promise<string> {
    const messages: { role: "system" | "user"; content: string }[] = [];
    if (opts.system) messages.push({ role: "system", content: opts.system });
    messages.push({ role: "user", content: opts.prompt });

    const res = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens,
    });

    return res.choices[0]?.message?.content ?? "";
  }

  async extractJSON<T>(opts: ExtractOptions<T>): Promise<T> {
    const messages: { role: "system" | "user"; content: string }[] = [];
    if (opts.system) messages.push({ role: "system", content: opts.system });
    messages.push({
      role: "user",
      content:
        opts.prompt +
        `\n\nReturn ONLY a JSON object that satisfies the "${opts.schemaName}" schema. No prose.`,
    });

    const res = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: opts.temperature ?? 0.2,
      response_format: { type: "json_object" },
    });

    const raw = res.choices[0]?.message?.content ?? "{}";
    return parseAndValidate(raw, opts.schema);
  }
}

function parseAndValidate<T>(raw: string, schema: z.ZodType<T>): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`LLM returned invalid JSON: ${(err as Error).message}\nRaw: ${raw.slice(0, 400)}`);
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`LLM JSON did not match schema: ${result.error.message}`);
  }
  return result.data;
}
