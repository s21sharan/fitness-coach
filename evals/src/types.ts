import type { RecentActivity } from "@/lib/training/prompts";
import type { SpecPayload } from "@/lib/training/spec/schema";

/**
 * Self-contained athlete scenario. Loaded from JSON files in evals/scenarios.
 * No DB access — everything the planner needs is in here.
 */
export interface Scenario {
  id: string;
  name: string;
  description: string;
  profile: {
    age: number | null;
    height: number | null;
    weight: number | null;
    sex: string | null;
    training_experience: string | null;
  };
  goals: {
    body_goal: string;
    emphasis: string | null;
    days_per_week: number;
    lifting_days: number | null;
    training_for_race: boolean;
    race_type: string | null;
    race_date: string | null;
    goal_time: string | null;
    does_cardio: boolean;
    cardio_types: string[] | null;
  };
  recentActivity: RecentActivity | null;
  /** Pre-rendered facts block (preferences, injuries, schedule constraints). */
  factsBlock?: string | null;
  /**
   * Optional hand-authored constraint spec. When omitted and EVAL_USE_SPEC is
   * set, the runner authors one from this scenario's context.
   */
  spec?: SpecPayload | null;
  /** Number of weeks the plan should cover. */
  weeks: number;
  /** What the plan MUST do. Judge will check each statement and score adherence. */
  must_have: string[];
  /** What the plan MUST NOT do. Judge will flag any violations. */
  must_not_have: string[];
}

export type RubricCriterion =
  | "constraint_adherence"
  | "periodization"
  | "intensity_distribution"
  | "specificity"
  | "scenario_fit";

export interface CriterionScore {
  /** 1 (catastrophic) to 5 (excellent). */
  score: number;
  reasoning: string;
}

export interface JudgeVerdict {
  /** Hard fail — judge flags a critical safety/constraint violation. */
  blocker: boolean;
  blocker_reason: string | null;
  scores: Record<RubricCriterion, CriterionScore>;
  /** 1-3 specific strengths of the plan. */
  strengths: string[];
  /** 1-3 specific weaknesses (concrete, not generic). */
  weaknesses: string[];
}

export interface ScenarioResult {
  scenario_id: string;
  scenario_name: string;
  /** Average of the 5 rubric scores. */
  avg_score: number;
  blocker: boolean;
  blocker_reason: string | null;
  verdict: JudgeVerdict;
  /** Compact rendering of the generated plan for the judge + human review. */
  plan_summary: string;
  duration_ms: number;
  error?: string;
}

export interface RunReport {
  run_id: string;
  timestamp: string;
  model_planner: string;
  model_judge: string;
  scenarios: ScenarioResult[];
  /** Average of all scenarios' avg_score (excluding errored runs). */
  overall_avg: number;
  blocker_count: number;
  error_count: number;
}
