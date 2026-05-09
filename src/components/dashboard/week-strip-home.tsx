"use client";

import { Icon } from "@/components/app/icon";

type DayType = "lift" | "run" | "swim" | "rest";

interface WeekWorkout {
  id: string;
  date: string;
  day_of_week?: string;
  session_type?: string | null;
  ai_notes?: string | null;
  status?: string;
  approved?: boolean;
}

interface WeekStripHomeProps {
  weekWorkouts?: WeekWorkout[];
  weekCompletions?: Record<string, Record<string, unknown>>;
  weekStart?: string;
}

function sessionToDayType(sessionType: string | null | undefined): DayType {
  if (!sessionType) return "rest";
  const s = sessionType.toLowerCase();
  if (s.includes("run") || s.includes("cardio") || s.includes("jog")) return "run";
  if (s.includes("swim")) return "swim";
  if (s.includes("rest") || s.includes("recovery") || s.includes("off")) return "rest";
  return "lift";
}

function tone(t: DayType): string {
  const map: Record<DayType, string> = {
    lift: "var(--coral)",
    run: "var(--sky)",
    swim: "var(--lilac)",
    rest: "#EEF2F4",
  };
  return map[t] || "var(--mint)";
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function WeekStripHome({ weekWorkouts, weekCompletions, weekStart }: WeekStripHomeProps) {
  const todayStr = new Date().toISOString().slice(0, 10);

  // Build 7-day strip
  interface DayCell {
    d: string;
    label: string;
    type: DayType;
    done: boolean;
    active: boolean;
    dateStr: string;
  }

  let cells: DayCell[];

  if (weekWorkouts && weekWorkouts.length > 0 && weekStart) {
    // Build from real data
    cells = Array.from({ length: 7 }, (_, i) => {
      const dateStr = addDays(weekStart, i);
      const workout = weekWorkouts.find((w) => w.date === dateStr);
      const sessionType = workout?.session_type;
      const type = sessionToDayType(sessionType);
      const label = sessionType || "Rest";
      const done = !!(weekCompletions && weekCompletions[dateStr]);
      const active = dateStr === todayStr;
      return { d: DAY_LABELS[i], label, type, done, active, dateStr };
    });
  } else {
    // Fallback: 7 placeholder days anchored to this week
    const now = new Date();
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const mondayStr = monday.toISOString().slice(0, 10);

    cells = Array.from({ length: 7 }, (_, i) => {
      const dateStr = addDays(mondayStr, i);
      const active = dateStr === todayStr;
      return { d: DAY_LABELS[i], label: "Rest", type: "rest" as DayType, done: false, active, dateStr };
    });
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-[18px] md:grid md:grid-cols-7 md:overflow-visible md:pb-0">
      {cells.map((day, i) => (
        <div
          key={i}
          className="min-w-[90px] flex-shrink-0 md:min-w-0"
          style={{
            background: day.active ? "var(--ink)" : "#fff",
            color: day.active ? "#fff" : "var(--ink)",
            borderRadius: 18,
            padding: 14,
            border: day.active ? "none" : "1px solid var(--line)",
            position: "relative",
            overflow: "hidden",
            transform: day.active ? "translateY(-3px)" : "none",
            boxShadow: day.active ? "0 14px 28px rgba(15,27,34,0.18)" : "none",
            transition: "transform .2s",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              opacity: 0.6,
              letterSpacing: ".08em",
              textTransform: "uppercase",
            }}
          >
            {day.d}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 6,
            }}
          >
            {day.type !== "rest" && (
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 8,
                  background: tone(day.type),
                  display: "grid",
                  placeItems: "center",
                  color: "var(--ink)",
                }}
              >
                <Icon name={day.type === "lift" ? "lift" : "run"} size={13} />
              </div>
            )}
            <span
              style={{
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "-0.01em",
              }}
            >
              {day.label}
            </span>
          </div>
          {day.done && (
            <div
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "var(--mint-deep)",
                display: "grid",
                placeItems: "center",
                color: "#fff",
              }}
            >
              <Icon name="check" size={11} />
            </div>
          )}
          {day.active && (
            <div
              style={{
                position: "absolute",
                bottom: 10,
                right: 10,
                fontSize: 10,
                fontWeight: 700,
                color: "var(--coral)",
              }}
            >
              ● TODAY
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
