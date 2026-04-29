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
import { StepProfile } from "@/components/onboarding/step-profile";
import { StepBodyGoal } from "@/components/onboarding/step-body-goal";
import { StepEmphasis } from "@/components/onboarding/step-emphasis";
import { StepRace } from "@/components/onboarding/step-race";
import { StepRaceDetails } from "@/components/onboarding/step-race-details";
import { StepCardio } from "@/components/onboarding/step-cardio";
import { StepExperience } from "@/components/onboarding/step-experience";
import { StepAvailability } from "@/components/onboarding/step-availability";
import { StepIntegrations } from "@/components/onboarding/step-integrations";
import { StepSplitResult } from "@/components/onboarding/step-split-result";

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

export default function OnboardingPage() {
  const router = useRouter();
  const [data, setData] = useState<OnboardingData>(getDefaultOnboardingData());
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleSteps = getVisibleSteps(data);
  const currentStepId = visibleSteps[stepIndex];
  const StepComponent = stepComponents[currentStepId];
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
    <div className="space-y-8">
      <OnboardingProgress
        currentStep={stepIndex + 1}
        totalSteps={visibleSteps.length}
      />

      <StepComponent data={data} onUpdate={handleUpdate} />

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={handleBack}
          disabled={isFirstStep}
          className="rounded-lg border border-gray-300 px-6 py-2 font-medium disabled:opacity-30"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={saving}
          className="rounded-lg bg-black px-6 py-2 font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? "Saving..." : isLastStep ? "Finish" : "Next"}
        </button>
      </div>
    </div>
  );
}
