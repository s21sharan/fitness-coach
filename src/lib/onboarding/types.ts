// ============================================================
// Athlete Context Profile
//
// Output of the redesigned onboarding flow. Mirrors the
// normalized tables created in migration 004_athlete_context.sql.
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

export type GoalKey =
  | "run_faster"
  | "finish_race"
  | "improve_triathlon"
  | "build_aerobic_base"
  | "build_muscle"
  | "get_stronger"
  | "lose_fat"
  | "recomp"
  | "maintain_strength_with_endurance"
  | "avoid_injury"
  | "improve_consistency"
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
  | "sports"
  | "identity"
  | "goals"
  | "events"
  | "load_current"
  | "load_target"
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
  enabled: boolean;          // currently train
  is_planned: boolean;       // include in plan
  priority: number | null;   // 1 = primary, 2, 3, ...
  is_primary: boolean;
  is_limiter: boolean;
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
  lifting_goal?: LiftingGoal | null;
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
  start_time: string;         // "HH:MM"
  end_time: string;           // "HH:MM"
  max_duration_min: number | null;
  locations: string[];        // gym / pool / outdoor / home
}

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

export type InjuryArea =
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
  has_readiness_data: boolean;
  sore_frequency: "rarely" | "sometimes" | "often" | "always" | null;
  recovery_confidence: "always_cooked" | "slightly_under" | "usually_ok" | "fresh" | "under_training" | null;
}

export interface BodyNutrition {
  body_goal: BodyGoalDetailed | null;
  goal_weight_lbs: number | null;
  target_rate_lbs_per_week: number | null;
  diet_style: string | null;
  protein_target_g: number | null;
  fuel_workouts_when_cutting: "yes" | "sometimes" | "avoid_around_workouts" | "not_sure" | null;
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
// Plan preview output
// ------------------------------------------------------------

export interface PlanPreviewWeek {
  narrative: string;
  risks: string[];
  first_week: PlanPreviewDay[];
}

export interface PlanPreviewDay {
  day_label: string;   // "Mon", "Tue", ...
  session: string;     // "Threshold run + upper"
  rationale: string;
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
  // basic biometrics
  basic: BasicProfile;

  // sport identity
  athlete_identity: AthleteIdentity | null;

  // sports map keyed by sport id
  sports: Record<SportId, SportEntry>;

  // goals
  goal_keys: GoalKey[];          // multi-select
  goal_rank: GoalKey[];          // ranked subset (top 3-5)
  primary_optimization: PrimaryGoal | null;
  aggressiveness: Aggressiveness | null;

  // events
  events: AthleteEvent[];
  no_event: boolean;

  // body & nutrition
  body_nutrition: BodyNutrition;

  // availability
  availability_windows: AvailabilityWindow[];
  availability_rules: AvailabilityRule[];

  // recovery
  recovery: RecoveryContext;

  // injuries
  injuries: AthleteInjury[];

  // equipment
  equipment: EquipmentItem[];

  // preferences
  preferences: Preferences;

  // coach
  coach: CoachSettings;

  // captured chat notes (one per insertion point at most)
  chat_notes: ChatNote[];

  // optional plan preview (last screen)
  plan_preview: PlanPreviewWeek | null;
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

