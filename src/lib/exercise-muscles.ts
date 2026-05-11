export const MUSCLE_GROUPS = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
  "forearms",
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number] | "other";

interface ExercisePattern {
  keywords: string[];
  primary: string[];
  secondary: string[];
}

const EXERCISE_MAP: ExercisePattern[] = [
  // Chest
  {
    keywords: ["bench press", "chest press", "push up", "push-up", "pushup"],
    primary: ["chest"],
    secondary: ["triceps", "shoulders"],
  },
  {
    keywords: ["fly", "flye", "cable fly", "pec deck", "crossover"],
    primary: ["chest"],
    secondary: ["shoulders"],
  },
  {
    keywords: ["incline press", "incline bench", "incline dumbbell"],
    primary: ["chest"],
    secondary: ["shoulders", "triceps"],
  },
  {
    keywords: ["decline press", "decline bench"],
    primary: ["chest"],
    secondary: ["triceps"],
  },

  // Back
  {
    keywords: ["lat pulldown", "pull down"],
    primary: ["back"],
    secondary: ["biceps"],
  },
  {
    keywords: [
      "pull up",
      "pull-up",
      "pullup",
      "chin up",
      "chin-up",
      "chinup",
    ],
    primary: ["back"],
    secondary: ["biceps"],
  },
  {
    keywords: [
      "row",
      "seated row",
      "cable row",
      "barbell row",
      "dumbbell row",
      "t-bar row",
      "pendlay",
    ],
    primary: ["back"],
    secondary: ["biceps"],
  },
  {
    keywords: ["deadlift", "sumo deadlift"],
    primary: ["back", "hamstrings", "glutes"],
    secondary: ["core", "forearms"],
  },
  { keywords: ["pullover"], primary: ["back"], secondary: ["chest"] },

  // Shoulders
  {
    keywords: [
      "overhead press",
      "shoulder press",
      "military press",
      "ohp",
    ],
    primary: ["shoulders"],
    secondary: ["triceps"],
  },
  {
    keywords: ["lateral raise", "side raise", "side lateral"],
    primary: ["shoulders"],
    secondary: [],
  },
  { keywords: ["front raise"], primary: ["shoulders"], secondary: [] },
  {
    keywords: ["rear delt", "reverse fly", "face pull"],
    primary: ["shoulders"],
    secondary: ["back"],
  },
  {
    keywords: ["upright row"],
    primary: ["shoulders"],
    secondary: ["biceps"],
  },
  {
    keywords: ["shrug"],
    primary: ["shoulders"],
    secondary: ["forearms"],
  },

  // Arms
  {
    keywords: [
      "bicep curl",
      "barbell curl",
      "dumbbell curl",
      "hammer curl",
      "preacher curl",
      "ez curl",
      "concentration curl",
      "cable curl",
      "incline curl",
    ],
    primary: ["biceps"],
    secondary: ["forearms"],
  },
  {
    keywords: [
      "tricep pushdown",
      "tricep extension",
      "skull crusher",
      "overhead extension",
      "tricep dip",
      "kickback",
      "close grip bench",
    ],
    primary: ["triceps"],
    secondary: [],
  },
  {
    keywords: ["wrist curl", "reverse curl", "farmer"],
    primary: ["forearms"],
    secondary: [],
  },

  // Legs
  {
    keywords: ["squat", "goblet squat", "front squat", "hack squat"],
    primary: ["quads", "glutes"],
    secondary: ["hamstrings", "core"],
  },
  {
    keywords: ["leg press"],
    primary: ["quads", "glutes"],
    secondary: ["hamstrings"],
  },
  {
    keywords: ["leg extension", "quad extension"],
    primary: ["quads"],
    secondary: [],
  },
  {
    keywords: [
      "lunge",
      "split squat",
      "bulgarian",
      "step up",
      "step-up",
    ],
    primary: ["quads", "glutes"],
    secondary: ["hamstrings"],
  },
  {
    keywords: [
      "leg curl",
      "hamstring curl",
      "lying curl",
      "seated curl",
    ],
    primary: ["hamstrings"],
    secondary: [],
  },
  {
    keywords: [
      "romanian deadlift",
      "rdl",
      "stiff leg",
      "good morning",
    ],
    primary: ["hamstrings"],
    secondary: ["glutes", "back"],
  },
  {
    keywords: [
      "hip thrust",
      "glute bridge",
      "hip extension",
      "abduction",
    ],
    primary: ["glutes"],
    secondary: ["hamstrings"],
  },
  {
    keywords: ["calf raise", "calf press", "seated calf"],
    primary: ["calves"],
    secondary: [],
  },

  // Core
  {
    keywords: [
      "crunch",
      "sit up",
      "sit-up",
      "ab wheel",
      "ab rollout",
      "plank",
      "leg raise",
      "hanging raise",
      "pallof",
      "dead bug",
      "russian twist",
      "cable crunch",
      "woodchop",
    ],
    primary: ["core"],
    secondary: [],
  },

  // Dips (general)
  {
    keywords: ["dip"],
    primary: ["chest", "triceps"],
    secondary: ["shoulders"],
  },
];

/**
 * Maps a Hevy exercise name to its primary and secondary muscle groups.
 * Strips parenthetical variants (e.g. "(Barbell)", "(Dumbbell)", etc.) before matching.
 */
export function mapExerciseToMuscles(exerciseName: string): {
  primary: string[];
  secondary: string[];
} {
  // Lowercase and strip parenthetical text
  const normalized = exerciseName
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .trim();

  for (const entry of EXERCISE_MAP) {
    for (const keyword of entry.keywords) {
      if (normalized.includes(keyword)) {
        return { primary: entry.primary, secondary: entry.secondary };
      }
    }
  }

  return { primary: ["other"], secondary: [] };
}

/**
 * Computes total sets and volume (weight_kg × reps) per primary muscle group
 * from a list of exercises.
 */
export function computeMuscleVolume(
  exercises: Array<{
    name: string;
    sets: Array<{ weight_kg: number; reps: number }>;
  }>
): Record<string, { sets: number; volume: number }> {
  const result: Record<string, { sets: number; volume: number }> = {};

  for (const exercise of exercises) {
    const { primary } = mapExerciseToMuscles(exercise.name);

    for (const muscle of primary) {
      if (!result[muscle]) {
        result[muscle] = { sets: 0, volume: 0 };
      }

      result[muscle].sets += exercise.sets.length;

      for (const set of exercise.sets) {
        result[muscle].volume += set.weight_kg * set.reps;
      }
    }
  }

  return result;
}
