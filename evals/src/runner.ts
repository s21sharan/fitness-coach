import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { generateMultiWeekPlan } from "@/lib/training/generate-plan";
import { authorSpecPayload } from "@/lib/training/spec/author";
import type { SpecAuthorContext } from "@/lib/training/spec/context";
import type { SpecPayload } from "@/lib/training/spec/schema";
import { renderPlanForJudge } from "./plan-summary";
import { judgePlan, JUDGE_MODEL } from "./judge";
import type { JudgeVerdict, RunReport, Scenario, ScenarioResult } from "./types";

const PLANNER_MODEL = "claude-sonnet-4-6"; // mirrors src/lib/training/generate-plan.ts

// When set, exercise the full spec pipeline: author a per-athlete constraint
// spec from each scenario and enforce it (with repair) during generation.
const USE_SPEC = !!process.env.EVAL_USE_SPEC && process.env.EVAL_USE_SPEC !== "0";

function scenarioToAuthorContext(s: Scenario): SpecAuthorContext {
  return {
    profile: {
      age: s.profile.age,
      sex: s.profile.sex,
      height: s.profile.height,
      weight: s.profile.weight,
      training_experience: s.profile.training_experience,
    },
    goals: {
      body_goal: s.goals.body_goal,
      emphasis: s.goals.emphasis,
      days_per_week: s.goals.days_per_week,
      lifting_days: s.goals.lifting_days,
      training_for_race: s.goals.training_for_race,
      race_type: s.goals.race_type,
      race_date: s.goals.race_date,
      does_cardio: s.goals.does_cardio,
      cardio_types: s.goals.cardio_types,
    },
    factsBlock: s.factsBlock ?? null,
    recentActivity: s.recentActivity,
  };
}

const SCENARIOS_DIR = join(process.cwd(), "evals", "scenarios");
const RESULTS_DIR = join(process.cwd(), "evals", "results");

export function loadScenarios(): Scenario[] {
  if (!existsSync(SCENARIOS_DIR)) {
    throw new Error(`Scenarios dir not found: ${SCENARIOS_DIR}`);
  }
  const files = readdirSync(SCENARIOS_DIR).filter((f) => f.endsWith(".json")).sort();
  return files.map((f) => {
    const raw = readFileSync(join(SCENARIOS_DIR, f), "utf-8");
    return JSON.parse(raw) as Scenario;
  });
}

