// ============================================================
// Athlete Context Profile
//
// Output of the redesigned onboarding flow. Mirrors the
// normalized tables created in migrations 005_athlete_context.sql
// and 006_onboarding_refinements.sql.
// ============================================================

export type Sex = "M" | "F" | "Other";
export type Experience = "beginner" | "intermediate" | "advanced";

export type SportId = "run" | "bike" | "swim" | "lift" | "other";

export type AthleteIdentity =
  | "runner_who_lifts"
  | "triathlete_who_lifts"
  | "lifter_adding_endurance"
  | "hybrid_athlete"
  | "endurance_returning"
  | "beginner_consistency"
  | "performance_racer"
  | "general_fitness";

// Goal vocabulary kept broad for back-compat with stored drafts; the
// onboarding UI only surfaces the trimmed `GOAL_OPTIONS` set below.
export type GoalKey =
  | "finish_a_race"
  | "build_endurance"
  | "build_speed"
  | "improve_race_performance"
  | "build_muscle"
  | "get_stronger"
  | "lose_fat"
  | "improve_consistency"
  | "avoid_injury"
  // legacy values still accepted
  | "run_faster"
  | "finish_race"
  | "improve_triathlon"
  | "build_aerobic_base"
  | "recomp"
  | "maintain_strength_with_endurance"
  | "first_long_event"
  | "improve_swim_technique"
  | "improve_cycling_power";

export type PrimaryGoal =
  | "race_performance"
  | "strength"
  | "muscle_gain"
  | "fat_loss"
  | "general_fitness"
  | "longevity";

export type Aggressiveness =
  | "conservative"
  | "balanced"
  | "balanced_aggressive"
  | "push_hard"
  | "consistency_first";

export type ExplanationLevel = "minimal" | "moderate" | "detailed";

export type MissedWorkoutBehavior =
  | "auto_reschedule"
  | "ask_first"
  | "skip_move_on"
  | "adapt_by_importance";

export type PlanFlexibility =
  | "very_flexible"
  | "somewhat_flexible"
  | "structured"
  | "highly_structured";

export type BodyGoalDetailed =
  | "maintain"
  | "cut_fat"
  | "slow_cut"
  | "recomp"
  | "lean_bulk"
  | "aggressive_bulk"
  | "strength_focused"
  | "race_weight_focused"
  | "not_sure";

export type EventPriority = "A" | "B" | "C";

export type StepId =
  | "welcome"
  | "connect"
  | "sports"           // merged sports + load_current + load_target tile
  | "identity"
  | "goals"
  | "events"
  | "strength"
  | "body_nutrition"
  | "availability"
  | "recovery"
  | "injury"
  | "equipment"
  | "coach_style"
  | "plan_preview";

// ------------------------------------------------------------
// Per-sport entries
// ------------------------------------------------------------

export interface SportEntry {
  sport: SportId;
  enabled: boolean;          // had been training before this block
  is_planned: boolean;       // include in upcoming block
  priority: number | null;
  is_primary: boolean;       // retained for back-compat; UI no longer collects
  is_limiter: boolean;       // retained for back-compat; UI no longer collects
  current_volume: CurrentVolume | null;
  target_peak: TargetPeak | null;
  sport_specific: SportSpecific | null;
}

export interface CurrentVolume {
  weekly_miles?: number | null;
  weekly_hours?: number | null;
  weekly_meters?: number | null;
  weekly_sessions?: number | null;
  longest_session?: number | null;      // miles / hours / meters
  peak_recent?: number | null;           // peak across last 6mo
  notes?: string | null;
}

export interface TargetPeak {
  weekly_miles?: number | null;
  weekly_hours?: number | null;
  weekly_meters?: number | null;
  weekly_sessions?: number | null;
  not_sure?: boolean;
}

export interface SportSpecific {
  ftp?: number | null;                   // bike
  css_per_100?: string | null;           // swim CSS
  easy_pace?: string | null;             // run
  threshold_pace?: string | null;        // run
  pool_length_m?: number | null;
  split_type?: SplitPreference | null;   // lift
  leg_interference?: LegInterferenceTolerance | null;
  key_lifts?: string[] | null;
  movement_style?: MovementStyle[] | null;
  lifting_goal?: LiftingGoal | null;     // retained for back-compat
  has_power_meter?: boolean | null;
}

