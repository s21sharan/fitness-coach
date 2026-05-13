import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/db.js", () => ({ supabase: {} }));

import { overlap, decideSuppression, type ActivityRef } from "../../src/sync/reconcile.js";

function ref(overrides: Partial<ActivityRef>): ActivityRef {
  return {
    table: "cardio_logs",
    id: "id-" + Math.random().toString(36).slice(2, 8),
    externalId: "ext-" + Math.random().toString(36).slice(2, 8),
    provider: "strava",
    category: "run",
    date: "2026-05-12",
    startTime: "2026-05-12T18:00:00Z",
    durationSec: 3600,
    syncedAt: "2026-05-12T19:00:00Z",
    isSuppressed: false,
    suppressedByProvider: null,
    suppressedByExternalId: null,
    ...overrides,
  };
}

describe("overlap", () => {
  it("matches a Hevy lift and a Strava lift that differ by 1 minute (platform rounding)", () => {
    const hevy = ref({
      table: "workout_logs",
      provider: "hevy",
      category: "strength",
      startTime: "2026-05-12T18:00:00Z",
      durationSec: 3660, // 61 min — Hevy commonly logs ~1 min longer
    });
    const strava = ref({
      provider: "strava",
      category: "strength",
      startTime: "2026-05-12T18:00:00Z",
      durationSec: 3600,
    });
    expect(overlap(hevy, strava)).toBe(true);
  });

  it("matches a Hevy strength session against a legacy Strava 'other' (cross-category)", () => {
    const hevy = ref({
      table: "workout_logs",
      provider: "hevy",
      category: "strength",
      startTime: "2026-05-12T18:00:00Z",
      durationSec: 3600,
    });
    const stravaLegacy = ref({
      provider: "strava",
      category: "other",
      startTime: "2026-05-12T18:02:00Z",
      durationSec: 3550,
    });
    expect(overlap(hevy, stravaLegacy)).toBe(true);
  });

  it("does not match a Strava 'other' Yoga against a strength session at a different time", () => {
    const strength = ref({
      table: "workout_logs",
      provider: "hevy",
      category: "strength",
      startTime: "2026-05-12T18:00:00Z",
      durationSec: 3600,
    });
    const yoga = ref({
      provider: "strava",
      category: "other",
      startTime: "2026-05-12T08:00:00Z",
      durationSec: 3600,
    });
    expect(overlap(strength, yoga)).toBe(false);
  });

  it("does not match two unrelated morning runs an hour apart", () => {
    const a = ref({ category: "run", startTime: "2026-05-12T07:00:00Z", durationSec: 1800 });
    const b = ref({ category: "run", startTime: "2026-05-12T08:00:00Z", durationSec: 2700 });
    expect(overlap(a, b)).toBe(false);
  });

  it("does not match a 30-min run vs a 60-min run even at the same start time", () => {
    const a = ref({ category: "run", startTime: "2026-05-12T08:00:00Z", durationSec: 1800 });
    const b = ref({ category: "run", startTime: "2026-05-12T08:00:00Z", durationSec: 3600 });
    expect(overlap(a, b)).toBe(false);
  });

  it("does not match across non-'other' categories", () => {
    const a = ref({ category: "run" });
    const b = ref({ category: "strength" });
    expect(overlap(a, b)).toBe(false);
  });

  it("does not match across different dates", () => {
    const a = ref({ date: "2026-05-12" });
    const b = ref({ date: "2026-05-13" });
    expect(overlap(a, b)).toBe(false);
  });

  it("requires both start_times for cross-category matching", () => {
    const hevy = ref({
      table: "workout_logs",
      provider: "hevy",
      category: "strength",
      startTime: null,
      durationSec: 3600,
    });
    const stravaLegacy = ref({
      provider: "strava",
      category: "other",
      startTime: "2026-05-12T18:00:00Z",
      durationSec: 3600,
    });
    expect(overlap(hevy, stravaLegacy)).toBe(false);
  });

  it("falls back to date + duration when same-category and one side has no start_time", () => {
    const a = ref({ category: "run", startTime: null, durationSec: 3000 });
    const b = ref({ category: "run", startTime: "2026-05-12T18:00:00Z", durationSec: 3060 });
    expect(overlap(a, b)).toBe(true);
  });
});

describe("decideSuppression", () => {
  const active = new Set(["hevy", "strava", "garmin"]);

  it("Hevy strength wins over Strava strength on the same session", () => {
    const hevy = ref({
      table: "workout_logs",
      provider: "hevy",
      category: "strength",
      externalId: "hevy-w-1",
      durationSec: 3600,
    });
    const strava = ref({
      table: "cardio_logs",
      provider: "strava",
      category: "strength",
      externalId: "strava-a-1",
      durationSec: 3500,
    });

    const decision = decideSuppression([strava, hevy], active);
    expect(decision.winners).toHaveLength(1);
    expect(decision.winners[0].provider).toBe("hevy");
    expect(decision.suppressed).toHaveLength(1);
    expect(decision.suppressed[0].loser.provider).toBe("strava");
    expect(decision.suppressed[0].winner.provider).toBe("hevy");
  });

  it("re-surfaces a Strava strength row when Hevy is no longer in the active set", () => {
    const hevy = ref({
      table: "workout_logs",
      provider: "hevy",
      category: "strength",
      externalId: "hevy-w-1",
      isSuppressed: false,
    });
    const strava = ref({
      table: "cardio_logs",
      provider: "strava",
      category: "strength",
      externalId: "strava-a-1",
      isSuppressed: true,
      suppressedByProvider: "hevy",
      suppressedByExternalId: "hevy-w-1",
    });

    const decision = decideSuppression([strava, hevy], new Set(["strava"]));
    const winner = decision.winners[0];
    expect(winner.provider).toBe("strava");
    expect(decision.suppressed[0].loser.provider).toBe("hevy");
  });

  it("leaves non-overlapping activities alone", () => {
    const morningRun = ref({ category: "run", startTime: "2026-05-12T06:00:00Z" });
    const eveningLift = ref({
      category: "strength",
      provider: "hevy",
      table: "workout_logs",
      startTime: "2026-05-12T18:00:00Z",
    });

    const decision = decideSuppression([morningRun, eveningLift], active);
    expect(decision.winners).toHaveLength(2);
    expect(decision.suppressed).toHaveLength(0);
  });

  it("treats a Strava+Garmin merged row as carrying the higher of the two priorities", () => {
    const merged = ref({
      provider: "merged",
      category: "run",
      externalId: "strava-run-1",
    });
    const hevy = ref({
      provider: "hevy",
      category: "run",
      externalId: "hevy-r-1",
      table: "workout_logs",
    });

    // Hevy doesn't cover "run" — Garmin (via merged) should win.
    const decision = decideSuppression([merged, hevy], active);
    expect(decision.winners[0].provider).toBe("merged");
  });

  it("breaks ties on syncedAt", () => {
    const stravaA = ref({
      provider: "strava",
      category: "other",
      externalId: "a",
      syncedAt: "2026-05-12T10:00:00Z",
    });
    const stravaB = ref({
      provider: "strava",
      category: "other",
      externalId: "b",
      syncedAt: "2026-05-12T11:00:00Z",
    });
    const decision = decideSuppression([stravaA, stravaB], active);
    expect(decision.winners[0].externalId).toBe("b");
  });
});
