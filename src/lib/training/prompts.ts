export interface RecentActivity {
  avgRunPaceMinKm: number | null;
  avgRunDistanceKm: number | null;
  avgRunHr: number | null;
  weeklyRunCount: number;
  weeklyLiftCount: number;
  avgLiftDurationMin: number | null;
  avgHrv: number | null;
  avgSleepHours: number | null;
}

export interface UserContext {
  age: number | null;
  height: number | null;
  weight: number | null;
  sex: string | null;
  experience: string | null;
  bodyGoal: string;
  emphasis: string | null;
  daysPerWeek: number;
  liftingDays: number | null;
  trainingForRace: boolean;
  raceType: string | null;
  raceDate: string | null;
  goalTime: string | null;
  doesCardio: boolean;
  cardioTypes: string[];
  recentActivity: RecentActivity | null;
}

export const PLAN_SYSTEM_PROMPT = `You are a certified personal trainer and endurance coach creating a training plan.
Generate a structured training split based on the user's profile, goals, and constraints.
Your plan should be split-level (session types like "Push", "Upper Body", "Easy Run Zone 2"),
NOT exercise-level. Users choose their own exercises in their tracking apps.

For hybrid/race athletes, use proper periodization:
- Base phase: high volume, low intensity
- Build phase: increasing intensity, sport-specific work
- Peak phase: race-specific sessions, reduced volume
- Taper phase: significant volume reduction, maintain intensity

Session type examples:
- Lifting: "Push", "Pull", "Legs", "Upper Body", "Lower Body", "Full Body", "Chest + Back", "Shoulders + Arms"
- Cardio: "Easy Run (Zone 2)", "Tempo Run", "Intervals", "Long Run", "Long Ride", "Swim", "Long Ride + Brick Run"
- Multi-session days: "Upper Body + Easy Run (Zone 2)", "Easy Run (Zone 2) + Swim"
- Rest: "Rest"

day_of_week mapping: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday

When setting targets for each day, use the athlete's recent data to set realistic goals:
- For runs: set target_distance_km, target_pace_min_km, target_hr_zone, target_hr_max based on their recent averages
- For lifting: set target_duration_min and muscle_focus
- For rest days: targets can be omitted
- Zone 2 runs should target a pace ~10-15% slower than their average pace
- Long runs should target 1.5-2x their average distance at easy pace
- Tempo runs should target their average pace or slightly faster`;

export function buildUserPrompt(ctx: UserContext): string {
  const lines: string[] = [];

  lines.push("Create a training plan for this user:");
  lines.push("");

  if (ctx.age) lines.push(`Age: ${ctx.age}`);
  if (ctx.sex) lines.push(`Sex: ${ctx.sex}`);
  if (ctx.height) lines.push(`Height: ${Math.round(ctx.height)} cm`);
  if (ctx.weight) lines.push(`Weight: ${ctx.weight} lbs`);
  if (ctx.experience) lines.push(`Experience: ${ctx.experience}`);
  lines.push("");

  lines.push(`Goal: ${formatGoal(ctx.bodyGoal)}`);
  if (ctx.emphasis && ctx.emphasis !== "none") {
    lines.push(`Emphasis: ${ctx.emphasis}`);
  }
  lines.push(`Available days per week: ${ctx.daysPerWeek}`);
  if (ctx.liftingDays !== null && ctx.liftingDays !== ctx.daysPerWeek) {
    lines.push(`Lifting days: ${ctx.liftingDays}`);
  }
  lines.push("");

  if (ctx.trainingForRace && ctx.raceType) {
    lines.push(`Training for: ${formatRaceType(ctx.raceType)}`);
    if (ctx.raceDate) {
      const weeksOut = getWeeksUntilRace(ctx.raceDate);
      lines.push(`Race date: ${ctx.raceDate} (${weeksOut} weeks out)`);
    }
    if (ctx.goalTime) lines.push(`Goal time: ${ctx.goalTime}`);
    lines.push("");
  }

  if (ctx.doesCardio && ctx.cardioTypes.length > 0 && !ctx.trainingForRace) {
    lines.push(`Also does cardio: ${ctx.cardioTypes.join(", ")}`);
    lines.push("");
  }

  lines.push(`Today's date: ${new Date().toISOString().slice(0, 10)}`);

  if (ctx.recentActivity) {
    const a = ctx.recentActivity;
    lines.push("");
    lines.push("Recent activity data (last 30 days):");
    if (a.avgRunPaceMinKm) lines.push(`- Avg easy run pace: ${a.avgRunPaceMinKm} min/km`);
    if (a.avgRunDistanceKm) lines.push(`- Avg run distance: ${a.avgRunDistanceKm} km`);
    if (a.avgRunHr) lines.push(`- Avg run HR: ${a.avgRunHr} bpm`);
    lines.push(`- Weekly runs: ${a.weeklyRunCount}, weekly lifts: ${a.weeklyLiftCount}`);
    if (a.avgLiftDurationMin) lines.push(`- Avg lifting session: ${a.avgLiftDurationMin} min`);
    if (a.avgHrv) lines.push(`- Avg HRV: ${a.avgHrv}`);
    if (a.avgSleepHours) lines.push(`- Avg sleep: ${a.avgSleepHours}h`);
    lines.push("");
    lines.push("Use this data to set realistic pace, distance, and duration targets for each workout.");
  }

  return lines.join("\n");
}

