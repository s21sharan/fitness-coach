"use client";

import { useEffect, useState, useCallback } from "react";
import { Topbar } from "@/components/topbar";

interface Integration {
  provider: string;
  status: string;
  last_synced_at: string | null;
  created_at: string;
}

interface NutritionLog {
  date: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
}

interface WorkoutLog {
  date: string;
  workout_id: string;
  name: string;
  duration_minutes: number;
  exercises: unknown;
}

interface CardioLog {
  date: string;
  activity_id: string;
  type: string;
  distance: number;
  duration: number;
  avg_hr: number | null;
  pace_or_speed: number | null;
  calories: number | null;
}

interface RecoveryLog {
  date: string;
  resting_hr: number | null;
  hrv: number | null;
  sleep_hours: number | null;
  sleep_score: number | null;
  body_battery: number | null;
  stress_level: number | null;
  steps: number | null;
}

interface TestData {
  integrations: Integration[];
  nutrition: NutritionLog[];
  workouts: WorkoutLog[];
  cardio: CardioLog[];
  recovery: RecoveryLog[];
}

interface DayData {
  date: string;
  nutrition: NutritionLog | null;
  workouts: WorkoutLog[];
  cardio: CardioLog[];
  recovery: RecoveryLog | null;
}

const PROVIDERS: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  macrofactor: { label: "MacroFactor", bg: "bg-orange-400", text: "text-orange-600", dot: "bg-orange-400" },
  hevy:        { label: "Hevy",        bg: "bg-green-500",  text: "text-green-600",  dot: "bg-green-500" },
  strava:      { label: "Strava",      bg: "bg-blue-500",   text: "text-blue-600",   dot: "bg-blue-500" },
  garmin:      { label: "Garmin",      bg: "bg-purple-500", text: "text-purple-600", dot: "bg-purple-500" },
};

function formatPace(pace: number): string {
  const mins = Math.floor(pace);
  const secs = Math.round((pace - mins) * 60);
  return `${mins}:${String(secs).padStart(2, "0")}/km`;
}

function buildCalendar(data: TestData): DayData[] {
  const days: DayData[] = [];
  const today = new Date();

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);

    days.push({
      date: dateStr,
      nutrition: data.nutrition.find((n) => n.date === dateStr) || null,
      workouts: data.workouts.filter((w) => w.date === dateStr),
      cardio: data.cardio.filter((c) => c.date === dateStr),
      recovery: data.recovery.find((r) => r.date === dateStr) || null,
    });
  }

  return days;
}

