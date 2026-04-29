"use client";

import type { OnboardingData } from "@/lib/onboarding/types";

interface StepSplitResultProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

function recommendSplit(data: OnboardingData): { split: string; reasoning: string; schedule: string[] } {
  const days = data.daysPerWeek ?? 4;
  const isRacing = data.trainingForRace;
  const emphasis = data.emphasis;
  const experience = data.experience;

  if (isRacing) {
    const liftDays = data.liftingDays ?? 3;
    if (liftDays <= 2) {
      return {
        split: "Full Body + Race Prep",
        reasoning: `With ${liftDays} lifting days alongside race training, full body sessions maintain strength efficiently.`,
        schedule: generateHybridSchedule(days, liftDays, "Full Body"),
      };
    }
    return {
      split: "Upper/Lower + Race Prep",
      reasoning: `${liftDays} lifting days with race training works well with an upper/lower split for balanced strength.`,
      schedule: generateHybridSchedule(days, liftDays, "Upper/Lower"),
    };
  }

  if (days <= 3) {
    return {
      split: "Full Body",
      reasoning: "With 3 training days, full body gives you the highest frequency per muscle group.",
      schedule: ["Full Body", "Rest", "Full Body", "Rest", "Full Body", "Rest", "Rest"],
    };
  }

  if (days === 4) {
    if (experience === "advanced") {
      return {
        split: "PHUL",
        reasoning: "4 days with advanced experience — PHUL combines power and hypertrophy for continued progress.",
        schedule: ["Upper Power", "Lower Power", "Rest", "Upper Hypertrophy", "Lower Hypertrophy", "Rest", "Rest"],
      };
    }
    return {
      split: "Upper / Lower",
      reasoning: "4 days is the sweet spot for upper/lower — good frequency, good recovery.",
      schedule: ["Upper", "Lower", "Rest", "Upper", "Lower", "Rest", "Rest"],
    };
  }

  // 5-6 days
  if (emphasis === "shoulders" || emphasis === "arms") {
    return {
      split: "Arnold Split",
      reasoning: `With ${emphasis} emphasis, the Arnold split gives shoulders and arms a dedicated day for extra volume.`,
      schedule: ["Chest + Back", "Shoulders + Arms", "Legs", "Chest + Back", "Shoulders + Arms", "Legs", "Rest"],
    };
  }

  return {
    split: "Push / Pull / Legs",
    reasoning: `${days} days with balanced emphasis — PPL is the gold standard for well-rounded muscle growth.`,
    schedule: ["Push", "Pull", "Legs", "Rest", "Push", "Pull", "Rest"],
  };
}

function generateHybridSchedule(totalDays: number, liftDays: number, liftType: string): string[] {
  const schedule = Array(7).fill("Rest");
  const liftLabels = liftType === "Full Body"
    ? Array(liftDays).fill("Full Body")
    : ["Upper", "Lower", "Upper", "Lower"].slice(0, liftDays);

  const cardioDays = totalDays - liftDays;
  const cardioLabels = ["Easy Run (Zone 2)", "Intervals", "Long Run", "Easy Run (Zone 2)"].slice(0, cardioDays);

  let li = 0, ci = 0;
  for (let d = 0; d < 7 && (li < liftLabels.length || ci < cardioLabels.length); d++) {
    if (li < liftLabels.length && (d % 2 === 0 || ci >= cardioLabels.length)) {
      schedule[d] = liftLabels[li++];
    } else if (ci < cardioLabels.length) {
      schedule[d] = cardioLabels[ci++];
    }
  }

  return schedule;
}

const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function StepSplitResult({ data }: StepSplitResultProps) {
  const { split, reasoning, schedule } = recommendSplit(data);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Your Recommended Split</h2>
        <p className="mt-1 text-gray-500">Based on your goals, experience, and availability.</p>
      </div>

      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-xl font-bold">{split}</h3>
        <p className="mt-2 text-gray-600">{reasoning}</p>
      </div>

      <div className="rounded-lg border bg-white p-6">
        <h3 className="mb-4 text-sm font-medium text-gray-500">Your Week</h3>
        <div className="grid grid-cols-7 gap-2">
          {schedule.map((session, i) => (
            <div
              key={i}
              className={`flex flex-col items-center rounded-lg border p-3 ${
                session === "Rest" ? "bg-gray-50 text-gray-400" : "bg-white"
              }`}
            >
              <span className="text-xs text-gray-500">{dayNames[i]}</span>
              <span className="mt-1 text-center text-xs font-medium">{session}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
