import { z } from "zod";
import { getLLMProvider } from "@/lib/llm";
import { FACT_CATEGORIES, FACT_PREDICATES, FACT_LIFECYCLES } from "./vocab";
import type { FactInput, FactSource } from "./types";

const FactSchema = z.object({
  category: z.enum(FACT_CATEGORIES),
  subject: z.string().nullable().describe("Short canonical noun (snake_case) — e.g. 'left_knee', 'long_runs', 'monday_mornings'. Null only if the fact is global to the athlete."),
  predicate: z.enum(FACT_PREDICATES),
  value: z.record(z.string(), z.unknown()).nullable().describe("Optional structured payload, e.g. { severity: 7 } or { duration_min: 45 }. Omit if unstructured."),
  summary: z.string().min(4).max(280).describe("One-sentence natural language summary. This is what the coach reads next time."),
  lifecycle: z.enum(FACT_LIFECYCLES),
  confidence: z.number().min(0).max(1).default(0.8),
});

const ExtractionSchema = z.object({
  facts: z.array(FactSchema).describe("Zero or more facts. Return [] when the exchange contains nothing durable."),
});

const SYSTEM_PROMPT = `You distill durable facts about an athlete from coaching conversations. The facts feed a long-term memory the coach reads on every future turn.

Return ONLY facts that are useful long after this conversation. Skip:
- Acknowledgments, agreements, the coach's recommendations
- Plans / commitments the user might do later ("I'll try X tomorrow")
- Restatements of data the coach already has (e.g. HRV numbers, sessions on the calendar)
- Facts already implied by structured profile fields (age, sex, weight)

Lifecycle guide (be conservative):
- chronic: verified long-term physical conditions or fixed identity ("I had ACL surgery in 2021", "I'm vegetarian"). Never use chronic for transient feelings.
- standing: stable preferences, habits, dislikes, sustained constraints ("I prefer morning workouts", "no equipment on Tuesdays"). 90-day half-life — gets refreshed when re-mentioned.
- recent: current-state facts that will become irrelevant in a couple weeks ("knee tweak from yesterday's run", "extra work stress this month").
- ephemeral: very short-lived observations ("feeling tired today"). Use sparingly.

Predicate guide:
- has_pain / has_history_of / recovering_from: physical condition.
- prefers / avoids: preferences and dislikes.
- struggles_with / responds_well_to / recovers_well_from: training response patterns.
- noted: one-off observation that doesn't fit elsewhere.
- unavailable: scheduling constraint.

Format value as a small flat object when useful (severity, duration_min, count). Leave null otherwise. Summary should read as a complete sentence and include any relevant numbers from value.

When in doubt, return fewer facts. Empty result is fine.`;

interface ExtractChatInput {
  userMessage: string;
  assistantText: string;
}

interface ExtractNoteInput {
  noteText: string;
  context: {
    sessionType: string;
    date: string;
    source: "completion_note" | "skip_note";
  };
}

/**
 * Run the extractor on a user/assistant exchange. Returns the LLM's proposed
 * facts already coerced to FactInput shape with `source='chat'` filled in.
 * Returns [] on any failure (best-effort; never blocks the user-facing turn).
 */
export async function extractFactsFromChat(input: ExtractChatInput): Promise<FactInput[]> {
  const prompt = `<user_message>\n${truncate(input.userMessage, 1500)}\n</user_message>\n\n<assistant_reply>\n${truncate(input.assistantText, 1500)}\n</assistant_reply>\n\nReturn durable athlete facts.`;
  return runExtraction(prompt, "chat");
}

/**
 * Extract facts from a workout note (completion reflection or skip reason).
 * Adds light context about the session so the model can place the note.
 */
export async function extractFactsFromNote(input: ExtractNoteInput): Promise<FactInput[]> {
  const prompt = `Athlete note on a ${input.context.sessionType} session (${input.context.date}, source=${input.context.source}):\n\n${truncate(input.noteText, 1500)}\n\nReturn durable athlete facts.`;
  return runExtraction(prompt, input.context.source);
}

async function runExtraction(prompt: string, source: FactSource): Promise<FactInput[]> {
  try {
    const provider = getLLMProvider();
    const result = await provider.extractJSON({
      system: SYSTEM_PROMPT,
      prompt,
      schema: ExtractionSchema,
      schemaName: "AthleteFactExtraction",
      schemaDescription: "Zero or more durable athlete facts extracted from a single conversational exchange.",
      temperature: 0.2,
    });
    return result.facts.map((f) => ({
      category: f.category,
      subject: f.subject,
      predicate: f.predicate,
      value: f.value,
      summary: f.summary,
      lifecycle: f.lifecycle,
      confidence: f.confidence,
      source,
    }));
  } catch (e) {
    console.error("fact extractor failed", e);
    return [];
  }
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n) + "…";
}
