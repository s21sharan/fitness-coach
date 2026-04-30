import { describe, it, expect, vi, beforeEach } from "vitest";
import { StravaClient } from "../../src/integrations/strava-client.js";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockTokenManager = {
  getValidToken: vi.fn(),
};

describe("StravaClient", () => {
  let client: StravaClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTokenManager.getValidToken.mockResolvedValue("valid-access-token");
    client = new StravaClient(mockTokenManager as any);
  });

  describe("getActivities", () => {
    it("fetches activities after a timestamp", async () => {
      const mockActivities = [
        {
          id: 12345,
          name: "Morning Run",
          sport_type: "Run",
          distance: 5000,
          moving_time: 1500,
          elapsed_time: 1600,
          total_elevation_gain: 50,
          start_date: "2026-04-29T06:00:00Z",
          average_speed: 3.33,
          average_heartrate: 155,
          has_heartrate: true,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockActivities),
        headers: new Map([
          ["x-ratelimit-usage", "5,100"],
          ["x-ratelimit-limit", "200,2000"],
        ]),
      });

      const activities = await client.getActivities({ after: 1714348800 });
      expect(activities).toHaveLength(1);
      expect(activities[0].sport_type).toBe("Run");
      expect(activities[0].distance).toBe(5000);
    });
  });

  describe("getActivity", () => {
    it("fetches activity detail with calories", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 12345,
          name: "Morning Run",
          sport_type: "Run",
          distance: 5000,
          moving_time: 1500,
          calories: 450,
          average_heartrate: 155,
          has_heartrate: true,
        }),
        headers: new Map(),
      });

      const activity = await client.getActivity(12345);
      expect(activity.calories).toBe(450);
    });
  });

  describe("token refresh", () => {
    it("uses token manager for every request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
        headers: new Map(),
      });

      await client.getActivities({});
      expect(mockTokenManager.getValidToken).toHaveBeenCalled();
    });
  });
});
