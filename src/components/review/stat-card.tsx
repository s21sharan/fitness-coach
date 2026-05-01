"use client";

interface StatCardProps {
  label: string;
  value: string;
  color?: "green" | "amber" | "red" | "default";
}

const COLOR_MAP = {
  green: "text-green-600",
  amber: "text-amber-600",
  red: "text-red-600",
  default: "text-gray-900",
};

export function StatCard({ label, value, color = "default" }: StatCardProps) {
  return (
    <div className="rounded-lg border bg-white p-4 text-center">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${COLOR_MAP[color]}`}>{value}</p>
    </div>
  );
}
