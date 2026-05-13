"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageBubble, TypingIndicator } from "@/components/chat/message-bubble";
import { ChatInput } from "@/components/chat/chat-input";
import { PlanProposalCard } from "@/components/chat/plan-proposal-card";
import { BlockProposalCard } from "@/components/chat/block-proposal-card";
import { Icon } from "@/components/app/icon";
import { convertDBToUIMessage } from "@/lib/chat/conversation";

const transport = new DefaultChatTransport({ api: "/api/chat" });

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

    // v6 tool-result format
    if (p.type === "tool-result" && p.toolName === "regenerate_plan" && p.result) {
      return p.result;
    }

    // v6 tool-invocation with state=result
    if (p.type === "tool-invocation") {
      const inv = p.toolInvocation as Record<string, unknown> | undefined;
      if (inv?.toolName === "regenerate_plan") {
        if (inv.state === "result" && inv.result) return inv.result;
        if (inv.output) return inv.output;
      }
    }

    // Typed tool part: tool-regenerate_plan
    if (p.type === "tool-regenerate_plan") {
      if (p.state === "output-available" && p.output) return p.output;
      if (p.state === "result" && p.result) return p.result;
    }

    // Generic: any part with toolName matching and an output/result
    if ((p as Record<string, unknown>).toolName === "regenerate_plan") {
      if (p.output) return p.output;
      if (p.result) return p.result;
    }
  }
  return null;
}

function extractBlockProposal(parts: unknown[]): unknown | null {
  for (const part of parts) {
    const p = part as Record<string, unknown>;

    if (p.type === "tool-result" && p.toolName === "propose_next_block" && p.result) {
      return p.result;
    }

    if (p.type === "tool-invocation") {
      const inv = p.toolInvocation as Record<string, unknown> | undefined;
      if (inv?.toolName === "propose_next_block") {
        if (inv.state === "result" && inv.result) return inv.result;
        if (inv.output) return inv.output;
      }
    }

    if (p.type === "tool-propose_next_block") {
      if (p.state === "output-available" && p.output) return p.output;
      if (p.state === "result" && p.result) return p.result;
    }

    if ((p as Record<string, unknown>).toolName === "propose_next_block") {
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
    if (p.type === "tool-call" && typeof p.toolName === "string") {
      names.push(p.toolName);
    }
    if (p.type === "tool-invocation") {
      const inv = p.toolInvocation as Record<string, unknown> | undefined;
      if (inv?.toolName && typeof inv.toolName === "string") {
        names.push(inv.toolName);
      }
    }
    // Typed tool parts start with "tool-"
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

export default function CoachPage() {
  const [input, setInput] = useState("");
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, setMessages } = useChat({ transport });
  const isLoading = status === "streaming" || status === "submitted";

  // Load chat history on mount
  useEffect(() => {
    fetch("/api/chat/messages")
      .then((res) => res.json())
      .then((data) => {
        if (data.messages?.length > 0) {
          setMessages(data.messages.map(convertDBToUIMessage));
        }
      })
      .catch(() => {})
      .finally(() => setHistoryLoaded(true));
  }, [setMessages]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput("");
  };

  const handleClearChat = useCallback(async () => {
    const res = await fetch("/api/chat/messages", { method: "DELETE" });
    if (res.ok) {
      setMessages([]);
    }
  }, [setMessages]);

  // Show loading skeleton while history is being fetched
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", maxWidth: 780, margin: "0 auto" }}>
      {/* Header bar — visible when there are messages */}
      {!showEmptyState && (
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "flex-end",
            padding: "10px 20px 0",
          }}
        >
          <button
            type="button"
            onClick={handleClearChat}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 10px", borderRadius: 8,
              border: "1px solid #e5e7eb", background: "#fff",
              fontSize: 12, color: "#9ca3af", cursor: "pointer",
            }}
          >
            <Icon name="trash" size={13} />
            Clear chat
          </button>
        </div>
      )}

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "24px 20px" }}>
        {showEmptyState ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--ink, #0F1B22)", display: "grid", placeItems: "center" }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>H</span>
            </div>
            <h2 style={{ marginTop: 16, fontSize: 18, fontWeight: 700 }}>Hey! I&apos;m your Coach.</h2>
            <p style={{ marginTop: 6, fontSize: 14, color: "#6b7280", maxWidth: 360 }}>
              I have access to all your fitness data — workouts, cardio, recovery, and more. Ask me anything.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 24, maxWidth: 480 }}>
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage({ text: prompt })}
                  style={{
                    padding: "8px 14px", borderRadius: 20, border: "1px solid #e5e7eb",
                    background: "#fff", fontSize: 12, color: "#6b7280", cursor: "pointer",
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {messages.map((m) => {
              const parts = (m.parts || []) as unknown[];
              const textContent = extractText(parts);
              const toolNames = extractToolNames(parts);
              const planData = m.role === "assistant" ? extractPlanProposal(parts) : null;
              const blockData = m.role === "assistant" ? extractBlockProposal(parts) : null;

              return (
                <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {textContent && (
                    <MessageBubble
                      role={m.role as "user" | "assistant"}
                      content={textContent}
                      tools={toolNames.length > 0 && !planData ? toolNames : undefined}
                    />
                  )}
                  {planData && (planData as Record<string, unknown>).success && (
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <div style={{ width: 32, flexShrink: 0 }} />
                      <div style={{ maxWidth: 560, width: "100%" }}>
                        <PlanProposalCard data={planData as Parameters<typeof PlanProposalCard>[0]["data"]} />
                      </div>
                    </div>
                  )}
                  {blockData && (blockData as Record<string, unknown>).success && (
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <div style={{ width: 32, flexShrink: 0 }} />
                      <div style={{ maxWidth: 560, width: "100%" }}>
                        <BlockProposalCard data={blockData as Parameters<typeof BlockProposalCard>[0]["data"]} />
                      </div>
                    </div>
                  )}
                  {!textContent && !planData && toolNames.length > 0 && (
                    <MessageBubble role="assistant" content="" tools={toolNames} />
                  )}
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
      />
    </div>
  );
}
