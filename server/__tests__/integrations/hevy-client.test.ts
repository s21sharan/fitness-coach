import { describe, it, expect, vi, beforeEach } from "vitest";
import { HevyClient } from "../../src/integrations/hevy-client.js";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("HevyClient", () => {
  let client: HevyClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new HevyClient("test-api-key");
  });

  describe("validate", () => {
    it("returns true for valid API key", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ page: 1, page_count: 1, workouts: [] }),
      });
      expect(await client.validate()).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/workouts"),
        expect.objectContaining({
          headers: { "api-key": "test-api-key" },
        }),
      );
    });

    it("returns false for invalid API key", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
      expect(await client.validate()).toBe(false);
    });
  });

  describe("getWorkoutEvents", () => {
    it("fetches incremental workout events since a timestamp", async () => {
      const mockEvents = {
        page: 1,
        page_count: 1,
        events: [
          {
            type: "updated",
            workout: {
              id: "w-1",
              title: "Push Day",
              start_time: "2026-04-29T07:00:00Z",
              end_time: "2026-04-29T08:15:00Z",
              exercises: [
                {
                  index: 0,
                  title: "Bench Press (Barbell)",
                  exercise_template_id: "tmpl-1",
                  sets: [
                    { index: 0, type: "normal", weight_kg: 100, reps: 8, rpe: 8.5 },
                  ],
                },
              ],
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEvents),
      });

      const events = await client.getWorkoutEvents("2026-04-28T00:00:00Z");
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("updated");
      expect(events[0].workout?.title).toBe("Push Day");
    });
  });

  describe("getWorkouts", () => {
    it("paginates through all workouts", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          page: 1,
          page_count: 2,
          workouts: [{ id: "w-1", title: "Day 1", start_time: "2026-04-29T07:00:00Z", end_time: "2026-04-29T08:00:00Z", exercises: [] }],
        }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          page: 2,
          page_count: 2,
          workouts: [{ id: "w-2", title: "Day 2", start_time: "2026-04-28T07:00:00Z", end_time: "2026-04-28T08:00:00Z", exercises: [] }],
        }),
      });

      const workouts = await client.getWorkouts();
      expect(workouts).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
