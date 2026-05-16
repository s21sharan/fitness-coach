import { describe, it, expect } from "vitest";
import { computeComplianceStats, formatComplianceForPrompt, isCardioPlanned, type ComplianceInput } from "@/lib/training/compliance";
import type { PlannedWorkoutTargets } from "@/lib/training/workout-contract";

describe("isCardioPlanned", () => {
  it("returns true when targets.contract.sport is run/bike/swim", () => {
    const targets: PlannedWorkoutTargets = {
      contract: { version: 1, sport: "run", name: "Run", source: "coach", steps: [{ type: "work", duration_sec: 60 }] },
    };
    expect(isCardioPlanned({ session_type: "anything", targets })).toBe(true);
    targets.contract!.sport = "bike";
    expect(isCardioPlanned({ session_type: "x", targets })).toBe(true);
    targets.contract!.sport = "swim";
    expect(isCardioPlanned({ session_type: "x", targets })).toBe(true);
  });

  it("returns false when targets.contract.sport is strength (ignores session_type)", () => {
    const targets: PlannedWorkoutTargets = {
      contract: { version: 1, sport: "strength", name: "Lower", source: "coach", steps: [{ type: "work", duration_sec: 60 }] },
    };
    expect(isCardioPlanned({ session_type: "Easy Run", targets })).toBe(false);
  });

  it("falls back to regex on session_type when no contract", () => {
    expect(isCardioPlanned({ session_type: "Easy Run (Zone 2)", targets: null })).toBe(true);
    expect(isCardioPlanned({ session_type: "Long Ride", targets: null })).toBe(true);
    expect(isCardioPlanned({ session_type: "Push", targets: null })).toBe(false);
    expect(isCardioPlanned({ session_type: "Lower Body" })).toBe(false);
  });
});

describe("computeComplianceStats", () => {
  it("returns perfect compliance when all sessions completed", () => {
    const input: ComplianceInput = {
      planned: [
        { date: "2026-05-04", session_type: "Push", is_cardio: false },
        { date: "2026-05-05", session_type: "Easy Run (Zone 2)", is_cardio: true },
        { date: "2026-05-06", session_type: "Legs", is_cardio: false },
      ],
      actualLifting: [
        { date: "2026-05-04", name: "Push Day" },
        { date: "2026-05-06", name: "Leg Day" },
      ],
      actualCardio: [
        { date: "2026-05-05", type: "run", distance: 8 },
      ],
    };

    const stats = computeComplianceStats(input);
    expect(stats.totalPlanned).toBe(3);
    expect(stats.totalCompleted).toBe(3);
    expect(stats.completionRate).toBeCloseTo(1.0);
    expect(stats.liftCompliance).toEqual({ planned: 2, completed: 2 });
    expect(stats.cardioCompliance).toEqual({ planned: 1, completed: 1 });
    expect(stats.skippedSessions).toEqual([]);
  });

  it("identifies skipped sessions", () => {
    const input: ComplianceInput = {
      planned: [
        { date: "2026-05-04", session_type: "Push", is_cardio: false },
        { date: "2026-05-05", session_type: "Tempo Run", is_cardio: true },
        { date: "2026-05-06", session_type: "Legs", is_cardio: false },
        { date: "2026-05-07", session_type: "Rest", is_cardio: false },
      ],
      actualLifting: [
        { date: "2026-05-04", name: "Push Day" },
      ],
      actualCardio: [],
    };

    const stats = computeComplianceStats(input);
    expect(stats.totalPlanned).toBe(3);
    expect(stats.totalCompleted).toBe(1);
    expect(stats.completionRate).toBeCloseTo(1 / 3);
    expect(stats.skippedSessions).toEqual([
      "2026-05-05: Tempo Run",
      "2026-05-06: Legs",
    ]);
  });

  it("detects extra sessions not in the plan", () => {
    const input: ComplianceInput = {
      planned: [
        { date: "2026-05-04", session_type: "Push", is_cardio: false },
      ],
      actualLifting: [
        { date: "2026-05-04", name: "Push Day" },
        { date: "2026-05-05", name: "Arms" },
      ],
      actualCardio: [
        { date: "2026-05-06", type: "run", distance: 5 },
      ],
    };

    const stats = computeComplianceStats(input);
    expect(stats.extraSessions).toEqual([
      "2026-05-05: Arms (lifting)",
      "2026-05-06: run (cardio)",
    ]);
  });

  it("handles empty data gracefully", () => {
    const stats = computeComplianceStats({
      planned: [],
      actualLifting: [],
      actualCardio: [],
    });
    expect(stats.totalPlanned).toBe(0);
    expect(stats.totalCompleted).toBe(0);
    expect(stats.completionRate).toBe(0);
    expect(stats.skippedSessions).toEqual([]);
    expect(stats.extraSessions).toEqual([]);
  });

  it("excludes rest days from planned count", () => {
    const input: ComplianceInput = {
      planned: [
        { date: "2026-05-04", session_type: "Push", is_cardio: false },
        { date: "2026-05-05", session_type: "Rest", is_cardio: false },
        { date: "2026-05-06", session_type: "rest", is_cardio: false },
      ],
      actualLifting: [{ date: "2026-05-04", name: "Push" }],
      actualCardio: [],
    };

    const stats = computeComplianceStats(input);
    expect(stats.totalPlanned).toBe(1);
    expect(stats.completionRate).toBeCloseTo(1.0);
  });
});

describe("formatComplianceForPrompt", () => {
  it("formats stats as readable text", () => {
    const text = formatComplianceForPrompt({
      totalPlanned: 10,
      totalCompleted: 7,
      completionRate: 0.7,
      liftCompliance: { planned: 6, completed: 5 },
      cardioCompliance: { planned: 4, completed: 2 },
      skippedSessions: ["2026-05-05: Tempo Run", "2026-05-08: Long Run"],
      extraSessions: ["2026-05-09: Arms (lifting)"],
    });
    expect(text).toContain("70%");
    expect(text).toContain("7/10");
    expect(text).toContain("Lifting: 5/6");
    expect(text).toContain("Cardio: 2/4");
    expect(text).toContain("Skipped");
    expect(text).toContain("Tempo Run");
    expect(text).toContain("Extra");
    expect(text).toContain("Arms");
  });

  it("returns empty string when no planned sessions", () => {
    const text = formatComplianceForPrompt({
      totalPlanned: 0,
      totalCompleted: 0,
      completionRate: 0,
      liftCompliance: { planned: 0, completed: 0 },
      cardioCompliance: { planned: 0, completed: 0 },
      skippedSessions: [],
      extraSessions: [],
    });
    expect(text).toBe("");
  });
});
