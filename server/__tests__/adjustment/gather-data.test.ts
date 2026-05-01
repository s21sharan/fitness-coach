import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/db.js", () => ({ supabase: {} }));
vi.mock("../../src/config.js", () => ({ config: {} }));

import { computeCompliance } from "../../src/adjustment/gather-data.js";

describe("gather-data", () => {
  describe("computeCompliance", () => {
    it("calculates 100% when all non-rest sessions are completed", () => {
      const planned = [
        { session_type: "Push", status: "completed" },
        { session_type: "Pull", status: "completed" },
        { session_type: "Legs", status: "completed" },
        { session_type: "Rest", status: "scheduled" },
      ];
      expect(computeCompliance(planned)).toBe(100);
    });

    it("calculates 50% when half sessions are completed", () => {
      const planned = [
        { session_type: "Push", status: "completed" },
        { session_type: "Pull", status: "scheduled" },
        { session_type: "Rest", status: "scheduled" },
      ];
      expect(computeCompliance(planned)).toBe(50);
    });

    it("returns 100 for rest-only weeks", () => {
      const planned = [
        { session_type: "Rest", status: "scheduled" },
        { session_type: "Rest", status: "scheduled" },
      ];
      expect(computeCompliance(planned)).toBe(100);
    });
  });
});