export type SplitPreference =
  | "full_body"
  | "upper_lower"
  | "ppl"
  | "body_part"
  | "hybrid_custom"
  | "recommend";

export type LegInterferenceTolerance =
  | "heavy_legs_fine"
  | "heavy_legs_interfere"
  | "minimal_lower_soreness"
  | "sacrifice_run_for_strength"
  | "sacrifice_strength_for_endurance";

export type LiftingGoal =
  | "strength"
  | "hypertrophy"
  | "maintain"
  | "injury_prevention"
  | "general_fitness"
  | "sport_specific";

export type MovementStyle =
  | "compound_barbell"
  | "compound_dumbbell"
  | "unilateral"
  | "machines_cables"
  | "olympic"
  | "bodyweight"
  | "isolation"
  | "kettlebells";

// ------------------------------------------------------------
// Events
// ------------------------------------------------------------

export interface AthleteEvent {
  id: string;                 // client-side uuid for keying
  name: string;
  sport_type: string | null;  // running / triathlon / cycling / lifting / other
  distance: string | null;    // e.g. "marathon", "70.3"
  event_date: string | null;  // ISO
  priority: EventPriority | null;
  goal_type: string | null;   // finish / pr / time / podium / qualify
  goal_time: string | null;
  course_notes: string | null;
  travel: boolean;
}

// ------------------------------------------------------------
// Availability
// ------------------------------------------------------------

export interface AvailabilityWindow {
  id: string;
  day_of_week: number;        // 0 = Mon ... 6 = Sun
  start_time: string;         // "HH:MM" — "06:00" for AM, "16:00" for PM, "08:00" for all-day
  end_time: string;           // "HH:MM"
  max_duration_min: number | null;  // hours available × 60
  session_count: number;       // 1 by default; 2 means split into two sessions of this duration
  locations: string[];        // gym / pool / outdoor / home
}

export type AvailabilityBlock = "am" | "pm" | "all_day";

export type AvailabilityRuleKey =
  | "long_run_weekend"
  | "long_ride_weekend"
  | "avoid_hard_run_before_leg_day"
  | "avoid_heavy_lower_before_threshold"
  | "keep_one_rest_day"
  | "prefer_morning"
  | "prefer_evening"
  | "limit_two_a_days"
  | "like_two_a_days"
  | "train_every_day"
  | "need_weekly_flexibility"
  | "pool_morning_only"
  | "gym_mwf_only"
  | "no_treadmill"
  | "no_running_two_days_in_row";

export interface AvailabilityRule {
  id: string;
  rule_key: AvailabilityRuleKey | string;
  params: Record<string, unknown> | null;
}

// ------------------------------------------------------------
// Injury / equipment / recovery / nutrition / preferences
// ------------------------------------------------------------

// New, simpler general body-area buckets that the UI surfaces.
// Legacy InjuryArea values still allowed in stored data.
export type BodyArea =
  | "foot_ankle"
  | "lower_leg"
  | "knee"
  | "hip_glutes"
  | "low_back"
  | "upper_back_neck"
  | "shoulder"
  | "elbow_wrist"
  | "hamstring"
  | "other";

export type InjuryArea =
  | BodyArea
  | "achilles"
  | "knee"
  | "hip"
  | "shin"
  | "plantar"
  | "low_back"
  | "shoulder"
  | "neck"
  | "hamstring"
  | "calf"
  | "ankle"
  | "stress_fracture_history"
  | "other";

export interface AthleteInjury {
  id: string;
  area: InjuryArea | string;
  description: string | null;       // specific issue typed by user
  current_pain_level: number;       // 0-10
  history: boolean;
  triggers: string[];
  affecting_training: boolean;
}

export interface EquipmentItem {
  id: string;
  sport: SportId;
  item: string;
  available: boolean;
  notes?: string;
}

export interface RecoveryContext {
  avg_sleep_hours: number | null;
  sleep_consistency: "very_consistent" | "mostly_consistent" | "variable" | "poor" | null;
  work_stress: "low" | "moderate" | "high" | "very_high" | null;
  physical_job: boolean;
  // Retained for back-compat; UI no longer collects these (HRV inferred
  // from connected wearables; subjective recovery only meaningful post-plan).
  has_readiness_data: boolean;
  sore_frequency: "rarely" | "sometimes" | "often" | "always" | null;
  recovery_confidence: "always_cooked" | "slightly_under" | "usually_ok" | "fresh" | "under_training" | null;
}

