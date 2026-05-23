import { specPayloadSchema, type SpecPayload, type SpecConstraints } from "./schema";

export interface SpecConsistencyResult {
  ok: boolean;
  errors: string[];
}

/**
 * Hard check #1: is the spec itself well-formed and internally consistent?
 *
 * This is purely mechanical — it does NOT judge whether the values are *good*
 * for the athlete (that's the supervisor review's job). It only catches
 * contradictions a generated plan could never satisfy, so we never persist a
 * spec that's impossible by construction.
 */
export function checkSpecConsistency(payload: unknown): SpecConsistencyResult {
  const parsed = specPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    };
  }

  const errors: string[] = [];
  const c: SpecConstraints = parsed.data.constraints;

  if (c.lifting_days_per_week !== null && c.lifting_days_per_week > c.days_per_week) {
    errors.push(
      `lifting_days_per_week (${c.lifting_days_per_week}) exceeds days_per_week (${c.days_per_week}) — can't lift more days than you train.`,
    );
  }

  if (c.max_quality_sessions_per_week > c.days_per_week) {
    errors.push(
      `max_quality_sessions_per_week (${c.max_quality_sessions_per_week}) exceeds days_per_week (${c.days_per_week}).`,
    );
  }

  // A required-modality-days entry for a forbidden modality is a contradiction.
  for (const r of c.required_modality_days) {
    if (c.forbidden_modalities.includes(r.modality)) {
      errors.push(
        `required_modality_days names "${r.modality}" but it is also in forbidden_modalities.`,
      );
    }
    if (r.days.length > c.days_per_week) {
      errors.push(
        `required_modality_days for "${r.modality}" lists ${r.days.length} days but days_per_week is ${c.days_per_week}.`,
      );
    }
  }

  // If strength is forbidden, lifting_days must be 0/null.
  if (c.forbidden_modalities.includes("strength") && (c.lifting_days_per_week ?? 0) > 0) {
    errors.push(
      `strength is forbidden but lifting_days_per_week is ${c.lifting_days_per_week}.`,
    );
  }

  return { ok: errors.length === 0, errors };
}

/** Type guard helper for callers that have already validated elsewhere. */
export function isValidSpecPayload(payload: unknown): payload is SpecPayload {
  return specPayloadSchema.safeParse(payload).success;
}
