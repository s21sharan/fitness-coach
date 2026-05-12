"use client";

import type { AthleteContextProfile, SportEntry, SportId } from "@/lib/onboarding/types";
import { SPORTS } from "@/lib/onboarding/types";

interface ScreenSportsProps {
  profile: AthleteContextProfile;
  onUpdate: (updates: Partial<AthleteContextProfile>) => void;
}

export const SCREEN_SPORTS_TITLE = "Which sports do you train?";
export const SCREEN_SPORTS_SUBTITLE =
  "Pick what you currently train, what you want in the plan, your primary, and your biggest limiter.";

export function ScreenSports({ profile, onUpdate }: ScreenSportsProps) {
  const updateSport = (sport: SportId, patch: Partial<SportEntry>) => {
    onUpdate({
      sports: {
        ...profile.sports,
        [sport]: { ...profile.sports[sport], ...patch },
      },
    });
  };

  const setPrimary = (sport: SportId) => {
    const next: Record<SportId, SportEntry> = { ...profile.sports };
    (Object.keys(next) as SportId[]).forEach((s) => {
      next[s] = { ...next[s], is_primary: s === sport, priority: s === sport ? 1 : next[s].priority };
    });
    onUpdate({ sports: next });
  };

  const setLimiter = (sport: SportId) => {
    const next: Record<SportId, SportEntry> = { ...profile.sports };
    (Object.keys(next) as SportId[]).forEach((s) => {
      next[s] = { ...next[s], is_limiter: s === sport };
    });
    onUpdate({ sports: next });
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(140px, 1.4fr) 90px 90px 90px 90px",
          gap: 10,
          alignItems: "center",
          fontSize: 11,
          fontWeight: 700,
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        <span></span>
        <span style={{ textAlign: "center" }}>Train now</span>
        <span style={{ textAlign: "center" }}>Plan it</span>
        <span style={{ textAlign: "center" }}>Primary</span>
        <span style={{ textAlign: "center" }}>Limiter</span>
      </div>

      {SPORTS.map((s) => {
        const entry = profile.sports[s.value];
        return (
          <div
            key={s.value}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(140px, 1.4fr) 90px 90px 90px 90px",
              gap: 10,
              alignItems: "center",
              background: "#fff",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--line)",
              padding: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>{s.emoji}</span>
              <div>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: "var(--ink)" }}>{s.label}</p>
                <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>{s.description}</p>
              </div>
            </div>
            <Toggle
              value={entry.enabled}
              onChange={(v) => updateSport(s.value, { enabled: v })}
            />
            <Toggle
              value={entry.is_planned}
              onChange={(v) => updateSport(s.value, { is_planned: v, enabled: v || entry.enabled })}
            />
            <RadioPill
              checked={entry.is_primary}
              disabled={!entry.is_planned}
              onClick={() => entry.is_planned && setPrimary(s.value)}
            />
            <RadioPill
              checked={entry.is_limiter}
              disabled={!entry.is_planned}
              onClick={() => entry.is_planned && setLimiter(s.value)}
            />
          </div>
        );
      })}

      <p style={{ fontSize: 12, color: "var(--muted)", margin: "8px 0 0", lineHeight: 1.5 }}>
        Tip: "Primary" is the sport your plan optimizes first. "Limiter" is the one that's holding you back — we'll
        give it extra focus.
      </p>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        height: 36,
        borderRadius: "var(--r-md)",
        border: value ? "2px solid var(--ink)" : "1.5px solid var(--line)",
        background: value ? "var(--ink)" : "#fff",
        color: value ? "#fff" : "var(--ink)",
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: 800,
        cursor: "pointer",
        transition: "all 0.12s",
      }}
    >
      {value ? "Yes" : "—"}
    </button>
  );
}

function RadioPill({ checked, disabled, onClick }: { checked: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 36,
        borderRadius: "var(--r-md)",
        border: checked ? "2px solid var(--ink)" : "1.5px solid var(--line)",
        background: checked ? "var(--coral)" : disabled ? "var(--bg-2)" : "#fff",
        color: "var(--ink)",
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.12s",
      }}
    >
      {checked ? "●" : "○"}
    </button>
  );
}
