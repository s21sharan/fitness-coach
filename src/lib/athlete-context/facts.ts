import { createServerClient } from "@/lib/supabase/server";
import type { AthleteFact, FactInput } from "./types";
import { expiryForLifecycle } from "./lifecycle";
import { findActiveMatch } from "./deduper";

const FACT_COLUMNS =
  "id, user_id, category, subject, predicate, value, summary, lifecycle, confidence, status, observed_at, expires_at, source, source_ref_table, source_ref_id, supersedes_id, created_at, updated_at";

/**
 * Insert a fact with dedupe + supersede semantics:
 *
 * - If no active fact matches (user_id, category, subject, predicate) → plain insert.
 * - If a match exists with the SAME structured `value` → refresh the existing
 *   row (bump observed_at, recompute expires_at). The summary is replaced
 *   only if the new summary is non-empty and longer — long-form text wins.
 * - If a match exists with a DIFFERENT `value` → insert new with
 *   supersedes_id = match.id, and mark the old row status='superseded'.
 *
 * Returns the resulting fact (whichever row is now the active one).
 */
export async function insertFact(userId: string, input: FactInput): Promise<AthleteFact | null> {
  const supabase = createServerClient();
  const existing = await findActiveMatch(supabase, userId, input);
  const now = new Date();
  const expiresAt = expiryForLifecycle(input.lifecycle, now);

  if (existing) {
    if (valuesEqual(existing.value, input.value ?? null)) {
      const newSummary =
        input.summary.length > existing.summary.length ? input.summary : existing.summary;
      const { data, error } = await supabase
        .from("athlete_facts")
        .update({
          observed_at: now.toISOString(),
          expires_at: expiresAt,
          summary: newSummary,
          confidence: Math.max(existing.confidence, input.confidence ?? 0.8),
          updated_at: now.toISOString(),
        })
        .eq("id", existing.id)
        .select(FACT_COLUMNS)
        .single();
      if (error) {
        console.error("insertFact refresh error", error);
        return existing;
      }
      return data as AthleteFact;
    }

    // Contradiction → supersede.
    const { data: inserted, error: insertErr } = await supabase
      .from("athlete_facts")
      .insert({
        user_id: userId,
        category: input.category,
        subject: input.subject ?? null,
        predicate: input.predicate,
        value: input.value ?? null,
        summary: input.summary,
        lifecycle: input.lifecycle,
        confidence: input.confidence ?? 0.8,
        observed_at: now.toISOString(),
        expires_at: expiresAt,
        source: input.source,
        source_ref_table: input.source_ref_table ?? null,
        source_ref_id: input.source_ref_id ?? null,
        supersedes_id: existing.id,
      })
      .select(FACT_COLUMNS)
      .single();
    if (insertErr || !inserted) {
      console.error("insertFact supersede insert error", insertErr);
      return null;
    }
    await supabase
      .from("athlete_facts")
      .update({ status: "superseded", updated_at: now.toISOString() })
      .eq("id", existing.id);
    return inserted as AthleteFact;
  }

  const { data, error } = await supabase
    .from("athlete_facts")
    .insert({
      user_id: userId,
      category: input.category,
      subject: input.subject ?? null,
      predicate: input.predicate,
      value: input.value ?? null,
      summary: input.summary,
      lifecycle: input.lifecycle,
      confidence: input.confidence ?? 0.8,
      observed_at: now.toISOString(),
      expires_at: expiresAt,
      source: input.source,
      source_ref_table: input.source_ref_table ?? null,
      source_ref_id: input.source_ref_id ?? null,
    })
    .select(FACT_COLUMNS)
    .single();
  if (error) {
    console.error("insertFact error", error);
    return null;
  }
  return data as AthleteFact;
}

/**
 * Lazy expiration sweep + fetch: marks any active facts whose expires_at has
 * passed as 'expired' first, then returns the remaining active facts. The
 * sweep is best-effort — a failure here still returns whatever active rows
 * we can read.
 */
export async function fetchActiveFacts(userId: string, limit = 60): Promise<AthleteFact[]> {
  const supabase = createServerClient();
  await supabase
    .from("athlete_facts")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("status", "active")
    .not("expires_at", "is", null)
    .lt("expires_at", new Date().toISOString());

  const { data, error } = await supabase
    .from("athlete_facts")
    .select(FACT_COLUMNS)
    .eq("user_id", userId)
    .eq("status", "active")
    .order("observed_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("fetchActiveFacts error", error);
    return [];
  }
  return (data ?? []) as AthleteFact[];
}

export async function archiveFact(userId: string, factId: string): Promise<boolean> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("athlete_facts")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", factId)
    .eq("user_id", userId);
  return !error;
}

export async function updateFactSummary(
  userId: string,
  factId: string,
  summary: string,
): Promise<boolean> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("athlete_facts")
    .update({ summary, updated_at: new Date().toISOString() })
    .eq("id", factId)
    .eq("user_id", userId);
  return !error;
}

export async function listAllFactsForUser(userId: string, limit = 200): Promise<AthleteFact[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("athlete_facts")
    .select(FACT_COLUMNS)
    .eq("user_id", userId)
    .order("observed_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as AthleteFact[];
}

function valuesEqual(a: Record<string, unknown> | null, b: Record<string, unknown> | null): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  try {
    return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
  } catch {
    return false;
  }
}

function sortKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    const v = obj[k];
    out[k] = v && typeof v === "object" && !Array.isArray(v)
      ? sortKeys(v as Record<string, unknown>)
      : v;
  }
  return out;
}
