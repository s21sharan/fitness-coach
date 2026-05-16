import { formatCalendarDateLocal, isValidYmd } from "@/lib/dates/local-calendar";

/** Today's date in local calendar terms (YYYY-MM-DD). */
export function todayYmdLocal(): string {
  return formatCalendarDateLocal(new Date());
}

export type DateGuardResult = { ok: true } | { ok: false; error: string };

/**
 * Reject dates before today. Today and future are allowed.
 * The error string is intentionally stable so the AI coach can recognize it.
 */
export function assertDateNotPast(date: string, today: string = todayYmdLocal()): DateGuardResult {
  if (!isValidYmd(date)) {
    return { ok: false, error: `Invalid date "${date}". Use YYYY-MM-DD format.` };
  }
  if (date < today) {
    return {
      ok: false,
      error: `Cannot schedule on ${date} — past dates are read-only. Pick ${today} or later.`,
    };
  }
  return { ok: true };
}
