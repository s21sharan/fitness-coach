"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  type OnboardingData,
  type StepId,
  getDefaultOnboardingData,
  getVisibleSteps,
} from "@/lib/onboarding/types";
import { saveOnboardingData } from "./actions";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { StepProfile, STEP_PROFILE_TITLE, STEP_PROFILE_SUBTITLE } from "@/components/onboarding/step-profile";
import { StepBodyGoal, STEP_BODY_GOAL_TITLE, STEP_BODY_GOAL_SUBTITLE } from "@/components/onboarding/step-body-goal";
import { StepEmphasis, STEP_EMPHASIS_TITLE, STEP_EMPHASIS_SUBTITLE } from "@/components/onboarding/step-emphasis";
import { StepRace, STEP_RACE_TITLE, STEP_RACE_SUBTITLE } from "@/components/onboarding/step-race";
import { StepRaceDetails, STEP_RACE_DETAILS_TITLE, STEP_RACE_DETAILS_SUBTITLE } from "@/components/onboarding/step-race-details";
import { StepCardio, STEP_CARDIO_TITLE, STEP_CARDIO_SUBTITLE } from "@/components/onboarding/step-cardio";
import { StepExperience, STEP_EXPERIENCE_TITLE, STEP_EXPERIENCE_SUBTITLE } from "@/components/onboarding/step-experience";
import { StepAvailability, STEP_AVAILABILITY_TITLE, STEP_AVAILABILITY_SUBTITLE } from "@/components/onboarding/step-availability";
import { StepIntegrations, STEP_INTEGRATIONS_TITLE, STEP_INTEGRATIONS_SUBTITLE } from "@/components/onboarding/step-integrations";
import { StepSplitResult, STEP_SPLIT_RESULT_TITLE, STEP_SPLIT_RESULT_SUBTITLE } from "@/components/onboarding/step-split-result";

const stepComponents: Record<
  StepId,
  React.ComponentType<{ data: OnboardingData; onUpdate: (updates: Partial<OnboardingData>) => void }>
> = {
  profile: StepProfile,
  body_goal: StepBodyGoal,
  emphasis: StepEmphasis,
  race: StepRace,
  race_details: StepRaceDetails,
  cardio: StepCardio,
  experience: StepExperience,
  availability: StepAvailability,
  integrations: StepIntegrations,
  split_result: StepSplitResult,
};

const stepMeta: Record<StepId, { title: string; subtitle: string }> = {
  profile: { title: STEP_PROFILE_TITLE, subtitle: STEP_PROFILE_SUBTITLE },
  body_goal: { title: STEP_BODY_GOAL_TITLE, subtitle: STEP_BODY_GOAL_SUBTITLE },
  emphasis: { title: STEP_EMPHASIS_TITLE, subtitle: STEP_EMPHASIS_SUBTITLE },
  race: { title: STEP_RACE_TITLE, subtitle: STEP_RACE_SUBTITLE },
  race_details: { title: STEP_RACE_DETAILS_TITLE, subtitle: STEP_RACE_DETAILS_SUBTITLE },
  cardio: { title: STEP_CARDIO_TITLE, subtitle: STEP_CARDIO_SUBTITLE },
  experience: { title: STEP_EXPERIENCE_TITLE, subtitle: STEP_EXPERIENCE_SUBTITLE },
  availability: { title: STEP_AVAILABILITY_TITLE, subtitle: STEP_AVAILABILITY_SUBTITLE },
  integrations: { title: STEP_INTEGRATIONS_TITLE, subtitle: STEP_INTEGRATIONS_SUBTITLE },
  split_result: { title: STEP_SPLIT_RESULT_TITLE, subtitle: STEP_SPLIT_RESULT_SUBTITLE },
};

export default function OnboardingPage() {
  const router = useRouter();
  const [data, setData] = useState<OnboardingData>(getDefaultOnboardingData());
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleSteps = getVisibleSteps(data);
  const currentStepId = visibleSteps[stepIndex];
  const StepComponent = stepComponents[currentStepId];
  const meta = stepMeta[currentStepId];
  const isLastStep = stepIndex === visibleSteps.length - 1;
  const isFirstStep = stepIndex === 0;

  const handleUpdate = (updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const handleNext = async () => {
    if (isLastStep) {
      setSaving(true);
      setError(null);
      const result = await saveOnboardingData(data);
      setSaving(false);

      if (result.success) {
        router.push("/dashboard");
      } else {
        setError(result.error ?? "Something went wrong");
      }
      return;
    }

    const nextSteps = getVisibleSteps(data);
    const nextIndex = Math.min(stepIndex + 1, nextSteps.length - 1);
    setStepIndex(nextIndex);
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setStepIndex(stepIndex - 1);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Floating blobs */}
      <div
        className="blob"
        style={{
          top: -100,
          right: -80,
          width: 420,
          height: 420,
          background: "var(--coral)",
          animation: "float-1 8s ease-in-out infinite",
        }}
      />
      <div
        className="blob"
        style={{
          bottom: -80,
          left: -80,
          width: 360,
          height: 360,
          background: "var(--mint)",
          animation: "float-2 10s ease-in-out infinite",
        }}
      />

      {/* Top bar */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 32px 0",
        }}
      >
        {/* Brand mark */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: "var(--ink)",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 6px 14px rgba(15,27,34,0.18)",
              position: "relative",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "radial-gradient(circle at 70% 30%, rgba(246,183,166,0.6), transparent 60%)",
              }}
            />
            <svg width={16} height={16} viewBox="0 0 16 16" fill="none" style={{ position: "relative" }}>
              <path d="M3 12 L8 4 L13 12" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <circle cx={8} cy={8} r={1.5} fill="var(--coral)" />
            </svg>
          </div>
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-0.02em", color: "var(--ink)" }}>
            Hybro
          </span>
        </div>

        {/* Step counter */}
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--muted)",
          }}
        >
          Step {stepIndex + 1} of {visibleSteps.length}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ position: "relative", zIndex: 10, padding: "16px 32px 0" }}>
        <OnboardingProgress step={stepIndex} total={visibleSteps.length} />
      </div>

      {/* Center content */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 32px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 680 }}>
          {/* Title + subtitle */}
          <div style={{ marginBottom: 32, textAlign: "center" }}>
            <h1
              style={{
                margin: 0,
                fontSize: 32,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: "var(--ink)",
                lineHeight: 1.2,
              }}
            >
              {meta.title}
            </h1>
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 16,
                color: "var(--muted)",
                fontWeight: 500,
                lineHeight: 1.5,
              }}
            >
              {meta.subtitle}
            </p>
          </div>

          {/* Step content */}
          <StepComponent data={data} onUpdate={handleUpdate} />
        </div>
      </div>

      {/* Frosted glass footer */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          background: "rgba(255,255,255,0.55)",
          backdropFilter: "blur(12px)",
          borderTop: "1px solid var(--line)",
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Back button */}
        {!isFirstStep ? (
          <button
            type="button"
            onClick={handleBack}
            className="btn-ghost"
          >
            ← Back
          </button>
        ) : (
          <div />
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {error && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--coral-deep)", fontWeight: 600 }}>
              {error}
            </p>
          )}

          {/* Continue / Finish button */}
          <button
            type="button"
            onClick={handleNext}
            disabled={saving}
            className="btn-ink"
            style={{ opacity: saving ? 0.5 : 1 }}
          >
            {saving ? "Saving…" : isLastStep ? "Finish →" : "Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}
