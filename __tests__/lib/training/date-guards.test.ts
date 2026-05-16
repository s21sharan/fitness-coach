import { describe, it, expect } from "vitest";
import { assertDateNotPast, todayYmdLocal } from "@/lib/training/date-guards";

describe("todayYmdLocal", () => {
  it("returns a valid YYYY-MM-DD string", () => {
    const t = todayYmdLocal();
    expect(t).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("assertDateNotPast", () => {
  const today = "2026-05-13";

  it("accepts today", () => {
    expect(assertDateNotPast(today, today)).toEqual({ ok: true });
  });

  it("accepts a future date", () => {
    expect(assertDateNotPast("2026-05-14", today)).toEqual({ ok: true });
  });

  it("rejects yesterday", () => {
    const r = assertDateNotPast("2026-05-12", today);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("Cannot schedule");
    expect(r.error).toContain("2026-05-12");
    expect(r.error).toContain("read-only");
  });

  it("rejects a date in the distant past", () => {
    expect(assertDateNotPast("2024-01-01", today).ok).toBe(false);
  });

  it("rejects malformed dates", () => {
    const r = assertDateNotPast("not-a-date", today);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("Invalid date");
  });

  it("rejects 2025-13-01 (invalid month)", () => {
    expect(assertDateNotPast("2025-13-01", today).ok).toBe(false);
  });
});
