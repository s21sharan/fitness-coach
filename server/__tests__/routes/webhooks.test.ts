import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/config.js", () => ({
  config: { stravaWebhookVerifyToken: "hybro-strava-verify" },
}));
vi.mock("../../src/db.js", () => ({ supabase: {} }));
vi.mock("../../src/sync/strava.js", () => ({
  syncStravaActivity: vi.fn(),
  syncStravaForUser: vi.fn(),
  syncAllStrava: vi.fn(),
}));
vi.mock("../../src/utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { verifyStravaWebhook } from "../../src/routes/webhooks.js";

describe("Strava webhook", () => {
  describe("verifyStravaWebhook", () => {
    it("returns challenge when verify token matches", () => {
      const result = verifyStravaWebhook("subscribe", "abc123", "test-token", "test-token");
      expect(result).toEqual({ "hub.challenge": "abc123" });
    });

    it("returns null when verify token does not match", () => {
      const result = verifyStravaWebhook("subscribe", "abc123", "wrong-token", "test-token");
      expect(result).toBeNull();
    });
  });
});
