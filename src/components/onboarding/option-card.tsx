"use client";

import { cn } from "@/lib/utils";

interface OptionCardProps {
  label: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
}

export function OptionCard({ label, description, selected, onClick }: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border-2 p-4 text-left transition-colors",
        selected
          ? "border-black bg-gray-50"
          : "border-gray-200 hover:border-gray-300"
      )}
    >
      <span className="font-medium">{label}</span>
      {description && (
        <span className="mt-1 block text-sm text-gray-500">{description}</span>
      )}
    </button>
  );
}
