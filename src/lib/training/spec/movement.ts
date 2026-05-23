import { mapExerciseToMuscles } from "@/lib/exercise-muscles";
import type { MovementPattern } from "./schema";

/**
 * Classify a strength exercise name into the movement patterns it loads.
 *
 * This is the open-vocabulary-ish guardrail behind injury constraints: a spec
 * that forbids `loaded_knee_flexion` relies on this to flag a "Bulgarian Split
 * Squat" even when the coach annotated it "shallow depth". Keyword-based and
 * deliberately conservative — false positives (flagging a borderline movement)
 * are cheaper than false negatives (shipping a contraindicated lift).
 */

interface PatternRule {
  pattern: MovementPattern;
  keywords: string[];
}

// Order matters only for readability; an exercise can match multiple patterns.
const PATTERN_RULES: PatternRule[] = [
  {
    pattern: "loaded_knee_flexion",
    keywords: [
      "squat", // back/front/goblet/hack/box/pistol squat
      "lunge",
      "split squat",
      "bulgarian",
      "leg press",
      "step up",
      "step-up",
      "stepup",
      "leg extension",
      "sissy",
      "pistol",
    ],
  },
  {
    pattern: "heavy_hinge",
    keywords: [
      "deadlift",
      "romanian deadlift",
      "rdl",
      "stiff leg",
      "stiff-leg",
      "good morning",
      "hip thrust",
      "glute bridge",
      "kettlebell swing",
      "kb swing",
      "hip hinge",
    ],
  },
  {
    pattern: "running_impact",
    keywords: ["run", "jog", "sprint", "shuttle", "bound", "skater"],
  },
  {
    pattern: "jumping_plyometric",
    keywords: ["jump", "plyo", "bound", "hop", "box jump", "depth jump", "broad jump"],
  },
  {
    pattern: "overhead_press",
    keywords: [
      "overhead press",
      "shoulder press",
      "military press",
      "push press",
      "ohp",
      "jerk",
      "snatch",
    ],
  },
  {
    pattern: "spinal_loading",
    keywords: [
      "back squat",
      "front squat",
      "deadlift",
      "good morning",
      "barbell row",
      "bent over row",
      "bent-over row",
      "overhead press",
      "military press",
      "push press",
    ],
  },
];

/**
 * Returns the set of movement patterns an exercise name loads. Strips
 * parenthetical variants ("(Barbell)") the way `mapExerciseToMuscles` does.
 */
export function classifyMovementPatterns(exerciseName: string): Set<MovementPattern> {
  const normalized = exerciseName
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .trim();
  const out = new Set<MovementPattern>();
  for (const rule of PATTERN_RULES) {
    if (rule.keywords.some((k) => normalized.includes(k))) out.add(rule.pattern);
  }
  return out;
}

const LOWER_MUSCLES = new Set(["quads", "hamstrings", "glutes", "calves"]);

/**
 * Whether an exercise is a lower-body movement, used for the heavy-lower →
 * quality-run spacing rule. Combines pattern detection with the muscle map so
 * we catch both knee-flexion and hinge work as "lower body".
 */
export function isLowerBodyExercise(exerciseName: string): boolean {
  const patterns = classifyMovementPatterns(exerciseName);
  if (patterns.has("loaded_knee_flexion") || patterns.has("heavy_hinge")) return true;
  const { primary } = mapExerciseToMuscles(exerciseName);
  return primary.some((m) => LOWER_MUSCLES.has(m));
}
