import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/db.js", () => ({ supabase: {} }));
vi.mock("../../src/config.js", () => ({
  config: { encryptionKey: "test-key", macrofactorFirebaseApiKey: "test-api-key" },
}));
vi.mock("../../src/integrations/macrofactor-client.js", () => ({ MacroFactorClient: {} }));
vi.mock("../../src/utils/encryption.js", () => ({ decrypt: vi.fn() }));
vi.mock("../../src/utils/logger.js", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

import { normalizeNutrition } from "../../src/sync/macrofactor.js";

describe("MacroFactor sync", () => {
  describe("normalizeNutrition", () => {
    it("converts MacroFactor nutrition to nutrition_logs row", () => {
      const entry = {
        date: "2026-04-29",
        calories: 2200,
        protein: 180,
        carbs: 220,
        fat: 70,
        fiber: 30,
      };

      const row = normalizeNutrition("user-1", entry);
      expect(row).toEqual({
        user_id: "user-1",
        date: "2026-04-29",
        calories: 2200,
        protein: 180,
        carbs: 220,
        fat: 70,
        fiber: 30,
        sugar: null,
        sodium: null,
        meals: null,
        synced_at: expect.any(String),
      });
    });
  });
});
