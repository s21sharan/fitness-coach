"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { HrZoneChart, computeHrZones } from "./recovery-charts";
import { cType } from "@/lib/training/calendar-data";
import type { CardioLog, ZoneBoundary } from "@/lib/hooks/use-dashboard-data";

type Tab = "all" | "run" | "bike" | "swim";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "all", label: "All" },
  { key: "run", label: "Run" },
  { key: "bike", label: "Bike" },
  { key: "swim", label: "Swim" },
];

interface Props {
  cardio: CardioLog[];
  boundaries: ZoneBoundary[] | null;
  compact?: boolean;
}

export function HrZoneTabs({ cardio, boundaries, compact = false }: Props) {
  const [tab, setTab] = useState<Tab>("all");

  const availableTabs = useMemo(() => {
    const present = new Set(cardio.map((c) => cType(c.type)));
    return TABS.filter((t) => t.key === "all" || present.has(t.key));
  }, [cardio]);

  const filtered = useMemo(() => {
    if (tab === "all") return cardio;
    return cardio.filter((c) => cType(c.type) === tab);
  }, [cardio, tab]);

  const zones = useMemo(() => computeHrZones(filtered, boundaries), [filtered, boundaries]);

  if (availableTabs.length <= 1) {
    return <HrZoneChart zones={zones} compact={compact} />;
  }

  return (
    <div>
      <div style={{ marginBottom: compact ? 8 : 12 }}>
        <div style={tabStripStyle}>
          {availableTabs.map((t) => (
            <button
              key={t.key}
              style={{ ...tabBaseStyle, ...(tab === t.key ? tabActiveStyle : {}) }}
              onClick={(e) => { e.stopPropagation(); setTab(t.key); }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <HrZoneChart zones={zones} compact={compact} />
    </div>
  );
}

const tabStripStyle: CSSProperties = {
  display: "inline-flex",
  gap: 2,
  padding: 3,
  background: "#f3f4f6",
  borderRadius: 9,
  border: "1px solid #e5e7eb",
};

const tabBaseStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  padding: "5px 12px",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
  borderRadius: 7,
  color: "#6b7280",
  transition: "background .15s, color .15s",
};

const tabActiveStyle: CSSProperties = {
  background: "#fff",
  color: "#111827",
  boxShadow: "0 1px 2px rgba(15, 27, 34, 0.08)",
};
