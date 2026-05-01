"use client";

interface Completion {
  workout?: { name: string; duration_minutes: number; exercise_count: number };
  cardio?: Array<{ type: string; distance: number; duration: number; avg_hr: number | null; pace_or_speed: number | null }>;
}

interface DayCardProps {
  dayName: string;
  dateStr: string;
  sessionType: string;
  status: "scheduled" | "completed" | "missed";
  isToday: boolean;
  aiNotes: string | null;
  completion: Completion | null;
}

function formatPace(paceMinPerKm: number): string {
  const mins = Math.floor(paceMinPerKm);
  const secs = Math.round((paceMinPerKm - mins) * 60);
  return `${mins}:${String(secs).padStart(2, "0")}/km`;
}

function getSessionBadgeColor(sessionType: string): string {
  const lower = sessionType.toLowerCase();
  if (sessionType === "Rest") return "bg-gray-100 text-gray-500";
  if (lower.includes("tempo") || lower.includes("long") || lower.includes("brick") || lower.includes("interval")) {
    return "bg-amber-50 text-amber-700";
  }
  if (lower.includes("run") || lower.includes("ride")) return "bg-blue-50 text-blue-700";
  if (lower.includes("swim")) return "bg-indigo-50 text-indigo-700";
  return "bg-green-50 text-green-700";
}

function getBorderColor(status: string, isToday: boolean): string {
  if (isToday) return "border-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.15)]";
  if (status === "completed") return "border-green-500";
  if (status === "missed") return "border-red-300 bg-red-50/30";
  return "border-gray-200";
}

export function DayCard({ dayName, dateStr, sessionType, status, isToday, aiNotes, completion }: DayCardProps) {
  const isRest = sessionType === "Rest";
  const borderColor = getBorderColor(status, isToday);
  const sessions = sessionType.split(" + ");

  return (
    <div className={`flex flex-col items-center rounded-xl border-2 p-3 bg-white ${borderColor}`}>
      <div className={`text-[11px] font-semibold uppercase ${isToday ? "text-blue-600 font-bold" : "text-gray-500"}`}>
        {isToday ? "Today" : dayName}
      </div>
      <div className="text-[13px] text-gray-400">{dateStr}</div>

      <div className="mt-2 flex flex-col items-center gap-1">
        {sessions.map((s, i) => (
          <span key={i} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getSessionBadgeColor(s.trim())}`}>
            {s.trim()}
          </span>
        ))}
      </div>

      <div className="mt-2 text-center">
        {status === "completed" && (
          <>
            <div className="text-green-500 text-base">✓</div>
            {completion?.workout && (
              <div className="text-[10px] text-gray-600 leading-relaxed">
                <div>{completion.workout.duration_minutes} min</div>
                <div>{completion.workout.exercise_count} exercises</div>
              </div>
            )}
            {completion?.cardio?.map((c, i) => (
              <div key={i} className="text-[10px] text-blue-600 leading-relaxed">
                <div>{c.distance} km</div>
                {c.pace_or_speed && <div>{formatPace(c.pace_or_speed)}</div>}
                {c.avg_hr && <div>{c.avg_hr} bpm</div>}
              </div>
            ))}
          </>
        )}

        {status === "missed" && (
          <span className="text-[11px] font-medium text-red-500">Missed</span>
        )}

        {status === "scheduled" && !isRest && (
          <span className="text-[11px] text-gray-500">Scheduled</span>
        )}

        {isRest && (
          <>
            <div className="text-gray-300 text-lg">—</div>
            <span className="text-[10px] text-gray-400">Recovery day</span>
          </>
        )}
      </div>

      {aiNotes && (
        <div className="mt-1 text-[10px] text-blue-500 italic text-center leading-tight">
          {aiNotes}
        </div>
      )}
    </div>
  );
}
