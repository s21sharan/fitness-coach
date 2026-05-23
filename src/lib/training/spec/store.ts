import { createServerClient } from "@/lib/supabase/server";
import {
  type AthleteSpec,
  type SpecConstraints,
  type SpecPayload,
  type SpecSource,
} from "./schema";
import { checkSpecConsistency } from "./check-spec";
import { reviewSpecChange, type SpecReview } from "./review";
import { authorSpecPayload } from "./author";
import { gatherSpecAuthorContext, type SpecAuthorContext } from "./context";

function rowToSpec(row: {
  id: string;
  user_id: string;
  version: number;
  status: string;
  constraints: Record<string, unknown>;
  notes: string[];
  justification: string;
  source: string;
  supersedes_id: string | null;
  created_at: string;
  updated_at: string;
}): AthleteSpec {
  return {
    id: row.id,
    user_id: row.user_id,
    version: row.version,
    status: row.status as AthleteSpec["status"],
    constraints: row.constraints as unknown as SpecConstraints,
    notes: Array.isArray(row.notes) ? row.notes : [],
    justification: row.justification,
    source: row.source as SpecSource,
    supersedes_id: row.supersedes_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function specToPayload(spec: AthleteSpec): SpecPayload {
  return { constraints: spec.constraints, notes: spec.notes };
}

/** The active (current) spec for an athlete, or null if none exists yet. */
export async function getActiveSpec(userId: string): Promise<AthleteSpec | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("athlete_specs")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) return null;
  return rowToSpec(data);
}

export type MutateResult =
  | { ok: true; spec: AthleteSpec; review: SpecReview }
  | { ok: false; stage: "consistency"; errors: string[] }
  | { ok: false; stage: "review"; review: SpecReview }
  | { ok: false; stage: "persist"; error: string };

/**
 * The single gate every spec mutation flows through (onboarding draft, lazy
 * backfill, coach edit):
 *   propose → hard-check (consistency) → supervisor review → persist new version.
 *
 * On success a new 'active' row supersedes the prior one (append-only, versioned).
 */
export async function mutateSpec(opts: {
  userId: string;
  ctx: SpecAuthorContext;
  proposed: SpecPayload;
  source: SpecSource;
  justification: string;
}): Promise<MutateResult> {
  // 1. Hard check — internal consistency / schema validity.
  const consistency = checkSpecConsistency(opts.proposed);
  if (!consistency.ok) {
    return { ok: false, stage: "consistency", errors: consistency.errors };
  }

  const current = await getActiveSpec(opts.userId);

  // 2. Supervisor review — judgment / justification.
  const review = await reviewSpecChange({
    ctx: opts.ctx,
    proposed: opts.proposed,
    justification: opts.justification,
    previous: current ? specToPayload(current) : null,
  });
  if (!review.approved) {
    return { ok: false, stage: "review", review };
  }

  // 3. Persist a new active version, superseding any prior active row.
  const supabase = createServerClient();
  const now = new Date().toISOString();
  if (current) {
    await supabase
      .from("athlete_specs")
      .update({ status: "superseded", updated_at: now })
      .eq("id", current.id);
  }

  const { data, error } = await supabase
    .from("athlete_specs")
    .insert({
      user_id: opts.userId,
      version: (current?.version ?? 0) + 1,
      status: "active",
      constraints: opts.proposed.constraints as unknown as Record<string, unknown>,
      notes: opts.proposed.notes,
      justification: opts.justification,
      source: opts.source,
      supersedes_id: current?.id ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, stage: "persist", error: error?.message ?? "insert failed" };
  }
  return { ok: true, spec: rowToSpec(data), review };
}

/**
 * Lazy backfill: return the active spec, authoring one from the athlete's
 * existing data if none exists yet. Returns null if authoring/persisting fails
 * so callers can proceed without spec enforcement rather than blocking.
 */
export async function ensureActiveSpec(userId: string): Promise<AthleteSpec | null> {
  const existing = await getActiveSpec(userId);
  if (existing) return existing;

  try {
    const ctx = await gatherSpecAuthorContext(userId);
    const proposed = await authorSpecPayload(ctx);
    const result = await mutateSpec({
      userId,
      ctx,
      proposed,
      source: "backfill",
      justification: "Auto-generated from existing profile, goals, history, and durable facts (no prior spec).",
    });
    return result.ok ? result.spec : null;
  } catch (e) {
    console.error("ensureActiveSpec failed", e);
    return null;
  }
}