export interface MultiWeekPromptContext extends UserContext {
  compliance: string | null;
  weeksToGenerate: number;
  /**
   * Pre-rendered athlete facts block from formatFactsForPlanPrompt. The
   * planner MUST respect these (day-of-week preferences, injuries,
   * scheduling constraints) when picking the layout.
   */
  factsBlock?: string | null;
}

export const MULTI_WEEK_SYSTEM_PROMPT = `You are an expert hybrid-athlete coach producing a structured multi-week training block.

## Coaching Methodology
- **Endurance:** 80/20 polarized approach — ~80% easy/Zone 2, ~20% threshold/VO2max work.
- **Lifting:** progressive overload via volume or intensity week-over-week. RPE-based autoregulation.
- **Hybrid sequencing:** hard/easy day alternation. Never schedule heavy lower-body lifting the day before a key cardio session (tempo, intervals, long run/ride).
- **Deload:** Every 3rd or 4th week, reduce volume 30-40% while maintaining intensity.
- **Two-a-days:** Only when the athlete has the time and recovery capacity. Place the priority session in the slot where the athlete has more energy (usually AM for cardio, PM for lifting).

## Session Specificity
Sessions must be specific and actionable — not generic labels.
- BAD: "Tempo Run", "Easy Run", "Upper Body"
- GOOD: "Tempo Run — 5x1km @ 4:20/km, 90s jog recovery", "Easy Run — 45min Zone 2, conversational pace", "Upper Body — horizontal push/pull emphasis, 3x8-10 RPE 7"

## Progressive Overload Between Weeks
Each week MUST differ from the previous. Never repeat a week verbatim. Progress through:
- Cardio: increase duration 5-10%, add intervals, increase pace target
- Lifting: add 1 set to compounds, increase RPE from 7→8, increase weight 2-5%
- If it's a deload week, reduce volume by 30-40% while keeping some intensity

## Day Layout Format
Each day has am_session and pm_session slots (both can be null). Use them to:
- Schedule two-a-days when the athlete has AM+PM availability
- Place key quality sessions when the athlete is freshest
- Place easier/recovery work in the other slot

Set is_rest=true and leave both sessions null for full rest days.

## Session Format — Structured Contracts
Each am_session / pm_session is a structured object (NOT a string):
{
  "sport": "run" | "bike" | "swim" | "strength",
  "name": short display label (≤60 chars), e.g. "Easy Z2 run" or "Lower body lift",
  "rationale": one sentence explaining why this session is placed here and now,
  "contract": {
    "version": 1,
    "sport": same as outer sport,
    "name": same short display label,
    "slot": "am" | "pm" | "full",
    "source": "coach",
    "steps": [ ...ordered ContractStep[] ]
  }
}

Each ContractStep has:
- type: "warmup" | "work" | "recovery" | "cooldown" | "rest" | "repeat"
- label: optional short description ("Tempo block", "Bench press")
- duration_sec: integer seconds
- distance_m: meters (alternative to duration for running/cycling)
- target_hr_zone: 1..5
- pace_sec_per_km: seconds per km for running
- ftp_percent: 30..150 for cycling
- exercise_name / sets / reps / weight_kg / rpe: for strength steps
- repeats + steps: for interval blocks ("type": "repeat" with nested steps)

Emission rules:
- ALWAYS set version=1, source="coach", and the correct sport on the contract.
- Cardio (run / bike / swim): include at least one "work" step with duration_sec or distance_m, plus target_hr_zone or pace_sec_per_km when known. Add warmup/cooldown when appropriate.
- Strength: when the athlete has specifics, emit one "work" step per exercise with exercise_name, sets, reps (and weight_kg/rpe if known). When vague, a single "work" step with a "label" and "duration_sec" is acceptable.
- Match the athlete's level of detail — don't fabricate specifics they didn't request.
- day_label: exactly "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"

## Week Block Format
Each week has a week_focus explaining the training intent for that week.
- Week 1 of a new plan: "Establish rhythm — calibrate effort levels, moderate volume"
- Progression week: "Progress volume +10%, maintain intensity targets"
- Deload week: "Recovery week — volume cut 35%, keep 2 quality sessions"

## Risk Awareness
Identify 1-3 real risks tailored to THIS athlete's situation (not generic advice).
Examples: "Volume ramp is aggressive given 7h sleep average", "Heavy legs on Wed may compromise Thursday tempo", "HRV trending down — consider auto-regulating Thursday intensity"`;