export type ProteinTier = "moderate" | "high" | "highest";
export type DietStyle =
  | "omnivore"
  | "low_carb"
  | "low_fat"
  | "high_carb"
  | "vegetarian"
  | "vegan"
  | "pescatarian"
  | "keto"
  | "paleo"
  | "mediterranean"
  | "other";

export interface BodyNutrition {
  body_goal: BodyGoalDetailed | null;
  goal_weight_lbs: number | null;
  target_rate_lbs_per_week: number | null;
  diet_style: DietStyle | string | null;
  protein_tier: ProteinTier | null;
  protein_target_g: number | null;
  fuel_workouts_when_cutting: "yes" | "sometimes" | "avoid_around_workouts" | "not_sure" | null;
  // Retained for back-compat; UI no longer collects (the integration page
  // already captures which tracker the user uses).
  tracking_app: "macrofactor" | "myfitnesspal" | "cronometer" | "none" | "other" | null;
  notes: string;
}

export interface Preferences {
  motivation_drivers: string[];
  common_derailers: string[];
  enjoyed_workouts: string[];
  dislikes: string[];
  sacrifice_priority: string[];  // first to reduce
  protect_priority: string[];    // first to protect
}

export interface CoachSettings {
  aggressiveness: Aggressiveness | null;
  explanation_level: ExplanationLevel | null;
  missed_workout_behavior: MissedWorkoutBehavior | null;
  plan_flexibility: PlanFlexibility | null;
  tone_notes: string;
}

// ------------------------------------------------------------
// Captured AI chat notes
// ------------------------------------------------------------

export type ChatInsertionPoint =
  | "goals"
  | "availability"
  | "plan_preview"
  | "coach_style";

export interface ChatNote {
  insertion_point: ChatInsertionPoint;
  raw_text: string;
  extracted: ExtractedChatTags | null;
}

export interface ExtractedChatTags {
  constraints?: string[];
  conflicts?: string[];
  hidden_risks?: string[];
  tone?: string | null;
  goals?: string[];
  notes?: string[];
  rules?: string[];        // candidate availability rule_keys
}

// ------------------------------------------------------------
// Plan preview output (multi-week + AM/PM)
// ------------------------------------------------------------

export interface PlanPreviewDay {
  day_label: string;               // "Mon", "Tue", ...
  am_session: string | null;
  am_rationale: string | null;
  pm_session: string | null;
  pm_rationale: string | null;
  is_rest: boolean;                // overrides — pure rest day
  notes: string | null;            // free-form day note
}

export interface PlanPreviewWeekBlock {
  week_number: number;
  week_focus: string;              // 1-2 sentence focus for the week
  days: PlanPreviewDay[];          // length 7, Mon..Sun
}

export interface PlanPreviewWeek {
  narrative: string;
  risks: string[];
  weeks: PlanPreviewWeekBlock[];   // 1..N weeks
}

// ------------------------------------------------------------
// Profile (top-level shape)
// ------------------------------------------------------------

export interface BasicProfile {
  height_cm: number | null;
  weight_lbs: number | null;
  age: number | null;
  sex: Sex | null;
  training_experience: Experience | null;
}

export interface AthleteContextProfile {
  basic: BasicProfile;

  athlete_identity: AthleteIdentity | null;

  sports: Record<SportId, SportEntry>;

  goal_keys: GoalKey[];
  goal_rank: GoalKey[];
  primary_optimization: PrimaryGoal | null;
  aggressiveness: Aggressiveness | null;

  events: AthleteEvent[];
  no_event: boolean;

  body_nutrition: BodyNutrition;

  availability_windows: AvailabilityWindow[];
  availability_rules: AvailabilityRule[];

  recovery: RecoveryContext;

  injuries: AthleteInjury[];

  equipment: EquipmentItem[];

  preferences: Preferences;

  coach: CoachSettings;

  chat_notes: ChatNote[];

  plan_preview: PlanPreviewWeek | null;

  // Plan preview controls (UI-only; not persisted to athlete tables).
  weeks_to_generate: number;       // 1..4
}

// ------------------------------------------------------------
// Defaults
// ------------------------------------------------------------

