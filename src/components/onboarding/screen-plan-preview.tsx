"use client";

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AthleteContextProfile,
  PlanPreviewDay,
  PlanPreviewWeek,
  PlanPreviewWeekBlock,
} from "@/lib/onboarding/types";
import { DAY_LABELS } from "@/lib/onboarding/types";

interface ScreenPlanPreviewProps {
  profile: AthleteContextProfile;
  onUpdate: (updates: Partial<AthleteContextProfile>) => void;
}

export const SCREEN_PLAN_PREVIEW_TITLE = "Your first block at a glance.";
export const SCREEN_PLAN_PREVIEW_SUBTITLE =
  "Coach drafted this from everything you've shared. Talk back below — coach will rewrite the schedule in real time.";

type CoachTurn =
  | { role: "user"; text: string }
  | { role: "coach"; narrative: string };

export function ScreenPlanPreview({ profile, onUpdate }: ScreenPlanPreviewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PlanPreviewWeek | null>(profile.plan_preview);
  const [scores, setScores] = useState<Record<string, string> | null>(null);
  const [feedback, setFeedback] = useState("");
  const [history, setHistory] = useState<CoachTurn[]>([]);
  const [activeWeek, setActiveWeek] = useState(1);
  const conversationRef = useRef<HTMLDivElement | null>(null);

  const weeks = profile.weeks_to_generate ?? 1;

  const generate = useCallback(
    async (params?: { feedback?: string; weeks?: number; prior?: PlanPreviewWeek | null }) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/coach/preview-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profile,
            weeks: params?.weeks ?? weeks,
            feedback: params?.feedback,
            prior_preview: params?.prior ?? preview,
          }),
        });
        if (!res.ok) throw new Error(`Plan preview failed (${res.status})`);
        const data = await res.json();
        const next: PlanPreviewWeek = data.preview;
        setPreview(next);
        setScores(data.scores ?? null);
        onUpdate({ plan_preview: next });
        if (params?.feedback) {
          setHistory((h) => [
            ...h,
            { role: "user", text: params.feedback as string },
            { role: "coach", narrative: next.narrative },
          ]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not generate preview");
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile, weeks, preview]
  );

  useEffect(() => {
    if (!preview) {
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [history]);

  const handleWeeksChange = (n: number) => {
    onUpdate({ weeks_to_generate: n });
    void generate({ weeks: n });
  };

  const handleSendFeedback = () => {
    const trimmed = feedback.trim();
    if (!trimmed) return;
    setFeedback("");
    void generate({ feedback: trimmed });
  };

  const currentWeekBlock: PlanPreviewWeekBlock | null = useMemo(() => {
    if (!preview?.weeks?.length) return null;
    return preview.weeks.find((w) => w.week_number === activeWeek) ?? preview.weeks[0];
  }, [preview, activeWeek]);

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 18 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Generate
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            {[1, 2, 3, 4].map((n) => {
              const selected = weeks === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleWeeksChange(n)}
                  disabled={loading}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 999,
                    border: selected ? "2px solid var(--ink)" : "1.5px solid var(--line)",
                    background: selected ? "var(--ink)" : "#fff",
                    color: selected ? "#fff" : "var(--ink)",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 800,
                    fontFamily: "inherit",
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {n} {n === 1 ? "week" : "weeks"}
                </button>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={() => generate()}
          disabled={loading}
          className="btn-ghost"
          style={{ fontSize: 12 }}
        >
          {loading ? "Generating…" : "Regenerate"}
        </button>
      </div>

      {error && <p style={{ color: "var(--coral-deep)", fontSize: 13, margin: 0 }}>{error}</p>}

      {loading && !preview && (
        <div style={{ padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
          Coach is drafting your block…
        </div>
      )}

      {preview && (
        <>
          <div
            style={{
              background: "#fff",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-lg)",
              padding: 18,
            }}
          >
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6 }}>
              {preview.narrative}
            </p>
          </div>

          {scores && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {Object.entries(scores).map(([k, v]) => (
                <span
                  key={k}
                  style={{
                    padding: "4px 10px",
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
                padding: 14,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "var(--ink)",
                }}
              >
                Risks to watch
              </p>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, color: "var(--ink-2)" }}>
                {preview.risks.map((r, i) => (
                  <li key={i} style={{ marginBottom: 3 }}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {preview.weeks.length > 1 && (
            <div style={{ display: "flex", gap: 6 }}>
              {preview.weeks.map((w) => {
                const selected = w.week_number === activeWeek;
                return (
                  <button
                    key={w.week_number}
                    type="button"
                    onClick={() => setActiveWeek(w.week_number)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 999,
                      border: selected ? "2px solid var(--ink)" : "1.5px solid var(--line)",
                      background: selected ? "var(--ink)" : "#fff",
                      color: selected ? "#fff" : "var(--ink)",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 800,
                      fontFamily: "inherit",
                    }}
                  >
                    Week {w.week_number}
                  </button>
                );
              })}
            </div>
          )}

          {currentWeekBlock && (
            <>
              {currentWeekBlock.week_focus && (
                <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>
                  Week {currentWeekBlock.week_number} focus: {currentWeekBlock.week_focus}
                </p>
              )}
              <CalendarGrid days={currentWeekBlock.days} />
            </>
          )}
        </>
      )}

      <CoachChat
        history={history}
        feedback={feedback}
        loading={loading}
        onChange={setFeedback}
        onSend={handleSendFeedback}
        ref={conversationRef}
      />
    </div>
  );
}

function CalendarGrid({ days }: { days: PlanPreviewDay[] }) {
  // Reorder by canonical DAY_LABELS order in case the LLM returns mixed
  const dayMap = new Map<string, PlanPreviewDay>(days.map((d) => [d.day_label, d]));
  const ordered = DAY_LABELS.map((label) => dayMap.get(label) ?? blankDay(label));

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
        gap: 8,
      }}
    >
      {ordered.map((day) => (
        <DayCell key={day.day_label} day={day} />
      ))}
    </div>
  );
}

function DayCell({ day }: { day: PlanPreviewDay }) {
  return (
    <div
      style={{
        background: day.is_rest ? "var(--bg-2)" : "#fff",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-md)",
        padding: 10,
        minHeight: 140,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--muted)",
        }}
      >
        {day.day_label}
      </p>

      {day.is_rest ? (
        <p style={{ margin: "auto 0", fontSize: 12, fontWeight: 700, color: "var(--muted)", textAlign: "center" }}>
          Rest
        </p>
      ) : (
        <>
          {day.am_session && (
            <SessionBlock label="AM" session={day.am_session.name} rationale={day.am_session.rationale ?? null} accent="mint-soft" />
          )}
          {day.pm_session && (
            <SessionBlock label="PM" session={day.pm_session.name} rationale={day.pm_session.rationale ?? null} accent="coral-soft" />
          )}
          {!day.am_session && !day.pm_session && (
            <p style={{ margin: "auto 0", fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
              Open
            </p>
          )}
        </>
      )}

      {day.notes && (
        <p style={{ margin: "auto 0 0", fontSize: 10, color: "var(--muted)", fontStyle: "italic" }}>
          {day.notes}
        </p>
      )}
    </div>
  );
}

function SessionBlock({
  label,
  session,
  rationale,
  accent,
}: {
  label: string;
  session: string;
  rationale: string | null;
  accent: "mint-soft" | "coral-soft";
}) {
  return (
    <div
      style={{
        background: `var(--${accent})`,
        borderRadius: "var(--r-sm)",
        padding: 6,
      }}
    >
      <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.08em" }}>
        {label}
      </p>
      <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 700, color: "var(--ink)", lineHeight: 1.3 }}>
        {session}
      </p>
      {rationale && (
        <p style={{ margin: "3px 0 0", fontSize: 10, color: "var(--ink-2)", lineHeight: 1.3 }}>
          {rationale}
        </p>
      )}
    </div>
  );
}

