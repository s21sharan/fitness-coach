"use client";

import { type FormEvent } from "react";
import { Icon } from "@/components/app/icon";
import { ChatInputDropdown } from "./chat-input-dropdown";

interface ChatInputProps {
  input: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: FormEvent) => void;
  isLoading: boolean;
  onReviewCheckins?: () => void;
}

export function ChatInput({ input, onChange, onSubmit, isLoading, onReviewCheckins }: ChatInputProps) {
  return (
    <div
      style={{
        padding: "12px 32px 22px",
        background: "transparent",
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          maxWidth: 680,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "rgba(255,255,255,0.8)",
          backdropFilter: "blur(12px)",
          borderRadius: 999,
          padding: "8px 8px 8px 18px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
        }}
      >
        <Icon name="sparkle" size={16} style={{ color: "var(--coral-deep)", flexShrink: 0 }} />
        {onReviewCheckins && (
          <ChatInputDropdown onReviewCheckins={onReviewCheckins} />
        )}
        <input
          type="text"
          value={input}
          onChange={onChange}
          placeholder="Ask anything — coach has your data"
          disabled={isLoading}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            font: "inherit",
            fontSize: 14,
            padding: "8px 0",
            background: "transparent",
          }}
        />
        <button
          type="button"
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            color: "var(--ink-2)",
            flexShrink: 0,
          }}
        >
          <Icon name="mic" size={16} />
        </button>
        <button
          type="submit"
          disabled={isLoading || !(input ?? "").trim()}
          className="btn-coral"
          style={{ padding: "9px 14px", fontSize: 13, flexShrink: 0 }}
        >
          {isLoading ? (
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.4)",
                borderTopColor: "#fff",
                animation: "spin 0.7s linear infinite",
              }}
            />
          ) : (
            <Icon name="send" size={14} />
          )}
        </button>
      </form>
    </div>
  );
}
