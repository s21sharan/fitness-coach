/**
 * Calendar-day helpers for `YYYY-MM-DD` columns (no time-of-day).
 * Avoid `toISOString().slice(0, 10)` — it uses UTC and shifts dates vs the user's calendar.
 */

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidYmd(s: string): boolean {
  if (!YMD_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** Gregorian calendar date of `d` in the runtime's local timezone (browser or server host). */
export function formatCalendarDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Add signed whole days to a calendar date string (Gregorian, no DST on the date line).
 */
export function addCalendarDaysYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new Error(`addCalendarDaysYmd: invalid ymd "${ymd}"`);
  }
  const t = new Date(Date.UTC(y, m - 1, d + deltaDays, 12, 0, 0));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

/** Gregorian calendar date of an instant in a specific IANA time zone (`YYYY-MM-DD`). */
export function formatCalendarDateInTimeZone(isoOrDate: Date | string, timeZone: string): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) {
    return typeof isoOrDate === "string" ? isoOrDate.slice(0, 10) : formatCalendarDateLocal(d);
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function isValidIanaTimeZone(tz: string): boolean {
  const t = tz.trim();
  if (!t) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: t });
    return true;
  } catch {
    return false;
  }
}

const MON0_ABBREV: Record<string, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

const EXACT_DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Map plan-preview `day_label` to Mon=0..Sun=6 (matches `athlete_availability_windows` + prompts). */
export function dayLabelToMon0Index(label: string): number {
  const raw = label.trim().toLowerCase();
  if (!raw) return -1;
  const key3 = raw.slice(0, 3);
  if (key3 in MON0_ABBREV) return MON0_ABBREV[key3 as keyof typeof MON0_ABBREV];
  const exact = EXACT_DAY_LABELS.indexOf(label.trim() as (typeof EXACT_DAY_LABELS)[number]);
  return exact;
}

/** Monday 00:00:00 local for the local calendar week containing `d`. */
export function startOfLocalWeekMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}

/** `YYYY-MM-DD` for the Monday of the local week containing `now`. */
export function weekAnchorMondayYmdFromLocalDate(now = new Date()): string {
  return formatCalendarDateLocal(startOfLocalWeekMonday(now));
}

/**
 * Snap any `YYYY-MM-DD` to the Monday of that civil week (UTC noon anchor for weekday).
 */
export function snapYmdToWeekMonday(ymd: string): string {
  if (!isValidYmd(ymd)) return weekAnchorMondayYmdFromLocalDate(new Date());
  const [y, m, d] = ymd.split("-").map(Number);
  const ref = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dow = ref.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  return addCalendarDaysYmd(ymd, diff);
}
