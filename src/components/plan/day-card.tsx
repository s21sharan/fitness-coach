"use client";

import { Icon } from "@/components/app/icon";

type SessionType = "lift" | "run" | "swim" | "rest";

interface DayCardProps {
  day: string;
  date: string;
  label: string;
  type: SessionType;
  duration: string;
  exercises: string[];
  done?: boolean;
  active?: boolean;
  color: "coral" | "sky" | "lilac" | "lemon";
}

const COLOR_MAP: Record<string, string> = {
  coral: "var(--coral)",
  sky: "var(--sky)",
  lilac: "var(--lilac, #c8b8f5)",
  lemon: "var(--lemon)",
};

const SOFT_MAP: Record<string, string> = {
  coral: "var(--coral-soft)",
  sky: "var(--sky-soft)",
  lilac: "rgba(200,184,245,0.25)",
  lemon: "rgba(245,233,160,0.35)",
};

const TYPE_ICON: Record<SessionType, string> = {
  lift: "lift",
  run: "run",
  swim: "swim",
  rest: "rest",
};

export function DayCard({
  day,
  date,
  label,
  type,
  duration,
  exercises,
  done = false,
  active = false,
  color,
}: DayCardProps) {
  const bgColor = active ? COLOR_MAP[color] : "#fff";
  const iconBg = active ? "var(--ink)" : COLOR_MAP[color];
  const iconColor = active ? "#fff" : "var(--ink)";

  const shadowColor =
    color === "coral"
      ? "rgba(238,154,133,0.3)"
      : color === "sky"
      ? "rgba(160,210,245,0.3)"
      : color === "lemon"
      ? "rgba(220,205,100,0.25)"
      : "rgba(200,184,245,0.3)";

  return (
    <div
      style={{
        background: bgColor,
        borderRadius: 22,
        padding: 16,
        border: active ? "none" : "1px solid var(--line)",
        position: "relative",
        overflow: "hidden",
        minHeight: 240,
        boxShadow: active ? `0 18px 30px ${shadowColor}` : "none",
        transform: active ? "translateY(-4px)" : "none",
        transition: "transform .2s",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Day / date header */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              opacity: 0.6,
              letterSpacing: ".1em",
              textTransform: "uppercase",
            }}
          >
            {day}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{date}</div>
        </div>

        {done && !active && (
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "var(--mint-deep)",
              display: "grid",
              placeItems: "center",
              color: "#fff",
            }}
          >
            <Icon name="check" size={10} />
          </div>
        )}

        {active && (
          <div
            style={{
              fontSize: 9,
              fontWeight: 800,
              padding: "3px 7px",
              borderRadius: 6,
              background: "var(--ink)",
              color: "#fff",
            }}
          >
            TODAY
          </div>
        )}
      </div>

      {/* Type icon */}
      {type !== "rest" && (
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            background: iconBg,
            color: iconColor,
            display: "grid",
            placeItems: "center",
            marginBottom: 10,
          }}
        >
          <Icon name={TYPE_ICON[type]} size={15} />
        </div>
      )}

      {/* Session label */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 800,
          lineHeight: 1.25,
          marginBottom: 6,
          letterSpacing: "-0.01em",
        }}
      >
        {label}
      </div>

      {/* Duration */}
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", marginBottom: 10 }}>
        {duration}
      </div>

      {/* Exercise list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: "auto" }}>
        {exercises.slice(0, 4).map((ex, j) => (
          <div
            key={j}
            style={{
              fontSize: 10.5,
              color: "var(--ink-2)",
              fontWeight: 600,
              lineHeight: 1.4,
            }}
          >
            · {ex}
          </div>
        ))}
        {exercises.length > 4 && (
          <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600 }}>
            +{exercises.length - 4} more
          </div>
        )}
      </div>
    </div>
  );
}
