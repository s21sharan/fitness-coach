"use client";

import { useEffect, useState } from "react";
import type {
  AthleteContextProfile,
  CurrentVolume,
  SportId,
  TargetPeak,
} from "@/lib/onboarding/types";
import { SPORTS } from "@/lib/onboarding/types";
import { fetchAggregatedLoad } from "@/app/onboarding/actions";
import type {
  AggregatedLoadSummary,
  SportLoadSummary,
} from "@/lib/training-load/aggregate";

interface ScreenSportsProps {
  profile: AthleteContextProfile;
  onUpdate: (updates: Partial<AthleteContextProfile>) => void;
}

export const SCREEN_SPORTS_TITLE = "Which sports — and how much?";
export const SCREEN_SPORTS_SUBTITLE =
  "We pulled the last 8 weeks from your apps. Toggle what you want in the upcoming block and set a target.";

// Bucketed target presets per sport.
const TARGET_PRESETS: Record<SportId, { label: string; value: number }[]> = {
  run: [
    { label: "< 20", value: 20 },
    { label: "20-30", value: 30 },
    { label: "30-40", value: 40 },
    { label: "40-50", value: 50 },
    { label: "50-60", value: 60 },
    { label: "60-70", value: 70 },
    { label: "70+", value: 80 },
  ],
  bike: [
    { label: "1-2 hr", value: 2 },
    { label: "3-5 hr", value: 5 },
    { label: "6-8 hr", value: 8 },
    { label: "9-12 hr", value: 12 },
    { label: "12+ hr", value: 14 },
  ],
  swim: [
    { label: "1 sess", value: 1 },
    { label: "2 sess", value: 2 },
    { label: "3 sess", value: 3 },
    { label: "4+ sess", value: 4 },
  ],
  lift: [
    { label: "1-2 sess", value: 2 },
    { label: "3 sess", value: 3 },
    { label: "4 sess", value: 4 },
    { label: "5-6 sess", value: 5 },
  ],
  other: [],
};

const TARGET_LABELS: Record<SportId, { unit: string; key: keyof TargetPeak }> = {
  run: { unit: "mi/wk", key: "weekly_miles" },
  bike: { unit: "hr/wk", key: "weekly_hours" },
  swim: { unit: "sess/wk", key: "weekly_sessions" },
  lift: { unit: "sess/wk", key: "weekly_sessions" },
  other: { unit: "sess/wk", key: "weekly_sessions" },
};