function defaultSport(sport: SportId): SportEntry {
  return {
    sport,
    enabled: false,
    is_planned: false,
    priority: null,
    is_primary: false,
    is_limiter: false,
    current_volume: null,
    target_peak: null,
    sport_specific: null,
  };
}

export function getDefaultAthleteProfile(): AthleteContextProfile {
  return {
    basic: {
      height_cm: null,
      weight_lbs: null,
      age: null,
      sex: null,
      training_experience: null,
    },
    athlete_identity: null,
    sports: {
      run: defaultSport("run"),
      bike: defaultSport("bike"),
      swim: defaultSport("swim"),
      lift: defaultSport("lift"),
      other: defaultSport("other"),
    },
    goal_keys: [],
    goal_rank: [],
    primary_optimization: null,
    aggressiveness: null,
    events: [],
    no_event: false,
    body_nutrition: {
      body_goal: null,
      goal_weight_lbs: null,
      target_rate_lbs_per_week: null,
      diet_style: null,
      protein_tier: null,
      protein_target_g: null,
      fuel_workouts_when_cutting: null,
      tracking_app: null,
      notes: "",
    },
    availability_windows: [],
    availability_rules: [],
    recovery: {
      avg_sleep_hours: null,
      sleep_consistency: null,
      work_stress: null,
      physical_job: false,
      has_readiness_data: false,
      sore_frequency: null,
      recovery_confidence: null,
    },
    injuries: [],
    equipment: [],
    preferences: {
      motivation_drivers: [],
      common_derailers: [],
      enjoyed_workouts: [],
      dislikes: [],
      sacrifice_priority: [],
      protect_priority: [],
    },
    coach: {
      aggressiveness: null,
      explanation_level: null,
      missed_workout_behavior: null,
      plan_flexibility: null,
      tone_notes: "",
    },
    chat_notes: [],
    plan_preview: null,
    weeks_to_generate: 1,
  };
}

// ------------------------------------------------------------
// Step visibility / branching
// ------------------------------------------------------------

export function plannedSports(data: AthleteContextProfile): SportId[] {
  return (Object.values(data.sports) as SportEntry[])
    .filter((s) => s.is_planned)
    .map((s) => s.sport);
}

export function hasLifting(data: AthleteContextProfile): boolean {
  return data.sports.lift.is_planned;
}

export function hasAnySport(data: AthleteContextProfile): boolean {
  return plannedSports(data).length > 0;
}

export function getVisibleSteps(data: AthleteContextProfile): StepId[] {
  const steps: StepId[] = ["welcome", "connect", "sports", "identity", "goals"];

  if (!data.no_event) {
    steps.push("events");
  }

  if (hasLifting(data)) {
    steps.push("strength");
  }

  steps.push(
    "body_nutrition",
    "availability",
    "recovery",
    "injury",
  );

  if (hasAnySport(data)) {
    steps.push("equipment");
  }

  steps.push("coach_style", "plan_preview");

  return steps;
}

// ------------------------------------------------------------
// Constants used by step components
// ------------------------------------------------------------

export const SPORTS: { value: SportId; label: string; emoji: string; description: string }[] = [
  { value: "run", label: "Running", emoji: "🏃", description: "Roads, trails, track" },
  { value: "bike", label: "Cycling", emoji: "🚴", description: "Road, trainer, indoor" },
  { value: "swim", label: "Swimming", emoji: "🏊", description: "Pool or open water" },
  { value: "lift", label: "Lifting", emoji: "🏋️", description: "Strength training" },
  { value: "other", label: "Other", emoji: "🎯", description: "Hike, ski, row, sport" },
];

// Refined identity set: complementary, less overlapping.
export const ATHLETE_IDENTITIES: { value: AthleteIdentity; label: string; description: string }[] = [
  { value: "runner_who_lifts", label: "Runner who lifts", description: "Endurance comes first; lifting supports it" },
  { value: "lifter_adding_endurance", label: "Lifter adding cardio", description: "Strength comes first; cardio is supplemental" },
  { value: "triathlete_who_lifts", label: "Multisport athlete", description: "Multiple endurance sports, lifting supportive" },
  { value: "hybrid_athlete", label: "True hybrid", description: "Balance strength and endurance equally" },
  { value: "performance_racer", label: "Competitive racer", description: "Periodized toward goal events" },
  { value: "endurance_returning", label: "Returning to training", description: "Coming back from time off" },
  { value: "beginner_consistency", label: "Just getting started", description: "Building consistency first" },
  { value: "general_fitness", label: "General health", description: "Health, longevity, balanced training" },
];

