import { describe, it, expect, vi } from "vitest";
import { detectReschedules } from "../../src/integrations/google-calendar-client.js";

vi.mock("../../src/db.js", () => ({
  supabase: { from: vi.fn() },
}));
vi.mock("../../src/config.js", () => ({
  config: { googleClientId: "test", googleClientSecret: "test" },
}));

describe("google-calendar-client", () => {
  describe("detectReschedules", () => {
    it("detects when a calendar event was moved", () => {
      const calendarEvents = [
        { id: "evt-1", start: "2026-05-04T08:00:00Z", end: "2026-05-04T09:15:00Z", summary: "[Hybro] Push" },
      ];
      const plannedWorkouts = [
        { id: "pw-1", calendar_event_id: "evt-1", scheduled_time: "2026-05-04T07:00:00Z", session_type: "Push" },
      ];

      const reschedules = detectReschedules(calendarEvents, plannedWorkouts);
      expect(reschedules).toHaveLength(1);
      expect(reschedules[0].workoutId).toBe("pw-1");
      expect(reschedules[0].newTime).toBe("2026-05-04T08:00:00.000Z");
    });

    it("returns empty when no changes", () => {
      const calendarEvents = [
        { id: "evt-1", start: "2026-05-04T07:00:00Z", end: "2026-05-04T08:15:00Z", summary: "[Hybro] Push" },
      ];
      const plannedWorkouts = [
        { id: "pw-1", calendar_event_id: "evt-1", scheduled_time: "2026-05-04T07:00:00Z", session_type: "Push" },
      ];

      const reschedules = detectReschedules(calendarEvents, plannedWorkouts);
      expect(reschedules).toHaveLength(0);
    });
  });
});
