"use client";

import type { AthleteContextProfile, GoalKey } from "@/lib/onboarding/types";
import { GOAL_OPTIONS, PRIMARY_GOALS } from "@/lib/onboarding/types";
import { GoalRanker } from "./goal-ranker";
import { ChatCapture } from "./chat-capture";

interface ScreenGoalsProps {
  profile: AthleteContextProfile;
  onUpdate: (updates: Partial<AthleteContextProfile>) => void;
}

export const SCREEN_GOALS_TITLE = "What are you optimizing for?";
export const SCREEN_GOALS_SUBTITLE =
  "Pick the goals that matter most right now, drag to rank them, then choose the one thing we should never sacrifice.";

const MAX_RANKED = 5;

export function ScreenGoals({ profile, onUpdate }: ScreenGoalsProps) {
  const toggleGoal = (key: GoalKey) => {
    const exists = profile.goal_keys.includes(key);
    if (exists) {
      onUpdate({
        goal_keys: profile.goal_keys.filter((g) => g !== key),
        goal_rank: profile.goal_rank.filter((g) => g !== key),
      });
    } else {
      const goal_keys = [...profile.goal_keys, key];
      const goal_rank =
        profile.goal_rank.length < MAX_RANKED
          ? [...profile.goal_rank, key]
          : profile.goal_rank;
      onUpdate({ goal_keys, goal_rank });
    }
  };

  return (
    <div style={{ maxWidth: 660, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 22 }}>
      <div>
        <p
          style={{
            margin: "0 0 10px",
            fontSize: 11,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--muted)",
          }}
        >
          What matters in the next 3-6 months
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {GOAL_OPTIONS.map((opt) => {
            const selected = profile.goal_keys.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleGoal(opt.value)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: selected ? "2px solid var(--ink)" : "1.5px solid var(--line)",
                  background: selected ? "var(--ink)" : "#fff",
                  color: selected ? "#fff" : "var(--ink)",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>{opt.emoji}</span>
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p
          style={{
            margin: "0 0 10px",
            fontSize: 11,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--muted)",
          }}
        >
          Rank your top {Math.min(profile.goal_rank.length, MAX_RANKED) || ""} goals (drag)
        </p>
        <GoalRanker rank={profile.goal_rank} onChange={(r) => onUpdate({ goal_rank: r })} />
      </div>

      <div>
        <p
          style={{
            margin: "0 0 10px",
            fontSize: 11,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--muted)",
          }}
        >
          If we had to optimize one thing
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {PRIMARY_GOALS.map((opt) => {
            const selected = profile.primary_optimization === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onUpdate({ primary_optimization: opt.value })}
                style={{
                  padding: "14px 16px",
                  borderRadius: "var(--r-lg)",
                  border: selected ? "2px solid var(--ink)" : "1.5px solid var(--line)",
                  background: selected ? "var(--coral-soft)" : "#fff",
                  color: "var(--ink)",
                  textAlign: "left",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>{opt.label}</p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                  {opt.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <ChatCapture
        profile={profile}
        onUpdate={onUpdate}
        insertion_point="goals"
        prompt='Tell your coach anything important about these goals. "I want X but worry about Y" notes are especially useful.'
        placeholder={`e.g. "Sub-4 marathon but I don't want to lose muscle. Swimming is my limiter."`}
      />
    </div>
  );
}
