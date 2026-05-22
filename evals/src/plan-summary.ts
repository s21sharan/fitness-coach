import type { MultiWeekPlan, SessionContract, ContractStepZ } from "@/lib/training/schemas";

/**
 * Render a generated plan as compact text the judge can score against.
 * Mirrors what a human reviewer would skim: per-week focus, daily sessions
 * with the key contract details (sets×reps×RPE for strength; distance+pace+HR
 * for cardio).
 */
export function renderPlanForJudge(plan: MultiWeekPlan): string {
  const lines: string[] = [];
  lines.push(`Split: ${plan.split_type}`);
  lines.push(`Narrative: ${plan.narrative}`);
  if (plan.plan_config?.periodization_phase) {
    lines.push(`Phase: ${plan.plan_config.periodization_phase}`);
  }
  if (plan.plan_config?.deload_frequency) {
    lines.push(`Deload every: ${plan.plan_config.deload_frequency} weeks`);
  }
  if (plan.risks && plan.risks.length > 0) {
    lines.push(`Risks called out by planner: ${plan.risks.join(" | ")}`);
  }
  lines.push("");

  for (const week of plan.weeks) {
    lines.push(`── Week ${week.week_number}: ${week.week_focus} ──`);
    for (const day of week.days) {
      const tag = day.is_rest ? " (REST)" : "";
      lines.push(`  ${day.day_label}${tag}`);
      if (day.am_session) {
        lines.push(`    AM: ${renderSession(day.am_session)}`);
      }
      if (day.pm_session) {
        lines.push(`    PM: ${renderSession(day.pm_session)}`);
      }
      if (day.is_rest && !day.am_session && !day.pm_session) {
        lines.push(`    (full rest)`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

function renderSession(s: SessionContract): string {
  const parts: string[] = [];
  parts.push(`[${s.sport}] ${s.name}`);
  if (s.rationale) parts.push(`— ${s.rationale}`);
  const stepLines = (s.contract.steps as ContractStepZ[])
    .map((step) => renderStep(step))
    .filter((x) => x.length > 0);
  if (stepLines.length > 0) {
    parts.push(`\n      • ${stepLines.join("\n      • ")}`);
  }
  return parts.join(" ");
}

function renderStep(step: ContractStepZ, depth = 0): string {
  const prefix = "  ".repeat(depth);
  if (step.type === "repeat") {
    const inner = (step.steps ?? []).map((s) => renderStep(s as ContractStepZ, depth + 1)).join(" + ");
    return `${prefix}${step.repeats ?? 1}× (${inner})`;
  }
  const bits: string[] = [];
  bits.push(step.type.toUpperCase());
  if (step.label) bits.push(step.label);
  if (step.exercise_name) {
    const setRep = [
      step.sets ? `${step.sets}×` : "",
      step.reps ? `${step.reps}` : "",
    ].join("");
    bits.push(`${step.exercise_name} ${setRep}${step.weight_kg ? ` @ ${step.weight_kg}kg` : ""}${step.rpe ? ` RPE${step.rpe}` : ""}`);
  } else {
    if (step.distance_m) bits.push(`${(step.distance_m / 1000).toFixed(2)}km`);
    if (step.duration_sec) bits.push(`${Math.round(step.duration_sec / 60)}min`);
    if (step.pace_sec_per_km) {
      const m = Math.floor(step.pace_sec_per_km / 60);
      const s = step.pace_sec_per_km % 60;
      bits.push(`@ ${m}:${String(s).padStart(2, "0")}/km`);
    }
    if (step.target_hr_zone) bits.push(`Z${step.target_hr_zone}`);
    if (step.ftp_percent) bits.push(`${step.ftp_percent}% FTP`);
  }
  return `${prefix}${bits.filter(Boolean).join(" ")}`;
}
