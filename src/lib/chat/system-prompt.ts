interface SystemPromptInput {
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
  todayNutrition: {
    calories: number;
    protein: number;
  } | null;
  weekStats: {
    sessionsCompleted: number;
    sessionsPlanned: number;
  } | null;
}

const RACE_LABELS: Record<string, string> = {
  "5k": "5K", "10k": "10K", half_marathon: "Half Marathon", marathon: "Marathon",
  ultra: "Ultra Marathon", sprint_tri: "Sprint Triathlon", olympic_tri: "Olympic Triathlon",
  half_ironman: "Half Ironman (70.3)", ironman: "Full Ironman (140.6)",
};

const SPLIT_LABELS: Record<string, string> = {
  ppl: "Push / Pull / Legs", arnold: "Arnold Split", upper_lower: "Upper / Lower",
  full_body: "Full Body", phul: "PHUL", bro_split: "Bro Split",
  hybrid_upper_lower: "Upper/Lower + Race Prep", hybrid_nick_bare: "Hybrid (Nick Bare Style)",
};

export function buildSystemPrompt(input: SystemPromptInput): string {
  const { profile, goals, plan, todaySession, recovery, todayNutrition, weekStats } = input;
  const lines: string[] = [];

  lines.push("You are Coach, a fitness coach. You are direct, specific, encouraging but honest, opinionated, and concise.");
  lines.push("");

  const profileParts: string[] = [];
  if (profile.age) profileParts.push(`${profile.age}yo`);
  if (profile.sex) profileParts.push(profile.sex);
  if (profile.height) profileParts.push(`${profile.height}cm`);
  if (profile.weight) profileParts.push(`${profile.weight}lbs`);
  if (profile.training_experience) profileParts.push(profile.training_experience);
  if (profileParts.length > 0) lines.push(`Profile: ${profileParts.join(", ")}`);

  lines.push(`Goal: ${formatGoal(goals.body_goal)}`);
  if (goals.emphasis && goals.emphasis !== "none") lines.push(`Emphasis: ${goals.emphasis}`);
  lines.push(`Training ${goals.days_per_week} days/week`);

  if (goals.training_for_race && goals.race_type) {
    lines.push(`Race: ${RACE_LABELS[goals.race_type] || goals.race_type}`);
    if (goals.race_date) lines.push(`Race date: ${goals.race_date}`);
    if (goals.goal_time) lines.push(`Goal time: ${goals.goal_time}`);
  }

  if (plan) {
    lines.push(`Current split: ${SPLIT_LABELS[plan.split_type] || plan.split_type}`);
    if (plan.plan_config?.periodization_phase) {
      const phase = plan.plan_config.periodization_phase as string;
      lines.push(`Phase: ${phase.charAt(0).toUpperCase() + phase.slice(1)}`);
    }
    if (plan.plan_config?.race_weeks_out) lines.push(`Race in ${plan.plan_config.race_weeks_out} weeks`);
  }
  lines.push("");

  const today = new Date();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  lines.push(`Today: ${today.toISOString().slice(0, 10)} (${dayNames[today.getDay()]})`);
  if (todaySession) lines.push(`Today's session: ${todaySession}`);

  if (recovery) {
    const parts: string[] = [];
    if (recovery.hrv !== null) parts.push(`HRV ${recovery.hrv}`);
    if (recovery.sleep_hours !== null) parts.push(`Sleep ${recovery.sleep_hours}h`);
    if (recovery.resting_hr !== null) parts.push(`RHR ${recovery.resting_hr}`);
    if (recovery.body_battery !== null) parts.push(`Body Battery ${recovery.body_battery}`);
    if (parts.length > 0) lines.push(`Recovery: ${parts.join(", ")}`);
  }

  if (todayNutrition) lines.push(`Today so far: ${todayNutrition.calories} cal, ${todayNutrition.protein}g protein`);
  if (weekStats) lines.push(`This week: ${weekStats.sessionsCompleted}/${weekStats.sessionsPlanned} sessions completed`);
  lines.push("");

  lines.push("Guidelines:");
  lines.push("- Give specific, actionable advice based on their actual data");
  lines.push('- Reference specific numbers ("your HRV dropped to 28 last night")');
  lines.push("- When recommending food, consider their macro targets and what they've eaten today");
  lines.push("- When suggesting training changes, consider their current split and recovery");
  lines.push("- Flag recovery concerns proactively (poor sleep, high stress, low HRV)");
  lines.push("- For race training, adjust advice based on proximity to race date");
  lines.push("- Be concise — use bullet points, not paragraphs");
  lines.push("- You can use tools to look up data you don't have in this context");
  lines.push("- When modifying the plan, explain what you're changing and why");

  return lines.join("\n");
}

function formatGoal(goal: string): string {
  const map: Record<string, string> = { gain_muscle: "Gain muscle", lose_weight: "Lose weight / cut", maintain: "Maintain / recomp", other: "General fitness" };
  return map[goal] || goal;
}
