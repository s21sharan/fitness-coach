"use client";

interface CaloriesCardProps {
  calories: number | null;
  target: number;
  protein: number | null;
}

export function CaloriesCard({ calories, target, protein }: CaloriesCardProps) {
  if (calories === null) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-sm font-medium text-gray-500">Calories</h3>
        <p className="mt-2 text-sm text-gray-400">No data today</p>
      </div>
    );
  }

  const pct = Math.min(100, Math.round((calories / target) * 100));
  const barColor = pct >= 90 ? "bg-green-500" : pct >= 60 ? "bg-amber-500" : "bg-gray-300";

  return (
    <div className="rounded-lg border bg-white p-6">
      <h3 className="text-sm font-medium text-gray-500">Calories</h3>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-bold">{calories.toLocaleString()}</span>
        <span className="text-sm text-gray-400">/ {target.toLocaleString()} cal</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      {protein !== null && (
        <p className="mt-1.5 text-xs text-gray-500">{protein}g protein</p>
      )}
    </div>
  );
}
