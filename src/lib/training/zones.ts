/**
 * Custom HR and Power zone configuration types
 */
import type { ZoneBoundary } from "./calendar-data";

export type HrZoneMode = "custom" | "percent_hrr" | "percent_max" | "percent_threshold";
export type PowerZoneMode = "custom" | "percent_ftp";

export interface HrZoneConfig {
  mode: HrZoneMode;
  resting_hr?: number | null;
  max_hr?: number | null;
  threshold_hr?: number | null;
  boundaries: ZoneBoundary[];
  updated_at: string;
}

export interface PowerZoneConfig {
  mode: PowerZoneMode;
  ftp?: number | null;
  boundaries: ZoneBoundary[];
  updated_at: string;
}

export interface SportZoneConfig {
  hr?: HrZoneConfig | null;
  power?: PowerZoneConfig | null;
}

export interface UserZoneSettings {
  global?: SportZoneConfig | null;
  run?: SportZoneConfig | null;
  bike?: SportZoneConfig | null;
}

export interface UserPowerZones {
  source: "custom" | "legacy";
  mode?: PowerZoneMode;
  ftp?: number | null;
  boundaries: ZoneBoundary[];
  updatedAt: string | null;
}

export const HR_ZONE_NAMES = ["Recovery", "Aerobic", "Tempo", "Threshold", "Anaerobic"] as const;

export const POWER_ZONE_NAMES = [
  "Active Recovery",
  "Endurance",
  "Tempo",
  "Threshold",
  "VO2max",
  "Anaerobic",
  "Neuromuscular",
] as const;

export const HR_ZONE_MODE_LABELS: Record<HrZoneMode, string> = {
  custom: "Full Custom",
  percent_hrr: "% Heart Rate Reserve",
  percent_max: "% Max HR",
  percent_threshold: "% Threshold HR",
};

export const POWER_ZONE_MODE_LABELS: Record<PowerZoneMode, string> = {
  custom: "Full Custom",
  percent_ftp: "% FTP",
};

interface ResolvableHrZones {
  boundaries: ZoneBoundary[];
  bySport?: {
    global?: { boundaries: ZoneBoundary[] };
    run?: { boundaries: ZoneBoundary[] };
    bike?: { boundaries: ZoneBoundary[] };
  };
}

// Pick the best HR zone boundaries for a given activity type. Priority:
// per-sport custom (run / bike) → global custom → top-level fallback (which
// itself is global custom → first custom → Garmin in the API). Aggregate
// views that don't have a specific sport should keep using `.boundaries`.
export function resolveHrZoneBoundaries(
  activityType: string | null | undefined,
  hrZones: ResolvableHrZones | null | undefined,
): ZoneBoundary[] | null {
  if (!hrZones) return null;
  const t = (activityType ?? "").toLowerCase();
  const sport: "run" | "bike" | null = t === "run" ? "run" : t === "bike" || t === "ride" ? "bike" : null;
  const bySport = hrZones.bySport;
  if (sport && bySport?.[sport]?.boundaries.length === 5) return bySport[sport]!.boundaries;
  if (bySport?.global?.boundaries.length === 5) return bySport.global.boundaries;
  return hrZones.boundaries.length === 5 ? hrZones.boundaries : null;
}
