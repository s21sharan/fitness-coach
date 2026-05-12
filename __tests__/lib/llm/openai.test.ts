import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

const mockCreate = vi.fn();

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = { completions: { create: mockCreate } };
      constructor() {}
    },
  };
});

import { OpenAIProvider } from "@/lib/llm/openai";

beforeEach(() => {
  mockCreate.mockReset();
});

describe("OpenAIProvider", () => {
  it("calls chat.completions.create with system + user messages for complete()", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "hello" } }],
    });
    const provider = new OpenAIProvider({ apiKey: "test", model: "gpt-4o-mini" });
    const out = await provider.complete({ system: "be helpful", prompt: "say hi" });
    expect(out).toBe("hello");
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const call = mockCreate.mock.calls[0][0];
    expect(call.model).toBe("gpt-4o-mini");
    expect(call.messages).toEqual([
      { role: "system", content: "be helpful" },
      { role: "user", content: "say hi" },
    ]);
  });

  it("extractJSON parses and validates against the schema", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"name":"Test","age":3}' } }],
    });
    const provider = new OpenAIProvider({ apiKey: "test" });
    const schema = z.object({ name: z.string(), age: z.number() });
    const out = await provider.extractJSON({
      prompt: "give me a record",
      schema,
      schemaName: "Sample",
    });
    expect(out).toEqual({ name: "Test", age: 3 });
    const call = mockCreate.mock.calls[0][0];
    expect(call.response_format).toEqual({ type: "json_object" });
  });

  it("throws when LLM returns invalid JSON", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "not json" } }],
    });
    const provider = new OpenAIProvider({ apiKey: "test" });
    const schema = z.object({ x: z.string() });
    await expect(
      provider.extractJSON({ prompt: "x", schema, schemaName: "S" })
    ).rejects.toThrow(/invalid JSON/);
  });

  it("throws when JSON doesn't match schema", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"wrong":"shape"}' } }],
    });
    const provider = new OpenAIProvider({ apiKey: "test" });
    const schema = z.object({ x: z.string() });
    await expect(
      provider.extractJSON({ prompt: "x", schema, schemaName: "S" })
    ).rejects.toThrow(/did not match schema/);
  });
});
