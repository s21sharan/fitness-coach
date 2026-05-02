"use client";

import { Icon } from "@/components/app/icon";

interface PlanNavProps {
  weekOffset: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

/** Renders prev / this-week / next ghost buttons for use as the Topbar `right` prop. */
export function PlanNav({ weekOffset, onPrev, onNext, onToday }: PlanNavProps) {
  return (
    <>
      <button
        onClick={onPrev}
        className="btn-ghost"
        style={{ padding: "8px 14px", fontSize: 13 }}
        aria-label="Previous week"
      >
        <Icon name="chevron-left" size={14} />
      </button>
      <button
        onClick={onToday}
        className="btn-ghost"
        style={{
          padding: "8px 14px",
          fontSize: 13,
          fontWeight: weekOffset === 0 ? 800 : 600,
        }}
      >
        This week
      </button>
      <button
        onClick={onNext}
        className="btn-ghost"
        style={{ padding: "8px 14px", fontSize: 13 }}
        aria-label="Next week"
      >
        <Icon name="chevron-right" size={14} />
      </button>
    </>
  );
}

/* ── Keep legacy PlanHeader export so old imports don't break ─────── */

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

export function PlanHeader({
  weekOffset,
  onPrev,
  onNext,
  onToday,
}: PlanHeaderProps) {
  return (
    <PlanNav
      weekOffset={weekOffset}
      onPrev={onPrev}
      onNext={onNext}
      onToday={onToday}
    />
  );
}