// Trimmed goal options: complementary, performance-direction oriented.
// Lifting-specific goals live on the strength screen (page 9), not here.
export const GOAL_OPTIONS: { value: GoalKey; label: string; emoji: string }[] = [
  { value: "finish_a_race", label: "Finish a race", emoji: "🏁" },
  { value: "build_endurance", label: "Build endurance", emoji: "🫁" },
  { value: "build_speed", label: "Build speed", emoji: "💨" },
  { value: "improve_race_performance", label: "Improve race performance", emoji: "🥇" },
  { value: "build_muscle", label: "Build muscle", emoji: "💪" },
  { value: "get_stronger", label: "Get stronger", emoji: "🏋️" },
  { value: "lose_fat", label: "Lose fat", emoji: "📉" },
  { value: "improve_consistency", label: "Improve consistency", emoji: "📆" },
  { value: "avoid_injury", label: "Stay healthy / avoid injury", emoji: "🛡️" },
];

export const PRIMARY_GOALS: { value: PrimaryGoal; label: string; description: string }[] = [
  { value: "race_performance", label: "Race performance", description: "Optimize for an event result" },
  { value: "strength", label: "Strength", description: "Get stronger in key lifts" },
  { value: "muscle_gain", label: "Muscle gain", description: "Hypertrophy first" },
  { value: "fat_loss", label: "Fat loss", description: "Body composition first" },
  { value: "general_fitness", label: "General fitness", description: "Health and habit" },
  { value: "longevity", label: "Longevity / injury prevention", description: "Sustainable training" },
];

export const AGGRESSIVENESS_OPTIONS: { value: Aggressiveness; label: string; description: string }[] = [
  { value: "conservative", label: "Conservative", description: "Injury-averse, ramp slowly" },
  { value: "balanced", label: "Balanced", description: "Sustainable progress" },
  { value: "balanced_aggressive", label: "Balanced-aggressive", description: "Push, but smart about recovery" },
  { value: "push_hard", label: "Push me hard", description: "Maximize stimulus" },
  { value: "consistency_first", label: "Consistency first", description: "Keep me showing up" },
];

export const EXPLANATION_LEVELS: { value: ExplanationLevel; label: string }[] = [
  { value: "minimal", label: "Minimal — just tell me what to do" },
  { value: "moderate", label: "Moderate — brief reasoning" },
  { value: "detailed", label: "Detailed — explain it like a coach" },
];

export const MISSED_WORKOUT_OPTIONS: { value: MissedWorkoutBehavior; label: string }[] = [
  { value: "auto_reschedule", label: "Automatically reschedule" },
  { value: "ask_first", label: "Ask me first" },
  { value: "skip_move_on", label: "Skip and move on" },
  { value: "adapt_by_importance", label: "Adapt based on importance" },
];

export const PLAN_FLEXIBILITY_OPTIONS: { value: PlanFlexibility; label: string }[] = [
  { value: "very_flexible", label: "Very flexible" },
  { value: "somewhat_flexible", label: "Somewhat flexible" },
  { value: "structured", label: "Structured" },
  { value: "highly_structured", label: "Highly structured" },
];

export const BODY_GOALS_DETAILED: { value: BodyGoalDetailed; label: string; description: string }[] = [
  { value: "maintain", label: "Maintain", description: "Hold weight" },
  { value: "cut_fat", label: "Cut fat", description: "Aggressive deficit" },
  { value: "slow_cut", label: "Slow cut", description: "Lose fat without losing strength" },
  { value: "recomp", label: "Recomp", description: "Maintain weight, change composition" },
  { value: "lean_bulk", label: "Lean bulk", description: "Gain slowly while staying lean" },
  { value: "aggressive_bulk", label: "Aggressive bulk", description: "Eat big, gain fast" },
  { value: "strength_focused", label: "Strength-focused", description: "Body comp is secondary" },
  { value: "race_weight_focused", label: "Race weight focused", description: "Hit race weight by event date" },
  { value: "not_sure", label: "Not sure", description: "Recommend for me" },
];

