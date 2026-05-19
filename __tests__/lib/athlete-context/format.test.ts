import { describe, it, expect } from "vitest";
import { humanize, normalizeSubject, formatFactsForPlanPrompt } from "@/lib/athlete-context/format";
import type { AthleteFact } from "@/lib/athlete-context/types";

function fact(partial: Partial<AthleteFact>): AthleteFact {
  return {
    id: "id",
    user_id: "u1",
    category: "preference",
    subject: null,
    predicate: "prefers",
    value: null,
    summary: "summary",
    lifecycle: "standing",
    confidence: 0.8,
    status: "active",
    observed_at: new Date().toISOString(),
    expires_at: null,
    source: "manual",
    source_ref_table: null,
    source_ref_id: null,
    supersedes_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  } as AthleteFact;
}

describe("humanize", () => {
  it("capitalizes and replaces underscores/dashes with spaces", () => {
    expect(humanize("training_response")).toBe("Training response");
    expect(humanize("left-knee")).toBe("Left knee");
    expect(humanize("prefers")).toBe("Prefers");
  });

  it("handles empty/null gracefully", () => {
    expect(humanize("")).toBe("");
    expect(humanize(null)).toBe("");
    expect(humanize(undefined)).toBe("");
  });
});

describe("normalizeSubject", () => {
  it("lowercases and snake_cases free input", () => {
    expect(normalizeSubject("Left Knee")).toBe("left_knee");
    expect(normalizeSubject("Monday mornings!")).toBe("monday_mornings");
    expect(normalizeSubject("  long   runs ")).toBe("long_runs");
  });

  it("returns null for empty input", () => {
    expect(normalizeSubject("")).toBeNull();
    expect(normalizeSubject("   ")).toBeNull();
  });
});

describe("formatFactsForPlanPrompt", () => {
  it("returns null for empty input", () => {
    expect(formatFactsForPlanPrompt([])).toBeNull();
  });

  it("groups facts by lifecycle in priority order and humanizes subjects", () => {
    const block = formatFactsForPlanPrompt([
      fact({ lifecycle: "standing", subject: "long_runs", summary: "Prefers Thursday long runs." }),
      fact({ lifecycle: "chronic", subject: "left_knee", summary: "Patellar pain on long runs." }),
      fact({ lifecycle: "recent", subject: null, summary: "Travel next week." }),
    ]);
    expect(block).not.toBeNull();
    expect(block).toContain("Permanent");
    expect(block).toContain("Long-term preferences & habits");
    expect(block).toContain("Recent state");
    // chronic must render before standing
    expect(block!.indexOf("Permanent")).toBeLessThan(block!.indexOf("Long-term preferences"));
    // humanized subject in the rendered fact line
    expect(block).toContain("[Long runs]");
    expect(block).toContain("Prefers Thursday long runs.");
  });
});
