// Provider capability registry for activity deduplication.
//
// Each provider declares which activity categories it covers and how
// authoritative it is for that category (priority). The reconciler uses
// this to pick a winner when the same real-world activity appears across
// multiple sources.
//
// To add a new provider (e.g. Polar, WHOOP), add an entry below and
// teach its sync worker to classify activities into ActivityCategory.

export type ActivityCategory = "run" | "bike" | "swim" | "strength" | "other";

export type ProviderId = "hevy" | "strava" | "garmin";

export interface ProviderCoverage {
  // Higher wins. Anchor values:
  //  100 = dedicated platform for this category (Hevy for strength)
  //   60 = enriched general tracker (Garmin run/bike/swim)
  //   50 = general tracker (Strava run/bike/swim)
  //   30 = general tracker, secondary category (Garmin strength)
  //   10 = general tracker, weak coverage (Strava strength, generic "other")
  priority: number;
  // Informational — "dedicated" providers strongly outrank "general" for
  // their primary categories regardless of recency/enrichment.
  level: "dedicated" | "general" | "enrichment";
}

export interface Provider {
  id: ProviderId;
  coverage: Partial<Record<ActivityCategory, ProviderCoverage>>;
}

export const PROVIDERS: Provider[] = [
  {
    id: "hevy",
    coverage: {
      strength: { priority: 100, level: "dedicated" },
    },
  },
  {
    id: "strava",
    coverage: {
      run: { priority: 50, level: "general" },
      bike: { priority: 50, level: "general" },
      swim: { priority: 50, level: "general" },
      strength: { priority: 10, level: "general" },
      other: { priority: 10, level: "general" },
    },
  },
  {
    id: "garmin",
    coverage: {
      run: { priority: 60, level: "general" },
      bike: { priority: 60, level: "general" },
      swim: { priority: 60, level: "general" },
      strength: { priority: 30, level: "general" },
      other: { priority: 30, level: "general" },
    },
  },
];

export function getProvider(id: string): Provider | null {
  return PROVIDERS.find((p) => p.id === id) ?? null;
}

export function getCoverage(provider: string, category: ActivityCategory): ProviderCoverage | null {
  return getProvider(provider)?.coverage[category] ?? null;
}

// Effective priority for a (provider, category) pair given the user's
// currently-active integrations. A provider whose integration is no longer
// active drops to 0, so previously-suppressed rows from a still-active
// provider can re-surface on the next reconcile.
export function effectivePriority(
  provider: string,
  category: ActivityCategory,
  activeProviders: ReadonlySet<string>,
): number {
  if (!activeProviders.has(provider)) return 0;
  return getCoverage(provider, category)?.priority ?? 0;
}
