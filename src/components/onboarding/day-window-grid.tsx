"use client";

import {
  type AvailabilityBlock,
  type AvailabilityWindow,
  AVAILABILITY_BLOCKS,
  DAY_LABELS,
  HOUR_PRESETS,
  makeId,
} from "@/lib/onboarding/types";

interface DayWindowGridProps {
  windows: AvailabilityWindow[];
  onChange: (windows: AvailabilityWindow[]) => void;
}

const BLOCK_BY_ID: Record<AvailabilityBlock, (typeof AVAILABILITY_BLOCKS)[number]> = {
  am: AVAILABILITY_BLOCKS[0],
  pm: AVAILABILITY_BLOCKS[1],
  all_day: AVAILABILITY_BLOCKS[2],
};

export function DayWindowGrid({ windows, onChange }: DayWindowGridProps) {
  const getWindow = (day: number, block: AvailabilityBlock): AvailabilityWindow | undefined => {
    const meta = BLOCK_BY_ID[block];
    return windows.find(
      (w) => w.day_of_week === day && w.start_time === meta.start && w.end_time === meta.end
    );
  };

  const addOrUpdate = (day: number, block: AvailabilityBlock, patch: Partial<AvailabilityWindow>) => {
    const meta = BLOCK_BY_ID[block];
    const existing = getWindow(day, block);
    if (existing) {
      onChange(windows.map((w) => (w.id === existing.id ? { ...w, ...patch } : w)));
    } else {
      const created: AvailabilityWindow = {
        id: makeId(),
        day_of_week: day,
        start_time: meta.start,
        end_time: meta.end,
        max_duration_min: 60,
        session_count: 1,
        locations: [],
        ...patch,
      };
      onChange([...windows, created]);
    }
  };

  const remove = (day: number, block: AvailabilityBlock) => {
    const existing = getWindow(day, block);
    if (existing) onChange(windows.filter((w) => w.id !== existing.id));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {DAY_LABELS.map((dayLabel, day) => {
        const am = getWindow(day, "am");
        const pm = getWindow(day, "pm");
        const allDay = getWindow(day, "all_day");
        const isWeekend = day >= 5;

        return (
          <div
            key={dayLabel}
            style={{
              background: "#fff",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-md)",
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: "var(--ink)" }}>{dayLabel}</span>
              {isWeekend && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--muted)",
                  }}
                >
                  Weekend — long sessions OK
                </span>
              )}
            </div>

            <BlockRow
              label="AM"
              window={am}
              onToggle={(want) => (want ? addOrUpdate(day, "am", {}) : remove(day, "am"))}
              onHoursChange={(min) => addOrUpdate(day, "am", { max_duration_min: min })}
              onSessionCountChange={(count) => addOrUpdate(day, "am", { session_count: count })}
            />

            <BlockRow
              label="PM"
              window={pm}
              onToggle={(want) => (want ? addOrUpdate(day, "pm", {}) : remove(day, "pm"))}
              onHoursChange={(min) => addOrUpdate(day, "pm", { max_duration_min: min })}
              onSessionCountChange={(count) => addOrUpdate(day, "pm", { session_count: count })}
            />

            {isWeekend && (
              <BlockRow
                label="All-day option"
                window={allDay}
                onToggle={(want) => {
                  if (want) {
                    // remove AM/PM if user opts into all-day
                    const filtered = windows.filter(
                      (w) =>
                        !(w.day_of_week === day &&
                          ((w.start_time === BLOCK_BY_ID.am.start && w.end_time === BLOCK_BY_ID.am.end) ||
                           (w.start_time === BLOCK_BY_ID.pm.start && w.end_time === BLOCK_BY_ID.pm.end)))
                    );
                    onChange([
                      ...filtered,
                      {
                        id: makeId(),
                        day_of_week: day,
                        start_time: BLOCK_BY_ID.all_day.start,
                        end_time: BLOCK_BY_ID.all_day.end,
                        max_duration_min: 360,
                        session_count: 1,
                        locations: [],
                      },
                    ]);
                  } else {
                    remove(day, "all_day");
                  }
                }}
                onHoursChange={(min) => addOrUpdate(day, "all_day", { max_duration_min: min })}
                onSessionCountChange={(count) => addOrUpdate(day, "all_day", { session_count: count })}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function BlockRow({
  label,
  window: w,
  onToggle,
  onHoursChange,
  onSessionCountChange,
}: {
  label: string;
  window: AvailabilityWindow | undefined;
  onToggle: (want: boolean) => void;
  onHoursChange: (min: number) => void;
  onSessionCountChange: (count: number) => void;
}) {
  const enabled = !!w;
  const minutes = w?.max_duration_min ?? 60;
  const sessionCount = w?.session_count ?? 1;
  const canSplit = minutes >= 90;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: 12, alignItems: "flex-start" }}>
      <button
        type="button"
        onClick={() => onToggle(!enabled)}
        style={{
          padding: "8px 0",
          borderRadius: "var(--r-md)",
          border: enabled ? "2px solid var(--ink)" : "1.5px solid var(--line)",
          background: enabled ? "var(--ink)" : "#fff",
          color: enabled ? "#fff" : "var(--ink)",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 800,
          fontFamily: "inherit",
        }}
      >
        {label}
      </button>

      {enabled ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {HOUR_PRESETS.map((p) => {
              const selected = minutes === p.minutes;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => onHoursChange(p.minutes)}
                  style={{
                    padding: "5px 11px",
                    borderRadius: 999,
                    border: selected ? "2px solid var(--ink)" : "1.5px solid var(--line)",
                    background: selected ? "var(--coral-soft)" : "#fff",
                    color: "var(--ink)",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: "inherit",
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          {canSplit && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Split into</span>
              {[1, 2].map((n) => {
                const selected = sessionCount === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onSessionCountChange(n)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: selected ? "2px solid var(--ink)" : "1.5px solid var(--line)",
                      background: selected ? "var(--ink)" : "#fff",
                      color: selected ? "#fff" : "var(--ink)",
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: "inherit",
                    }}
                  >
                    {n === 1 ? "1 session" : "2 sessions"}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <span style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic", paddingTop: 8 }}>
          Tap to set availability
        </span>
      )}
    </div>
  );
}
