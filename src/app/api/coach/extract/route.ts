import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { getLLMProvider, isLLMConfigured } from "@/lib/llm";
import { AVAILABILITY_RULE_OPTIONS } from "@/lib/onboarding/types";

const ChatInsertionPoint = z.enum(["goals", "availability", "plan_preview", "coach_style"]);

const ExtractRequestSchema = z.object({
  insertion_point: ChatInsertionPoint,
  raw_text: z.string().min(1).max(4000),
  context: z.record(z.string(), z.unknown()).optional(),
});

const ExtractedSchema = z.object({
  constraints: z.array(z.string()).optional(),
  conflicts: z.array(z.string()).optional(),
  hidden_risks: z.array(z.string()).optional(),
  tone: z.string().nullable().optional(),
  goals: z.array(z.string()).optional(),
  notes: z.array(z.string()).optional(),
  rules: z.array(z.string()).optional(),
});

type Extracted = z.infer<typeof ExtractedSchema>;

const SYSTEM_PROMPT = `You are an expert fitness coach analyzing notes from an athlete's onboarding.
Extract structured tags from their free-text note so a training planner can use them later.
Be concise, use short phrases (not full sentences), and prefer matching the user's own words.
Never invent constraints they did not state.`;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ExtractRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { insertion_point, raw_text, context } = parsed.data;

  let extracted: Extracted;
  if (!isLLMConfigured()) {
    extracted = heuristicExtract(raw_text, insertion_point);
  } else {
    try {
      const llm = getLLMProvider();
      extracted = await llm.extractJSON<Extracted>({
        system: SYSTEM_PROMPT,
        prompt: buildPrompt(insertion_point, raw_text, context),
        schema: ExtractedSchema,
        schemaName: "AthleteNoteExtraction",
        schemaDescription:
          "Structured tags extracted from an athlete's free-text onboarding note.",
        temperature: 0.2,
      });
    } catch (err) {
      console.error("Coach extract LLM error:", err);
      extracted = heuristicExtract(raw_text, insertion_point);
    }
  }

  // Persist (best-effort — don't fail the request if this errors)
  try {
    const supabase = createServerClient();
    await supabase.from("athlete_chat_notes").insert({
      user_id: userId,
      insertion_point,
      raw_text,
      extracted: extracted as Record<string, unknown>,
    });
  } catch (err) {
    console.error("Failed to persist chat note:", err);
  }

  return NextResponse.json({ extracted });
}

function buildPrompt(
  insertion_point: z.infer<typeof ChatInsertionPoint>,
  text: string,
  context?: Record<string, unknown>
): string {
  const ruleOptions = AVAILABILITY_RULE_OPTIONS.map((r) => `- ${r.value}: ${r.label}`).join("\n");

  const focus =
    insertion_point === "goals"
      ? `Focus: extract athlete goals, conflicting goals, hidden risks ("I want X but worry about Y"), and the coaching tone the athlete prefers.`
      : insertion_point === "availability"
      ? `Focus: extract availability constraints and scheduling rules. When the user describes a rule that matches one of the following keys, include it in "rules":\n${ruleOptions}\nAlso emit any free-form constraints as short phrases in "constraints".`
      : insertion_point === "plan_preview"
      ? `Focus: extract specific revisions the athlete wants to the proposed plan (move sessions, drop sessions, swap days, intensity preferences). Capture conflicts and constraints.`
      : `Focus: extract preferred coaching tone and style cues. Capture personality keywords in "tone" and any constraints they imply in "constraints".`;

  return [
    `Insertion point: ${insertion_point}`,
    focus,
    context ? `Profile context: ${JSON.stringify(context).slice(0, 1500)}` : "",
    `User's note:\n"""\n${text}\n"""`,
    `Return a JSON object with fields: constraints (string[]), conflicts (string[]), hidden_risks (string[]), tone (string|null), goals (string[]), notes (string[]), rules (string[]). Omit fields you don't have evidence for.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function heuristicExtract(text: string, insertion_point: string): Extracted {
  // Minimal fallback if no LLM key configured.
  const lower = text.toLowerCase();
  const rules: string[] = [];
  const constraints: string[] = [];

  for (const rule of AVAILABILITY_RULE_OPTIONS) {
    if (lower.includes(rule.label.toLowerCase())) rules.push(rule.value);
  }
  if (lower.includes("morning")) rules.push("prefer_morning");
  if (lower.includes("evening")) rules.push("prefer_evening");
  if (lower.includes("rest day")) rules.push("keep_one_rest_day");
  if (lower.includes("long run") && lower.includes("weekend"))
    rules.push("long_run_weekend");
  if (lower.includes("treadmill") && (lower.includes("can't") || lower.includes("cannot") || lower.includes("no")))
    rules.push("no_treadmill");

  if (text.length > 0) constraints.push(text.slice(0, 140));

  return {
    constraints,
    rules: dedupe(rules),
    notes: [`Heuristic extraction (LLM not configured) at insertion ${insertion_point}.`],
  };
}

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items));
}