function DayCell({ day }: { day: DayData }) {
  const [expanded, setExpanded] = useState(false);
  const d = new Date(day.date + "T00:00:00");
  const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
  const dayNum = d.getDate();
  const isToday = day.date === new Date().toISOString().slice(0, 10);

  const hasData = day.nutrition || day.workouts.length > 0 || day.cardio.length > 0 || day.recovery;

  return (
    <div
      className={`rounded-lg border p-2 cursor-pointer transition-colors ${
        isToday ? "border-blue-500 bg-blue-50/50" : hasData ? "bg-white hover:bg-gray-50" : "bg-gray-50/50"
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between">
        <div>
          <span className={`text-xs ${isToday ? "font-bold text-blue-600" : "text-gray-500"}`}>{dayName}</span>
          <span className={`ml-1 text-sm font-semibold ${isToday ? "text-blue-700" : ""}`}>{dayNum}</span>
        </div>
        <div className="flex gap-1">
          {day.nutrition && <span className={`h-2 w-2 rounded-full ${PROVIDERS.macrofactor.dot}`} title="MacroFactor" />}
          {day.workouts.length > 0 && <span className={`h-2 w-2 rounded-full ${PROVIDERS.hevy.dot}`} title="Hevy" />}
          {day.cardio.length > 0 && <span className={`h-2 w-2 rounded-full ${PROVIDERS.strava.dot}`} title="Strava" />}
          {day.recovery && <span className={`h-2 w-2 rounded-full ${PROVIDERS.garmin.dot}`} title="Garmin" />}
        </div>
      </div>

      {expanded && hasData && (
        <div className="mt-2 space-y-2 border-t pt-2 text-xs">
          {day.nutrition && (
            <div className="space-y-0.5">
              <p className={`font-semibold ${PROVIDERS.macrofactor.text}`}>MacroFactor</p>
              <p>{day.nutrition.calories} cal · {day.nutrition.protein}g P · {day.nutrition.carbs}g C · {day.nutrition.fat}g F</p>
              {day.nutrition.fiber && <p className="text-gray-400">Fiber: {day.nutrition.fiber}g</p>}
            </div>
          )}

          {day.workouts.map((w, i) => (
            <div key={i} className="space-y-0.5">
              <p className={`font-semibold ${PROVIDERS.hevy.text}`}>Hevy: {w.name}</p>
              <p>{w.duration_minutes} min · {Array.isArray(w.exercises) ? w.exercises.length : 0} exercises</p>
            </div>
          ))}

          {day.cardio.map((c, i) => (
            <div key={i} className="space-y-0.5">
              <p className={`font-semibold ${PROVIDERS.strava.text}`}>Strava: {c.type}</p>
              <p>
                {c.distance} km · {Math.round(c.duration / 60)} min
                {c.avg_hr ? ` · ${c.avg_hr} bpm` : ""}
                {c.pace_or_speed ? ` · ${formatPace(c.pace_or_speed)}` : ""}
              </p>
              {c.calories && <p className="text-gray-400">{c.calories} cal burned</p>}
            </div>
          ))}

          {day.recovery && (
            <div className="space-y-0.5">
              <p className={`font-semibold ${PROVIDERS.garmin.text}`}>Garmin</p>
              <div className="flex flex-wrap gap-2">
                {day.recovery.hrv !== null && <span>HRV {day.recovery.hrv}</span>}
                {day.recovery.sleep_hours !== null && <span>Sleep {day.recovery.sleep_hours}h</span>}
                {day.recovery.resting_hr !== null && <span>RHR {day.recovery.resting_hr}</span>}
                {day.recovery.body_battery !== null && <span>BB {day.recovery.body_battery}</span>}
                {day.recovery.stress_level !== null && <span>Stress {day.recovery.stress_level}</span>}
                {day.recovery.steps !== null && <span>{day.recovery.steps?.toLocaleString()} steps</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<TestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/test-data");
    if (res.ok) {
      setData(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const triggerSync = async (provider: string) => {
    setSyncing(provider);
    await fetch(`/api/integrations/${provider}/sync`, { method: "POST" });
    setTimeout(() => {
      fetchData();
      setSyncing(null);
    }, 3000);
  };

  const allProviders = ["macrofactor", "hevy", "strava", "garmin"];

  return (
    <>
      <Topbar title="Dashboard" subtitle="Integration data · last 30 days" />
      <div className="main">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
          </div>
        ) : !data ? (
          <p className="text-gray-500">Failed to load data.</p>
        ) : (
          <div className="space-y-6">
            {/* Connection Status */}
            <div className="rounded-lg border bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Connections</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {allProviders.map((provider) => {
                  const p = PROVIDERS[provider];
                  const integration = data.integrations.find((i) => i.provider === provider);
                  const connected = !!integration;
                  const dotColor = connected
                    ? integration.status === "error" ? "bg-red-500" : integration.status === "expired" ? "bg-yellow-500" : p.dot
                    : "bg-gray-300";

                  return (
                    <div key={provider} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <div className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
                        <div>
                          <p className="text-sm font-medium">{p.label}</p>
                          {connected && integration.last_synced_at && (
                            <p className="text-[10px] text-gray-400">
                              Synced {new Date(integration.last_synced_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      {connected && (
                        <button
                          onClick={() => triggerSync(provider)}
                          disabled={syncing === provider}
                          className="rounded bg-gray-100 px-2 py-1 text-[10px] font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-50"
                        >
                          {syncing === provider ? "..." : "Sync"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Data Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([
                { key: "macrofactor", count: data.nutrition.length, label: "Nutrition Days" },
                { key: "hevy",        count: data.workouts.length,  label: "Workouts" },
                { key: "strava",      count: data.cardio.length,    label: "Cardio Sessions" },
                { key: "garmin",      count: data.recovery.length,  label: "Recovery Days" },
              ] as const).map((item) => (
                <div key={item.key} className="rounded-lg border bg-white p-4 text-center">
                  <p className={`text-2xl font-bold ${PROVIDERS[item.key].text}`}>{item.count}</p>
                  <p className="text-xs text-gray-500">{item.label}</p>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs text-gray-500">
              {allProviders.map((key) => (
                <span key={key} className="flex items-center gap-1">
                  <span className={`h-2 w-2 rounded-full ${PROVIDERS[key].dot}`} />
                  {PROVIDERS[key].label}
                </span>
              ))}
              <span className="text-gray-400">· Click a day to expand</span>
            </div>

            {/* Calendar Grid */}
            <div className="rounded-lg border bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Last 30 Days</h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-7 gap-2">
                {buildCalendar(data).map((day) => (
                  <DayCell key={day.date} day={day} />
                ))}
              </div>
            </div>

            {/* Raw MacroFactor Data Table */}
            {data.nutrition.length > 0 && (
              <div className="rounded-lg border bg-white p-4">
                <h2 className={`text-sm font-semibold mb-3 ${PROVIDERS.macrofactor.text}`}>MacroFactor Data</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-gray-500">
                        <th className="pb-2 pr-4">Date</th>
                        <th className="pb-2 pr-4">Calories</th>
                        <th className="pb-2 pr-4">Protein</th>
                        <th className="pb-2 pr-4">Carbs</th>
                        <th className="pb-2 pr-4">Fat</th>
                        <th className="pb-2">Fiber</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.nutrition.map((n) => (
                        <tr key={n.date} className="border-b last:border-0">
                          <td className="py-2 pr-4 text-gray-700">{n.date}</td>
                          <td className="py-2 pr-4 font-medium">{n.calories ?? "—"}</td>
                          <td className="py-2 pr-4">{n.protein ?? "—"}g</td>
                          <td className="py-2 pr-4">{n.carbs ?? "—"}g</td>
                          <td className="py-2 pr-4">{n.fat ?? "—"}g</td>
                          <td className="py-2">{n.fiber ?? "—"}g</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
