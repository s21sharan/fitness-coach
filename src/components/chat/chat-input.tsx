"use client";

import { type FormEvent } from "react";

interface ChatInputProps {
  input: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: FormEvent) => void;
  isLoading: boolean;
}

export function ChatInput({ input, onChange, onSubmit, isLoading }: ChatInputProps) {
  return (
    <div className="border-t bg-white px-5 py-3">
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={onChange}
          placeholder="Ask your coach anything..."
          className="flex-1 rounded-full border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-gray-400"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white disabled:opacity-40"
        >
          {isLoading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <span className="text-lg">↑</span>
          )}
        </button>
      </form>
    </div>
  );
}
