"use client";

import {
  type AvailabilityBlock,
  type AvailabilityWindow,
  AVAILABILITY_BLOCKS,
  DAY_LABELS,
  HOUR_PRESETS,
  LONG_SESSION_PRESETS,
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

const DEFAULT_DURATION_MIN: Record<AvailabilityBlock, number> = {
  am: 60,
  pm: 60,
  all_day: 180,
};

type Preset = { label: string; minutes: number };

export function DayWindowGrid({ windows, onChange }: DayWindowGridProps) {
  const getWindow = (day: number, block: AvailabilityBlock): AvailabilityWindow | undefined => {
    const meta = BLOCK_BY_ID[block];
    return windows.find(
      (w) => w.day_of_week === day && w.start_time === meta.start && w.end_time === meta.end
    );
  };

  const upsertWindow = (day: number, block: AvailabilityBlock, patch: Partial<AvailabilityWindow>) => {
    const meta = BLOCK_BY_ID[block];
    const existing = getWindow(day, block);
    if (existing) {
      onChange(windows.map((w) => (w.id === existing.id ? { ...w, ...patch } : w)));
    } else {
      onChange([
        ...windows,
        {
          id: makeId(),
          day_of_week: day,
          start_time: meta.start,
          end_time: meta.end,
          max_duration_min: DEFAULT_DURATION_MIN[block],
          session_count: 1,
          locations: [],
          ...patch,
        },
      ]);
    }
  };

  const removeBlock = (day: number, block: AvailabilityBlock) => {
    const existing = getWindow(day, block);
    if (existing) onChange(windows.filter((w) => w.id !== existing.id));
  };

  // AM and PM coexist. Long session is mutually exclusive with both.
  const toggleAmOrPm = (day: number, block: "am" | "pm") => {
    const existing = getWindow(day, block);
    if (existing) {
      removeBlock(day, block);
      return;
    }
    const longSession = getWindow(day, "all_day");
    const filtered = longSession ? windows.filter((w) => w.id !== longSession.id) : windows;
    const meta = BLOCK_BY_ID[block];
    onChange([
      ...filtered,
      {
        id: makeId(),
        day_of_week: day,
        start_time: meta.start,
        end_time: meta.end,
        max_duration_min: DEFAULT_DURATION_MIN[block],
        session_count: 1,
        locations: [],
      },
    ]);
  };

  const toggleLongSession = (day: number) => {
    const existing = getWindow(day, "all_day");
    if (existing) {
      removeBlock(day, "all_day");
      return;
    }
    const filtered = windows.filter((w) => {
      if (w.day_of_week !== day) return true;
      const isAm = w.start_time === BLOCK_BY_ID.am.start && w.end_time === BLOCK_BY_ID.am.end;
      const isPm = w.start_time === BLOCK_BY_ID.pm.start && w.end_time === BLOCK_BY_ID.pm.end;
      return !isAm && !isPm;
    });
    onChange([
      ...filtered,
      {
        id: makeId(),
        day_of_week: day,
        start_time: BLOCK_BY_ID.all_day.start,
        end_time: BLOCK_BY_ID.all_day.end,
        max_duration_min: DEFAULT_DURATION_MIN.all_day,
        session_count: 1,
        locations: [],
      },
    ]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {DAY_LABELS.map((dayLabel, day) => {
        const am = getWindow(day, "am");
        const pm = getWindow(day, "pm");
        const allDay = getWindow(day, "all_day");
        const hasAny = !!am || !!pm || !!allDay;

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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontWeight: 800, fontSize: 14, color: "var(--ink)" }}>{dayLabel}</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <ChipToggle label="AM" selected={!!am} onClick={() => toggleAmOrPm(day, "am")} />
                <ChipToggle label="PM" selected={!!pm} onClick={() => toggleAmOrPm(day, "pm")} />
                <ChipToggle
                  label="Long session"
                  selected={!!allDay}
                  onClick={() => toggleLongSession(day)}
                />
              </div>
            </div>

            {!hasAny && (
              <span style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>
                Tap a chip to set availability — Long session replaces AM/PM with one longer window.
              </span>
            )}

            {am && (
              <DurationRow
                label="AM"
                minutes={am.max_duration_min ?? DEFAULT_DURATION_MIN.am}
                presets={HOUR_PRESETS}
                onChange={(min) => upsertWindow(day, "am", { max_duration_min: min })}
              />
            )}
            {pm && (
              <DurationRow
                label="PM"
                minutes={pm.max_duration_min ?? DEFAULT_DURATION_MIN.pm}
                presets={HOUR_PRESETS}
                onChange={(min) => upsertWindow(day, "pm", { max_duration_min: min })}
              />
            )}
            {allDay && (
              <DurationRow
                label="Long"
                minutes={allDay.max_duration_min ?? DEFAULT_DURATION_MIN.all_day}
                presets={LONG_SESSION_PRESETS}
                onChange={(min) => upsertWindow(day, "all_day", { max_duration_min: min })}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ChipToggle({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        border: selected ? "2px solid var(--ink)" : "1.5px solid var(--line)",
        background: selected ? "var(--ink)" : "#fff",
        color: selected ? "#fff" : "var(--ink)",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 800,
        fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}

function DurationRow({
  label,
  minutes,
  presets,
  onChange,
}: {
  label: string;
  minutes: number;
  presets: readonly Preset[];
  onChange: (min: number) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "52px 1fr", gap: 10, alignItems: "center" }}>
      <span
        style={{
          fontSize: 10,
          color: "var(--muted)",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {presets.map((p) => {
          const selected = minutes === p.minutes;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange(p.minutes)}
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
    </div>
  );
}