export function ScreenSports({ profile, onUpdate }: ScreenSportsProps) {
  const [load, setLoad] = useState<AggregatedLoadSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAggregatedLoad()
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.load) {
          setLoad(res.load);
          if (!prefilled) {
            prefillCurrentVolume(profile, res.load, onUpdate);
            setPrefilled(true);
          }
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setPlanned = (sport: SportId, planned: boolean) => {
    onUpdate({
      sports: {
        ...profile.sports,
        [sport]: { ...profile.sports[sport], is_planned: planned, enabled: planned || profile.sports[sport].enabled },
      },
    });
  };

  const setTarget = (sport: SportId, patch: Partial<TargetPeak>) => {
    onUpdate({
      sports: {
        ...profile.sports,
        [sport]: {
          ...profile.sports[sport],
          target_peak: { ...(profile.sports[sport].target_peak ?? {}), ...patch },
        },
      },
    });
  };

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
      {loading && (
        <p style={{ fontSize: 12, color: "var(--muted)", margin: 0, textAlign: "center" }}>
          Reading your last 8 weeks…
        </p>
      )}
      {!loading && load && !load.hasAnyData && (
        <p
          style={{
            fontSize: 13,
            color: "var(--ink-2)",
            margin: 0,
            padding: 12,
            background: "var(--lemon)",
            borderRadius: "var(--r-md)",
          }}
        >
          No synced data yet — set what you want in the upcoming block (you can always connect more apps later).
        </p>
      )}

      {SPORTS.map((s) => {
        const entry = profile.sports[s.value];
        const summary = summaryFor(load, s.value);
        const target = entry.target_peak ?? {};
        const targetMeta = TARGET_LABELS[s.value];
        const buckets = TARGET_PRESETS[s.value];
        const currentTarget = (target[targetMeta.key] as number | null | undefined) ?? null;

        return (
          <div
            key={s.value}
            style={{
              background: "#fff",
              border: entry.is_planned ? "1.5px solid var(--ink)" : "1px solid var(--line)",
              borderRadius: "var(--r-lg)",
              padding: 16,
              transition: "border 0.12s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 26 }}>{s.emoji}</span>
                <div>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: "var(--ink)" }}>{s.label}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>
                    {currentSummaryText(s.value, entry.current_volume, summary)}
                  </p>
                </div>
              </div>
              <Toggle
                label={entry.is_planned ? "Training" : "Not training"}
                value={entry.is_planned}
                onChange={(v) => setPlanned(s.value, v)}
              />
            </div>

            {entry.is_planned && buckets.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--muted)",
                  }}
                >
                  Where do you want to ramp to? ({targetMeta.unit})
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {buckets.map((b) => {
                    const selected = currentTarget === b.value;
                    return (
                      <button
                        key={b.label}
                        type="button"
                        onClick={() => setTarget(s.value, { [targetMeta.key]: b.value, not_sure: false })}
                        style={{
                          padding: "7px 13px",
                          borderRadius: 999,
                          border: selected ? "2px solid var(--ink)" : "1.5px solid var(--line)",
                          background: selected ? "var(--ink)" : "#fff",
                          color: selected ? "#fff" : "var(--ink)",
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 700,
                          fontFamily: "inherit",
                        }}
                      >
                        {b.label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setTarget(s.value, { not_sure: true, [targetMeta.key]: null })}
                    style={{
                      padding: "7px 13px",
                      borderRadius: 999,
                      border: target.not_sure ? "2px solid var(--ink)" : "1.5px solid var(--line)",
                      background: target.not_sure ? "var(--coral-soft)" : "#fff",
                      color: "var(--ink)",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: "inherit",
                    }}
                  >
                    Not sure
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        padding: "8px 14px",
        borderRadius: 999,
        border: value ? "2px solid var(--ink)" : "1.5px solid var(--line)",
        background: value ? "var(--ink)" : "#fff",
        color: value ? "#fff" : "var(--ink)",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 800,
        fontFamily: "inherit",
        transition: "all 0.12s",
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  );
}

function summaryFor(load: AggregatedLoadSummary | null, sport: SportId): SportLoadSummary | null {
  if (!load) return null;
  switch (sport) {
    case "run": return load.run;
    case "bike": return load.bike;
    case "swim": return load.swim;
    case "lift": return load.lift;
    default: return null;
  }
}

function currentSummaryText(sport: SportId, cv: CurrentVolume | null, summary: SportLoadSummary | null): string {
  // Prefer user-confirmed value, otherwise show synced data.
  const primaryFromCv = primaryVolume(cv);
  if (primaryFromCv != null) {
    return `Currently ~${primaryFromCv} ${unitFor(sport)}`;
  }
  if (summary) {
    return `Last 8 wk: ~${summary.weekly_avg} ${unitFor(sport)}`;
  }
  return "Not currently tracked";
}

function primaryVolume(cv: CurrentVolume | null): number | null {
  if (!cv) return null;
  return cv.weekly_miles ?? cv.weekly_hours ?? cv.weekly_sessions ?? cv.weekly_meters ?? null;
}

function unitFor(sport: SportId): string {
  switch (sport) {
    case "run": return "mi/wk";
    case "bike": return "hr/wk";
    case "swim": return "sess/wk";
    case "lift": return "sess/wk";
    default: return "";
  }
}

function prefillCurrentVolume(
  profile: AthleteContextProfile,
  load: AggregatedLoadSummary,
  onUpdate: (updates: Partial<AthleteContextProfile>) => void
) {
  const next = { ...profile.sports };
  let changed = false;

  function set(sport: SportId, summary: SportLoadSummary | null, mapper: (s: SportLoadSummary) => CurrentVolume) {
    if (!summary) return;
    if (next[sport].current_volume) return;
    next[sport] = { ...next[sport], current_volume: mapper(summary), enabled: true };
    changed = true;
  }

  set("run", load.run, (s) => ({ weekly_miles: s.weekly_avg, longest_session: s.longest_session, peak_recent: s.weekly_peak }));
  set("bike", load.bike, (s) => ({ weekly_hours: s.weekly_avg, longest_session: s.longest_session, peak_recent: s.weekly_peak }));
  set("swim", load.swim, (s) => ({ weekly_meters: s.weekly_avg, longest_session: s.longest_session, peak_recent: s.weekly_peak }));
  set("lift", load.lift, (s) => ({ weekly_sessions: s.weekly_avg, peak_recent: s.weekly_peak }));

  if (changed) onUpdate({ sports: next });
}

// Re-export for tests
export { prefillCurrentVolume, currentSummaryText, primaryVolume };
