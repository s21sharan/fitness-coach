import type { z } from "zod";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompleteOptions {
  system?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ExtractOptions<T> {
  system?: string;
  prompt: string;
  schema: z.ZodType<T>;
  schemaName: string;
  schemaDescription?: string;
  temperature?: number;
}

export interface LLMProvider {
  readonly name: string;
  complete(opts: CompleteOptions): Promise<string>;
  extractJSON<T>(opts: ExtractOptions<T>): Promise<T>;
}
