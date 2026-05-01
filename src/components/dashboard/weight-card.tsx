"use client";

interface WeightCardProps {
  current: number | null;
  direction: "up" | "down" | "stable";
}

const ARROWS: Record<string, { icon: string; color: string }> = {
  up: { icon: "↑", color: "text-red-500" },
  down: { icon: "↓", color: "text-green-500" },
  stable: { icon: "→", color: "text-gray-400" },
};

export function WeightCard({ current, direction }: WeightCardProps) {
  if (current === null) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-sm font-medium text-gray-500">Weight</h3>
        <p className="mt-2 text-sm text-gray-400">No data</p>
      </div>
    );
  }

  const arrow = ARROWS[direction];

  return (
    <div className="rounded-lg border bg-white p-6">
      <h3 className="text-sm font-medium text-gray-500">Weight</h3>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold">{current}</span>
        <span className="text-sm text-gray-400">lbs</span>
        <span className={`text-lg font-bold ${arrow.color}`}>{arrow.icon}</span>
      </div>
      <p className="mt-1 text-xs text-gray-400">
        {direction === "up" ? "Trending up" : direction === "down" ? "Trending down" : "Stable"}
      </p>
    </div>
  );
}
