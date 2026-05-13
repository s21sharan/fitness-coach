import { describe, it, expect } from "vitest";
import {
  addCalendarDaysYmd,
  dayLabelToMon0Index,
  formatCalendarDateInTimeZone,
  formatCalendarDateLocal,
  isValidIanaTimeZone,
  isValidYmd,
  snapYmdToWeekMonday,
  weekAnchorMondayYmdFromLocalDate,
} from "@/lib/dates/local-calendar";

describe("isValidYmd", () => {
  it("accepts real calendar dates and rejects garbage", () => {
    expect(isValidYmd("2026-05-12")).toBe(true);
    expect(isValidYmd("2024-02-29")).toBe(true);
    expect(isValidYmd("2023-02-29")).toBe(false);
    expect(isValidYmd("not-a-date")).toBe(false);
  });
});

describe("addCalendarDaysYmd", () => {
  it("rolls across month boundaries", () => {
    expect(addCalendarDaysYmd("2026-04-28", 5)).toBe("2026-05-03");
  });

  it("subtracts days", () => {
    expect(addCalendarDaysYmd("2026-05-12", -7)).toBe("2026-05-05");
  });
});

describe("snapYmdToWeekMonday", () => {
  it("maps Wednesday to the same week's Monday", () => {
    expect(snapYmdToWeekMonday("2026-05-13")).toBe("2026-05-11");
  });
});

describe("weekAnchorMondayYmdFromLocalDate", () => {
  it("returns Monday for a fixed Wednesday", () => {
    const wed = new Date(2026, 4, 13, 15, 0, 0);
    expect(weekAnchorMondayYmdFromLocalDate(wed)).toBe("2026-05-11");
  });
});

describe("formatCalendarDateLocal", () => {
  it("uses local calendar fields, not UTC", () => {
    const d = new Date(2026, 4, 12, 23, 0, 0);
    expect(formatCalendarDateLocal(d)).toBe("2026-05-12");
  });
});

describe("formatCalendarDateInTimeZone", () => {
  it("uses IANA zone for the calendar day", () => {
    expect(formatCalendarDateInTimeZone("2026-05-12T02:00:00.000Z", "America/Los_Angeles")).toBe("2026-05-11");
  });
});

describe("dayLabelToMon0Index", () => {
  it("accepts abbreviations and full English names", () => {
    expect(dayLabelToMon0Index("Mon")).toBe(0);
    expect(dayLabelToMon0Index("Monday")).toBe(0);
    expect(dayLabelToMon0Index("  wed  ")).toBe(2);
    expect(dayLabelToMon0Index("nope")).toBe(-1);
  });
});

describe("isValidIanaTimeZone", () => {
  it("accepts real zones and rejects invalid", () => {
    expect(isValidIanaTimeZone("America/Los_Angeles")).toBe(true);
    expect(isValidIanaTimeZone("Not/AZone")).toBe(false);
  });
});
