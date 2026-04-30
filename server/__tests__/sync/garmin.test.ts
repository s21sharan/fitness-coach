import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/db.js", () => ({ supabase: {} }));
vi.mock("../../src/config.js", () => ({
  config: {
    encryptionKey: "test-key",
    garminServiceUrl: "http://localhost:8000",
  },
}));
vi.mock("../../src/utils/encryption.js", () => ({ decrypt: vi.fn() }));
vi.mock("../../src/utils/logger.js", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

import { normalizeGarminData } from "../../src/sync/garmin.js";

describe("Garmin sync", () => {
  describe("normalizeGarminData", () => {
    it("converts Garmin API response to recovery_logs rows", () => {
      const garminResponse = {
        dates: ["2026-04-29"],
        resting_hr: [{ date: "2026-04-29", value: 52 }],
        hrv: [{ date: "2026-04-29", value: 45 }],
        sleep: [{ date: "2026-04-29", hours: 7.5, score: 82 }],
        body_battery: [{ date: "2026-04-29", value: 75 }],
        stress: [{ date: "2026-04-29", value: 28 }],
        steps: [{ date: "2026-04-29", value: 8500 }],
      };

      const rows = normalizeGarminData("user-1", garminResponse);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({
        user_id: "user-1",
        date: "2026-04-29",
        resting_hr: 52,
        hrv: 45,
        sleep_hours: 7.5,
        sleep_score: 82,
        body_battery: 75,
        stress_level: 28,
        steps: 8500,
        synced_at: expect.any(String),
      });
    });

    it("handles missing data for some metrics", () => {
      const garminResponse = {
        dates: ["2026-04-29"],
        resting_hr: [{ date: "2026-04-29", value: 52 }],
        hrv: [],
        sleep: [],
        body_battery: [],
        stress: [],
        steps: [{ date: "2026-04-29", value: 8500 }],
      };

      const rows = normalizeGarminData("user-1", garminResponse);
      expect(rows).toHaveLength(1);
      expect(rows[0].hrv).toBeNull();
      expect(rows[0].sleep_hours).toBeNull();
    });
  });
});
