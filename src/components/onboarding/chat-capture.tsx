"use client";

import { useState } from "react";
import type {
  AthleteContextProfile,
  ChatInsertionPoint,
  ChatNote,
  ExtractedChatTags,
} from "@/lib/onboarding/types";

interface ChatCaptureProps {
  profile: AthleteContextProfile;
  onUpdate: (updates: Partial<AthleteContextProfile>) => void;
  insertion_point: ChatInsertionPoint;
  prompt: string;
  placeholder: string;
}

export function ChatCapture({
  profile,
  onUpdate,
  insertion_point,
  prompt,
  placeholder,
}: ChatCaptureProps) {
  const existing = profile.chat_notes.find((n) => n.insertion_point === insertion_point);
  const [text, setText] = useState(existing?.raw_text ?? "");
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedChatTags | null>(existing?.extracted ?? null);

  const handleSend = async () => {
    if (!text.trim()) return;
    setExtracting(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insertion_point,
          raw_text: text.trim(),
          context: {
            primary_goal: profile.primary_optimization,
            aggressiveness: profile.aggressiveness,
            athlete_identity: profile.athlete_identity,
            sports_planned: Object.values(profile.sports)
              .filter((s) => s.is_planned)
              .map((s) => s.sport),
          },
        }),
      });
      if (!res.ok) throw new Error(`Coach extraction failed (${res.status})`);
      const data = await res.json();
      const next: ExtractedChatTags = data.extracted ?? {};
      setExtracted(next);

      const note: ChatNote = {
        insertion_point,
        raw_text: text.trim(),
        extracted: next,
      };
      const others = profile.chat_notes.filter((n) => n.insertion_point !== insertion_point);
      onUpdate({ chat_notes: [...others, note] });

      // If availability extract returned rule keys, append them as availability rules
      if (insertion_point === "availability" && Array.isArray(next.rules)) {
        const existingKeys = new Set(profile.availability_rules.map((r) => r.rule_key));
        const newRules = next.rules
          .filter((k) => !existingKeys.has(k))
          .map((k) => ({
            id: `rule-${k}-${Math.random().toString(36).slice(2, 7)}`,
            rule_key: k,
            params: null,
          }));
        if (newRules.length > 0) {
          onUpdate({
            availability_rules: [...profile.availability_rules, ...newRules],
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div
      style={{
        background: "var(--coral-soft)",
        borderRadius: "var(--r-lg)",
        padding: 18,
        border: "1px solid var(--coral)",
      }}
    >
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
        💬 Coach prompt
      </p>
      <p style={{ margin: "6px 0 12px", fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
        {prompt}
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={3}
        style={{
          width: "100%",
          padding: 12,
          borderRadius: "var(--r-md)",
          border: "1.5px solid var(--line)",
          background: "#fff",
          fontFamily: "inherit",
          fontSize: 13,
          fontWeight: 500,
          color: "var(--ink)",
          resize: "vertical",
          minHeight: 80,
          outline: "none",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 12 }}>
        <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>
          {extracting ? "Coach is reading…" : "Optional. Hit send to capture your nuance."}
        </p>
        <button
          type="button"
          onClick={handleSend}
          disabled={extracting || !text.trim()}
          className="btn-ink"
          style={{ opacity: extracting || !text.trim() ? 0.4 : 1 }}
        >
          {extracting ? "…" : "Send to coach"}
        </button>
      </div>

      {error && (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--coral-deep)", fontWeight: 600 }}>
          {error}
        </p>
      )}

      {extracted && (
        <ExtractedTags extracted={extracted} />
      )}
    </div>
  );
}

function ExtractedTags({ extracted }: { extracted: ExtractedChatTags }) {
  const chips: { label: string; bg: string }[] = [];
  for (const c of extracted.constraints ?? []) chips.push({ label: c, bg: "var(--sky-soft)" });
  for (const c of extracted.conflicts ?? []) chips.push({ label: `⚠ ${c}`, bg: "var(--lemon)" });
  for (const c of extracted.hidden_risks ?? []) chips.push({ label: `risk: ${c}`, bg: "var(--coral)" });
  for (const c of extracted.goals ?? []) chips.push({ label: `goal: ${c}`, bg: "var(--mint-soft)" });
  if (extracted.tone) chips.push({ label: `tone: ${extracted.tone}`, bg: "var(--lilac)" });

  if (chips.length === 0) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
      {chips.map((chip, i) => (
        <span
          key={i}
          style={{
            padding: "5px 10px",
            borderRadius: 999,
            background: chip.bg,
            fontSize: 11,
            fontWeight: 600,
            color: "var(--ink)",
          }}
        >
          {chip.label}
        </span>
      ))}
    </div>
  );
}
