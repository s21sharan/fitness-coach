"use client";

import { Icon } from "@/components/app/icon";

type DayType = "lift" | "run" | "swim" | "rest";

interface Day {
  d: string;
  label: string;
  type: DayType;
  done?: boolean;
  active?: boolean;
}

const days: Day[] = [
  { d: "Mon", label: "Pull", type: "lift", done: true },
  { d: "Tue", label: "Run 8K", type: "run", done: true },
  { d: "Wed", label: "Legs", type: "lift", done: true },
  { d: "Thu", label: "Rest", type: "rest", done: true },
  { d: "Fri", label: "Push", type: "lift", active: true },
  { d: "Sat", label: "Long Run", type: "run" },
  { d: "Sun", label: "Rest", type: "rest" },
];

function tone(t: DayType): string {
  const map: Record<DayType, string> = {
    lift: "var(--coral)",
    run: "var(--sky)",
    swim: "var(--lilac)",
    rest: "#EEF2F4",
  };
  return map[t] || "var(--mint)";
}

export function WeekStripHome() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: 10,
        marginBottom: 18,
      }}
    >
      {days.map((day, i) => (
        <div
          key={i}
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
              ● NOW
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
