import type { SpecConstraints, SpecPayload, MovementPattern } from "./schema";
import type { SpecViolation } from "./check-plan";

const PATTERN_LABEL: Record<MovementPattern, string> = {
  loaded_knee_flexion: "loaded knee flexion (squats, lunges, split squats, leg press, step-ups)",
  heavy_hinge: "heavy hip-hinge (deadlift, RDL, good morning)",
  running_impact: "running / ground-impact",
  jumping_plyometric: "jumping / plyometrics",
  overhead_press: "overhead pressing",
  spinal_loading: "axial spinal loading (heavy barbell back work)",
};

/**
 * Render the spec as a hard-constraints block for the planner's context. These
 * are non-negotiable for the generated plan; the checker enforces every line.
 */
export function renderSpecForPrompt(payload: SpecPayload): string {
  const c: SpecConstraints = payload.constraints;
  const lines: string[] = [];
  lines.push("## Hard constraints for THIS athlete (you MUST satisfy every one)");
  lines.push(`- Train on at most ${c.days_per_week} day(s) per week.`);
  if (c.lifting_days_per_week !== null) {
    lines.push(`- At most ${c.lifting_days_per_week} strength session(s) per week.`);
  }
  lines.push(`- At most ${c.max_quality_sessions_per_week} quality (above Zone 2) cardio session(s) per week.`);
  lines.push(
    `- Keep at least ${c.min_hours_between_heavy_lower_and_quality_run}h between any heavy lower-body lift and a quality run (count real hours — an AM session the morning after a PM lift is only ~13h).`,
  );
  if (!c.allow_quality_back_to_back) {
    lines.push("- Never place two quality sessions on consecutive days.");
  }
  if (c.max_weekly_volume_increase_pct !== null) {
    lines.push(`- Do not increase weekly running volume by more than ${c.max_weekly_volume_increase_pct}% week-over-week (deload weeks excepted).`);
  }
  if (c.forbidden_modalities.length > 0) {
    lines.push(`- Do NOT include any of these modalities at all: ${c.forbidden_modalities.join(", ")}.`);
  }
  if (c.forbidden_movement_patterns.length > 0) {
    lines.push(
      `- Do NOT prescribe any movement that loads: ${c.forbidden_movement_patterns.map((p) => PATTERN_LABEL[p]).join("; ")}.`,
    );
  }
  for (const r of c.required_modality_days) {
    lines.push(`- Schedule ${r.modality} sessions ONLY on: ${r.days.join(", ")}.`);
  }
  if (payload.notes.length > 0) {
    lines.push("");
    lines.push("Coaching notes (guidance, not hard rules):");
    for (const n of payload.notes) lines.push(`- ${n}`);
  }
  return lines.join("\n");
}

/**
 * Render a set of violations as a focused repair instruction appended to the
 * planner prompt. Concrete, per-violation feedback fixes far more reliably than
 * a vague "review this".
 */
export function renderViolationsForRepair(violations: SpecViolation[]): string {
  const lines: string[] = [];
  lines.push(
    "Your previous draft VIOLATED these hard constraints. Regenerate the FULL plan, fixing every one below while keeping everything else as close to the prior draft as possible:",
  );
  for (const v of violations) {
    lines.push(`- ${v.detail}`);
  }
  lines.push("");
  lines.push("Do not introduce any new violations while fixing these.");
  return lines.join("\n");
}
