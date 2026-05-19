import { describe, it, expect } from "vitest";
import {
  expiryForLifecycle,
  isExpired,
  orderFactsForPrompt,
} from "@/lib/athlete-context/lifecycle";
import { LIFECYCLE_TTL_MS } from "@/lib/athlete-context/vocab";
import type { AthleteFact } from "@/lib/athlete-context/types";

function fact(partial: Partial<AthleteFact>): AthleteFact {
  return {
    id: partial.id ?? "id",
    user_id: "u1",
    category: "preference",
    subject: null,
    predicate: "prefers",
    value: null,
    summary: "test",
    lifecycle: "standing",
    confidence: 0.8,
    status: "active",
    observed_at: new Date().toISOString(),
    expires_at: null,
    source: "chat",
    source_ref_table: null,
    source_ref_id: null,
    supersedes_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  } as AthleteFact;
}

describe("expiryForLifecycle", () => {
  it("returns null for chronic", () => {
    expect(expiryForLifecycle("chronic")).toBeNull();
  });

  it("returns observedAt + TTL for non-chronic lifecycles", () => {
    const base = new Date("2026-01-01T00:00:00.000Z");
    const standing = expiryForLifecycle("standing", base);
    expect(standing).toBe(new Date(base.getTime() + LIFECYCLE_TTL_MS.standing!).toISOString());

    const recent = expiryForLifecycle("recent", base);
    expect(recent).toBe(new Date(base.getTime() + LIFECYCLE_TTL_MS.recent!).toISOString());

    const ephemeral = expiryForLifecycle("ephemeral", base);
    expect(ephemeral).toBe(new Date(base.getTime() + LIFECYCLE_TTL_MS.ephemeral!).toISOString());
  });
});

describe("isExpired", () => {
  it("false when expires_at is null", () => {
    expect(isExpired({ expires_at: null })).toBe(false);
  });

  it("true when expires_at has passed", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isExpired({ expires_at: past })).toBe(true);
  });

  it("false when expires_at is in the future", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isExpired({ expires_at: future })).toBe(false);
  });
});

describe("orderFactsForPrompt", () => {
  it("groups by lifecycle (chronic first) then recency within each", () => {
    const older = new Date("2026-01-01T00:00:00.000Z").toISOString();
    const newer = new Date("2026-02-01T00:00:00.000Z").toISOString();

    const ephemeral = fact({ id: "eph", lifecycle: "ephemeral", observed_at: newer });
    const chronicOld = fact({ id: "chr-old", lifecycle: "chronic", observed_at: older });
    const chronicNew = fact({ id: "chr-new", lifecycle: "chronic", observed_at: newer });
    const standing = fact({ id: "std", lifecycle: "standing", observed_at: older });

    const ordered = orderFactsForPrompt([ephemeral, chronicOld, chronicNew, standing]);
    expect(ordered.map((f) => f.id)).toEqual(["chr-new", "chr-old", "std", "eph"]);
  });
});
