"use client";

import type { AthleteContextProfile, Experience } from "@/lib/onboarding/types";
import { ATHLETE_IDENTITIES } from "@/lib/onboarding/types";
import { OptionCard } from "./option-card";

interface ScreenIdentityProps {
  profile: AthleteContextProfile;
  onUpdate: (updates: Partial<AthleteContextProfile>) => void;
}

export const SCREEN_IDENTITY_TITLE = "Which sounds most like you?";
export const SCREEN_IDENTITY_SUBTITLE =
  "This sets default coaching assumptions — you can still override them on the next screens.";

const EXPERIENCE_OPTIONS: { value: Experience; label: string; description: string }[] = [
  { value: "beginner", label: "Beginner", description: "< 1 year consistent training" },
  { value: "intermediate", label: "Intermediate", description: "1-3 years consistent" },
  { value: "advanced", label: "Advanced", description: "3+ years consistent" },
];

export function ScreenIdentity({ profile, onUpdate }: ScreenIdentityProps) {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 22 }}>
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
          Identity
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {ATHLETE_IDENTITIES.map((opt) => (
            <OptionCard
              key={opt.value}
              label={opt.label}
              sub={opt.description}
              selected={profile.athlete_identity === opt.value}
              color="coral"
              onClick={() => onUpdate({ athlete_identity: opt.value })}
            />
          ))}
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
          Training experience
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {EXPERIENCE_OPTIONS.map((opt) => (
            <OptionCard
              key={opt.value}
              label={opt.label}
              sub={opt.description}
              selected={profile.basic.training_experience === opt.value}
              color="mint"
              onClick={() =>
                onUpdate({
                  basic: { ...profile.basic, training_experience: opt.value },
                })
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
