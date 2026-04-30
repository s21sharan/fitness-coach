import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/db.js", () => ({ supabase: {} }));
vi.mock("../../src/config.js", () => ({
  config: {
    stravaClientId: "test-client-id",
    stravaClientSecret: "test-client-secret",
  },
}));
vi.mock("../../src/integrations/strava-client.js", () => ({ StravaClient: vi.fn() }));
vi.mock("../../src/integrations/token-manager.js", () => ({ StravaTokenManager: vi.fn() }));
vi.mock("../../src/utils/logger.js", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

import { normalizeActivity, mapSportType } from "../../src/sync/strava.js";

describe("Strava sync", () => {
  describe("mapSportType", () => {
    it("maps Run types to 'run'", () => {
      expect(mapSportType("Run")).toBe("run");
      expect(mapSportType("TrailRun")).toBe("run");
      expect(mapSportType("VirtualRun")).toBe("run");
    });

    it("maps Ride types to 'bike'", () => {
      expect(mapSportType("Ride")).toBe("bike");
      expect(mapSportType("GravelRide")).toBe("bike");
      expect(mapSportType("VirtualRide")).toBe("bike");
    });

    it("maps Swim to 'swim'", () => {
      expect(mapSportType("Swim")).toBe("swim");
    });

    it("maps unknown types to 'other'", () => {
      expect(mapSportType("Yoga")).toBe("other");
      expect(mapSportType("WeightTraining")).toBe("other");
    });
  });

  describe("normalizeActivity", () => {
    it("converts Strava activity to cardio_logs row", () => {
      const activity = {
        id: 12345,
        name: "Morning Run",
        sport_type: "Run",
        distance: 5000,
        moving_time: 1500,
        elapsed_time: 1600,
        total_elevation_gain: 50,
        start_date: "2026-04-29T06:00:00Z",
        start_date_local: "2026-04-29T06:00:00Z",
        average_speed: 3.33,
        max_speed: 4.0,
        average_heartrate: 155,
        has_heartrate: true,
        calories: 450,
      };

      const row = normalizeActivity("user-1", activity);
      expect(row.user_id).toBe("user-1");
      expect(row.activity_id).toBe("12345");
      expect(row.type).toBe("run");
      expect(row.distance).toBeCloseTo(5.0);
      expect(row.duration).toBe(1500);
      expect(row.avg_hr).toBe(155);
      expect(row.calories).toBe(450);
      expect(row.elevation).toBe(50);
    });

    it("calculates pace in min/km for runs", () => {
      const activity = {
        id: 1,
        name: "Run",
        sport_type: "Run",
        distance: 10000,
        moving_time: 3000,
        elapsed_time: 3000,
        total_elevation_gain: 0,
        start_date: "2026-04-29T06:00:00Z",
        start_date_local: "2026-04-29T06:00:00Z",
        average_speed: 3.33,
        max_speed: 4.0,
        has_heartrate: false,
      };

      const row = normalizeActivity("user-1", activity);
      expect(row.pace_or_speed).toBeCloseTo(5.0);
    });
  });
});
