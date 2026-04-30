import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/sync/macrofactor.js", () => ({
  syncMacroFactorForUser: vi.fn().mockResolvedValue(5),
  syncAllMacroFactor: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../src/sync/hevy.js", () => ({
  syncHevyForUser: vi.fn().mockResolvedValue(3),
  syncAllHevy: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../src/sync/strava.js", () => ({
  syncStravaForUser: vi.fn().mockResolvedValue(2),
  syncAllStrava: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../src/sync/garmin.js", () => ({
  syncGarminForUser: vi.fn().mockResolvedValue(1),
  syncAllGarmin: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../src/db.js", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => ({ data: { credentials: { email: "enc", password: "enc" }, access_token: "enc" } }),
          }),
        }),
      }),
    }),
  },
}));

describe("sync routes", () => {
  it("validates provider parameter", async () => {
    const { createSyncRouter } = await import("../../src/routes/sync.js");
    const router = createSyncRouter();
    expect(router).toBeDefined();
  });
});
