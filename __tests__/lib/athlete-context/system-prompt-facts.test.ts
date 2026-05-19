import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "@/lib/chat/system-prompt";
import type { AthleteFact } from "@/lib/athlete-context/types";

function fact(partial: Partial<AthleteFact>): AthleteFact {
  return {
    id: "id",
    user_id: "u1",
    category: "preference",
    subject: null,
    predicate: "prefers",
    value: null,
    summary: "test fact",
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

const baseInput = {
  profile: { age: 30, height: 180, weight: 175, sex: "male", training_experience: "intermediate" },
  goals: {
    body_goal: "gain_muscle",
    emphasis: null,
    days_per_week: 5,
    training_for_race: false,
    race_type: null,
    race_date: null,
    goal_time: null,
  },
  plan: null,
  todaySession: null,
  recovery: null,
  weekStats: null,
} as const;

describe("buildSystemPrompt — facts rendering", () => {
  it("omits the Athlete knowledge section when no facts", () => {
    const prompt = buildSystemPrompt({ ...baseInput, facts: [] });
    expect(prompt).not.toContain("Athlete knowledge");
  });

  it("renders facts grouped by lifecycle with summary text", () => {
    const prompt = buildSystemPrompt({
      ...baseInput,
      facts: [
        fact({ id: "c1", lifecycle: "chronic", category: "injury", subject: "left_knee", summary: "Patellar pain on long runs since 2024." }),
        fact({ id: "s1", lifecycle: "standing", category: "preference", subject: "long_runs", summary: "Strongly prefers Sunday morning long runs." }),
        fact({ id: "r1", lifecycle: "recent", category: "soreness", subject: "calves", summary: "Reported tight calves this week after speed work." }),
      ],
    });
    expect(prompt).toContain("Athlete knowledge");
    expect(prompt).toContain("Chronic");
    expect(prompt).toContain("Standing");
    expect(prompt).toContain("Recent");
    expect(prompt).toContain("Patellar pain on long runs since 2024.");
    expect(prompt).toContain("Strongly prefers Sunday morning long runs.");
    expect(prompt).toContain("Reported tight calves this week after speed work.");
    // Subject tag should appear when present
    expect(prompt).toContain("[left_knee]");
  });

  it("caps the rendered set at 30 facts", () => {
    const many = Array.from({ length: 50 }, (_, i) =>
      fact({ id: `f${i}`, summary: `fact-line-${i}`, lifecycle: "standing" }),
    );
    const prompt = buildSystemPrompt({ ...baseInput, facts: many });
    const matches = prompt.match(/fact-line-/g) ?? [];
    expect(matches.length).toBe(30);
  });
});