function blankDay(label: string): PlanPreviewDay {
  return {
    day_label: label,
    am_session: null,
    pm_session: null,
    is_rest: true,
    notes: null,
  };
}

interface CoachChatProps {
  history: CoachTurn[];
  feedback: string;
  loading: boolean;
  onChange: (v: string) => void;
  onSend: () => void;
}

const CoachChat = forwardRef<HTMLDivElement, CoachChatProps>(function CoachChat(
  { history, feedback, loading, onChange, onSend },
  ref
) {
  return (
      <div
        style={{
          background: "var(--bg-2)",
          borderRadius: "var(--r-lg)",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
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
          Chat with coach
        </p>

        {history.length > 0 && (
          <div
            ref={ref}
            style={{
              maxHeight: 220,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              paddingRight: 4,
            }}
          >
            {history.map((turn, i) => (
              <div
                key={i}
                style={{
                  background: turn.role === "user" ? "var(--coral-soft)" : "#fff",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--r-md)",
                  padding: 10,
                  fontSize: 12,
                  color: "var(--ink-2)",
                  alignSelf: turn.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  lineHeight: 1.5,
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  {turn.role === "user" ? "You" : "Coach"}
                </span>
                {turn.role === "user" ? turn.text : turn.narrative}
              </div>
            ))}
          </div>
        )}

        <textarea
          value={feedback}
          onChange={(e) => onChange(e.target.value)}
          placeholder='e.g. "Swap Thursday and Friday — I have a long meeting Thursday morning. Add an easy spin Wednesday."'
          rows={3}
          style={{
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-md)",
            padding: 12,
            fontSize: 13,
            fontFamily: "inherit",
            resize: "vertical",
            minHeight: 80,
            color: "var(--ink)",
            outline: "none",
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              onSend();
            }
          }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600 }}>
            Cmd/Ctrl + Enter to send
          </span>
          <button
            type="button"
            onClick={onSend}
            disabled={loading || !feedback.trim()}
            className="btn-ink"
            style={{ fontSize: 12, opacity: loading || !feedback.trim() ? 0.5 : 1 }}
          >
            {loading ? "Coach is working…" : "Update plan"}
          </button>
        </div>
      </div>
  );
});
