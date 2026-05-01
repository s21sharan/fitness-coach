"use client";

import { useState, useEffect } from "react";
import type { OnboardingData } from "@/lib/onboarding/types";
import { generatePlanFromOnboarding } from "@/app/actions/training";
import type { DayLayout } from "@/lib/training/schemas";

interface StepSplitResultProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const SESSION_COLORS: Record<string, string> = {
  Rest: "bg-gray-50 text-gray-400",
  Push: "bg-green-50 text-green-700",
  Pull: "bg-green-50 text-green-700",
  Legs: "bg-green-50 text-green-700",
  "Upper Body": "bg-green-50 text-green-700",
  "Lower Body": "bg-green-50 text-green-700",
  "Full Body": "bg-green-50 text-green-700",
  "Chest + Back": "bg-green-50 text-green-700",
  "Shoulders + Arms": "bg-green-50 text-green-700",
};

function getSessionColor(sessionType: string): string {
  if (SESSION_COLORS[sessionType]) return SESSION_COLORS[sessionType];
  if (sessionType.toLowerCase().includes("run") || sessionType.toLowerCase().includes("ride")) {
    return "bg-blue-50 text-blue-700";
  }
  if (sessionType.toLowerCase().includes("swim")) {
    return "bg-indigo-50 text-indigo-700";
  }
  return "bg-white text-gray-700";
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
      <div className="flex flex-col items-center justify-center space-y-4 py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
        <p className="text-lg font-medium">Generating your personalized plan...</p>
        <p className="text-sm text-gray-500">Our AI coach is analyzing your goals and preferences</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
        <button
          type="button"
          onClick={() => setLoading(true)}
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!result) return null;

  const splitName = result.split_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Your AI-Generated Plan</h2>
        <p className="mt-1 text-gray-500">Personalized by our AI coach based on your goals.</p>
      </div>

      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-xl font-bold">{splitName}</h3>
        <p className="mt-2 text-gray-600">{result.reasoning}</p>
      </div>

      <div className="rounded-lg border bg-white p-6">
        <h3 className="mb-4 text-sm font-medium text-gray-500">Your Week</h3>
        <div className="grid grid-cols-7 gap-2">
          {result.weekly_layout.map((day, i) => (
            <div
              key={i}
              className={`flex flex-col items-center rounded-lg border p-3 ${getSessionColor(day.session_type)}`}
            >
              <span className="text-xs text-gray-500">{dayNames[day.day_of_week]}</span>
              <span className="mt-1 text-center text-xs font-medium">{day.session_type}</span>
              {day.ai_notes && (
                <span className="mt-1 text-center text-[10px] italic text-gray-400">{day.ai_notes}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
