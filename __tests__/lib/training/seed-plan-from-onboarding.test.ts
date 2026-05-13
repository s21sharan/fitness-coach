import { describe, it, expect } from "vitest";
import type { PlanPreviewDay } from "@/lib/onboarding/types";
import {
  combineDaySessions,
  normalizePlanPreviewWeeks,
} from "@/lib/training/seed-plan-from-onboarding";

describe("normalizePlanPreviewWeeks", () => {
  it("returns weeks array when present", () => {
    const weeks = [
      {
        week_number: 1,
        week_focus: "Base",
        days: Array.from({ length: 7 }, (_, i) => ({
          day_label: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
          am_session: i === 0 ? "Easy run" : null,
          am_rationale: null,
          pm_session: null,
          pm_rationale: null,
          is_rest: i > 0,
          notes: null,
        })),
      },
    ];
    expect(normalizePlanPreviewWeeks({ narrative: "", risks: [], weeks } as never)).toEqual(weeks);
  });

  it("maps legacy first_week to a single block", () => {
    const fw = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day_label, i) => ({
      day_label,
      session: i === 3 ? "Rest" : "Lift",
      rationale: "r",
    }));
    const out = normalizePlanPreviewWeeks({ narrative: "N", risks: [], first_week: fw } as never);
    expect(out).toHaveLength(1);
    expect(out?.[0].days).toHaveLength(7);
    expect(out?.[0].days[3].is_rest).toBe(true);
  });

  it("returns null for empty input", () => {
    expect(normalizePlanPreviewWeeks(null)).toBeNull();
    expect(normalizePlanPreviewWeeks({} as never)).toBeNull();
  });
});

describe("combineDaySessions", () => {
  const baseDay = (over: Partial<PlanPreviewDay>): PlanPreviewDay => ({
    day_label: "Mon",
    am_session: null,
    am_rationale: null,
    pm_session: null,
    pm_rationale: null,
    is_rest: false,
    notes: null,
    ...over,
  });

  it("returns Rest with null targets on rest days", () => {
    const r = combineDaySessions(baseDay({ is_rest: true, notes: "deload" }));
    expect(r.session_type).toBe("Rest");
    expect(r.targets).toBeNull();
    expect(r.ai_notes).toBe("deload");
  });

  it("merges AM and PM into one contract with labeled steps", () => {
    const r = combineDaySessions(
      baseDay({
        am_session: "Easy 30 min spin",
        am_rationale: "flush",
        pm_session: "Upper hypertrophy",
        pm_rationale: "volume",
      })
    );
    expect(r.session_type).toContain("AM:");
    expect(r.session_type).toContain("PM:");
    expect(r.targets?.contract?.steps.some((s) => s.label?.startsWith("AM —"))).toBe(true);
    expect(r.targets?.contract?.steps.some((s) => s.label?.startsWith("PM —"))).toBe(true);
  });
});
