// Unit preference system
// Stored in localStorage, read by all components that display distances/weights

export type DistanceUnit = "km" | "mi";
export type WeightUnit = "kg" | "lbs";

export interface UnitPreferences {
  distance: DistanceUnit;
  weight: WeightUnit;
}

const STORAGE_KEY = "hybro-unit-preferences";

const DEFAULTS: UnitPreferences = {
  distance: "mi",
  weight: "lbs",
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
