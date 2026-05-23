import { z } from "zod";
import { tool } from "ai";
import { specConstraintsSchema, type SpecPayload } from "@/lib/training/spec/schema";
import { ensureActiveSpec, mutateSpec, specToPayload } from "@/lib/training/spec/store";
import { gatherSpecAuthorContext } from "@/lib/training/spec/context";

/**
 * Coach tool to EDIT the athlete's constraint spec — the rulebook their plans
 * are generated against. This is deliberately separate from plan generation:
 * generation only READS the spec, while this tool is the only way to change it,
 * and every change passes through hard-check + supervisor review.
 *
 * Edits must be justified by real, athlete-grounded information (they reported
 * an injury healed, they want more volume, recovery markers shifted). The
 * supervisor rejects changes whose only purpose is to make a plan pass.
 */
export function updateConstraintsTool(userId: string) {
  return tool({
    description:
      "Edit the athlete's coaching constraint spec (the hard rules their plans must obey: weekly day caps, max quality sessions, heavy-legs→quality-run spacing, forbidden movements for injuries, modality day restrictions). Use ONLY when you have a real, athlete-grounded reason — e.g. they told you an injury healed, they want to change training volume, or their recovery markers shifted. Do NOT use this to make a plan easier to generate. Provide only the fields you want to change.",
    inputSchema: z.object({
      justification: z
        .string()
        .describe(
          "Why this change is warranted, grounded in what the athlete said or a real change in their situation. This is reviewed — vague or convenience-driven justifications are rejected.",
        ),
      constraints: specConstraintsSchema
        .partial()
        .describe("Only the constraint fields to change. Omitted fields keep their current values."),
      notes: z
        .array(z.string())
        .optional()
        .describe("Optional: replace the advisory coaching notes."),
    }),
    execute: async ({ justification, constraints, notes }) => {
      const current = await ensureActiveSpec(userId);
      if (!current) {
        return { success: false, error: "Could not load or create the athlete's spec." };
      }

      const proposed: SpecPayload = {
        constraints: { ...current.constraints, ...(constraints ?? {}) },
        notes: notes ?? current.notes,
      };

      const ctx = await gatherSpecAuthorContext(userId);
      const result = await mutateSpec({ userId, ctx, proposed, source: "coach_edit", justification });

      if (result.ok) {
        return {
          success: true,
          applied: true,
          version: result.spec.version,
          review_note: result.review.reason,
          hint: "The constraint change is now active and will apply to all future plan generations. Tell the athlete what changed and why.",
        };
      }
      if (result.stage === "consistency") {
        return { success: false, applied: false, stage: "consistency", errors: result.errors };
      }
      if (result.stage === "review") {
        return {
          success: false,
          applied: false,
          stage: "review",
          rejected_reason: result.review.reason,
          concerns: result.review.concerns,
          hint: "The supervisor rejected this change. Do not retry the same change — reconsider whether it's actually warranted, or explain to the athlete why it can't be made.",
        };
      }
      return { success: false, applied: false, stage: "persist", error: result.error };
    },
  });
}
