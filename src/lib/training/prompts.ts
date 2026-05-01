interface UserContext {
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

day_of_week mapping: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday`;

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
