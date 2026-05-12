"use client";

import { useCallback, useEffect, useState } from "react";
import type { AthleteContextProfile, PlanPreviewWeek } from "@/lib/onboarding/types";
import { ChatCapture } from "./chat-capture";

interface ScreenPlanPreviewProps {
  profile: AthleteContextProfile;
  onUpdate: (updates: Partial<AthleteContextProfile>) => void;
}

export const SCREEN_PLAN_PREVIEW_TITLE = "Here's your first week.";
export const SCREEN_PLAN_PREVIEW_SUBTITLE =
  "Coach generated this from everything you've told us. Anything you'd change before we lock it in?";

export function ScreenPlanPreview({ profile, onUpdate }: ScreenPlanPreviewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PlanPreviewWeek | null>(profile.plan_preview);
  const [scores, setScores] = useState<Record<string, string> | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/preview-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      if (!res.ok) throw new Error(`Plan preview failed (${res.status})`);
      const data = await res.json();
      const next: PlanPreviewWeek = data.preview;
      setPreview(next);
      setScores(data.scores ?? null);
      onUpdate({ plan_preview: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate preview");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!preview) generate();
  }, [generate, preview]);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="btn-ghost"
          style={{ fontSize: 12 }}
        >
          {loading ? "Generating…" : "Regenerate"}
        </button>
      </div>

      {error && (
        <p style={{ color: "var(--coral-deep)", fontSize: 13, margin: 0 }}>{error}</p>
      )}

      {loading && !preview && (
        <div style={{ padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
          Coach is drafting your first week…
        </div>
      )}

      {preview && (
        <>
          <div
            style={{
              background: "#fff",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-lg)",
              padding: 20,
            }}
          >
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6 }}>
              {preview.narrative}
            </p>
          </div>

          {scores && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {Object.entries(scores).map(([k, v]) => (
                <span
                  key={k}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 999,
                    background: "var(--sky-soft)",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--ink)",
                  }}
                >
                  {k.replace(/_/g, " ")}: {v}
                </span>
              ))}
            </div>
          )}

          {preview.risks.length > 0 && (
            <div
              style={{
                background: "var(--lemon)",
                borderRadius: "var(--r-lg)",
                padding: 16,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "var(--ink)",
                }}
              >
                Risks to watch
              </p>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13, color: "var(--ink-2)" }}>
                {preview.risks.map((r, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "var(--muted)",
              }}
            >
              First week
            </p>
            {preview.first_week.map((day) => (
              <div
                key={day.day_label}
                style={{
                  background: "#fff",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--r-md)",
                  padding: 14,
                  display: "grid",
                  gridTemplateColumns: "56px 1fr",
                  gap: 14,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  {day.day_label}
                </span>
                <div>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: "var(--ink)" }}>
                    {day.session}
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                    {day.rationale}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <ChatCapture
        profile={profile}
        onUpdate={onUpdate}
        insertion_point="plan_preview"
        prompt="Want anything changed? Move sessions, drop something, add intensity — tell coach in your words."
        placeholder='e.g. "Swap Thursday and Friday, I have a heavy meeting Thursday morning. Drop one easy run."'
      />
    </div>
  );
}
