"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type AthleteContextProfile,
  type StepId,
  getDefaultAthleteProfile,
  getVisibleSteps,
} from "@/lib/onboarding/types";
import {
  commitOnboardingData,
  getOnboardingDraft,
  saveOnboardingDraft,
} from "./actions";
import { weekAnchorMondayYmdFromLocalDate } from "@/lib/dates/local-calendar";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";

import { ScreenWelcome, SCREEN_WELCOME_TITLE, SCREEN_WELCOME_SUBTITLE } from "@/components/onboarding/screen-welcome";
import { ScreenConnect, SCREEN_CONNECT_TITLE, SCREEN_CONNECT_SUBTITLE } from "@/components/onboarding/screen-connect";
import { ScreenSports, SCREEN_SPORTS_TITLE, SCREEN_SPORTS_SUBTITLE } from "@/components/onboarding/screen-sports";
import { ScreenIdentity, SCREEN_IDENTITY_TITLE, SCREEN_IDENTITY_SUBTITLE } from "@/components/onboarding/screen-identity";
import { ScreenGoals, SCREEN_GOALS_TITLE, SCREEN_GOALS_SUBTITLE } from "@/components/onboarding/screen-goals";
import { ScreenEvents, SCREEN_EVENTS_TITLE, SCREEN_EVENTS_SUBTITLE } from "@/components/onboarding/screen-events";
import { ScreenStrength, SCREEN_STRENGTH_TITLE, SCREEN_STRENGTH_SUBTITLE } from "@/components/onboarding/screen-strength";
import { ScreenBodyNutrition, SCREEN_BODY_NUTRITION_TITLE, SCREEN_BODY_NUTRITION_SUBTITLE } from "@/components/onboarding/screen-body-nutrition";
import { ScreenAvailability, SCREEN_AVAILABILITY_TITLE, SCREEN_AVAILABILITY_SUBTITLE } from "@/components/onboarding/screen-availability";
import { ScreenRecovery, SCREEN_RECOVERY_TITLE, SCREEN_RECOVERY_SUBTITLE } from "@/components/onboarding/screen-recovery";
import { ScreenInjury, SCREEN_INJURY_TITLE, SCREEN_INJURY_SUBTITLE } from "@/components/onboarding/screen-injury";
import { ScreenEquipment, SCREEN_EQUIPMENT_TITLE, SCREEN_EQUIPMENT_SUBTITLE } from "@/components/onboarding/screen-equipment";
import { ScreenCoachStyle, SCREEN_COACH_STYLE_TITLE, SCREEN_COACH_STYLE_SUBTITLE } from "@/components/onboarding/screen-coach-style";
import { ScreenPlanPreview, SCREEN_PLAN_PREVIEW_TITLE, SCREEN_PLAN_PREVIEW_SUBTITLE } from "@/components/onboarding/screen-plan-preview";

type ScreenProps = {
  profile: AthleteContextProfile;
  onUpdate: (updates: Partial<AthleteContextProfile>) => void;
};

const SCREENS: Record<StepId, { Component: React.ComponentType<ScreenProps>; title: string; subtitle: string }> = {
  welcome: { Component: ScreenWelcome, title: SCREEN_WELCOME_TITLE, subtitle: SCREEN_WELCOME_SUBTITLE },
  connect: { Component: ScreenConnect, title: SCREEN_CONNECT_TITLE, subtitle: SCREEN_CONNECT_SUBTITLE },
  sports: { Component: ScreenSports, title: SCREEN_SPORTS_TITLE, subtitle: SCREEN_SPORTS_SUBTITLE },
  identity: { Component: ScreenIdentity, title: SCREEN_IDENTITY_TITLE, subtitle: SCREEN_IDENTITY_SUBTITLE },
  goals: { Component: ScreenGoals, title: SCREEN_GOALS_TITLE, subtitle: SCREEN_GOALS_SUBTITLE },
  events: { Component: ScreenEvents, title: SCREEN_EVENTS_TITLE, subtitle: SCREEN_EVENTS_SUBTITLE },
  strength: { Component: ScreenStrength, title: SCREEN_STRENGTH_TITLE, subtitle: SCREEN_STRENGTH_SUBTITLE },
  body_nutrition: { Component: ScreenBodyNutrition, title: SCREEN_BODY_NUTRITION_TITLE, subtitle: SCREEN_BODY_NUTRITION_SUBTITLE },
  availability: { Component: ScreenAvailability, title: SCREEN_AVAILABILITY_TITLE, subtitle: SCREEN_AVAILABILITY_SUBTITLE },
  recovery: { Component: ScreenRecovery, title: SCREEN_RECOVERY_TITLE, subtitle: SCREEN_RECOVERY_SUBTITLE },
  injury: { Component: ScreenInjury, title: SCREEN_INJURY_TITLE, subtitle: SCREEN_INJURY_SUBTITLE },
  equipment: { Component: ScreenEquipment, title: SCREEN_EQUIPMENT_TITLE, subtitle: SCREEN_EQUIPMENT_SUBTITLE },
  coach_style: { Component: ScreenCoachStyle, title: SCREEN_COACH_STYLE_TITLE, subtitle: SCREEN_COACH_STYLE_SUBTITLE },
  plan_preview: { Component: ScreenPlanPreview, title: SCREEN_PLAN_PREVIEW_TITLE, subtitle: SCREEN_PLAN_PREVIEW_SUBTITLE },
};

