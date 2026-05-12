"use client";

import type { AthleteContextProfile, EquipmentItem, SportId } from "@/lib/onboarding/types";
import {
  EQUIPMENT_BY_SPORT,
  EQUIPMENT_LABELS,
  SPORTS,
  makeId,
} from "@/lib/onboarding/types";
import { SportCard } from "./sport-card";

interface ScreenEquipmentProps {
  profile: AthleteContextProfile;
  onUpdate: (updates: Partial<AthleteContextProfile>) => void;
}

export const SCREEN_EQUIPMENT_TITLE = "What equipment do you have?";
export const SCREEN_EQUIPMENT_SUBTITLE =
  "We only ask about the sports you train. This makes the plan match your reality (no home-gym-only barbell suggestions).";

export function ScreenEquipment({ profile, onUpdate }: ScreenEquipmentProps) {
  const planned = Object.values(profile.sports).filter((s) => s.is_planned).map((s) => s.sport);

  const toggleItem = (sport: SportId, item: string) => {
    const existing = profile.equipment.find((e) => e.sport === sport && e.item === item);
    if (existing) {
      onUpdate({ equipment: profile.equipment.filter((e) => e.id !== existing.id) });
    } else {
      const newItem: EquipmentItem = {
        id: makeId(),
        sport,
        item,
        available: true,
      };
      onUpdate({ equipment: [...profile.equipment, newItem] });
    }
  };

  if (planned.length === 0) {
    return (
      <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
        Pick at least one sport on the sports screen first.
      </p>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
      {planned.map((sport) => {
        const items = EQUIPMENT_BY_SPORT[sport] ?? [];
        if (items.length === 0) return null;
        const sportMeta = SPORTS.find((s) => s.value === sport);
        return (
          <SportCard key={sport} sport={sport} badge={sportMeta?.label}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {items.map((item) => {
                const selected = profile.equipment.some((e) => e.sport === sport && e.item === item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleItem(sport, item)}
                    style={{
                      padding: "7px 13px",
                      borderRadius: 999,
                      border: selected ? "2px solid var(--ink)" : "1.5px solid var(--line)",
                      background: selected ? "var(--ink)" : "#fff",
                      color: selected ? "#fff" : "var(--ink)",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {EQUIPMENT_LABELS[item] ?? item}
                  </button>
                );
              })}
            </div>
          </SportCard>
        );
      })}
    </div>
  );
}