export const PROTEIN_TIERS: { value: ProteinTier; label: string; description: string }[] = [
  { value: "moderate", label: "Moderate", description: "~1.4 g/kg — general fitness" },
  { value: "high", label: "High", description: "~1.8 g/kg — lifting or recomp" },
  { value: "highest", label: "Highest", description: "~2.2 g/kg — aggressive cut or muscle gain" },
];

export const DIET_STYLES: { value: DietStyle; label: string; description: string }[] = [
  { value: "omnivore", label: "Omnivore", description: "Anything goes" },
  { value: "low_carb", label: "Low carb", description: "Lower carbs / higher fat" },
  { value: "high_carb", label: "High carb", description: "Carb-fuelled endurance" },
  { value: "low_fat", label: "Low fat", description: "Lower fat intake" },
  { value: "vegetarian", label: "Vegetarian", description: "No meat" },
  { value: "vegan", label: "Vegan", description: "Plant-based only" },
  { value: "pescatarian", label: "Pescatarian", description: "Fish but no meat" },
  { value: "keto", label: "Keto", description: "Very low carb" },
  { value: "paleo", label: "Paleo", description: "Whole foods only" },
  { value: "mediterranean", label: "Mediterranean", description: "Olive oil, fish, veg" },
  { value: "other", label: "Other", description: "Something else" },
];

export const AVAILABILITY_RULE_OPTIONS: { value: AvailabilityRuleKey; label: string }[] = [
  { value: "long_run_weekend", label: "Long run on weekends" },
  { value: "long_ride_weekend", label: "Long ride on weekends" },
  { value: "avoid_hard_run_before_leg_day", label: "No hard run the day before leg day" },
  { value: "avoid_heavy_lower_before_threshold", label: "No heavy legs before key run workouts" },
  { value: "keep_one_rest_day", label: "Keep one full rest day" },
  { value: "prefer_morning", label: "Prefer morning workouts" },
  { value: "prefer_evening", label: "Prefer evening workouts" },
  { value: "limit_two_a_days", label: "Limit two-a-days" },
  { value: "like_two_a_days", label: "I like two-a-days" },
  { value: "train_every_day", label: "I can train every day" },
  { value: "need_weekly_flexibility", label: "Need flexibility week to week" },
  { value: "pool_morning_only", label: "Pool only in the morning" },
  { value: "gym_mwf_only", label: "Gym only Mon/Wed/Fri" },
  { value: "no_treadmill", label: "Cannot run on treadmill" },
  { value: "no_running_two_days_in_row", label: "No back-to-back running days" },
];

// Block presets — AM, PM, all-day. all_day is the implicit "whole weekend day"
// flag captured by a single window that spans the entire day.
export const AVAILABILITY_BLOCKS: { id: AvailabilityBlock; label: string; start: string; end: string }[] = [
  { id: "am", label: "AM", start: "06:00", end: "12:00" },
  { id: "pm", label: "PM", start: "16:00", end: "22:00" },
  { id: "all_day", label: "All day", start: "08:00", end: "20:00" },
];

// Hour presets for a block, mapped to `max_duration_min`
export const HOUR_PRESETS = [
  { label: "30 min", minutes: 30 },
  { label: "1 hr", minutes: 60 },
  { label: "1.5 hr", minutes: 90 },
  { label: "2 hr", minutes: 120 },
  { label: "3+ hr", minutes: 180 },
  { label: "Half-day", minutes: 360 },
] as const;

// General body-area buckets surfaced by the injury screen.
export const BODY_AREAS: { value: BodyArea; label: string; example: string }[] = [
  { value: "foot_ankle", label: "Foot / ankle", example: "plantar fasciitis, achilles, sprain" },
  { value: "lower_leg", label: "Lower leg", example: "shin splints, calf strain" },
  { value: "knee", label: "Knee", example: "patellar tendon, IT band, meniscus" },
  { value: "hamstring", label: "Hamstring", example: "strain, tightness" },
  { value: "hip_glutes", label: "Hip / glutes", example: "hip flexor, glute med" },
  { value: "low_back", label: "Lower back", example: "muscle strain, disc, SI joint" },
  { value: "upper_back_neck", label: "Upper back / neck", example: "trap tension, posture" },
  { value: "shoulder", label: "Shoulder", example: "rotator cuff, impingement, AC joint" },
  { value: "elbow_wrist", label: "Elbow / wrist", example: "tennis elbow, tendinopathy" },
  { value: "other", label: "Other", example: "describe in the card" },
];