export function buildMultiWeekUserPrompt(ctx: MultiWeekPromptContext): string {
  const lines: string[] = [];

  lines.push("Create a multi-week training plan for this athlete:");
  lines.push("");

  // Profile
  const profileParts: string[] = [];
  if (ctx.age) profileParts.push(`${ctx.age}yo`);
  if (ctx.sex) profileParts.push(ctx.sex);
  if (ctx.height) profileParts.push(`${Math.round(ctx.height)}cm`);
  if (ctx.weight) profileParts.push(`${ctx.weight}lbs`);
  if (ctx.experience) profileParts.push(ctx.experience);
  if (profileParts.length > 0) lines.push(`Profile: ${profileParts.join(", ")}`);

  // Goals
  lines.push(`Goal: ${formatGoal(ctx.bodyGoal)}`);
  if (ctx.emphasis && ctx.emphasis !== "none") lines.push(`Emphasis: ${ctx.emphasis}`);
  lines.push(`Available days per week: ${ctx.daysPerWeek}`);
  if (ctx.liftingDays !== null && ctx.liftingDays !== ctx.daysPerWeek) {
    lines.push(`Lifting days: ${ctx.liftingDays}`);
  }
  lines.push("");

  // Race
  if (ctx.trainingForRace && ctx.raceType) {
    lines.push(`Training for: ${formatRaceType(ctx.raceType)}`);
    if (ctx.raceDate) {
      const weeksOut = getWeeksUntilRace(ctx.raceDate);
      lines.push(`Race date: ${ctx.raceDate} (${weeksOut} weeks out)`);
    }
    if (ctx.goalTime) lines.push(`Goal time: ${ctx.goalTime}`);
    lines.push("");
  }

  // Cardio (non-race)
  if (ctx.doesCardio && ctx.cardioTypes.length > 0 && !ctx.trainingForRace) {
    lines.push(`Also does cardio: ${ctx.cardioTypes.join(", ")}`);
    lines.push("");
  }

  // Today's date
  lines.push(`Today's date: ${new Date().toISOString().slice(0, 10)}`);

  // Recent activity
  if (ctx.recentActivity) {
    const a = ctx.recentActivity;
    lines.push("");
    lines.push("Recent activity data (last 30 days):");
    if (a.avgRunPaceMinKm) lines.push(`  Avg easy run pace: ${a.avgRunPaceMinKm} min/km`);
    if (a.avgRunDistanceKm) lines.push(`  Avg run distance: ${a.avgRunDistanceKm} km`);
    if (a.avgRunHr) lines.push(`  Avg run HR: ${a.avgRunHr} bpm`);
    lines.push(`  Weekly runs: ${a.weeklyRunCount}, weekly lifts: ${a.weeklyLiftCount}`);
    if (a.avgLiftDurationMin) lines.push(`  Avg lifting session: ${a.avgLiftDurationMin} min`);
    if (a.avgHrv) lines.push(`  Avg HRV: ${a.avgHrv}`);
    if (a.avgSleepHours) lines.push(`  Avg sleep: ${a.avgSleepHours}h`);
    lines.push("");
    lines.push("Use this data to set realistic pace, distance, and duration targets. Zone 2 pace should be ~10-15% slower than avg pace. Long runs should be 1.5-2x avg distance at easy pace.");
  }

  // Compliance feedback
  if (ctx.compliance) {
    lines.push("");
    lines.push("--- Previous plan compliance ---");
    lines.push(ctx.compliance);
    lines.push("");
    lines.push("Adapt the new plan based on this adherence data:");
    lines.push("- If cardio compliance is low, consider reducing cardio frequency or combining with lifting days");
    lines.push("- If lifting compliance is low, consider fewer lifting days or shorter sessions");
    lines.push("- If extra sessions appear, incorporate what the athlete gravitates toward");
    lines.push("- If overall compliance is high, the plan complexity and volume are appropriate");
  }

  // Durable athlete facts (preferences, injuries, scheduling constraints).
  // Placed near the bottom so it's the last thing the model reads before
  // outputting, and called out explicitly so day-of-week preferences are
  // honored when assigning sessions.
  if (ctx.factsBlock) {
    lines.push("");
    lines.push("--- WHAT THE ATHLETE HAS TOLD US (MUST RESPECT) ---");
    lines.push(ctx.factsBlock);
    lines.push("");
    lines.push(
      "These facts override generic conventions. If a fact specifies a day of the week, time of day, modality preference, or no-go (e.g. injury), the plan MUST honor it. Do not place long runs / hard sessions / lifts on days the athlete dislikes for that modality. If two facts conflict, the more recent one wins.",
    );
  }

  lines.push("");
  lines.push(`Generate exactly ${ctx.weeksToGenerate} weeks of training. Day labels must be exactly: "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun" in order.`);

  return lines.join("\n");
}

function formatGoal(goal: string): string {
  const map: Record<string, string> = {
    gain_muscle: "Gain muscle",
    lose_weight: "Lose weight / cut",
    maintain: "Maintain / recomp",
    other: "General fitness",
  };
  return map[goal] || goal;
}

function formatRaceType(raceType: string): string {
  const map: Record<string, string> = {
    "5k": "5K",
    "10k": "10K",
    half_marathon: "Half Marathon",
    marathon: "Marathon",
    ultra: "Ultra Marathon",
    sprint_tri: "Sprint Triathlon",
    olympic_tri: "Olympic Triathlon",
    half_ironman: "Half Ironman (70.3)",
    ironman: "Full Ironman (140.6)",
    other: "Other race",
  };
  return map[raceType] || raceType;
}

function getWeeksUntilRace(raceDateStr: string): number {
  const raceDate = new Date(raceDateStr);
  const now = new Date();
  const diffMs = raceDate.getTime() - now.getTime();
  return Math.max(0, Math.round(diffMs / (7 * 24 * 60 * 60 * 1000)));
}
