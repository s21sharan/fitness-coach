import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { COACHING_PRINCIPLES } from "@/lib/training/coaching-principles";
import { specPayloadSchema, type SpecPayload } from "./schema";
import { renderAuthorContext, type SpecAuthorContext } from "./context";

const AUTHOR_SYSTEM_PROMPT = `You author a per-athlete COACHING CONSTRAINT SPEC: the hard rules a training plan for THIS athlete must obey. These values are athlete-specific and will be machine-enforced against every plan we generate, so they must be correct and tailored — not generic.

${COACHING_PRINCIPLES}

Use the principles above as your PRIOR, then adapt every value to this specific athlete:

- days_per_week: the athlete's stated weekly availability (the plan may use fewer on deloads, never more).
- lifting_days_per_week: desired strength sessions/week (null only if they never lift).
- max_quality_sessions_per_week: usually 2. Use 3 ONLY for advanced athletes with high volume AND strong recovery markers. Use 1 (or 0) for beginners, injured, or overreaching athletes.
- min_hours_between_heavy_lower_and_quality_run: 48 by default; 24 only for an elite athlete with excellent recovery.
- allow_quality_back_to_back: almost always false. true only for advanced athletes who specifically need it.
- max_weekly_volume_increase_pct: 10 for runners building volume; null if the athlete isn't ramping running volume (pure lifters, fixed maintenance).
- forbidden_movement_patterns: ONLY from real injuries/limitations the athlete reported. Empty otherwise. Options: loaded_knee_flexion, heavy_hinge, running_impact, jumping_plyometric, overhead_press, spinal_loading.
- forbidden_modalities: ONLY when an injury/preference rules out a whole modality (e.g. "run" while a knee heals). Empty otherwise.
- required_modality_days: ONLY when the athlete stated a day restriction (e.g. swim only Tue/Thu for pool access). Empty otherwise.
- notes: 1-4 short free-text coaching intents that aren't crisp hard rules (e.g. "responds well to higher lifting volume", "prefers morning sessions").

CRITICAL: Do not invent injuries, day restrictions, or forbidden movements that the athlete did not report. An over-tight spec wrongly blocks good plans. Be precise, not paranoid.`;

/**
 * Author a constraint spec payload for an athlete from their context. The
 * result still passes through checkSpecConsistency + supervisor review before
 * it's persisted (see mutateSpec).
 */
export async function authorSpecPayload(ctx: SpecAuthorContext): Promise<SpecPayload> {
  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-6"),
    schema: specPayloadSchema,
    system: AUTHOR_SYSTEM_PROMPT,
    prompt: `Author the constraint spec for this athlete:\n\n${renderAuthorContext(ctx)}`,
    providerOptions: { anthropic: { structuredOutputMode: "jsonTool" } },
  });
  return object;
}
