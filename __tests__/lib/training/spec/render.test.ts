import { describe, it, expect } from "vitest";
import { renderSpecForPrompt, renderViolationsForRepair } from "@/lib/training/spec/render";
import type { SpecViolation } from "@/lib/training/spec/check-plan";
import { specOf } from "./builders";

describe("renderSpecForPrompt", () => {
  it("renders the per-athlete hard constraints, including injuries and day rules", () => {
    const out = renderSpecForPrompt({
      constraints: specOf({
        days_per_week: 5,
        lifting_days_per_week: 3,
        max_quality_sessions_per_week: 2,
        allow_quality_back_to_back: false,
        forbidden_modalities: ["run"],
        forbidden_movement_patterns: ["loaded_knee_flexion"],
        required_modality_days: [{ modality: "swim", days: ["Tue", "Thu"] }],
      }),
      notes: ["Prefers morning sessions"],
    });
    expect(out).toMatch(/at most 5 day/i);
    expect(out).toMatch(/at most 3 strength/i);
    expect(out).toMatch(/at most 2 quality/i);
    expect(out).toMatch(/consecutive days/i);
    expect(out).toMatch(/do not include.*run/i);
    expect(out).toMatch(/loaded knee flexion/i);
    expect(out).toMatch(/swim.*Tue, Thu/i);
    expect(out).toMatch(/Prefers morning sessions/);
  });

  it("omits sections that don't apply", () => {
    const out = renderSpecForPrompt({
      constraints: specOf({ forbidden_modalities: [], forbidden_movement_patterns: [], required_modality_days: [] }),
      notes: [],
    });
    expect(out).not.toMatch(/forbidden/i);
    expect(out).not.toMatch(/Coaching notes/i);
  });
});

describe("renderViolationsForRepair", () => {
  it("lists each violation's detail as actionable repair feedback", () => {
    const violations: SpecViolation[] = [
      { rule: "min_hours_between_heavy_lower_and_quality_run", severity: "blocker", week: 1, detail: "Heavy legs 13h before threshold." },
      { rule: "forbidden_movement_patterns", severity: "blocker", week: 1, detail: "BSS loads forbidden knee flexion." },
    ];
    const out = renderViolationsForRepair(violations);
    expect(out).toMatch(/VIOLATED/);
    expect(out).toMatch(/Heavy legs 13h before threshold/);
    expect(out).toMatch(/BSS loads forbidden knee flexion/);
    expect(out).toMatch(/not introduce any new violations/i);
  });
});
