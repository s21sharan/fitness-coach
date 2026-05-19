"use client";

import { useState } from "react";
import { humanize } from "@/lib/athlete-context/format";

const CATEGORY_HINT: Record<string, string> = {
  injury: "A long-term or current physical issue",
  soreness: "A short-term muscular or joint complaint",
  preference: "Training style, time of day, or modality you prefer",
  dislike: "Workouts or modalities you specifically dislike",
  motivation: "What drives you or what derails you",
  life_event: "Travel, illness, work crunch, family",
  equipment: "Gear access or constraints",
  training_response: "How a session or workout type tends to feel",
  goal_shift: "A change in your goal or aggressiveness",
  schedule_constraint: "Recurring availability quirk",
  identity: "A self-described trait (e.g. “I&apos;m a morning person”)",
};

type LifecycleChoice = "chronic" | "standing" | "recent" | "ephemeral" | "custom";

const LIFECYCLE_OPTIONS: Array<{
  key: LifecycleChoice;
  title: string;
  blurb: string;
}> = [
  { key: "chronic",   title: "Permanent",   blurb: "Never expires. Use for injuries, identity, lasting truths." },
  { key: "standing",  title: "Long-term",   blurb: "Stays for 90 days. Refreshes when you mention it again." },
  { key: "recent",    title: "Recent",      blurb: "Expires in 14 days. For current-state things." },
  { key: "ephemeral", title: "Brief",       blurb: "Expires in 3 days. One-off observations." },
  { key: "custom",    title: "Custom",      blurb: "Pick exactly how many days it should stick around." },
];

interface CreateMemoryFormProps {
  categories: readonly string[];
  predicates: readonly string[];
  onCreated: () => void | Promise<void>;
  onToast: (m: string) => void;
}

export function CreateMemoryForm({ categories, predicates, onCreated, onToast }: CreateMemoryFormProps) {
  const [category, setCategory] = useState(categories[0] ?? "preference");
  const [subject, setSubject] = useState("");
  const [predicate, setPredicate] = useState(predicates[0] ?? "prefers");
  const [summary, setSummary] = useState("");
  const [lifecycle, setLifecycle] = useState<LifecycleChoice>("standing");
  const [customDays, setCustomDays] = useState<string>("30");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setSubject("");
    setSummary("");
  };

  const customDaysNum = Number.parseInt(customDays, 10);
  const customValid = lifecycle !== "custom" || (Number.isFinite(customDaysNum) && customDaysNum > 0 && customDaysNum <= 3650);
  const summaryValid = summary.trim().length >= 3;
  const canSubmit = !submitting && summaryValid && customValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/athlete-facts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          subject: subject || null,
          predicate,
          summary,
          lifecycle,
          custom_expires_days: lifecycle === "custom" ? customDaysNum : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        onToast(data?.error ?? "Failed to save memory");
        return;
      }
      reset();
      onToast("Memory saved.");
      await onCreated();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={cardStyle}>
      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Add a memory</div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, lineHeight: 1.5 }}>
        Tell your coach something durable about you. The coach reads these on every chat turn
        alongside facts it extracts on its own.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <Field label="Category" hint={CATEGORY_HINT[category] ?? ""}>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={selectStyle}>
            {categories.map((c) => (
              <option key={c} value={c}>{humanize(c)}</option>
            ))}
          </select>
        </Field>
        <Field label="Relationship">
          <select value={predicate} onChange={(e) => setPredicate(e.target.value)} style={selectStyle}>
            {predicates.map((p) => (
              <option key={p} value={p}>{humanize(p)}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Topic" hint="What this is about — &ldquo;Left knee&rdquo;, &ldquo;Long runs&rdquo;, &ldquo;Monday mornings&rdquo;. Optional.">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Left knee"
          maxLength={80}
          style={inputStyle}
        />
      </Field>

      <div style={{ height: 14 }} />

      <Field
        label="What should your coach remember?"
        hint="One sentence the coach will read. Be specific — include numbers if it helps."
      >
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Patellar pain on long runs over 10mi — has been recurring since 2024 ACL surgery."
          maxLength={280}
          rows={3}
          style={{ ...inputStyle, resize: "vertical", minHeight: 70, fontFamily: "inherit" }}
        />
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, textAlign: "right" }}>
          {summary.length}/280
        </div>
      </Field>

      <div style={{ height: 14 }} />

      <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
        How long should this stick around?
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 10 }}>
        {LIFECYCLE_OPTIONS.map((lc) => {
          const active = lc.key === lifecycle;
          return (
            <button
              key={lc.key}
              type="button"
              onClick={() => setLifecycle(lc.key)}
              style={{
                textAlign: "left",
                padding: "10px 12px",
                borderRadius: 10,
                border: `1.5px solid ${active ? "#0f172a" : "#e2e8f0"}`,
                background: active ? "#0f172a" : "#fff",
                color: active ? "#fff" : "#0f172a",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{lc.title}</div>
              <div style={{ fontSize: 11, color: active ? "#cbd5e1" : "#64748b", lineHeight: 1.35 }}>
                {lc.blurb}
              </div>
            </button>
          );
        })}
      </div>

      {lifecycle === "custom" && (
        <div
          style={{
            marginBottom: 18,
            padding: "12px 14px",
            borderRadius: 10,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <label style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
            Expires in
          </label>
          <input
            type="number"
            min={1}
            max={3650}
            value={customDays}
            onChange={(e) => setCustomDays(e.target.value)}
            style={{
              ...inputStyle,
              width: 90,
              padding: "7px 10px",
              textAlign: "right",
            }}
          />
          <span style={{ fontSize: 13, color: "#0f172a" }}>days</span>
          {!customValid && (
            <span style={{ fontSize: 12, color: "#b91c1c", marginLeft: 8 }}>
              Enter 1–3650 days.
            </span>
          )}
        </div>
      )}

      {lifecycle !== "custom" && <div style={{ height: 8 }} />}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button
          type="button"
          onClick={reset}
          disabled={submitting}
          style={{
            padding: "9px 16px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            background: "#fff",
            color: "#0f172a",
            fontSize: 13,
            fontWeight: 700,
            cursor: submitting ? "wait" : "pointer",
          }}
        >
          Clear
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            padding: "9px 18px",
            borderRadius: 8,
            border: "none",
            background: !canSubmit ? "#cbd5e1" : "#0f172a",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: !canSubmit ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Saving…" : "Save memory"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 11, color: "var(--muted)" }}>{hint}</span>}
    </label>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid var(--line, #e2e8f0)",
  borderRadius: 14,
  padding: 24,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  fontSize: 13,
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  outline: "none",
  fontFamily: "inherit",
  color: "#0f172a",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};
