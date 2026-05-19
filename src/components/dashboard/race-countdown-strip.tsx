"use client";

interface RaceEvent {
  id: string;
  name: string;
  event_date: string; // "YYYY-MM-DD"
  priority: string | null;
}

interface RaceCountdownStripProps {
  events: RaceEvent[];
}

function getDaysUntil(eventDate: string): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(eventDate + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getPriorityColor(priority: string): string {
  if (priority === "A") return "#f87171";
  if (priority === "B") return "#fbbf24";
  return "#9ca3af";
}

export function RaceCountdownStrip({ events }: RaceCountdownStripProps) {
  if (!events || events.length === 0) return null;

  const visibleEvents = events.slice(0, 3);

  return (
    <div
      style={{
        borderTop: "1px solid #e5e7eb",
        margin: "12px 0 0 0",
        paddingTop: 12,
      }}
    >
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {visibleEvents.map((event) => {
          const daysUntil = getDaysUntil(event.event_date);
          const isUrgent = daysUntil <= 7;
          const countdownLabel = daysUntil === 0 ? "Today" : `${daysUntil}d`;
          const badgeBackground = isUrgent ? "#fef2f2" : "#f3f4f6";
          const badgeColor = isUrgent ? "#dc2626" : "#374151";

          return (
            <div
              key={event.id}
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                borderRadius: 999,
                background: "#f9fafb",
                border: "1px solid #f3f4f6",
              }}
            >
              {/* Calendar icon */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                style={{ flexShrink: 0 }}
              >
                <rect
                  x="1"
                  y="3"
                  width="14"
                  height="12"
                  rx="2"
                  stroke="#9ca3af"
                  strokeWidth="1.5"
                  fill="none"
                />
                <path d="M1 7h14" stroke="#9ca3af" strokeWidth="1.5" />
                <path
                  d="M5 1v4M11 1v4"
                  stroke="#9ca3af"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>

              {/* Race name */}
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#374151",
                  maxWidth: 140,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {event.name}
              </span>

              {/* Countdown badge */}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: badgeBackground,
                  color: badgeColor,
                }}
              >
                {countdownLabel}
              </span>

              {/* Priority dot */}
              {event.priority && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: getPriorityColor(event.priority),
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {event.priority}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
