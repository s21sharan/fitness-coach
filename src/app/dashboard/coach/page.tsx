"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
import { MessageBubble, TypingIndicator } from "@/components/chat/message-bubble";
import { ChatInput } from "@/components/chat/chat-input";

interface HistoryMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  tool_calls: unknown;
  created_at: string;
}

const SUGGESTED_PROMPTS = [
  "How's my training looking this week?",
  "Should I run or rest today?",
  "Analyze my recovery trends",
  "What should I focus on next?",
  "Am I overtraining?",
  "Give me a weekly summary",
];

export default function CoachPage() {
  const [initialMessages, setInitialMessages] = useState<
    Array<{ id: string; role: "user" | "assistant"; content: string }>
  >([]);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch("/api/chat/messages");
        if (res.ok) {
          const data = await res.json();
          const msgs = (data.messages as HistoryMessage[]).map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
          }));
          setInitialMessages(msgs);
        }
      } catch {}
      setLoaded(true);
    }
    loadHistory();
  }, []);

  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput } =
    useChat({
      api: "/api/chat",
      initialMessages,
    });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!loaded) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", maxWidth: 780, margin: "0 auto" }}>
      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "24px 20px" }}>
        {messages.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "var(--ink, #0F1B22)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <span style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>H</span>
            </div>
            <h2 style={{ marginTop: 16, fontSize: 18, fontWeight: 700 }}>Hey! I'm your Coach.</h2>
            <p style={{ marginTop: 6, fontSize: 14, color: "#6b7280", maxWidth: 360 }}>
              I have access to all your fitness data — workouts, cardio, recovery, and more. Ask me anything.
            </p>

            {/* Suggested prompts */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 24, maxWidth: 480 }}>
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setInput(prompt)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 20,
                    border: "1px solid #e5e7eb",
                    background: "#fff",
                    fontSize: 12,
                    color: "#6b7280",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#9ca3af";
                    e.currentTarget.style.color = "#374151";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#e5e7eb";
                    e.currentTarget.style.color = "#6b7280";
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                role={m.role as "user" | "assistant"}
                content={m.content}
                tools={
                  m.role === "assistant" && (m as any).toolInvocations
                    ? (m as any).toolInvocations.map((t: any) => t.toolName)
                    : undefined
                }
              />
            ))}
            {isLoading && <TypingIndicator />}
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        input={input}
        onChange={handleInputChange}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </div>
  );
}
