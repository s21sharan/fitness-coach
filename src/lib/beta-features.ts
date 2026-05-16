export type BetaFeature = "garmin";

interface BetaFlags {
  garmin?: boolean;
}

const STORAGE_KEY = "trainer-beta-acknowledged";

function read(): BetaFlags {
  if (typeof window === "undefined") return {};
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved) as BetaFlags;
  } catch {}
  return {};
}

export function isBetaAcknowledged(feature: BetaFeature): boolean {
  return !!read()[feature];
}

export function setBetaAcknowledged(feature: BetaFeature): void {
  if (typeof window === "undefined") return;
  const next = { ...read(), [feature]: true };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
