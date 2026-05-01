"use client";

import { DayCard } from "./day-card";

interface Workout {
  id: string;
  date: string;
  day_of_week: number;
  session_type: string;
  ai_notes: string | null;
  status: string;
  approved: boolean;
}

interface Completion {
  workout?: { name: string; duration_minutes: number; exercise_count: number };
  cardio?: Array<{ type: string; distance: number; duration: number; avg_hr: number | null; pace_or_speed: number | null }>;
}

interface WeekStripProps {
  workouts: Workout[];
  completions: Record<string, Completion>;
  weekStart: string;
  today: string;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getStatus(workout: Workout, dateStr: string, today: string, completion: Completion | undefined): "scheduled" | "completed" | "missed" {
  if (completion?.workout || completion?.cardio) return "completed";
  if (workout.session_type === "Rest") return "scheduled";
  if (dateStr < today && workout.status === "scheduled") return "missed";
  return "scheduled";
}

export function WeekStrip({ workouts, completions, weekStart, today }: WeekStripProps) {
  const workoutByDate: Record<string, Workout> = {};
  for (const w of workouts) {
    workoutByDate[w.date] = w;
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((dateStr, i) => {
        const workout = workoutByDate[dateStr];
        const completion = completions[dateStr];

        if (!workout) {
          return (
            <DayCard key={dateStr} dayName={DAY_NAMES[i]} dateStr={formatDateShort(dateStr)} sessionType="Rest" status="scheduled" isToday={dateStr === today} aiNotes={null} completion={null} />
          );
        }

        const status = getStatus(workout, dateStr, today, completion);

        return (
          <DayCard key={dateStr} dayName={DAY_NAMES[i]} dateStr={formatDateShort(dateStr)} sessionType={workout.session_type} status={status} isToday={dateStr === today} aiNotes={workout.ai_notes} completion={completion || null} />
        );
      })}
    </div>
  );
}
