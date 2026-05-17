/**
 * LocalStorage helpers for zone preferences (draft state before API save)
 */
import type { HrZoneConfig, PowerZoneConfig, SportZoneConfig } from "./training/zones";

const STORAGE_KEY = "trainer-zone-preferences";

export type ZoneScope = "global" | "run" | "bike";

interface ZonePreferencesStorage {
  global?: SportZoneConfig | null;
  run?: SportZoneConfig | null;
  bike?: SportZoneConfig | null;
}

function getStorage(): ZonePreferencesStorage {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ZonePreferencesStorage;
  } catch {
    return {};
  }
}

function setStorage(data: ZonePreferencesStorage): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getZonePreferences(scope: ZoneScope): SportZoneConfig | null {
  const storage = getStorage();
  return storage[scope] ?? null;
}

export function saveZonePreferences(scope: ZoneScope, config: SportZoneConfig | null): void {
  const storage = getStorage();
  storage[scope] = config;
  setStorage(storage);
}

export function getHrZoneConfig(scope: ZoneScope): HrZoneConfig | null {
  const config = getZonePreferences(scope);
  return config?.hr ?? null;
}

export function getPowerZoneConfig(scope: ZoneScope): PowerZoneConfig | null {
  const config = getZonePreferences(scope);
  return config?.power ?? null;
}

export function saveHrZoneConfig(scope: ZoneScope, hr: HrZoneConfig | null): void {
  const current = getZonePreferences(scope) ?? {};
  saveZonePreferences(scope, { ...current, hr });
}

export function savePowerZoneConfig(scope: ZoneScope, power: PowerZoneConfig | null): void {
  const current = getZonePreferences(scope) ?? {};
  saveZonePreferences(scope, { ...current, power });
}

export function clearZonePreferences(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