// Legacy detailed list kept for compatibility with previously stored injuries.
export const INJURY_AREAS: { value: InjuryArea; label: string }[] = [
  { value: "foot_ankle", label: "Foot / ankle" },
  { value: "lower_leg", label: "Lower leg" },
  { value: "knee", label: "Knee" },
  { value: "hamstring", label: "Hamstring" },
  { value: "hip_glutes", label: "Hip / glutes" },
  { value: "low_back", label: "Lower back" },
  { value: "upper_back_neck", label: "Upper back / neck" },
  { value: "shoulder", label: "Shoulder" },
  { value: "elbow_wrist", label: "Elbow / wrist" },
  { value: "other", label: "Other" },
];

export const INJURY_TRIGGERS = [
  "mileage_ramp",
  "speedwork",
  "hills",
  "heavy_squats",
  "long_runs",
  "poor_sleep",
  "shoes",
  "unknown",
] as const;

export const MOTIVATION_DRIVERS = [
  "seeing_progress",
  "races",
  "body_composition",
  "competition",
  "routine",
  "data",
  "coach_accountability",
  "social_training",
] as const;

export const DERAILERS = [
  "travel",
  "work_school",
  "sleep",
  "injury",
  "motivation",
  "poor_planning",
  "soreness",
  "nutrition",
  "too_much_intensity",
  "all_or_nothing",
] as const;

export const ENJOYED_WORKOUTS = [
  "long_runs",
  "track_work",
  "tempo",
  "hills",
  "long_rides",
  "intervals",
  "strength",
  "technique_sessions",
  "easy_aerobic",
] as const;

export const SACRIFICE_OPTIONS = [
  "reduce_lifting_volume",
  "reduce_endurance_volume",
  "reduce_intensity",
  "reduce_accessories",
  "reduce_swimming",
  "reduce_cycling",
  "reduce_running",
  "add_rest",
  "ask_each_time",
] as const;

export const PROTECT_OPTIONS = [
  "race_specific_workouts",
  "long_run",
  "long_ride",
  "heavy_lifting",
  "muscle_gain",
  "sleep_recovery",
  "consistency",
] as const;

// Equipment — refined per spec: no commercial/home_gym duality, indoor
// stationary bike added for cycling, swim slimmed to intentional set,
// indoor app (zwift) dropped.
export const EQUIPMENT_BY_SPORT: Record<SportId, string[]> = {
  run: ["road_access", "track", "trail", "treadmill", "hills_nearby"],
  bike: ["road_bike", "tri_bike", "smart_trainer", "stationary_bike", "power_meter", "hrm"],
  swim: ["pool_access", "open_water_access", "pull_buoy", "paddles", "fins", "masters_group"],
  lift: ["barbell", "squat_rack", "bench", "dumbbells", "trap_bar", "kettlebells", "machines", "cable_stack"],
  other: [],
};

export const EQUIPMENT_LABELS: Record<string, string> = {
  road_access: "Road access",
  track: "Track access",
  trail: "Trail access",
  treadmill: "Treadmill",
  hills_nearby: "Hills nearby",
  road_bike: "Road bike",
  tri_bike: "Tri bike",
  smart_trainer: "Smart trainer",
  stationary_bike: "Indoor stationary bike",
  power_meter: "Power meter",
  hrm: "Heart-rate monitor",
  pool_access: "Pool access",
  open_water_access: "Open water access",
  pull_buoy: "Pull buoy",
  paddles: "Paddles",
  fins: "Fins",
  masters_group: "Masters group",
  barbell: "Barbell",
  squat_rack: "Squat rack",
  bench: "Bench",
  dumbbells: "Dumbbells",
  trap_bar: "Trap bar",
  kettlebells: "Kettlebells",
  cable_stack: "Cable stack",
  machines: "Machines",
};

export const SPLIT_PREFERENCES: { value: SplitPreference; label: string }[] = [
  { value: "full_body", label: "Full body" },
  { value: "upper_lower", label: "Upper / Lower" },
  { value: "ppl", label: "Push / Pull / Legs" },
  { value: "body_part", label: "Body-part split" },
  { value: "hybrid_custom", label: "Hybrid custom" },
  { value: "recommend", label: "Recommend for me" },
];