export default function OnboardingPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <OnboardingFlow />
    </Suspense>
  );
}

function OnboardingFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [profile, setProfile] = useState<AthleteContextProfile>(() => getDefaultAthleteProfile());
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastSavedRef = useRef<string>("");
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate draft on mount
  useEffect(() => {
    let cancelled = false;
    getOnboardingDraft()
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.profile) {
          setProfile(mergeWithDefaults(res.profile));
          if (res.step && !searchParams.get("step")) {
            router.replace(`/onboarding?step=${res.step}`);
          }
        }
        setHydrated(true);
      })
      .catch(() => setHydrated(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => getVisibleSteps(profile), [profile]);
  const currentStep: StepId = useMemo(() => {
    const raw = searchParams.get("step");
    if (raw && (visible as string[]).includes(raw)) return raw as StepId;
    return visible[0];
  }, [visible, searchParams]);
  const stepIndex = visible.indexOf(currentStep);
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === visible.length - 1;

  const screen = SCREENS[currentStep];
  const ScreenComponent = screen.Component;

  // Autosave debounced
  useEffect(() => {
    if (!hydrated) return;
    const serialized = JSON.stringify(profile);
    if (serialized === lastSavedRef.current) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      lastSavedRef.current = serialized;
      saveOnboardingDraft(profile, currentStep).catch(() => {});
    }, 800);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [profile, hydrated, currentStep]);

  const handleUpdate = useCallback((updates: Partial<AthleteContextProfile>) => {
    setProfile((prev) => ({ ...prev, ...updates }));
  }, []);

  const goToStep = useCallback(
    (step: StepId) => {
      router.replace(`/onboarding?step=${step}`);
    },
    [router]
  );

  const handleNext = async () => {
    setError(null);
    if (isLast) {
      setSaving(true);
      try {
        const res = await commitOnboardingData(profile, {
          calendarWeekAnchorYmd: weekAnchorMondayYmdFromLocalDate(new Date()),
          calendarTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        if (!res.success) {
          setError(res.error ?? "Couldn't save your profile");
          return;
        }
        router.push("/dashboard");
      } finally {
        setSaving(false);
      }
      return;
    }
    // After updates, recompute visible steps and advance
    const updatedVisible = getVisibleSteps(profile);
    const updatedIdx = updatedVisible.indexOf(currentStep);
    const next = updatedVisible[updatedIdx + 1];
    if (next) goToStep(next);
  };

  const handleBack = () => {
    if (isFirst) return;
    const prev = visible[stepIndex - 1];
    if (prev) goToStep(prev);
  };

  if (!hydrated) return <LoadingScreen />;

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
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>
          Step {stepIndex + 1} of {visible.length}
        </span>
      </div>

      <div style={{ position: "relative", zIndex: 10, padding: "16px 32px 0" }}>
        <OnboardingProgress step={stepIndex} total={visible.length} />
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 10,
          flex: 1,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "32px 32px 120px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 760 }}>
          <div style={{ marginBottom: 24, textAlign: "center" }}>
            <h1
              style={{
                margin: 0,
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: "var(--ink)",
                lineHeight: 1.2,
              }}
            >
              {screen.title}
            </h1>
            <p
              style={{
                margin: "10px auto 0",
                fontSize: 15,
                color: "var(--muted)",
                fontWeight: 500,
                lineHeight: 1.5,
                maxWidth: 580,
              }}
            >
              {screen.subtitle}
            </p>
          </div>

          <ScreenComponent profile={profile} onUpdate={handleUpdate} />
        </div>
      </div>

      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 20,
          background: "rgba(255,255,255,0.7)",
          backdropFilter: "blur(12px)",
          borderTop: "1px solid var(--line)",
          padding: "14px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {!isFirst ? (
          <button type="button" onClick={handleBack} className="btn-ghost">
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
          <button
            type="button"
            onClick={handleNext}
            disabled={saving}
            className="btn-ink"
            style={{ opacity: saving ? 0.5 : 1 }}
          >
            {saving ? "Saving…" : isLast ? "Finish →" : "Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--muted)",
        fontSize: 13,
      }}
    >
      Loading…
    </div>
  );
}

function mergeWithDefaults(p: AthleteContextProfile): AthleteContextProfile {
  const defaults = getDefaultAthleteProfile();
  return {
    ...defaults,
    ...p,
    basic: { ...defaults.basic, ...(p.basic ?? {}) },
    sports: { ...defaults.sports, ...(p.sports ?? {}) },
    body_nutrition: { ...defaults.body_nutrition, ...(p.body_nutrition ?? {}) },
    recovery: { ...defaults.recovery, ...(p.recovery ?? {}) },
    preferences: { ...defaults.preferences, ...(p.preferences ?? {}) },
    coach: { ...defaults.coach, ...(p.coach ?? {}) },
    availability_windows: (p.availability_windows ?? []).map((w) => ({
      session_count: 1,
      ...w,
    })),
    availability_rules: p.availability_rules ?? [],
    events: p.events ?? [],
    injuries: (p.injuries ?? []).map((i) => ({
      description: null,
      ...i,
    })),
    equipment: p.equipment ?? [],
    chat_notes: p.chat_notes ?? [],
    goal_keys: p.goal_keys ?? [],
    goal_rank: p.goal_rank ?? [],
    weeks_to_generate: p.weeks_to_generate ?? defaults.weeks_to_generate,
  };
}
