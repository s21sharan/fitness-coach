import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { COACHING_PRINCIPLES } from "@/lib/training/coaching-principles";
import { renderSpecForPrompt } from "./render";
import { renderAuthorContext, type SpecAuthorContext } from "./context";
import type { SpecPayload } from "./schema";

export const specReviewSchema = z.object({
  approved: z.boolean(),
  reason: z.string(),
  concerns: z.array(z.string()),
});
export type SpecReview = z.infer<typeof specReviewSchema>;

const REVIEW_SYSTEM_PROMPT = `You are a supervising head coach reviewing a proposed CONSTRAINT SPEC for an athlete before it becomes the rulebook their plans are generated against. Your job is judgment, not arithmetic (a separate deterministic check already verified internal consistency).

${COACHING_PRINCIPLES}

Approve the spec ONLY if every value is reasonable and safe for THIS athlete:
- Caps match the athlete's level (e.g. max_quality_sessions_per_week=3 is wrong for a beginner; 48h heavy-legs→quality-run spacing should not be loosened to 24h without elite recovery).
- Injury constraints (forbidden patterns/modalities) match reported injuries — neither missing a real one nor inventing a fake one.
- Day restrictions match what the athlete actually said.

When reviewing an EDIT, also judge whether the stated justification genuinely supports the change. REJECT changes that loosen a safety constraint without a real, athlete-grounded reason (e.g. "to make plans easier to generate" is NOT a valid reason — that would defeat the guardrail).

Set approved=false with specific concerns if anything is off. Be strict on safety, lenient on style.`;

/**
 * Supervisor review of a proposed spec (initial or edited). This is the
 * judgment gate that the deterministic consistency check can't cover — is the
 * value actually appropriate for this athlete, and (for edits) does the
 * justification genuinely support the change?
 */
export async function reviewSpecChange(opts: {
  ctx: SpecAuthorContext;
  proposed: SpecPayload;
  justification: string;
  previous?: SpecPayload | null;
}): Promise<SpecReview> {
  const sections: string[] = [];
  sections.push(`ATHLETE CONTEXT:\n${renderAuthorContext(opts.ctx)}`);
  if (opts.previous) {
    sections.push(`CURRENT (active) SPEC:\n${renderSpecForPrompt(opts.previous)}`);
  }
  sections.push(`PROPOSED SPEC:\n${renderSpecForPrompt(opts.proposed)}`);
  sections.push(`JUSTIFICATION FOR THIS ${opts.previous ? "CHANGE" : "SPEC"}:\n${opts.justification || "(none provided)"}`);

  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-6"),
    schema: specReviewSchema,
    system: REVIEW_SYSTEM_PROMPT,
    prompt: sections.join("\n\n"),
    providerOptions: { anthropic: { structuredOutputMode: "jsonTool" } },
  });
  return object;
}