function isRateLimit(msg: string): boolean {
  return /rate limit|429|output tokens per minute/i.test(msg);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Tier-1 orgs cap Sonnet at 8k output tokens/min and a single plan can consume
 * most of that, so consecutive requests routinely breach the rolling window.
 * The SDK's built-in retry only backs off ~6s — far short of the 60s reset — so
 * we add our own slow retry on top: on a rate-limit error, wait out the window
 * and try again.
 */
async function runScenarioWithBackoff(scenario: Scenario, maxRetries = 3): Promise<ScenarioResult> {
  for (let attempt = 0; ; attempt++) {
    const r = await runScenario(scenario);
    if (!r.error || !isRateLimit(r.error) || attempt >= maxRetries) return r;
    const waitMs = 65_000;
    process.stdout.write(
      `  ⏳ ${scenario.id} hit rate limit — waiting ${waitMs / 1000}s before retry ${attempt + 1}/${maxRetries}\n`,
    );
    await sleep(waitMs);
  }
}

export async function runScenario(scenario: Scenario): Promise<ScenarioResult> {
  const t0 = Date.now();
  try {
    let spec: SpecPayload | null = scenario.spec ?? null;
    if (!spec && USE_SPEC) {
      spec = await authorSpecPayload(scenarioToAuthorContext(scenario));
    }

    const plan = await generateMultiWeekPlan({
      userId: `eval-${scenario.id}`,
      profile: scenario.profile,
      goals: scenario.goals,
      weeks: scenario.weeks,
      compliance: null,
      factsBlock: scenario.factsBlock ?? null,
      overrideRecentActivity: scenario.recentActivity,
      spec,
    });

    const planSummary = renderPlanForJudge(plan);
    const verdict = await judgePlan({ scenario, planSummary });
    const avg = averageScore(verdict);

    return {
      scenario_id: scenario.id,
      scenario_name: scenario.name,
      avg_score: avg,
      blocker: verdict.blocker,
      blocker_reason: verdict.blocker_reason,
      verdict,
      plan_summary: planSummary,
      duration_ms: Date.now() - t0,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      scenario_id: scenario.id,
      scenario_name: scenario.name,
      avg_score: 0,
      blocker: false,
      blocker_reason: null,
      verdict: emptyVerdict(),
      plan_summary: "",
      duration_ms: Date.now() - t0,
      error: message,
    };
  }
}

function averageScore(v: JudgeVerdict): number {
  const scores = [
    v.scores.constraint_adherence.score,
    v.scores.periodization.score,
    v.scores.intensity_distribution.score,
    v.scores.specificity.score,
    v.scores.scenario_fit.score,
  ];
  return Math.round((scores.reduce((s, x) => s + x, 0) / scores.length) * 100) / 100;
}

function emptyVerdict(): JudgeVerdict {
  const zero = { score: 0, reasoning: "" };
  return {
    blocker: false,
    blocker_reason: null,
    scores: {
      constraint_adherence: zero,
      periodization: zero,
      intensity_distribution: zero,
      specificity: zero,
      scenario_fit: zero,
    },
    strengths: [],
    weaknesses: [],
  };
}

export async function runAll(opts: { scenarioIds?: string[] } = {}): Promise<RunReport> {
  const all = loadScenarios();
  const filtered = opts.scenarioIds && opts.scenarioIds.length > 0
    ? all.filter((s) => opts.scenarioIds!.includes(s.id))
    : all;

  if (filtered.length === 0) {
    throw new Error("No scenarios matched the filter.");
  }

  // Default 1: tier-1 orgs cap Sonnet at 8k output tokens/min and a single
  // multi-week plan can consume most of that, so anything above 1 breaches the
  // rolling window. Higher-tier orgs can bump this via EVAL_CONCURRENCY.
  // runScenarioWithBackoff handles any residual 429s by waiting out the window.
  const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY ?? 1);
  console.log(
    `Running ${filtered.length} scenario(s), up to ${CONCURRENCY} at a time — planner=${PLANNER_MODEL}, judge=${JUDGE_MODEL}\n`,
  );

  const results: ScenarioResult[] = new Array(filtered.length);
  let next = 0;
  async function worker() {
    while (true) {
      const idx = next++;
      if (idx >= filtered.length) return;
      const s = filtered[idx];
      const r = await runScenarioWithBackoff(s);
      results[idx] = r;
      if (r.error) {
        process.stdout.write(`✗ ${s.id} — ERROR (${r.duration_ms}ms): ${r.error}\n`);
      } else {
        const flag = r.blocker ? " [BLOCKER]" : "";
        process.stdout.write(`✓ ${s.id} — avg=${r.avg_score}/5${flag} (${Math.round(r.duration_ms / 1000)}s)\n`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, filtered.length) }, worker));

  const scored = results.filter((r) => !r.error);
  const overall = scored.length > 0
    ? Math.round((scored.reduce((s, r) => s + r.avg_score, 0) / scored.length) * 100) / 100
    : 0;

  const report: RunReport = {
    run_id: new Date().toISOString().replace(/[:.]/g, "-"),
    timestamp: new Date().toISOString(),
    model_planner: PLANNER_MODEL,
    model_judge: JUDGE_MODEL,
    scenarios: results,
    overall_avg: overall,
    blocker_count: results.filter((r) => r.blocker).length,
    error_count: results.filter((r) => r.error).length,
  };

  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });
  const outPath = join(RESULTS_DIR, `${report.run_id}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  writeFileSync(join(RESULTS_DIR, "latest.json"), JSON.stringify(report, null, 2));

  printSummary(report);
  console.log(`\nFull report: ${outPath}`);
  return report;
}

function printSummary(report: RunReport): void {
  console.log("\n══════════════════════════════════════════════════════════════════");
  console.log(`  Overall: ${report.overall_avg}/5 across ${report.scenarios.length} scenarios`);
  console.log(`  Blockers: ${report.blocker_count}  ·  Errors: ${report.error_count}`);
  console.log("══════════════════════════════════════════════════════════════════");
  console.log("");
  console.log("Per-scenario breakdown:");
  console.log("  ID                                  Const Period Intens Specif Scenar  Avg  Flag");
  console.log("  ──────────────────────────────────  ───── ────── ────── ────── ──────  ───  ────");
  for (const r of report.scenarios) {
    if (r.error) {
      console.log(`  ${pad(r.scenario_id, 36)}  ERROR: ${r.error.slice(0, 60)}`);
      continue;
    }
    const s = r.verdict.scores;
    const flag = r.blocker ? "BLOCK" : "";
    console.log(
      `  ${pad(r.scenario_id, 36)}  ${cell(s.constraint_adherence.score)}    ${cell(s.periodization.score)}     ${cell(s.intensity_distribution.score)}     ${cell(s.specificity.score)}     ${cell(s.scenario_fit.score)}   ${r.avg_score.toFixed(2).padStart(4)}  ${flag}`,
    );
  }
  console.log("");
  console.log("Top weaknesses across all plans:");
  const weaknesses = report.scenarios.flatMap((r) => r.verdict.weaknesses);
  for (const w of weaknesses.slice(0, 10)) {
    console.log(`  • ${w}`);
  }
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}
function cell(n: number): string {
  return String(n);
}

// CLI entry: `npm run evals` or `npm run evals -- 01-marathon-build`
if (import.meta.url === `file://${process.argv[1]}`) {
  const filter = process.argv.slice(2);
  runAll({ scenarioIds: filter.length > 0 ? filter : undefined })
    .then((r) => process.exit(r.blocker_count > 0 || r.error_count > 0 ? 1 : 0))
    .catch((err) => {
      console.error("Eval run failed:", err);
      process.exit(2);
    });
}
