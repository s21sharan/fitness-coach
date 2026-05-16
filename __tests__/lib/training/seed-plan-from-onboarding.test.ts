import { describe, it, expect } from "vitest";
import type { PlanPreviewDay } from "@/lib/onboarding/types";
import type { SessionContract } from "@/lib/training/schemas";
import {
  combineDaySessions,
  normalizePlanPreviewWeeks,
} from "@/lib/training/seed-plan-from-onboarding";

function makeSession(over: Partial<SessionContract> & { name: string; sport: SessionContract["sport"] }): SessionContract {
  return {
    sport: over.sport,
    name: over.name,
    rationale: over.rationale ?? null,
    contract: {
      version: 1,
      sport: over.sport,
      name: over.name,
      slot: over.contract?.slot ?? "full",
      source: "onboarding_preview",
      steps: over.contract?.steps ?? [
        { type: "work", label: over.name, duration_sec: 1800, target_hr_zone: 2 },
      ],
    },
  };
}

describe("normalizePlanPreviewWeeks", () => {
  it("returns weeks array when present", () => {
    const weeks = [
      {
        week_number: 1,
        week_focus: "Base",
        days: Array.from({ length: 7 }, (_, i) => ({
          day_label: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
          am_session: i === 0 ? makeSession({ sport: "run", name: "Easy run" }) : null,
          pm_session: null,
          is_rest: i > 0,
          notes: null,
        })),
      },
    ];
    expect(normalizePlanPreviewWeeks({ narrative: "", risks: [], weeks } as never)).toEqual(weeks);
  });

  it("returns null for empty or legacy-shape input", () => {
    expect(normalizePlanPreviewWeeks(null)).toBeNull();
    expect(normalizePlanPreviewWeeks({} as never)).toBeNull();
    // legacy first_week shape is no longer accepted
    expect(
      normalizePlanPreviewWeeks({
        narrative: "N",
        risks: [],
        first_week: [{ day_label: "Mon", session: "Lift", rationale: "r" }],
      } as never)
    ).toBeNull();
  });
});

describe("combineDaySessions", () => {
  const baseDay = (over: Partial<PlanPreviewDay>): PlanPreviewDay => ({
    day_label: "Mon",
    am_session: null,
    pm_session: null,
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
        am_session: makeSession({ sport: "bike", name: "Easy 30 min spin", rationale: "flush" }),
        pm_session: makeSession({ sport: "strength", name: "Upper hypertrophy", rationale: "volume" }),
      })
    );
    expect(r.session_type).toContain("AM:");
    expect(r.session_type).toContain("PM:");
    expect(r.targets?.contract?.steps.some((s) => s.label?.startsWith("AM —"))).toBe(true);
    expect(r.targets?.contract?.steps.some((s) => s.label?.startsWith("PM —"))).toBe(true);
    expect(r.ai_notes).toContain("AM — flush");
    expect(r.ai_notes).toContain("PM — volume");
  });

  it("returns single contract when only one slot is filled", () => {
    const r = combineDaySessions(
      baseDay({ am_session: makeSession({ sport: "run", name: "Long run" }) })
    );
    expect(r.session_type).toBe("Long run");
    expect(r.targets?.contract?.sport).toBe("run");
    expect(r.targets?.contract?.slot).toBeDefined();
  });
});
