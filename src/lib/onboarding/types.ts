export type BodyGoal = "gain_muscle" | "lose_weight" | "maintain" | "other";
export type Emphasis = "shoulders" | "chest" | "back" | "arms" | "legs" | "glutes" | "none";
export type RaceType =
  | "5k" | "10k" | "half_marathon" | "marathon" | "ultra"
  | "sprint_tri" | "olympic_tri" | "half_ironman" | "ironman" | "other";
export type Experience = "beginner" | "intermediate" | "advanced";
export type CardioType = "running" | "cycling" | "swimming";
export type Sex = "M" | "F" | "Other";

export type StepId =
  | "profile"
  | "body_goal"
  | "emphasis"
  | "race"
  | "race_details"
  | "cardio"
  | "experience"
  | "availability"
  | "integrations"
  | "split_result";

export interface OnboardingData {
  // Step 1: Profile
  height: number | null;       // cm
  weight: number | null;       // lbs
  age: number | null;
  sex: Sex | null;

  // Step 2: Body Goal
  bodyGoal: BodyGoal | null;
  bodyGoalOther: string;

  // Step 3: Emphasis
  emphasis: Emphasis | null;

  // Step 4: Race
  trainingForRace: boolean;

  // Step 5a: Race Details
  raceType: RaceType | null;
  raceTypeOther: string;
  raceDate: string | null;     // ISO date string
  goalTime: string | null;

  // Step 5b: Cardio
  doesCardio: boolean;
  cardioTypes: CardioType[];

  // Step 6: Experience
  experience: Experience | null;

  // Step 7: Availability
  daysPerWeek: number | null;
  liftingDays: number | null;
}

export function getDefaultOnboardingData(): OnboardingData {
  return {
    height: null,
    weight: null,
    age: null,
    sex: null,
    bodyGoal: null,
    bodyGoalOther: "",
    emphasis: null,
    trainingForRace: false,
    raceType: null,
    raceTypeOther: "",
    raceDate: null,
    goalTime: null,
    doesCardio: false,
    cardioTypes: [],
    experience: null,
    daysPerWeek: null,
    liftingDays: null,
  };
}

export function getVisibleSteps(data: OnboardingData): StepId[] {
  const steps: StepId[] = ["profile", "body_goal"];

  if (data.bodyGoal === "gain_muscle" || data.bodyGoal === "maintain") {
    steps.push("emphasis");
  }

  steps.push("race");

  if (data.trainingForRace) {
    steps.push("race_details");
  } else {
    steps.push("cardio");
  }

  steps.push("experience", "availability", "integrations", "split_result");

  return steps;
}

export const BODY_GOALS: { value: BodyGoal; label: string }[] = [
  { value: "gain_muscle", label: "Gain Muscle" },
  { value: "lose_weight", label: "Lose Weight" },
  { value: "maintain", label: "Maintain / Recomp" },
  { value: "other", label: "Other" },
];

export const EMPHASIS_OPTIONS: { value: Emphasis; label: string }[] = [
  { value: "shoulders", label: "Shoulders" },
  { value: "chest", label: "Chest" },
  { value: "back", label: "Back" },
  { value: "arms", label: "Arms" },
  { value: "legs", label: "Legs" },
  { value: "glutes", label: "Glutes" },
  { value: "none", label: "None (Balanced)" },
];

export const RACE_TYPES: { value: RaceType; label: string; category: "running" | "triathlon" | "other" }[] = [
  { value: "5k", label: "5K", category: "running" },
  { value: "10k", label: "10K", category: "running" },
  { value: "half_marathon", label: "Half Marathon", category: "running" },
  { value: "marathon", label: "Marathon", category: "running" },
  { value: "ultra", label: "Ultra", category: "running" },
  { value: "sprint_tri", label: "Sprint Triathlon", category: "triathlon" },
  { value: "olympic_tri", label: "Olympic Triathlon", category: "triathlon" },
  { value: "half_ironman", label: "Half Ironman (70.3)", category: "triathlon" },
  { value: "ironman", label: "Ironman (140.6)", category: "triathlon" },
  { value: "other", label: "Other", category: "other" },
];

export const EXPERIENCE_LEVELS: { value: Experience; label: string; description: string }[] = [
  { value: "beginner", label: "Beginner", description: "Less than 1 year consistent lifting" },
  { value: "intermediate", label: "Intermediate", description: "1-3 years consistent lifting" },
  { value: "advanced", label: "Advanced", description: "3+ years consistent lifting" },
];

export const CARDIO_TYPES: { value: CardioType; label: string }[] = [
  { value: "running", label: "Running" },
  { value: "cycling", label: "Cycling" },
  { value: "swimming", label: "Swimming" },
];
