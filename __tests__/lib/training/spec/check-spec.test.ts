import { describe, it, expect } from "vitest";
import { checkSpecConsistency } from "@/lib/training/spec/check-spec";
import { specOf } from "./builders";

function payload(overrides = {}) {
  return { constraints: specOf(overrides), notes: [] };
}

describe("checkSpecConsistency", () => {
  it("accepts a well-formed spec", () => {
    const r = checkSpecConsistency(payload({ days_per_week: 5, lifting_days_per_week: 3, max_quality_sessions_per_week: 2 }));
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("rejects lifting_days exceeding days_per_week", () => {
    const r = checkSpecConsistency(payload({ days_per_week: 3, lifting_days_per_week: 5 }));
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/lifting_days_per_week/);
  });

  it("rejects max_quality exceeding days_per_week", () => {
    const r = checkSpecConsistency(payload({ days_per_week: 3, max_quality_sessions_per_week: 5 }));
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/max_quality_sessions_per_week/);
  });

  it("rejects a required modality that is also forbidden", () => {
    const r = checkSpecConsistency(
      payload({ forbidden_modalities: ["swim"], required_modality_days: [{ modality: "swim", days: ["Tue"] }] }),
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/forbidden_modalities/);
  });

  it("rejects forbidding strength while lifting_days > 0", () => {
    const r = checkSpecConsistency(payload({ forbidden_modalities: ["strength"], lifting_days_per_week: 3 }));
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/strength is forbidden/);
  });

  it("rejects a structurally invalid payload (bad enum)", () => {
    const r = checkSpecConsistency({
      constraints: { ...specOf(), forbidden_movement_patterns: ["not_a_real_pattern"] },
      notes: [],
    });
    expect(r.ok).toBe(false);
  });

  it("rejects missing fields", () => {
    const r = checkSpecConsistency({ constraints: { days_per_week: 5 }, notes: [] });
    expect(r.ok).toBe(false);
  });
});
