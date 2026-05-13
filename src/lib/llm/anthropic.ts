import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import type { CompleteOptions, ExtractOptions, LLMProvider } from "./types";

interface AnthropicProviderConfig {
  apiKey: string;
  model?: string;
}

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  private client: Anthropic;
  private model: string;

  constructor(cfg: AnthropicProviderConfig) {
    this.client = new Anthropic({ apiKey: cfg.apiKey });
    this.model = cfg.model ?? "claude-sonnet-4-20250514";
  }

  async complete(opts: CompleteOptions): Promise<string> {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.7,
      system: opts.system ?? "",
      messages: [{ role: "user", content: opts.prompt }],
    });

    const block = res.content[0];
    return block.type === "text" ? block.text : "";
  }

  async extractJSON<T>(opts: ExtractOptions<T>): Promise<T> {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      temperature: opts.temperature ?? 0.2,
      system: opts.system ?? "",
      messages: [
        {
          role: "user",
          content:
            opts.prompt +
            `\n\nReturn ONLY a JSON object that satisfies the "${opts.schemaName}" schema. No prose, no markdown fences, just raw JSON.`,
        },
      ],
    });

    const block = res.content[0];
    const raw = block.type === "text" ? block.text : "{}";
    return parseAndValidate(raw, opts.schema);
  }
}

function parseAndValidate<T>(raw: string, schema: z.ZodType<T>): T {
  // Strip markdown fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      `LLM returned invalid JSON: ${(err as Error).message}\nRaw: ${raw.slice(0, 400)}`
    );
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`LLM JSON did not match schema: ${result.error.message}`);
  }
  return result.data;
}
