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
