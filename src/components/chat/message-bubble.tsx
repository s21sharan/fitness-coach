"use client";

import { Icon } from "@/components/app/icon";

interface MealItem {
  emoji: string;
  title: string;
  macros: string;
}

interface ActionItem {
  label: string;
  primary?: boolean;
}

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  tools?: string[];
  actions?: ActionItem[];
  kind?: "meals";
  meals?: MealItem[];
}

export function MessageBubble({ role, content, tools, actions, kind, meals }: MessageBubbleProps) {
  if (role === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ maxWidth: "78%" }}>
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 20,
              borderTopRightRadius: 8,
              background: "var(--ink)",
              color: "#fff",
              fontSize: 14,
              lineHeight: 1.55,
            }}
          >
            {content}
          </div>
        </div>
      </div>
    );
  }

  // Coach message
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "var(--ink)",
          color: "#fff",
          display: "grid",
          placeItems: "center",
          fontWeight: 800,
          fontSize: 11,
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        T
      </div>
      <div style={{ maxWidth: "80%", minWidth: 0 }}>
        {kind === "meals" ? (
          <div style={{ display: "grid", gap: 8 }}>
            {(meals ?? []).map((meal, j) => (
              <div
                key={j}
                style={{
                  background: "var(--mint-soft)",
                  borderRadius: 16,
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 24 }}>{meal.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{meal.title}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{meal.macros}</div>
                </div>
                <button
                  className="btn-ghost"
                  style={{ padding: "5px 12px", fontSize: 11 }}
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              padding: "13px 17px",
              borderRadius: 20,
              borderTopLeftRadius: 8,
              background: "rgba(255,255,255,0.75)",
              backdropFilter: "blur(8px)",
              color: "var(--ink)",
              fontSize: 13.5,
              lineHeight: 1.6,
              fontWeight: 400,
              letterSpacing: "0.005em",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.03)",
            }}
            dangerouslySetInnerHTML={{ __html: formatContent(content) }}
          />
        )}

        {tools && tools.length > 0 && (
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            {tools.map((t) => (
              <span
                key={t}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "4px 9px",
                  borderRadius: 8,
                  background: "var(--coral-soft)",
                  color: "var(--coral-deep)",
                }}
              >
                <Icon name="plug" size={10} /> Read from {t}
              </span>
            ))}
          </div>
        )}

        {actions && actions.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {actions.map((a, k) => (
              <button
                key={k}
                className={a.primary ? "btn-coral" : "btn-ghost"}
                style={{ padding: "7px 14px", fontSize: 12 }}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "var(--ink)",
          color: "#fff",
          display: "grid",
          placeItems: "center",
          fontWeight: 800,
          fontSize: 11,
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        T
      </div>
      <div
        style={{
          padding: "11px 15px",
          borderRadius: 20,
          borderTopLeftRadius: 8,
          background: "rgba(255,255,255,0.75)",
          backdropFilter: "blur(8px)",
          display: "inline-flex",
          gap: 4,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.03)",
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--muted)",
              animation: "typing 1.4s infinite",
              animationDelay: `${i * 0.15}s`,
              display: "block",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function formatContent(content: string): string {
  return content
    // Headers — consume surrounding newlines so they don't become extra <br>s
    .replace(/\n*^### (.+)$\n*/gm, '<div style="font-weight:700;font-size:13.5px;margin:10px 0 4px;color:var(--ink)">$1</div>')
    .replace(/\n*^## (.+)$\n*/gm, '<div style="font-weight:700;font-size:14.5px;margin:12px 0 4px;color:var(--ink)">$1</div>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight:600">$1</strong>')
    // Bullet points — use proper list styling
    .replace(/\n- /g, '<br><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--coral);margin:0 8px 1px 2px;vertical-align:middle"></span>')
    .replace(/^- /gm, '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--coral);margin:0 8px 1px 2px;vertical-align:middle"></span>')
    // Collapse double newlines into paragraph break
    .replace(/\n\n+/g, '<div style="height:8px"></div>')
    // Remaining single newlines
    .replace(/\n/g, "<br>");
}
