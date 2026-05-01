"use client";

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
}

const PROMPTS = [
  { emoji: "🏃", text: "Plan my week" },
  { emoji: "🥗", text: "What should I eat?" },
  { emoji: "💪", text: "Why is bench stalling?" },
  { emoji: "😴", text: "Am I overtraining?" },
];

export function SuggestedPrompts({ onSelect }: SuggestedPromptsProps) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {PROMPTS.map((p) => (
        <div
          key={p.text}
          onClick={() => onSelect(p.text)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: 14,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <span>{p.emoji}</span>
          {p.text}
        </div>
      ))}
    </div>
  );
}
