import { describe, it, expect } from "vitest";
import { effectivePriority, getCoverage } from "../../src/sync/providers.js";

describe("provider registry", () => {
  describe("getCoverage", () => {
    it("returns dedicated-level coverage for Hevy strength", () => {
      const c = getCoverage("hevy", "strength");
      expect(c?.level).toBe("dedicated");
      expect(c?.priority).toBeGreaterThanOrEqual(100);
    });

    it("returns null when a provider does not cover a category", () => {
      expect(getCoverage("hevy", "run")).toBeNull();
      expect(getCoverage("hevy", "bike")).toBeNull();
    });

    it("returns general-level coverage for Strava endurance categories", () => {
      expect(getCoverage("strava", "run")?.level).toBe("general");
      expect(getCoverage("strava", "bike")?.level).toBe("general");
    });

    it("returns null for an unknown provider", () => {
      expect(getCoverage("polar", "run")).toBeNull();
    });
  });

  describe("effectivePriority", () => {
    const active = new Set(["hevy", "strava", "garmin"]);

    it("ranks dedicated lifting platforms above general trackers for strength", () => {
      expect(effectivePriority("hevy", "strength", active))
        .toBeGreaterThan(effectivePriority("strava", "strength", active));
      expect(effectivePriority("hevy", "strength", active))
        .toBeGreaterThan(effectivePriority("garmin", "strength", active));
    });

    it("ranks Garmin above Strava for endurance categories (enrichment)", () => {
      expect(effectivePriority("garmin", "run", active))
        .toBeGreaterThan(effectivePriority("strava", "run", active));
    });

    it("drops priority to 0 when provider is not in the active set", () => {
      const onlyStrava = new Set(["strava"]);
      expect(effectivePriority("hevy", "strength", onlyStrava)).toBe(0);
      expect(effectivePriority("strava", "strength", onlyStrava)).toBeGreaterThan(0);
    });

    it("returns 0 for a provider with no coverage in that category", () => {
      expect(effectivePriority("hevy", "run", active)).toBe(0);
    });
  });
});
