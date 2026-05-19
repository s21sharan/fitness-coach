import type { TrainingPaces } from "@/lib/training/training-paces";

export type FactLifecycle = "chronic" | "standing" | "recent" | "ephemeral";
export type FactStatus = "active" | "expired" | "superseded" | "archived";
export type FactSource =
  | "chat"
  | "completion_note"
  | "skip_note"
  | "plan_acceptance"
  | "onboarding_recap"
  | "manual"
  | "derived";

export interface AthleteFact {
  id: string;
  user_id: string;
  category: string;
  subject: string | null;
  predicate: string;
  value: Record<string, unknown> | null;
  summary: string;
  lifecycle: FactLifecycle;
  confidence: number;
  status: FactStatus;
  observed_at: string;
  expires_at: string | null;
  source: FactSource;
  source_ref_table: string | null;
  source_ref_id: string | null;
  supersedes_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * What the extractor returns / callers pass to insertFact. Lifecycle is
 * required so the caller (or the LLM) commits to a TTL; everything else
 * carries a sensible default.
 */
export interface FactInput {
  category: string;
  subject?: string | null;
  predicate: string;
  value?: Record<string, unknown> | null;
  summary: string;
  lifecycle: FactLifecycle;
  confidence?: number;
  source: FactSource;
  source_ref_table?: string | null;
  source_ref_id?: string | null;
}

export interface AthleteContext {
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
    training_for_race: boolean;
    race_type: string | null;
    race_date: string | null;
    goal_time: string | null;
  };
  plan: {
    id: string;
    split_type: string;
    plan_config: Record<string, unknown> | null;
  } | null;
  todaySession: string | null;
  recovery: {
    hrv: number | null;
    sleep_hours: number | null;
    resting_hr: number | null;
    body_battery: number | null;
  } | null;
  hrZones: Array<{ zone: number; low: number; high: number }> | null;
  trainingPaces: TrainingPaces | null;
  weekStats: {
    sessionsCompleted: number;
    sessionsPlanned: number;
    skippedThisWeek?: Array<{ date: string; sessionType: string; reason: string | null }>;
  } | null;
  block: {
    block_id: string;
    block_type: string;
    block_label: string;
    block_number: number;
    week_count: number;
    current_week: number;
    end_date: string;
    days_until_end: number;
    compliance_pct: number | null;
  } | null;
  availability: {
    windows: Array<{
      day_of_week: number;
      start_time: string;
      end_time: string;
      max_duration_min: number | null;
      session_count: number;
    }>;
    rules: Array<{ rule_key: string; params: Record<string, unknown> }>;
  } | null;
  upcomingPlannedSessions: Array<{
    date: string;
    session_type: string;
    status: string;
  }>;
  facts: AthleteFact[];
}
