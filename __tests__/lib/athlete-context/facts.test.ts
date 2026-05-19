import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory store stand-in for the athlete_facts table.
let table: Array<Record<string, unknown>> = [];

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => makeFakeClient(),
}));

function makeFakeClient() {
  return {
    from: (_t: string) => makeBuilder(),
  };
}

interface Filters {
  eq: Record<string, unknown>;
  is: Record<string, unknown | null>;
  lt: Record<string, string>;
  notNull: string[];
}

function makeBuilder() {
  const filters: Filters = { eq: {}, is: {}, lt: {}, notNull: [] };
  let mode: "select" | "insert" | "update" = "select";
  let insertPayload: Record<string, unknown> | null = null;
  let updatePayload: Record<string, unknown> | null = null;
  let limitN: number | null = null;

  const applyFilters = (row: Record<string, unknown>): boolean => {
    for (const [k, v] of Object.entries(filters.eq)) if (row[k] !== v) return false;
    for (const [k, v] of Object.entries(filters.is)) {
      if (v === null && row[k] != null) return false;
      if (v !== null && row[k] !== v) return false;
    }
    for (const [k, v] of Object.entries(filters.lt)) {
      if (typeof row[k] !== "string" || (row[k] as string) >= v) return false;
    }
    for (const k of filters.notNull) {
      if (row[k] == null) return false;
    }
    return true;
  };

  const exec = async (): Promise<{ data: unknown; error: null }> => {
    if (mode === "insert" && insertPayload) {
      // Apply DB-side defaults so query filters that rely on them work.
      const row = {
        id: `row-${table.length + 1}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: "active",
        supersedes_id: null,
        expires_at: null,
        confidence: 0.8,
        ...insertPayload,
      };
      table.push(row);
      return { data: row, error: null };
    }
    if (mode === "update" && updatePayload) {
      const matches = table.filter(applyFilters);
      for (const row of matches) Object.assign(row, updatePayload);
      return { data: matches[0] ?? null, error: null };
    }
    let rows = table.filter(applyFilters);
    if (limitN != null) rows = rows.slice(0, limitN);
    return { data: limitN === 1 ? rows[0] ?? null : rows, error: null };
  };

  const api: Record<string, unknown> = {
    select: (_cols: string) => api,
    insert: (payload: Record<string, unknown>) => {
      mode = "insert";
      insertPayload = payload;
      return api;
    },
    update: (payload: Record<string, unknown>) => {
      mode = "update";
      updatePayload = payload;
      return api;
    },
    eq: (k: string, v: unknown) => {
      filters.eq[k] = v;
      return api;
    },
    is: (k: string, v: unknown | null) => {
      filters.is[k] = v;
      return api;
    },
    lt: (k: string, v: string) => {
      filters.lt[k] = v;
      return api;
    },
    not: (k: string, op: string, v: unknown) => {
      if (op === "is" && v === null) filters.notNull.push(k);
      return api;
    },
    order: (_k: string, _opts?: unknown) => api,
    limit: (n: number) => {
      limitN = n;
      return api;
    },
    maybeSingle: async () => {
      limitN = 1;
      return exec();
    },
    single: async () => {
      limitN = 1;
      return exec();
    },
    then: (resolve: (v: { data: unknown; error: null }) => unknown) => exec().then(resolve),
  };
  return api;
}

// Import the module under test AFTER the vi.mock above so it picks up our fake.
import { insertFact, fetchActiveFacts } from "@/lib/athlete-context/facts";

beforeEach(() => {
  table = [];
});

describe("insertFact", () => {
  it("inserts a new fact when nothing matches", async () => {
    const res = await insertFact("u1", {
      category: "preference",
      subject: "long_runs",
      predicate: "prefers",
      value: { day: "sunday" },
      summary: "Prefers Sunday long runs",
      lifecycle: "standing",
      source: "chat",
    });
    expect(res).not.toBeNull();
    expect(table.length).toBe(1);
    expect(table[0]!.status).toBe("active");
    expect(table[0]!.supersedes_id).toBeNull();
  });

  it("refreshes an existing fact when value is identical", async () => {
    await insertFact("u1", {
      category: "preference",
      subject: "long_runs",
      predicate: "prefers",
      value: { day: "sunday" },
      summary: "Prefers Sunday long runs",
      lifecycle: "standing",
      source: "chat",
    });
    const originalObserved = table[0]!.observed_at as string;
    await new Promise((r) => setTimeout(r, 10));
    await insertFact("u1", {
      category: "preference",
      subject: "long_runs",
      predicate: "prefers",
      value: { day: "sunday" },
      summary: "Prefers Sunday long runs.",
      lifecycle: "standing",
      source: "chat",
    });
    expect(table.length).toBe(1);
    expect(table[0]!.observed_at).not.toBe(originalObserved);
  });

  it("supersedes when value contradicts", async () => {
    await insertFact("u1", {
      category: "preference",
      subject: "session_time",
      predicate: "prefers",
      value: { time: "morning" },
      summary: "Prefers morning sessions",
      lifecycle: "standing",
      source: "chat",
    });
    const originalId = table[0]!.id;
    await insertFact("u1", {
      category: "preference",
      subject: "session_time",
      predicate: "prefers",
      value: { time: "evening" },
      summary: "Prefers evening sessions",
      lifecycle: "standing",
      source: "chat",
    });
    expect(table.length).toBe(2);
    const old = table.find((r) => r.id === originalId)!;
    const fresh = table.find((r) => r.id !== originalId)!;
    expect(old.status).toBe("superseded");
    expect(fresh.status).toBe("active");
    expect(fresh.supersedes_id).toBe(originalId);
  });
});

describe("fetchActiveFacts", () => {
  it("returns only active rows for the user", async () => {
    await insertFact("u1", {
      category: "preference",
      subject: "x",
      predicate: "prefers",
      value: null,
      summary: "active1",
      lifecycle: "standing",
      source: "chat",
    });
    await insertFact("u2", {
      category: "preference",
      subject: "x",
      predicate: "prefers",
      value: null,
      summary: "other-user",
      lifecycle: "standing",
      source: "chat",
    });
    const facts = await fetchActiveFacts("u1");
    expect(facts.length).toBe(1);
    expect(facts[0]!.summary).toBe("active1");
  });
});
