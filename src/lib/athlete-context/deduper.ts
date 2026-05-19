import type { SupabaseClient } from "@supabase/supabase-js";
import type { AthleteFact, FactInput } from "./types";

/**
 * Find a single active fact matching (user_id, category, subject, predicate).
 * `subject` is treated as null-tolerant — both NULL and an empty string match
 * the same bucket, but distinct non-empty subjects are different.
 */
export async function findActiveMatch(
  supabase: SupabaseClient,
  userId: string,
  input: Pick<FactInput, "category" | "subject" | "predicate">,
): Promise<AthleteFact | null> {
  const FACT_COLUMNS =
    "id, user_id, category, subject, predicate, value, summary, lifecycle, confidence, status, observed_at, expires_at, source, source_ref_table, source_ref_id, supersedes_id, created_at, updated_at";

  let query = supabase
    .from("athlete_facts")
    .select(FACT_COLUMNS)
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("category", input.category)
    .eq("predicate", input.predicate);
  if (input.subject == null || input.subject === "") {
    query = query.is("subject", null);
  } else {
    query = query.eq("subject", input.subject);
  }
  const { data } = await query.limit(1).maybeSingle();
  return (data as AthleteFact | null) ?? null;
}
