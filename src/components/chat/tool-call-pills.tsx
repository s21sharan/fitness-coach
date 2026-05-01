"use client";

interface ToolCallPillsProps {
  toolCalls: Array<{ toolName: string }> | undefined;
}

const TOOL_ICONS: Record<string, string> = {
  get_nutrition: "🍽️",
  get_workouts: "🏋️",
  get_cardio: "🏃",
  get_recovery: "📊",
  get_weight_trend: "⚖️",
  get_training_plan: "📋",
  update_planned_workout: "✏️",
};

export function ToolCallPills({ toolCalls }: ToolCallPillsProps) {
  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div className="flex gap-1.5 pl-10">
      {toolCalls.map((tc, i) => {
        const isWrite = tc.toolName === "update_planned_workout";
        return (
          <span
            key={i}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              isWrite ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
            }`}
          >
            {TOOL_ICONS[tc.toolName] || "🔧"} {tc.toolName}
          </span>
        );
      })}
    </div>
  );
}
