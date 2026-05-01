"use client";

import { useChat } from "ai/react";
import { useEffect, useRef } from "react";
import { MessageBubble } from "./message-bubble";
import Link from "next/link";

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
}

export function ChatPanel({ open, onClose }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/chat",
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!open) return null;

  return (
    <div className="fixed right-0 top-0 bottom-0 z-40 flex w-80 flex-col border-l bg-white shadow-xl">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500">
            <span className="text-[10px] font-bold text-white">C</span>
          </div>
          <span className="text-sm font-semibold">Coach</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/chat" className="text-xs text-indigo-600 hover:underline">
            Open full →
          </Link>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">
            ×
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-gray-400">Ask Coach anything...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <MessageBubble key={m.id} role={m.role as "user" | "assistant"} content={m.content} />
            ))}
            {isLoading && (
              <div className="flex gap-2 items-start">
                <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500">
                  <span className="text-[8px] font-bold text-white">C</span>
                </div>
                <div className="rounded-xl border bg-white px-3 py-2">
                  <div className="flex gap-1">
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300" />
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300" style={{ animationDelay: "150ms" }} />
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t px-3 py-2">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Ask Coach..."
            className="flex-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs outline-none"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-white text-xs disabled:opacity-40"
          >
            ↑
          </button>
        </form>
      </div>
    </div>
  );
}
