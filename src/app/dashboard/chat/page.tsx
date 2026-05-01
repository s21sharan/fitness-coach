"use client";

import { useChat } from "ai/react";
import { useEffect, useRef, useState } from "react";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ToolCallPills } from "@/components/chat/tool-call-pills";
import { ChatInput } from "@/components/chat/chat-input";
import { SuggestedPrompts } from "@/components/chat/suggested-prompts";

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
    <div className="flex h-full flex-col -m-6">
      <SuggestedPrompts onSelect={handleSuggestedPrompt} />

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500">
              <span className="text-2xl font-bold text-white">C</span>
            </div>
            <h2 className="mt-4 text-lg font-semibold">Hey! I&apos;m your Coach.</h2>
            <p className="mt-1 text-sm text-gray-500">
              Ask me about your nutrition, training, recovery — or just what to eat for dinner.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m) => (
              <div key={m.id}>
                {m.role === "assistant" && (m as any).toolInvocations && (
                  <ToolCallPills
                    toolCalls={(m as any).toolInvocations?.map((t: any) => ({ toolName: t.toolName }))}
                  />
                )}
                <MessageBubble role={m.role as "user" | "assistant"} content={m.content} />
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2.5 items-start">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500">
                  <span className="text-sm font-bold text-white">C</span>
                </div>
                <div className="rounded-2xl rounded-tl-sm border border-gray-200 bg-white px-4 py-3">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-gray-300" style={{ animationDelay: "0ms" }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-gray-300" style={{ animationDelay: "150ms" }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-gray-300" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ChatInput
        input={input}
        onChange={handleInputChange}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </div>
  );
}
