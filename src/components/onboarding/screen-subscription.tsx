"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AthleteContextProfile } from "@/lib/onboarding/types";

interface ScreenSubscriptionProps {
  profile: AthleteContextProfile;
  onUpdate: (updates: Partial<AthleteContextProfile>) => void;
}

export const SCREEN_SUBSCRIPTION_TITLE = "Start your free trial";
export const SCREEN_SUBSCRIPTION_SUBTITLE =
  "3 days free, then $11.99/mo. Cancel anytime.";

const FEATURES = [
  "AI coaching tailored to your goals",
  "Personalized training plans",
  "Unified dashboard across all your apps",
  "Recovery insights from wearable data",
  "Nutrition tracking and guidance",
];

export function ScreenSubscription({ }: ScreenSubscriptionProps) {
  const searchParams = useSearchParams();
  const checkoutStatus = searchParams.get("checkout");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartTrial = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnUrl: "/onboarding?step=subscription",
          includeTrial: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || "Failed to create checkout session");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  // Success state — user returned from Stripe checkout
  if (checkoutStatus === "success") {
    return (
      <div
        style={{
          maxWidth: 480,
          margin: "0 auto",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          textAlign: "center",
          padding: "40px 0",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "var(--mint-soft)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <svg width={32} height={32} viewBox="0 0 24 24" fill="none">
            <path
              d="M5 13l4 4L19 7"
              stroke="var(--mint-deep)"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--ink)",
          }}
        >
          You&apos;re all set!
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 15,
            color: "var(--muted)",
            fontWeight: 500,
            lineHeight: 1.5,
          }}
        >
          Your 3-day free trial has started. Click Continue to head to your
          dashboard.
        </p>
      </div>
    );
  }

  // Default state — show pricing card + start trial button
  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      {/* Price card */}
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 16,
          padding: "32px 28px",
          border: "1px solid var(--line, rgba(0,0,0,0.06))",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 40,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--ink)",
            lineHeight: 1.1,
          }}
        >
          $11.99
          <span
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "var(--muted)",
              marginLeft: 4,
            }}
          >
            /mo
          </span>
        </div>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 14,
            color: "var(--muted)",
            fontWeight: 500,
          }}
        >
          after your 3-day free trial
        </p>
      </div>

      {/* Feature list */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          padding: "0 4px",
        }}
      >
        {FEATURES.map((feature) => (
          <div
            key={feature}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "var(--mint-soft)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 13l4 4L19 7"
                  stroke="var(--mint-deep)"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span
              style={{
                fontSize: 15,
                fontWeight: 500,
                color: "var(--ink)",
              }}
            >
              {feature}
            </span>
          </div>
        ))}
      </div>

      {/* CTA button */}
      <button
        type="button"
        onClick={handleStartTrial}
        disabled={loading}
        style={{
          width: "100%",
          padding: "14px 24px",
          borderRadius: 12,
          border: "none",
          background: "var(--coral-deep)",
          color: "#fff",
          fontSize: 16,
          fontWeight: 700,
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1,
          transition: "opacity 150ms",
        }}
      >
        {loading ? "Redirecting to checkout..." : "Start Free Trial"}
      </button>

      {/* Error message */}
      {error && (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "var(--coral-deep)",
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
