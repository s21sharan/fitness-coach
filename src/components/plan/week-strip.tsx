"use client";

import { DayCard } from "./day-card";

type SessionType = "lift" | "run" | "swim" | "rest";
type ColorKey = "coral" | "sky" | "lilac" | "lemon";

interface DayData {
  day: string;
  date: string;
  label: string;
  type: SessionType;
  duration: string;
  exercises: string[];
  done?: boolean;
  active?: boolean;
  color: ColorKey;
}

interface WeekStripProps {
  days: DayData[];
}

export function WeekStrip({ days }: WeekStripProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 mb-[18px] md:grid md:grid-cols-7 md:overflow-visible md:pb-0">
      {days.map((day, i) => (
        <div key={i} className="min-w-[100px] flex-shrink-0 md:min-w-0">
          <DayCard
            day={day.day}
            date={day.date}
            label={day.label}
            type={day.type}
            duration={day.duration}
            exercises={day.exercises}
            done={day.done}
            active={day.active}
            color={day.color}
          />
        </div>
      ))}
    </div>
  );
}

/* ── helpers for building DayData from API data ───────────────────── */

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
  cardio?: Array<{
    type: string;
    distance: number;
    duration: number;
    avg_hr: number | null;
    pace_or_speed: number | null;
  }>;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function inferType(sessionType: string): SessionType {
  const lower = sessionType.toLowerCase();
  if (lower === "rest" || lower === "rest day") return "rest";
  if (lower.includes("swim")) return "swim";
  if (
    lower.includes("run") ||
    lower.includes("ride") ||
    lower.includes("z2") ||
    lower.includes("cardio")
  )
    return "run";
  return "lift";
}

function inferColor(type: SessionType): ColorKey {
  if (type === "lift") return "coral";
  if (type === "run") return "sky";
  if (type === "swim") return "lilac";
  return "lemon";
}

function buildExercises(completion: Completion | undefined, sessionType: string): string[] {
  const exs: string[] = [];
  if (completion?.workout) {
    exs.push(`${completion.workout.name}`);
    exs.push(`${completion.workout.duration_minutes} min · ${completion.workout.exercise_count} exercises`);
  }
  if (completion?.cardio) {
    for (const c of completion.cardio) {
      const pace = c.pace_or_speed
        ? ` · ${Math.floor(c.pace_or_speed)}:${String(Math.round((c.pace_or_speed % 1) * 60)).padStart(2, "0")}/km`
        : "";
      exs.push(`${c.distance} km${pace}`);
      if (c.avg_hr) exs.push(`Avg HR ${c.avg_hr}`);
    }
  }
  if (exs.length === 0 && sessionType !== "Rest") {
    exs.push(sessionType);
  }
  return exs;
}

function isDone(
  workout: Workout,
  dateStr: string,
  today: string,
  completion: Completion | undefined
): boolean {
  if (completion?.workout || completion?.cardio) return true;
  if (workout.session_type === "Rest" && dateStr < today) return true;
  return false;
}

export function buildWeekDays(
  workouts: Workout[],
  completions: Record<string, Completion>,
  weekStart: string,
  today: string
): DayData[] {
  const workoutByDate: Record<string, Workout> = {};
  for (const w of workouts) {
    workoutByDate[w.date] = w;
  }

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const workout = workoutByDate[dateStr];
    const completion = completions[dateStr];

    if (!workout) {
      return {
        day: DAY_NAMES[i],
        date: formatDateShort(dateStr),
        label: "Rest",
        type: "rest" as SessionType,
        duration: "—",
        exercises: ["Recovery day"],
        done: dateStr < today,
        active: dateStr === today,
        color: "lemon" as ColorKey,
      };
    }

    const type = inferType(workout.session_type);
    const color = inferColor(type);
    const done = isDone(workout, dateStr, today, completion);
    const exercises = buildExercises(completion, workout.session_type);
    const durationMin = completion?.workout?.duration_minutes;

    return {
      day: DAY_NAMES[i],
      date: formatDateShort(dateStr),
      label: workout.session_type,
      type,
      duration: durationMin ? `${durationMin} min` : workout.ai_notes ? workout.ai_notes : "—",
      exercises,
      done,
      active: dateStr === today,
      color,
    };
  });
}
