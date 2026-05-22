import { z } from "zod";
import type { RubricCriterion } from "./types";

/**
 * Judge rubric. Kept as a single const so when we tune criteria, every
 * scenario re-scores against the new version automatically.
 */
export const RUBRIC: Record<RubricCriterion, { label: string; description: string }> = {
  constraint_adherence: {
    label: "Constraint adherence",
    description:
      "Does the plan respect the athlete's hard constraints? days_per_week count, lifting_days count, athlete facts (injuries, day preferences, modality dislikes), race date proximity (no heavy intensity in taper, no premature peak), and any explicit user request. Hard violations on day count or injury patterns are blockers, not just low scores.",
  },
  periodization: {
    label: "Periodization",
    description:
      "Is the phase appropriate for the athlete (base/build/peak/taper for race goals; accumulation/intensification for hypertrophy)? Is there a deload every 3-4 weeks (or 2-3 for masters/low recovery)? Does volume progress sensibly week-over-week (≤10% jumps)? For taper scenarios, is volume cut 40-60% while intensity is preserved?",
  },
  intensity_distribution: {
    label: "Intensity distribution",
    description:
      "For endurance work: roughly polarized 80/20 (≥80% easy/Z2, ≤20% threshold/VO2max), no more than two quality sessions per week for non-elite athletes, no gray-zone (Z3) bloat. For hybrid: heavy lower-body lift never the day before a quality run. Hard/easy alternation throughout — no stacking quality on consecutive days.",
  },
  specificity: {
    label: "Specificity",
    description:
      "Are sessions concrete and actionable? Cardio sessions should specify duration OR distance plus HR zone or pace. Strength sessions should specify either exercise×sets×reps×RPE or at minimum a duration + clear focus. Generic labels ('Tempo Run', 'Upper Body') with no detail score low. Each session should have a short rationale.",
  },
  scenario_fit: {
    label: "Scenario fit",
    description:
      "Does the plan satisfy the scenario's `must_have` items and avoid every `must_not_have` item? This is the scenario-specific check — score 5 only if every must_have is clearly addressed AND no must_not_have appears. One must_not_have violation caps this criterion at 2.",
  },
};

/**
 * Zod schema the judge model returns. Mirrors JudgeVerdict in types.ts.
 */
export const judgeVerdictSchema = z.object({
  blocker: z.boolean().describe("True if the plan has a critical safety or hard-constraint violation"),
  blocker_reason: z.string().nullable().describe("If blocker=true, one-sentence reason; else null"),
  scores: z.object({
    constraint_adherence: z.object({
      score: z.number().int().min(1).max(5),
      reasoning: z.string().min(1),
    }),
    periodization: z.object({
      score: z.number().int().min(1).max(5),
      reasoning: z.string().min(1),
    }),
    intensity_distribution: z.object({
      score: z.number().int().min(1).max(5),
      reasoning: z.string().min(1),
    }),
    specificity: z.object({
      score: z.number().int().min(1).max(5),
      reasoning: z.string().min(1),
    }),
    scenario_fit: z.object({
      score: z.number().int().min(1).max(5),
      reasoning: z.string().min(1),
    }),
  }),
  strengths: z.array(z.string()).min(1).max(3),
  weaknesses: z.array(z.string()).min(1).max(3),
});
