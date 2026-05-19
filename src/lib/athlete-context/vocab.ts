/**
 * Controlled vocabulary for athlete facts. Keeping these as constant unions
 * (not free-text) is what makes the supersedes graph work — the deduper
 * matches on (category, subject, predicate), so unconstrained predicates
 * would balloon the table with near-duplicates.
 *
 * If the extractor returns a category/predicate outside the allowed set,
 * coerce to the closest match or drop the fact. New entries should be added
 * here intentionally, not invented by the LLM.
 */

export const FACT_CATEGORIES = [
  "injury", // ongoing or historical physical issue
  "soreness", // transient muscular/joint complaint
  "preference", // training style, time-of-day, modalities
  "dislike", // explicitly disliked workouts/modalities
  "motivation", // what drives or derails them
  "life_event", // travel, illness, work crunch, family
  "equipment", // gear access changes
  "training_response", // how a session/workout felt — fatigue, recovery, PRs
  "goal_shift", // change in target / aggressiveness
  "schedule_constraint", // recurring availability gotchas
  "identity", // self-described traits ("I'm a heavy sweater", "AM person")
] as const;
export type FactCategory = typeof FACT_CATEGORIES[number];

export const FACT_PREDICATES = [
  "has_pain",
  "has_history_of",
  "recovering_from",
  "prefers",
  "avoids",
  "struggles_with",
  "recovers_well_from",
  "responds_well_to",
  "noted",
  "unavailable",
  "selected",
  "rejected",
] as const;
export type FactPredicate = typeof FACT_PREDICATES[number];

export const FACT_LIFECYCLES = ["chronic", "standing", "recent", "ephemeral"] as const;

/**
 * TTL by lifecycle. Returned in milliseconds; null = chronic (never expires).
 *
 * - chronic   never expires       — verified long-term conditions, identity
 * - standing  90d, refreshes on mention — preferences, habits
 * - recent    14d                 — current soreness, life stress
 * - ephemeral 3d                  — one-off "feeling off" observations
 */
export const LIFECYCLE_TTL_MS: Record<typeof FACT_LIFECYCLES[number], number | null> = {
  chronic: null,
  standing: 90 * 24 * 60 * 60 * 1000,
  recent: 14 * 24 * 60 * 60 * 1000,
  ephemeral: 3 * 24 * 60 * 60 * 1000,
};

export function isKnownCategory(s: string): s is FactCategory {
  return (FACT_CATEGORIES as readonly string[]).includes(s);
}

export function isKnownPredicate(s: string): s is FactPredicate {
  return (FACT_PREDICATES as readonly string[]).includes(s);
}
