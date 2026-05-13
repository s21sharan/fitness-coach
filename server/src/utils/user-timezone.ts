import { supabase } from "../db.js";
import { isValidIanaTimeZone } from "./activity-calendar-date.js";

/** Falls back to `Etc/UTC` (matches legacy `iso.slice(0, 10)` for `Z` timestamps). */
export async function fetchUserTimeZone(userId: string): Promise<string> {
  const { data } = await supabase.from("user_profiles").select("timezone").eq("user_id", userId).maybeSingle();
  const tz = data?.timezone?.trim();
  if (tz && isValidIanaTimeZone(tz)) return tz;
  return "Etc/UTC";
}
