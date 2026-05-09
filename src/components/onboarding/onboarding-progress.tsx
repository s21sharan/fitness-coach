"use client";

interface OnboardingProgressProps {
  step: number;   // 0-indexed current step
  total: number;
}

export function OnboardingProgress({ step, total }: OnboardingProgressProps) {
  return (
    <div style={{ display: "flex", gap: 5, width: "100%" }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 5,
            borderRadius: 3,
            background:
              i < step
                ? "var(--ink)"
                : i === step
                ? "var(--coral)"
                : "var(--line)",
            transition: "background 0.3s",
          }}
        />
      ))}
    </div>
  );
}
