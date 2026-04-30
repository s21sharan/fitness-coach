import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/db.js", () => ({ supabase: {} }));
vi.mock("../../src/config.js", () => ({
  config: { encryptionKey: "test-key", macrofactorFirebaseApiKey: "test-api-key" },
}));
vi.mock("../../src/integrations/hevy-client.js", () => ({ HevyClient: vi.fn() }));
vi.mock("../../src/utils/encryption.js", () => ({ decrypt: vi.fn() }));
vi.mock("../../src/utils/logger.js", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

import { normalizeWorkout } from "../../src/sync/hevy.js";

describe("Hevy sync", () => {
  describe("normalizeWorkout", () => {
    it("converts Hevy workout to workout_logs row", () => {
      const workout = {
        id: "w-1",
        title: "Push Day",
        start_time: "2026-04-29T07:00:00Z",
        end_time: "2026-04-29T08:15:00Z",
        updated_at: "2026-04-29T08:16:00Z",
        created_at: "2026-04-29T07:00:00Z",
        exercises: [
          {
            index: 0,
            title: "Bench Press (Barbell)",
            exercise_template_id: "tmpl-1",
            notes: null,
            supersets_id: null,
            sets: [
              { index: 0, type: "normal" as const, weight_kg: 100, reps: 8, rpe: 8.5, distance_meters: null, duration_seconds: null },
            ],
          },
        ],
      };

      const row = normalizeWorkout("user-1", workout);
      expect(row.user_id).toBe("user-1");
      expect(row.workout_id).toBe("w-1");
      expect(row.name).toBe("Push Day");
      expect(row.duration_minutes).toBe(75);
      expect(row.exercises).toHaveLength(1);
      expect(row.exercises[0].name).toBe("Bench Press (Barbell)");
      expect(row.exercises[0].sets[0].weight_kg).toBe(100);
    });
  });
});
