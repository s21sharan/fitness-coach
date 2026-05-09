"use client";

import { useState, useEffect } from "react";
import type { OnboardingData } from "@/lib/onboarding/types";
import { generatePlanFromOnboarding } from "@/app/actions/training";
import type { DayLayout } from "@/lib/training/schemas";

interface StepSplitResultProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

export const STEP_SPLIT_RESULT_TITLE = "Here's your starting split.";
export const STEP_SPLIT_RESULT_SUBTITLE = "Built around your goals, schedule, and experience level.";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getDayStyle(sessionType: string): React.CSSProperties {
  const lower = sessionType.toLowerCase();
  if (sessionType === "Rest") {
    return { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" };
  }
  if (lower.includes("push") || lower.includes("chest") || lower.includes("shoulders")) {
    return { background: "var(--coral)", color: "var(--ink)" };
  }
  if (lower.includes("pull") || lower.includes("back")) {
    return { background: "var(--mint)", color: "var(--ink)" };
  }
  if (lower.includes("leg") || lower.includes("lower")) {
    return { background: "var(--sky)", color: "var(--ink)" };
  }
  if (lower.includes("run") || lower.includes("ride") || lower.includes("swim")) {
    return { background: "var(--lemon)", color: "var(--ink)" };
  }
  if (lower.includes("upper") || lower.includes("full")) {
    return { background: "var(--lilac)", color: "var(--ink)" };
  }
  return { background: "rgba(255,255,255,0.15)", color: "#fff" };
}

export function StepSplitResult({ data }: StepSplitResultProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    split_type: string;
    reasoning: string;
    weekly_layout: DayLayout[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function generate() {
      setLoading(true);
      setError(null);

      const res = await generatePlanFromOnboarding(data);

      if (cancelled) return;

      if (res.success && res.plan) {
        setResult({
          split_type: res.plan.split_type,
          reasoning: res.plan.reasoning,
          weekly_layout: res.plan.weekly_layout,
        });
      } else {
        setError(res.error || "Failed to generate plan");
      }
      setLoading(false);
    }

    generate();
    return () => { cancelled = true; };
  }, [data]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          padding: "48px 0",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "3px solid rgba(255,255,255,0.2)",
            borderTopColor: "var(--coral)",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
          Generating your personalized plan…
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
          Our AI coach is analyzing your goals and preferences
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "32px 0" }}>
        <p style={{ color: "var(--coral-deep)", marginBottom: 16, fontWeight: 600 }}>{error}</p>
        <button
          type="button"
          onClick={() => setLoading(true)}
          className="btn-ghost"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!result) return null;

  const splitName = result.split_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", width: "100%" }}>
      {/* Dark card */}
      <div
        style={{
          position: "relative",
          background: "var(--ink)",
          borderRadius: "var(--r-xl)",
          padding: "32px",
          overflow: "hidden",
        }}
      >
        {/* Blobs inside dark card */}
        <div
          style={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 180,
            height: 180,
            borderRadius: "50%",
            background: "var(--coral)",
            opacity: 0.18,
            filter: "blur(50px)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -30,
            left: -30,
            width: 150,
            height: 150,
            borderRadius: "50%",
            background: "var(--sky)",
            opacity: 0.18,
            filter: "blur(50px)",
            pointerEvents: "none",
          }}
        />

        {/* Eyebrow */}
        <p
          style={{
            margin: "0 0 8px",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--coral)",
          }}
        >
          Recommended split
        </p>

        {/* Split name */}
        <h3
          style={{
            margin: "0 0 16px",
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "#fff",
          }}
        >
          {splitName}
        </h3>

        {/* Reasoning */}
        <p
          style={{
            margin: "0 0 28px",
            fontSize: 14,
            lineHeight: 1.6,
            color: "rgba(255,255,255,0.6)",
          }}
        >
          {result.reasoning}
        </p>

        {/* Week grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 6,
          }}
        >
          {result.weekly_layout.map((day, i) => {
            const dayStyle = getDayStyle(day.session_type);
            return (
              <div
                key={i}
                style={{
                  borderRadius: 10,
                  padding: "10px 4px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  ...dayStyle,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    opacity: 0.7,
                  }}
                >
                  {DAY_NAMES[day.day_of_week]}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    textAlign: "center",
                    lineHeight: 1.2,
                  }}
                >
                  {day.session_type}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
