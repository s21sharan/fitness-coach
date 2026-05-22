import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { COACHING_PRINCIPLES } from "@/lib/training/coaching-principles";
import { judgeVerdictSchema, RUBRIC } from "./rubric";
import type { JudgeVerdict, Scenario } from "./types";

// Latest Opus is the strongest judge — judge quality dominates eval cost.
export const JUDGE_MODEL = "claude-opus-4-7";

const RUBRIC_BLOCK = Object.entries(RUBRIC)
  .map(([key, { label, description }]) => `- **${key}** (${label}): ${description}`)
  .join("\n");

const SYSTEM = `You are a senior exercise physiologist and certified strength + endurance coach reviewing AI-generated training plans for quality. You are strict but fair — you score plans against a published rubric and the coaching principles below.

${COACHING_PRINCIPLES}

## Scoring rubric
Score each criterion 1-5:
- 5 = Excellent. No issues, exemplary application of the principle.
- 4 = Good. Minor quibbles, no real problems.
- 3 = Acceptable. Some weaknesses but the plan is still usable.
- 2 = Weak. Multiple violations of the principle; an experienced coach would flag this.
- 1 = Bad. Systemic violation that would harm the athlete or sabotage their goal.

The 5 criteria:
${RUBRIC_BLOCK}

## Blocker rules
Set blocker=true ONLY if the plan violates a hard scenario constraint (wrong days/week count, schedules sessions on dates the athlete said they cannot, loads an injured movement pattern, or commits a safety violation like heavy intensity during taper week). Sub-optimal periodization is NOT a blocker — score it low instead.

## Output rules
- Reasoning fields should cite SPECIFIC sessions/days/weeks from the plan ("Week 2 Wed stacks heavy squats after Tue tempo run"). No generic comments.
- Strengths and weaknesses: 1-3 each, concrete, no fluff.
- Be honest. A 3/5 plan should average 3, not 4 because nothing is catastrophically wrong.`;

export async function judgePlan(opts: {
  scenario: Scenario;
  planSummary: string;
}): Promise<JudgeVerdict> {
  const { scenario, planSummary } = opts;
  const userPrompt = buildJudgePrompt(scenario, planSummary);

  const { object } = await generateObject({
    model: anthropic(JUDGE_MODEL),
    schema: judgeVerdictSchema,
    system: SYSTEM,
    prompt: userPrompt,
  });

  return object as JudgeVerdict;
}

function buildJudgePrompt(scenario: Scenario, planSummary: string): string {
  const lines: string[] = [];
  lines.push(`## Scenario: ${scenario.name}`);
  lines.push(scenario.description);
  lines.push("");
  lines.push("### Athlete");
  lines.push(JSON.stringify({ profile: scenario.profile, goals: scenario.goals }, null, 2));
  if (scenario.recentActivity) {
    lines.push("");
    lines.push("### Recent activity (last 30 days)");
    lines.push(JSON.stringify(scenario.recentActivity, null, 2));
  }
  if (scenario.factsBlock) {
    lines.push("");
    lines.push("### Athlete facts (durable preferences / injuries / schedule)");
    lines.push(scenario.factsBlock);
  }
  lines.push("");
  lines.push("### Scenario expectations");
  lines.push("must_have (the plan MUST do these):");
  for (const m of scenario.must_have) lines.push(`- ${m}`);
  lines.push("must_not_have (the plan MUST NOT do these):");
  for (const m of scenario.must_not_have) lines.push(`- ${m}`);
  lines.push("");
  lines.push("### Generated plan");
  lines.push("```");
  lines.push(planSummary);
  lines.push("```");
  lines.push("");
  lines.push("Score the plan now. Cite specific weeks/days in every reasoning field. If a must_not_have was violated, cap scenario_fit at 2 and set blocker=true if the violation is a safety/constraint issue.");
  return lines.join("\n");
}
