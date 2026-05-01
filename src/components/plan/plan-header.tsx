"use client";

interface PlanHeaderProps {
  splitType: string;
  bodyGoal: string | null;
  raceType: string | null;
  planConfig: Record<string, unknown> | null;
  weekNumber: number;
  weekOffset: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

const SPLIT_LABELS: Record<string, string> = {
  ppl: "Push / Pull / Legs",
  arnold: "Arnold Split",
  upper_lower: "Upper / Lower",
  full_body: "Full Body",
  phul: "PHUL",
  bro_split: "Bro Split",
  hybrid_upper_lower: "Upper/Lower + Race Prep",
  hybrid_nick_bare: "Hybrid (Nick Bare Style)",
};

const GOAL_LABELS: Record<string, string> = {
  gain_muscle: "Muscle Gain",
  lose_weight: "Fat Loss",
  maintain: "Maintain",
};

export function PlanHeader({ splitType, bodyGoal, raceType, planConfig, weekNumber, weekOffset, onPrev, onNext, onToday }: PlanHeaderProps) {
  const name = SPLIT_LABELS[splitType] || splitType;
  const goal = bodyGoal ? GOAL_LABELS[bodyGoal] || bodyGoal : null;
  const phase = planConfig?.periodization_phase as string | undefined;
  const raceWeeksOut = planConfig?.race_weeks_out as number | undefined;

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold">{name}</h1>
        <p className="text-sm text-gray-500">
          {raceType && raceWeeksOut !== undefined && (
            <>
              {raceType.replace(/_/g, " ")} · {phase ? `${phase.charAt(0).toUpperCase() + phase.slice(1)} Phase` : ""} ·{" "}
              <span className="font-semibold text-amber-600">Race in {raceWeeksOut} weeks</span>
            </>
          )}
          {!raceType && goal && <>{goal} · Week {weekNumber}</>}
        </p>
      </div>
      <div className="flex gap-2">
        <button onClick={onPrev} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50">← Prev</button>
        <button onClick={onToday} className={`rounded-lg border px-3 py-1.5 text-sm ${weekOffset === 0 ? "font-semibold" : "hover:bg-gray-50"}`}>This Week</button>
        <button onClick={onNext} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50">Next →</button>
      </div>
    </div>
  );
}
