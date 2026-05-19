import { describe, it, expect } from "vitest";
import {
  FACT_CATEGORIES,
  FACT_PREDICATES,
  FACT_LIFECYCLES,
  LIFECYCLE_TTL_MS,
  isKnownCategory,
  isKnownPredicate,
} from "@/lib/athlete-context/vocab";

describe("vocab", () => {
  it("category and predicate vocabularies are non-empty constants", () => {
    expect(FACT_CATEGORIES.length).toBeGreaterThan(3);
    expect(FACT_PREDICATES.length).toBeGreaterThan(3);
    expect(FACT_LIFECYCLES).toEqual(["chronic", "standing", "recent", "ephemeral"]);
  });

  it("TTLs are ordered chronic > standing > recent > ephemeral (null first)", () => {
    expect(LIFECYCLE_TTL_MS.chronic).toBeNull();
    expect(LIFECYCLE_TTL_MS.standing).toBeGreaterThan(LIFECYCLE_TTL_MS.recent!);
    expect(LIFECYCLE_TTL_MS.recent).toBeGreaterThan(LIFECYCLE_TTL_MS.ephemeral!);
  });

  it("guards correctly identify known values", () => {
    expect(isKnownCategory("injury")).toBe(true);
    expect(isKnownCategory("not_real")).toBe(false);
    expect(isKnownPredicate("prefers")).toBe(true);
    expect(isKnownPredicate("not_real")).toBe(false);
  });
});