  steps.push("load_current", "load_target");

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
  { value: "bike", label: "Cycling", emoji: "🚴", description: "Road, trainer, mountain" },
  { value: "swim", label: "Swimming", emoji: "🏊", description: "Pool or open water" },
  { value: "lift", label: "Lifting", emoji: "🏋️", description: "Strength training" },
  { value: "other", label: "Other", emoji: "🎯", description: "Hike, ski, row, sport" },
];

export const ATHLETE_IDENTITIES: { value: AthleteIdentity; label: string; description: string }[] = [
  { value: "runner_who_lifts", label: "Runner who lifts", description: "Run quality protected; lifting supports running" },
  { value: "triathlete_who_lifts", label: "Triathlete who lifts", description: "Three-sport balance; lifting is supplemental" },
  { value: "lifter_adding_endurance", label: "Lifter adding endurance", description: "Preserve muscle; cautious run ramp" },
  { value: "hybrid_athlete", label: "Hybrid athlete", description: "Balanced interference management" },
  { value: "endurance_returning", label: "Returning endurance athlete", description: "Coming back from time off" },
  { value: "beginner_consistency", label: "Beginner", description: "Consistency, injury prevention, habit formation" },
  { value: "performance_racer", label: "Competitive racer", description: "Periodized plan toward events" },
  { value: "general_fitness", label: "General fitness", description: "Health, longevity, balanced training" },
];

export const GOAL_OPTIONS: { value: GoalKey; label: string; emoji: string }[] = [
  { value: "run_faster", label: "Run faster", emoji: "💨" },
  { value: "finish_race", label: "Finish a race", emoji: "🏁" },
  { value: "improve_triathlon", label: "Improve triathlon performance", emoji: "🔱" },
  { value: "build_aerobic_base", label: "Build aerobic base", emoji: "🫁" },
  { value: "build_muscle", label: "Build muscle", emoji: "💪" },
  { value: "get_stronger", label: "Get stronger", emoji: "🏋️" },
  { value: "lose_fat", label: "Lose fat", emoji: "📉" },
  { value: "recomp", label: "Recomp", emoji: "⚖️" },
  { value: "maintain_strength_with_endurance", label: "Maintain strength while building endurance", emoji: "🤝" },
  { value: "avoid_injury", label: "Avoid injury", emoji: "🛡️" },
  { value: "improve_consistency", label: "Improve consistency", emoji: "📆" },
  { value: "first_long_event", label: "Finish first 70.3 / marathon / Olympic tri", emoji: "🥇" },
  { value: "improve_swim_technique", label: "Improve swim technique", emoji: "🌊" },
  { value: "improve_cycling_power", label: "Improve cycling power", emoji: "⚡" },
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

export const INJURY_AREAS: { value: InjuryArea; label: string }[] = [
  { value: "achilles", label: "Achilles" },
  { value: "knee", label: "Knee" },
  { value: "hip", label: "Hip" },
  { value: "shin", label: "Shins" },
  { value: "plantar", label: "Plantar fascia" },
  { value: "low_back", label: "Low back" },
  { value: "shoulder", label: "Shoulder" },
  { value: "neck", label: "Neck" },
  { value: "hamstring", label: "Hamstring" },
  { value: "calf", label: "Calf" },
  { value: "ankle", label: "Ankle" },
  { value: "stress_fracture_history", label: "Stress fracture history" },
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

export const EQUIPMENT_BY_SPORT: Record<SportId, string[]> = {
  run: ["road_access", "track", "trail", "treadmill", "hills_nearby"],
  bike: ["road_bike", "tri_bike", "smart_trainer", "power_meter", "hrm", "indoor_app"],
  swim: ["pool_access", "open_water", "pull_buoy", "paddles", "fins", "snorkel", "masters_group"],
  lift: ["commercial_gym", "home_gym", "barbell", "squat_rack", "dumbbells", "cable_stack", "leg_press", "trap_bar", "machines"],
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
  power_meter: "Power meter",
  hrm: "Heart rate monitor",
  indoor_app: "Indoor app (Zwift, TrainerRoad, etc.)",
  pool_access: "Pool access",
  open_water: "Open water access",
  pull_buoy: "Pull buoy",
  paddles: "Paddles",
  fins: "Fins",
  snorkel: "Snorkel",
  masters_group: "Masters group",
  commercial_gym: "Commercial gym",
  home_gym: "Home gym",
  barbell: "Barbell",
  squat_rack: "Squat rack",
  dumbbells: "Dumbbells",
  cable_stack: "Cable stack",
  leg_press: "Leg press",
  trap_bar: "Trap bar",
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

export const LIFTING_GOALS: { value: LiftingGoal; label: string }[] = [
  { value: "strength", label: "Strength" },
  { value: "hypertrophy", label: "Hypertrophy" },
  { value: "maintain", label: "Maintain muscle" },
  { value: "injury_prevention", label: "Injury prevention" },
  { value: "general_fitness", label: "General fitness" },
  { value: "sport_specific", label: "Sport-specific" },
];

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

export function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}
