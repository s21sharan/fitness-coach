"use client";

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
}

const PROMPTS = [
  "What should I eat for dinner?",
  "How's my recovery?",
  "Should I train today?",
  "Swap today's session",
];

export function SuggestedPrompts({ onSelect }: SuggestedPromptsProps) {
  return (
    <div className="flex flex-wrap gap-2 border-b px-5 py-3">
      {PROMPTS.map((prompt) => (
        <button
          key={prompt}
          type="button"
          onClick={() => onSelect(prompt)}
          className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-700"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
