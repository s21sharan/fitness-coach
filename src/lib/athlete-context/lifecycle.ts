import { LIFECYCLE_TTL_MS } from "./vocab";
import type { AthleteFact, FactLifecycle } from "./types";

/**
 * Returns the expiry timestamp (ISO string) for a fact observed at
 * `observedAt` with the given lifecycle, or null for chronic facts.
 */
export function expiryForLifecycle(
  lifecycle: FactLifecycle,
  observedAt: Date = new Date(),
): string | null {
  const ttl = LIFECYCLE_TTL_MS[lifecycle];
  if (ttl == null) return null;
  return new Date(observedAt.getTime() + ttl).toISOString();
}

export function isExpired(fact: Pick<AthleteFact, "expires_at">, now: Date = new Date()): boolean {
  if (!fact.expires_at) return false;
  return new Date(fact.expires_at).getTime() <= now.getTime();
}

/**
 * Ordering used by the system prompt: chronic first (most durable),
 * then standing, then most recently observed. Status filtering happens
 * upstream in fetchActiveFacts — this is pure presentation order.
 */
const LIFECYCLE_RANK: Record<FactLifecycle, number> = {
  chronic: 0,
  standing: 1,
  recent: 2,
  ephemeral: 3,
};

export function orderFactsForPrompt(facts: AthleteFact[]): AthleteFact[] {
  return [...facts].sort((a, b) => {
    const lr = LIFECYCLE_RANK[a.lifecycle] - LIFECYCLE_RANK[b.lifecycle];
    if (lr !== 0) return lr;
    return new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime();
  });
}
