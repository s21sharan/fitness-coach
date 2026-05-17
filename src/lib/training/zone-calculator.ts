/**
 * Zone calculation utilities for HR and Power zones
 */
import type { ZoneBoundary } from "./calendar-data";

// Standard HR zone percentages for % Max HR method
const HR_MAX_PERCENTAGES = [
  { zone: 1, lowPct: 0.5, highPct: 0.6 },
  { zone: 2, lowPct: 0.6, highPct: 0.7 },
  { zone: 3, lowPct: 0.7, highPct: 0.8 },
  { zone: 4, lowPct: 0.8, highPct: 0.9 },
  { zone: 5, lowPct: 0.9, highPct: 1.0 },
];

// HR zone percentages for % Threshold HR method
const HR_THRESHOLD_PERCENTAGES = [
  { zone: 1, lowPct: 0.0, highPct: 0.8 },
  { zone: 2, lowPct: 0.8, highPct: 0.9 },
  { zone: 3, lowPct: 0.9, highPct: 0.95 },
  { zone: 4, lowPct: 0.95, highPct: 1.0 },
  { zone: 5, lowPct: 1.0, highPct: 1.06 },
];

// Coggan 7-zone power percentages
const POWER_FTP_PERCENTAGES = [
  { zone: 1, lowPct: 0.0, highPct: 0.55 },
  { zone: 2, lowPct: 0.55, highPct: 0.75 },
  { zone: 3, lowPct: 0.75, highPct: 0.9 },
  { zone: 4, lowPct: 0.9, highPct: 1.05 },
  { zone: 5, lowPct: 1.05, highPct: 1.2 },
  { zone: 6, lowPct: 1.2, highPct: 1.5 },
  { zone: 7, lowPct: 1.5, highPct: 2.0 },
];

/**
 * Estimate max HR from age using the standard formula (220 - age)
 */
export function estimateMaxHrFromAge(age: number): number {
  return Math.round(220 - age);
}

/**
 * Compute HR zones from max HR using % Max HR method
 */
export function computeHrZonesFromMaxHr(maxHr: number): ZoneBoundary[] {
  return HR_MAX_PERCENTAGES.map(({ zone, lowPct, highPct }) => ({
    zone,
    low: Math.round(maxHr * lowPct),
    high: Math.round(maxHr * highPct),
  }));
}

/**
 * Compute HR zones using Heart Rate Reserve (Karvonen) method
 * Zone = RHR + (MaxHR - RHR) × percentage
 */
export function computeHrZonesFromHrr(restingHr: number, maxHr: number): ZoneBoundary[] {
  const hrr = maxHr - restingHr;
  return HR_MAX_PERCENTAGES.map(({ zone, lowPct, highPct }) => ({
    zone,
    low: Math.round(restingHr + hrr * lowPct),
    high: Math.round(restingHr + hrr * highPct),
  }));
}

/**
 * Compute HR zones from threshold HR using % Threshold method
 */
export function computeHrZonesFromThreshold(thresholdHr: number): ZoneBoundary[] {
  return HR_THRESHOLD_PERCENTAGES.map(({ zone, lowPct, highPct }) => ({
    zone,
    low: Math.round(thresholdHr * lowPct),
    high: Math.round(thresholdHr * highPct),
  }));
}

/**
 * Compute power zones from FTP using Coggan 7-zone model
 */
export function computePowerZonesFromFtp(ftp: number): ZoneBoundary[] {
  return POWER_FTP_PERCENTAGES.map(({ zone, lowPct, highPct }) => ({
    zone,
    low: Math.round(ftp * lowPct),
    high: Math.round(ftp * highPct),
  }));
}

/**
 * Validate zone boundaries are well-formed
 */
export function validateZoneBoundaries(boundaries: ZoneBoundary[], expectedCount: number): boolean {
  if (!Array.isArray(boundaries) || boundaries.length !== expectedCount) {
    return false;
  }
  for (let i = 0; i < boundaries.length; i++) {
    const b = boundaries[i];
    if (typeof b.zone !== "number" || typeof b.low !== "number" || typeof b.high !== "number") {
      return false;
    }
    if (b.low < 0 || b.high < b.low) {
      return false;
    }
    if (b.zone !== i + 1) {
      return false;
    }
  }
  return true;
}

/**
 * Get default 5-zone HR boundaries (legacy fallback)
 */
export function getDefaultHrZones(): ZoneBoundary[] {
  return [
    { zone: 1, low: 0, high: 120 },
    { zone: 2, low: 120, high: 140 },
    { zone: 3, low: 140, high: 155 },
    { zone: 4, low: 155, high: 170 },
    { zone: 5, low: 170, high: 250 },
  ];
}

/**
 * Get default 7-zone power boundaries (legacy fallback, assumes ~200W FTP)
 */
export function getDefaultPowerZones(): ZoneBoundary[] {
  return computePowerZonesFromFtp(200);
}