export const LEG_INTERFERENCE_OPTIONS: { value: LegInterferenceTolerance; label: string }[] = [
  { value: "heavy_legs_fine", label: "Heavy legs are fine" },
  { value: "heavy_legs_interfere", label: "Heavy legs interfere with running" },
  { value: "minimal_lower_soreness", label: "I want minimal lower-body soreness" },
  { value: "sacrifice_run_for_strength", label: "I'll sacrifice some run quality for strength" },
  { value: "sacrifice_strength_for_endurance", label: "I'll sacrifice strength for endurance" },
];

// Movement-style groups for the strength screen.
export const MOVEMENT_STYLES: { value: MovementStyle; label: string; description: string }[] = [
  { value: "compound_barbell", label: "Barbell compounds", description: "Squat, dead, bench, OHP, row" },
  { value: "compound_dumbbell", label: "Dumbbell compounds", description: "DB bench, DB row, DB squat, lunges" },
  { value: "unilateral", label: "Unilateral", description: "Split squats, single-leg DL, lunges" },
  { value: "machines_cables", label: "Machines / cables", description: "Leg press, cable rows, machines" },
  { value: "olympic", label: "Olympic lifts", description: "Clean, snatch, jerk" },
  { value: "bodyweight", label: "Bodyweight", description: "Pullups, dips, push-ups, calisthenics" },
  { value: "isolation", label: "Isolation", description: "Curls, extensions, raises, accessories" },
  { value: "kettlebells", label: "Kettlebells", description: "Swings, Turkish get-ups, KB complexes" },
];

// LIFTING_GOALS retained for back-compat; the v2 strength screen no
// longer surfaces this (it overlapped with page-5 goals).
export const LIFTING_GOALS: { value: LiftingGoal; label: string }[] = [
  { value: "strength", label: "Strength" },
  { value: "hypertrophy", label: "Hypertrophy" },
  { value: "maintain", label: "Maintain muscle" },
  { value: "injury_prevention", label: "Injury prevention" },
  { value: "general_fitness", label: "General fitness" },
  { value: "sport_specific", label: "Sport-specific" },
];

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const WEEKDAYS = [0, 1, 2, 3, 4] as const;   // Mon..Fri
export const WEEKEND = [5, 6] as const;             // Sat, Sun

// ------------------------------------------------------------
// Event distance presets per sport
// ------------------------------------------------------------

export const EVENT_SPORTS: { value: string; label: string; emoji: string }[] = [
  { value: "running", label: "Running", emoji: "🏃" },
  { value: "triathlon", label: "Triathlon", emoji: "🔱" },
  { value: "cycling", label: "Cycling", emoji: "🚴" },
  { value: "swimming", label: "Swimming", emoji: "🏊" },
  { value: "powerlifting", label: "Powerlifting meet", emoji: "🏋️" },
  { value: "hypertrophy", label: "Hypertrophy phase", emoji: "💪" },
  { value: "other", label: "Other", emoji: "🎯" },
];

export const EVENT_DISTANCES: Record<string, string[]> = {
  running: ["5K", "10K", "Half marathon", "Marathon", "50K", "50 mi", "100K", "100 mi", "Custom"],
  triathlon: ["Sprint", "Olympic", "70.3 / Half-Iron", "140.6 / Ironman", "XTERRA", "Custom"],
  cycling: ["Crit", "Road race", "Gravel", "Century", "Double century", "Gran fondo", "Time trial", "Custom"],
  swimming: ["500y", "1000y", "1 mi", "5K open water", "10K open water", "Custom"],
  powerlifting: ["Local meet", "Regional", "National", "Custom"],
  hypertrophy: ["8-week block", "12-week block", "16-week block", "Custom"],
  other: ["Custom"],
};

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

export function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

// Convert a protein tier into a target gram count given body weight (lbs).
// Used at commit time to populate athlete_body_nutrition.protein_target_g.
export function proteinGramsFromTier(tier: ProteinTier | null, weightLbs: number | null): number | null {
  if (!tier) return null;
  const baseGPerKg = tier === "moderate" ? 1.4 : tier === "high" ? 1.8 : 2.2;
  if (weightLbs && weightLbs > 0) {
    return Math.round((weightLbs / 2.20462) * baseGPerKg);
  }
  // Fallback estimates if weight is unknown
  return tier === "moderate" ? 120 : tier === "high" ? 160 : 200;
}
