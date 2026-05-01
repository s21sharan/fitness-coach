"use client";

import { useChat } from "ai/react";
import { useEffect, useRef, useState } from "react";
import { MessageBubble, TypingIndicator } from "@/components/chat/message-bubble";
import { ChatInput } from "@/components/chat/chat-input";
import { ContextPanel } from "@/components/chat/context-panel";
import { Topbar } from "@/components/topbar";

interface HistoryMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  tool_calls: unknown;
  created_at: string;
}

export default function ChatPage() {
  const [initialMessages, setInitialMessages] = useState<Array<{ id: string; role: "user" | "assistant"; content: string }>>([]);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadHistory() {
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
      setLoaded(true);
    }
    loadHistory();
  }, []);

  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput } = useChat({
    api: "/api/chat",
    initialMessages,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt);
  };

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        height: "100%",
        margin: "-24px",
      }}
    >
      <Topbar title="Coach" subtitle="● Online · sees your data" />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 280px",
          gap: 0,
          flex: 1,
          overflow: "hidden",
        }}
      >
        {/* Left column: chat thread + input */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div
            ref={scrollRef}
            style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}
          >
            <div
              style={{
                maxWidth: 680,
                margin: "0 auto",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {/* Timestamp */}
              <div
                style={{
                  textAlign: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--muted)",
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  margin: "8px 0",
                }}
              >
                Today · {new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </div>

              {messages.length === 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "48px 0",
                    gap: 12,
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      background: "var(--ink)",
                      color: "#fff",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 800,
                      fontSize: 18,
                    }}
                  >
                    H
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
                      Hey! I&apos;m your Coach.
                    </div>
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>
                      Ask me about your nutrition, training, recovery — or just what to eat for dinner.
                    </div>
                  </div>
                </div>
              ) : (
                messages.map((m) => {
                  const toolInvocations = (m as unknown as { toolInvocations?: Array<{ toolName: string }> }).toolInvocations;
                  const tools = toolInvocations?.map((t) => t.toolName);
                  return (
                    <MessageBubble
                      key={m.id}
                      role={m.role as "user" | "assistant"}
                      content={m.content}
                      tools={tools}
                    />
                  );
                })
              )}

              {isLoading && <TypingIndicator />}
            </div>
          </div>

          <ChatInput
            input={input}
            onChange={handleInputChange}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        </div>

        {/* Right column: context panel */}
        <ContextPanel onPromptSelect={handleSuggestedPrompt} />
      </div>
    </div>
  );
}
