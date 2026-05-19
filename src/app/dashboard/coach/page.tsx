"use client";

import { useEffect, useRef, useState } from "react";
import { MessageBubble, TypingIndicator } from "@/components/chat/message-bubble";
import { ChatInput } from "@/components/chat/chat-input";
import { PlanProposalCard } from "@/components/chat/plan-proposal-card";
import { BlockProposalCard } from "@/components/chat/block-proposal-card";
import { CheckInCard } from "@/components/chat/checkin-card";
import { PhysiqueReviewModal } from "@/components/chat/physique-review-modal";
import { Icon } from "@/components/app/icon";
import { useChatContext } from "@/components/chat/chat-provider";
import type { ConversationSummary } from "@/lib/chat/conversation";

const SUGGESTED_PROMPTS = [
  "How's my training looking this week?",
  "Should I run or rest today?",
  "Analyze my recovery trends",
  "What should I focus on next?",
  "Am I overtraining?",
  "Give me a weekly summary",
];

function extractPlanProposal(parts: unknown[]): unknown | null {
  for (const part of parts) {
    const p = part as Record<string, unknown>;
    if (p.type === "tool-result" && p.toolName === "regenerate_plan" && p.result) return p.result;
    if (p.type === "tool-invocation") {
      const inv = p.toolInvocation as Record<string, unknown> | undefined;
      if (inv?.toolName === "regenerate_plan") {
        if (inv.state === "result" && inv.result) return inv.result;
        if (inv.output) return inv.output;
      }
    }
    if (p.type === "tool-regenerate_plan") {
      if (p.state === "output-available" && p.output) return p.output;
      if (p.state === "result" && p.result) return p.result;
    }
    if ((p as Record<string, unknown>).toolName === "regenerate_plan") {
      if (p.output) return p.output;
      if (p.result) return p.result;
    }
  }
  return null;
}

const BLOCK_PROPOSAL_TOOLS = ["propose_next_block", "create_planned_workouts_batch"] as const;

function extractBlockProposal(parts: unknown[]): unknown | null {
  for (const part of parts) {
    const p = part as Record<string, unknown>;
    const isMatch = (name: unknown) =>
      typeof name === "string" && (BLOCK_PROPOSAL_TOOLS as readonly string[]).includes(name);

    if (p.type === "tool-result" && isMatch(p.toolName) && p.result) return p.result;

    if (p.type === "tool-invocation") {
      const inv = p.toolInvocation as Record<string, unknown> | undefined;
      if (isMatch(inv?.toolName)) {
        if (inv?.state === "result" && inv.result) return inv.result;
        if (inv?.output) return inv.output;
      }
    }
    if (typeof p.type === "string" && p.type.startsWith("tool-")) {
      const namePart = p.type.slice("tool-".length);
      if ((BLOCK_PROPOSAL_TOOLS as readonly string[]).includes(namePart)) {
        if (p.state === "output-available" && p.output) return p.output;
        if (p.state === "result" && p.result) return p.result;
      }
    }
    if (isMatch((p as Record<string, unknown>).toolName)) {
      if (p.output) return p.output;
      if (p.result) return p.result;
    }
  }
  return null;
}

function extractCheckinPrompt(parts: unknown[]): unknown | null {
  for (const part of parts) {
    const p = part as Record<string, unknown>;
    if (p.type === "tool-result" && p.toolName === "prompt_checkin" && p.result) return p.result;
    if (p.type === "tool-invocation") {
      const inv = p.toolInvocation as Record<string, unknown> | undefined;
      if (inv?.toolName === "prompt_checkin") {
        if (inv.state === "result" && inv.result) return inv.result;
        if (inv.output) return inv.output;
      }
    }
    if (p.type === "tool-prompt_checkin") {
      if (p.state === "output-available" && p.output) return p.output;
      if (p.state === "result" && p.result) return p.result;
    }
    if ((p as Record<string, unknown>).toolName === "prompt_checkin") {
      if (p.output) return p.output;
      if (p.result) return p.result;
    }
  }
  return null;
}

