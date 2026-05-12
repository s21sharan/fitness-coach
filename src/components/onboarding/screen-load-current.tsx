"use client";

import { useEffect, useState } from "react";
import type { AthleteContextProfile, SportEntry, SportId, CurrentVolume } from "@/lib/onboarding/types";
import { fetchAggregatedLoad } from "@/app/onboarding/actions";
import type { AggregatedLoadSummary, SportLoadSummary } from "@/lib/training-load/aggregate";
import { SportCard } from "./sport-card";
import { inputStyle, labelStyle } from "./shared-styles";

interface ScreenLoadCurrentProps {
  profile: AthleteContextProfile;
  onUpdate: (updates: Partial<AthleteContextProfile>) => void;
}

export const SCREEN_LOAD_CURRENT_TITLE = "Confirm your current training.";
export const SCREEN_LOAD_CURRENT_SUBTITLE =
  "We pulled the last 8 weeks from your connected apps. Correct anything that looks wrong.";

const UNIT_LABELS: Record<string, string> = {
  miles: "mi/wk",
  hours: "hr/wk",
  meters: "m/wk",
  sessions: "sessions/wk",
};

export function ScreenLoadCurrent({ profile, onUpdate }: ScreenLoadCurrentProps) {
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
          if (!prefilled) prefillFromLoad(profile, res.load, onUpdate);
          setPrefilled(true);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plannedSports = (Object.values(profile.sports) as SportEntry[]).filter((s) => s.is_planned);

  if (plannedSports.length === 0) {
    return (
      <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
        Pick a sport on the previous screen first.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
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
          No synced data yet — fill these in manually (you can always connect more apps later).
        </p>
      )}

      {plannedSports.map((sport) => (
        <SportCard key={sport.sport} sport={sport.sport}>
          <CurrentVolumeForm
            sport={sport.sport}
            volume={sport.current_volume}
            summary={summaryFor(load, sport.sport)}
            onChange={(v) =>
              onUpdate({
                sports: {
                  ...profile.sports,
                  [sport.sport]: { ...sport, current_volume: v },
                },
              })
            }
          />
        </SportCard>
      ))}
    </div>
  );
}

function summaryFor(load: AggregatedLoadSummary | null, sport: SportId): SportLoadSummary | null {
  if (!load) return null;
  switch (sport) {
    case "run":
      return load.run;
    case "bike":
      return load.bike;
    case "swim":
      return load.swim;
    case "lift":
      return load.lift;
    default:
      return null;
  }
}

function prefillFromLoad(
  profile: AthleteContextProfile,
  load: AggregatedLoadSummary,
  onUpdate: (updates: Partial<AthleteContextProfile>) => void
) {
  const next = { ...profile.sports };
  let changed = false;

  function set(sport: SportId, summary: SportLoadSummary | null, mapper: (s: SportLoadSummary) => CurrentVolume) {
    if (!summary) return;
    if (!next[sport].is_planned) return;
    if (next[sport].current_volume) return; // don't overwrite
    next[sport] = { ...next[sport], current_volume: mapper(summary) };
    changed = true;
  }

  set("run", load.run, (s) => ({
    weekly_miles: s.weekly_avg,
    longest_session: s.longest_session,
    peak_recent: s.weekly_peak,
  }));
  set("bike", load.bike, (s) => ({
    weekly_hours: s.weekly_avg,
    longest_session: s.longest_session,
    peak_recent: s.weekly_peak,
  }));
  set("swim", load.swim, (s) => ({
    weekly_meters: s.weekly_avg,
    longest_session: s.longest_session,
    peak_recent: s.weekly_peak,
  }));
  set("lift", load.lift, (s) => ({
    weekly_sessions: s.weekly_avg,
    longest_session: s.longest_session,
    peak_recent: s.weekly_peak,
  }));

  if (changed) onUpdate({ sports: next });
}

function CurrentVolumeForm({
  sport,
  volume,
  summary,
  onChange,
}: {
  sport: SportId;
  volume: CurrentVolume | null;
  summary: SportLoadSummary | null;
  onChange: (v: CurrentVolume) => void;
}) {
  const fields: { key: keyof CurrentVolume; label: string; unit: string }[] = (() => {
    switch (sport) {
      case "run":
        return [
          { key: "weekly_miles", label: "Weekly miles", unit: "mi/wk" },
          { key: "longest_session", label: "Longest run", unit: "mi" },
          { key: "peak_recent", label: "Peak week (last 6mo)", unit: "mi" },
        ];
      case "bike":
        return [
          { key: "weekly_hours", label: "Weekly hours", unit: "hr/wk" },
          { key: "longest_session", label: "Longest ride", unit: "hr" },
          { key: "peak_recent", label: "Peak week", unit: "hr" },
        ];
      case "swim":
        return [
          { key: "weekly_meters", label: "Weekly meters", unit: "m/wk" },
          { key: "longest_session", label: "Longest swim", unit: "m" },
          { key: "peak_recent", label: "Peak week", unit: "m" },
        ];
      case "lift":
        return [
          { key: "weekly_sessions", label: "Weekly sessions", unit: "/wk" },
          { key: "longest_session", label: "Longest session", unit: "hr" },
        ];
      default:
        return [];
    }
  })();

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
      {fields.map((f) => (
        <div key={f.key as string}>
          <label style={labelStyle}>{f.label}</label>
          <div style={{ position: "relative" }}>
            <input
              type="number"
              value={(volume?.[f.key] as number | null | undefined) ?? ""}
              onChange={(e) =>
                onChange({
                  ...(volume ?? {}),
                  [f.key]: e.target.value ? Number(e.target.value) : null,
                })
              }
              placeholder={summary ? formatPlaceholder(summary, f.key) : "—"}
              style={inputStyle}
            />
            <span
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 11,
                color: "var(--muted)",
                fontWeight: 600,
                pointerEvents: "none",
              }}
            >
              {f.unit}
            </span>
          </div>
          {summary && f.key === "weekly_miles" && (
            <p style={{ fontSize: 11, color: "var(--muted)", margin: "4px 0 0" }}>
              Synced: ~{summary.weekly_avg} {UNIT_LABELS[summary.unit]}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function formatPlaceholder(summary: SportLoadSummary, key: keyof CurrentVolume): string {
  if (key === "longest_session") return String(summary.longest_session);
  if (key === "peak_recent") return String(summary.weekly_peak);
  return String(summary.weekly_avg);
}
