import { describe, it, expect } from "vitest";
import { parseAvailableSlots } from "@/lib/google-calendar";

describe("google-calendar", () => {
  describe("parseAvailableSlots", () => {
    it("identifies free slots between events", () => {
      const events = [
        { start: "2026-05-04T09:00:00Z", end: "2026-05-04T10:00:00Z", summary: "Meeting" },
        { start: "2026-05-04T14:00:00Z", end: "2026-05-04T15:30:00Z", summary: "Call" },
      ];
      const slots = parseAvailableSlots(events, "2026-05-04", 5, 21);
      expect(slots.length).toBeGreaterThanOrEqual(3);
      expect(slots[0].start).toContain("05:00");
    });

    it("returns full day when no events", () => {
      const slots = parseAvailableSlots([], "2026-05-04", 5, 21);
      expect(slots).toHaveLength(1);
      expect(slots[0].start).toContain("05:00");
      expect(slots[0].end).toContain("21:00");
    });
  });
});
