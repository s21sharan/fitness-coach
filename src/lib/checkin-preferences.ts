export interface CheckinPreferences {
  enabled: boolean;
  frequencyWeeks: number;
}

const STORAGE_KEY = "trainer-checkin-preferences";

const DEFAULTS: CheckinPreferences = {
  enabled: true,
  frequencyWeeks: 1,
};

export function getCheckinPreferences(): CheckinPreferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...DEFAULTS, ...JSON.parse(saved) };
  } catch {}
  return DEFAULTS;
}

export function saveCheckinPreferences(prefs: CheckinPreferences): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
