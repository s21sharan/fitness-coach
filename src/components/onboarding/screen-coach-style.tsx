"use client";

import type {
  AthleteContextProfile,
  Aggressiveness,
  CoachSettings,
  ExplanationLevel,
  MissedWorkoutBehavior,
  PlanFlexibility,
} from "@/lib/onboarding/types";
import {
  AGGRESSIVENESS_OPTIONS,
  EXPLANATION_LEVELS,
  MISSED_WORKOUT_OPTIONS,
  PLAN_FLEXIBILITY_OPTIONS,
} from "@/lib/onboarding/types";
import { ChatCapture } from "./chat-capture";
import { labelStyle } from "./shared-styles";

interface ScreenCoachStyleProps {
  profile: AthleteContextProfile;
  onUpdate: (updates: Partial<AthleteContextProfile>) => void;
}

export const SCREEN_COACH_STYLE_TITLE = "How should your coach behave?";
export const SCREEN_COACH_STYLE_SUBTITLE =
  "These settings change how the AI nudges you week to week.";

export function ScreenCoachStyle({ profile, onUpdate }: ScreenCoachStyleProps) {
  const c = profile.coach;
  const set = (patch: Partial<CoachSettings>) => onUpdate({ coach: { ...c, ...patch } });

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 22 }}>
      <Section title="Aggressiveness">
        <Stack>
          {AGGRESSIVENESS_OPTIONS.map((opt) => (
            <RowButton
              key={opt.value}
              selected={c.aggressiveness === opt.value}
              onClick={() => {
                set({ aggressiveness: opt.value as Aggressiveness });
                onUpdate({ aggressiveness: opt.value as Aggressiveness });
              }}
              title={opt.label}
              description={opt.description}
            />
          ))}
        </Stack>
      </Section>

      <Section title="Explanation level">
        <Stack>
          {EXPLANATION_LEVELS.map((opt) => (
            <RowButton
              key={opt.value}
              selected={c.explanation_level === opt.value}
              onClick={() => set({ explanation_level: opt.value as ExplanationLevel })}
              title={opt.label}
            />
          ))}
        </Stack>
      </Section>

      <Section title="If you miss a workout">
        <Stack>
          {MISSED_WORKOUT_OPTIONS.map((opt) => (
            <RowButton
              key={opt.value}
              selected={c.missed_workout_behavior === opt.value}
              onClick={() => set({ missed_workout_behavior: opt.value as MissedWorkoutBehavior })}
              title={opt.label}
            />
          ))}
        </Stack>
      </Section>

      <Section title="Plan flexibility">
        <Stack>
          {PLAN_FLEXIBILITY_OPTIONS.map((opt) => (
            <RowButton
              key={opt.value}
              selected={c.plan_flexibility === opt.value}
              onClick={() => set({ plan_flexibility: opt.value as PlanFlexibility })}
              title={opt.label}
            />
          ))}
        </Stack>
      </Section>

      <ChatCapture
        profile={profile}
        onUpdate={onUpdate}
        insertion_point="coach_style"
        prompt="What coaching tone do you want? Encouraging? Direct? Data-heavy? Tell us in your words."
        placeholder={`e.g. "Direct, honest. Tell me when I should rest. Don't sugarcoat. I want to know the why."`}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ ...labelStyle, marginBottom: 10 }}>{title}</p>
      {children}
    </div>
  );
}

function Stack({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>;
}

function RowButton({
  selected,
  onClick,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: "12px 14px",
        borderRadius: "var(--r-md)",
        border: selected ? "2px solid var(--ink)" : "1.5px solid var(--line)",
        background: selected ? "var(--mint-soft)" : "#fff",
        color: "var(--ink)",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>{title}</p>
      {description && (
        <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--muted)" }}>{description}</p>
      )}
    </button>
  );
}