function extractToolNames(parts: unknown[]): string[] {
  const names: string[] = [];
  for (const part of parts) {
    const p = part as Record<string, unknown>;
    if (p.type === "tool-call" && typeof p.toolName === "string") names.push(p.toolName);
    if (p.type === "tool-invocation") {
      const inv = p.toolInvocation as Record<string, unknown> | undefined;
      if (inv?.toolName && typeof inv.toolName === "string") names.push(inv.toolName);
    }
    if (typeof p.type === "string" && p.type.startsWith("tool-") && p.type !== "tool-call" && p.type !== "tool-result") {
      const name = (p.type as string).replace("tool-", "");
      if (name && !names.includes(name)) names.push(name);
    }
  }
  return names;
}

function extractText(parts: unknown[]): string {
  return (parts || [])
    .filter((p): p is { type: "text"; text: string } => (p as Record<string, unknown>).type === "text")
    .map((p) => p.text)
    .join("");
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ConversationsSidebar({
  conversations,
  activeId,
  onSwitch,
  onNew,
  onRename,
  onDelete,
}: {
  conversations: ConversationSummary[];
  activeId: string | null;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}) {
  const [menuId, setMenuId] = useState<string | null>(null);

  useEffect(() => {
    const close = () => setMenuId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        borderRight: "1px solid rgba(0,0,0,0.06)",
        background: "rgba(255,255,255,0.5)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <div style={{ padding: "16px 14px 8px" }}>
        <button
          type="button"
          onClick={onNew}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.08)",
            background: "#fff",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--ink, #0F1B22)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <Icon name="plus" size={14} />
          New chat
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px 16px" }}>
        {conversations.length === 0 ? (
          <div style={{ fontSize: 12, color: "#9ca3af", padding: "16px 8px", textAlign: "center" }}>
            No past chats yet. Send your first message to get started.
          </div>
        ) : (
          conversations.map((c) => {
            const isActive = c.id === activeId;
            return (
              <div key={c.id} style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => onSwitch(c.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 28px 8px 10px",
                    marginBottom: 2,
                    borderRadius: 8,
                    border: "none",
                    background: isActive ? "rgba(15,27,34,0.08)" : "transparent",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    color: "var(--ink, #0F1B22)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: isActive ? 700 : 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      lineHeight: 1.3,
                    }}
                  >
                    {c.title || "Untitled"}
                  </span>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>
                    {relativeTime(c.updated_at || c.created_at)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuId(menuId === c.id ? null : c.id);
                  }}
                  aria-label="Conversation actions"
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    border: "none",
                    background: "transparent",
                    color: "#9ca3af",
                    cursor: "pointer",
                    fontSize: 14,
                    lineHeight: 1,
                  }}
                >
                  ⋯
                </button>
                {menuId === c.id && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: "absolute",
                      top: 30,
                      right: 6,
                      zIndex: 5,
                      background: "#fff",
                      border: "1px solid rgba(0,0,0,0.08)",
                      borderRadius: 8,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      padding: 4,
                      minWidth: 120,
                    }}
                  >
                    <button
                      type="button"
                      style={menuItemStyle}
                      onClick={() => {
                        setMenuId(null);
                        const next = window.prompt("Rename conversation", c.title || "");
                        if (next && next.trim()) onRename(c.id, next.trim());
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      style={{ ...menuItemStyle, color: "#dc2626" }}
                      onClick={() => {
                        setMenuId(null);
                        if (window.confirm(`Delete "${c.title || "Untitled"}"?`)) onDelete(c.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "6px 10px",
  fontSize: 12,
  background: "transparent",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  color: "#374151",
};

export default function CoachPage() {
  const {
    messages,
    status,
    historyLoaded,
    conversations,
    activeConversationId,
    sendMessage,
    switchConversation,
    startNewConversation,
    renameConversation,
    deleteConversation,
  } = useChatContext();

  const [input, setInput] = useState("");
  const [showReviewModal, setShowReviewModal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input);
    setInput("");
  };

  if (!historyLoaded) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", maxWidth: 780, margin: "0 auto" }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 32, height: 32, borderRadius: "50%",
                border: "2.5px solid #e5e7eb", borderTopColor: "var(--ink, #0F1B22)",
                animation: "spin 0.7s linear infinite",
              }}
            />
            <span style={{ fontSize: 13, color: "#9ca3af" }}>Loading conversation...</span>
          </div>
        </div>
      </div>
    );
  }

  const showEmptyState = messages.length === 0;

  return (
    <div style={{ display: "flex", height: "100%", width: "100%" }}>
      <ConversationsSidebar
        conversations={conversations}
        activeId={activeConversationId}
        onSwitch={(id) => void switchConversation(id)}
        onNew={() => startNewConversation()}
        onRename={(id, title) => void renameConversation(id, title)}
        onDelete={(id) => void deleteConversation(id)}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", maxWidth: 780, margin: "0 auto", position: "relative" }}>
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "24px 20px" }}>
          {showEmptyState ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--ink, #0F1B22)", display: "grid", placeItems: "center" }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>T</span>
              </div>
              <h2 style={{ marginTop: 16, fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>Hey! I&apos;m your Coach.</h2>
              <p style={{ marginTop: 6, fontSize: 14, color: "#8896a4", maxWidth: 360, lineHeight: 1.5 }}>
                I have access to all your fitness data — workouts, cardio, recovery, and more. Ask me anything.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 24, maxWidth: 480 }}>
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendMessage(prompt)}
                    style={{
                      padding: "8px 14px", borderRadius: 20, border: "none",
                      background: "rgba(255,255,255,0.7)", fontSize: 12, color: "#6b7280", cursor: "pointer",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.95)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.7)")}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {messages.map((m) => {
                const parts = (m.parts || []) as unknown[];
                const textContent = extractText(parts);
                const toolNames = extractToolNames(parts);
                const planData = m.role === "assistant" ? extractPlanProposal(parts) : null;
                const blockData = m.role === "assistant" ? extractBlockProposal(parts) : null;
                const checkinData = m.role === "assistant" ? extractCheckinPrompt(parts) : null;

                return (
                  <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {textContent && (
                      <MessageBubble
                        role={m.role as "user" | "assistant"}
                        content={textContent}
                      />
                    )}
                    {planData && (planData as Record<string, unknown>).success && (
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <div style={{ width: 28, flexShrink: 0 }} />
                        <div style={{ maxWidth: 560, width: "100%" }}>
                          <PlanProposalCard data={planData as Parameters<typeof PlanProposalCard>[0]["data"]} />
                        </div>
                      </div>
                    )}
                    {blockData && (blockData as Record<string, unknown>).success && (
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <div style={{ width: 28, flexShrink: 0 }} />
                        <div style={{ maxWidth: 560, width: "100%" }}>
                          <BlockProposalCard data={blockData as Parameters<typeof BlockProposalCard>[0]["data"]} />
                        </div>
                      </div>
                    )}
                    {checkinData && (checkinData as Record<string, unknown>).type === "checkin_prompt" && (
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <div style={{ width: 28, flexShrink: 0 }} />
                        <div style={{ maxWidth: 560, width: "100%" }}>
                          <CheckInCard data={checkinData as Parameters<typeof CheckInCard>[0]["data"]} />
                        </div>
                      </div>
                    )}
                    {!textContent && !planData && !blockData && !checkinData && toolNames.length > 0 && null}
                  </div>
                );
              })}
              {isLoading && <TypingIndicator />}
            </div>
          )}
        </div>

        <ChatInput
          input={input}
          onChange={(e) => setInput(e.target.value)}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          onReviewCheckins={() => setShowReviewModal(true)}
        />

        {showReviewModal && (
          <PhysiqueReviewModal onClose={() => setShowReviewModal(false)} />
        )}
      </div>
    </div>
  );
}
