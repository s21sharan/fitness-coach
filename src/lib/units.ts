// Unit preference system
// Stored in localStorage, read by all components that display distances/weights

export type DistanceUnit = "km" | "mi";
export type WeightUnit = "kg" | "lbs";
export type SwimDistanceUnit = "m" | "yd";

export interface UnitPreferences {
  distance: DistanceUnit;
  weight: WeightUnit;
  swimDistance: SwimDistanceUnit;
}

const STORAGE_KEY = "hybro-unit-preferences";

const DEFAULTS: UnitPreferences = {
  distance: "mi",
  weight: "lbs",
  swimDistance: "m",
};

export function getUnitPreferences(): UnitPreferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...DEFAULTS, ...JSON.parse(saved) };
  } catch {}
  return DEFAULTS;
}

export function saveUnitPreferences(prefs: UnitPreferences): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

// Conversion helpers
const KM_TO_MI = 0.621371;
const KG_TO_LBS = 2.20462;
const M_PER_KM = 1000;
const YD_PER_KM = 1093.6133;

export function convertDistance(km: number, unit: DistanceUnit): number {
  if (unit === "mi") return Math.round(km * KM_TO_MI * 100) / 100;
  return Math.round(km * 100) / 100;
}

export function convertWeight(kg: number, unit: WeightUnit): number {
  if (unit === "lbs") return Math.round(kg * KG_TO_LBS * 10) / 10;
  return Math.round(kg * 10) / 10;
}

export function convertPace(minPerKm: number, unit: DistanceUnit): number {
  // min/km -> min/mi
  if (unit === "mi") return Math.round(minPerKm / KM_TO_MI * 100) / 100;
  return Math.round(minPerKm * 100) / 100;
}

export function distanceLabel(unit: DistanceUnit): string {
  return unit === "mi" ? "mi" : "km";
}

export function weightLabel(unit: WeightUnit): string {
  return unit === "lbs" ? "lbs" : "kg";
}

export function paceLabel(unit: DistanceUnit): string {
  return unit === "mi" ? "/mi" : "/km";
}

export function fmtDist(km: number, unit: DistanceUnit): string {
  const val = convertDistance(km, unit);
  return val >= 10 ? val.toFixed(1) : val.toFixed(2);
}

export function fmtPace(minPerKm: number, unit: DistanceUnit): string {
  const pace = convertPace(minPerKm, unit);
  const mins = Math.floor(pace);
  const secs = Math.round((pace - mins) * 60);
  return `${mins}:${String(secs).padStart(2, "0")}${paceLabel(unit)}`;
}

export function fmtWeight(valueInStoredUnit: number, fromUnit: WeightUnit, toUnit: WeightUnit): string {
  if (fromUnit === toUnit) return `${valueInStoredUnit}`;
  if (fromUnit === "lbs" && toUnit === "kg") return `${Math.round(valueInStoredUnit / KG_TO_LBS * 10) / 10}`;
  if (fromUnit === "kg" && toUnit === "lbs") return `${Math.round(valueInStoredUnit * KG_TO_LBS * 10) / 10}`;
  return `${valueInStoredUnit}`;
}

// ─── Swim-specific helpers ──────────────────────────────────────────────────

export function convertSwimDistance(km: number, unit: SwimDistanceUnit): number {
  if (unit === "yd") return Math.round(km * YD_PER_KM);
  return Math.round(km * M_PER_KM);
}

export function swimDistanceLabel(unit: SwimDistanceUnit): string {
  return unit;
}

export function fmtSwimDist(km: number, unit: SwimDistanceUnit): string {
  return convertSwimDistance(km, unit).toLocaleString();
}

// Swim pace is conventionally min/100m or min/100yd.
// Input is min/km (matches Garmin split `pace_min_km` and plan `target_pace_min_km`).
export function convertSwimPace(minPerKm: number, unit: SwimDistanceUnit): number {
  const minPerUnit = unit === "yd" ? minPerKm / YD_PER_KM : minPerKm / M_PER_KM;
  return minPerUnit * 100; // min per 100 units
}

// cardio_logs.pace_or_speed is min/km for runs but km/h for bikes & swims
// (see server/src/sync/strava.ts and services/garmin/garmin_client.py).
// This converts that speed value to swim pace (min per 100m / 100yd).
export function swimPaceFromSpeedKmh(speedKmh: number, unit: SwimDistanceUnit): number {
  if (speedKmh <= 0) return 0;
  const unitsPerKm = unit === "yd" ? YD_PER_KM : M_PER_KM;
  // time for 100 units, in minutes
  return 6000 / (unitsPerKm * speedKmh);
}

export function swimPaceLabel(unit: SwimDistanceUnit): string {
  return unit === "yd" ? "/100yd" : "/100m";
}

function formatPaceMSS(decimalMins: number, suffix: string): string {
  const mins = Math.floor(decimalMins);
  const secs = Math.round((decimalMins - mins) * 60);
  return `${mins}:${String(secs).padStart(2, "0")}${suffix}`;
}

export function fmtSwimPace(minPerKm: number, unit: SwimDistanceUnit): string {
  return formatPaceMSS(convertSwimPace(minPerKm, unit), swimPaceLabel(unit));
}

export function fmtSwimPaceFromSpeedKmh(speedKmh: number, unit: SwimDistanceUnit): string {
  return formatPaceMSS(swimPaceFromSpeedKmh(speedKmh, unit), swimPaceLabel(unit));
}

// ─── Type-aware cardio helpers ──────────────────────────────────────────────
// Activity types come from cardio_logs.type — values include "run", "bike",
// "ride", "swim", "swimming", etc. Anything that looks like swimming routes
// through the swim formatters; everything else uses the standard distance unit.

export function isSwimType(type: string | null | undefined): boolean {
  if (!type) return false;
  return /swim/i.test(type);
}

export function cardioDistanceLabel(type: string | null | undefined, prefs: UnitPreferences): string {
  return isSwimType(type) ? swimDistanceLabel(prefs.swimDistance) : distanceLabel(prefs.distance);
}

export function cardioPaceLabel(type: string | null | undefined, prefs: UnitPreferences): string {
  return isSwimType(type) ? swimPaceLabel(prefs.swimDistance) : paceLabel(prefs.distance);
}

export function fmtCardioDist(km: number, type: string | null | undefined, prefs: UnitPreferences): string {
  return isSwimType(type) ? fmtSwimDist(km, prefs.swimDistance) : fmtDist(km, prefs.distance);
}

// For cardio_logs.pace_or_speed: runs store min/km, swims/bikes store km/h.
// Swim path routes through swimPaceFromSpeedKmh; runs use the standard pace path.
export function fmtCardioPace(paceOrSpeed: number, type: string | null | undefined, prefs: UnitPreferences): string {
  if (isSwimType(type)) return fmtSwimPaceFromSpeedKmh(paceOrSpeed, prefs.swimDistance);
  return fmtPace(paceOrSpeed, prefs.distance);
}
