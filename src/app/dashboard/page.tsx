import { auth } from "@clerk/nextjs/server";
import { SyncStatus } from "@/components/dashboard/sync-status";

export default async function DashboardPage() {
  const { userId } = await auth();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <SyncStatus />

      {/* Today Card */}
      <div className="rounded-lg border bg-white p-6">
        <h2 className="text-sm font-medium text-gray-500">Today</h2>
        <p className="mt-2 text-xl font-semibold">Rest Day</p>
        <p className="mt-1 text-sm text-gray-500">
          No session planned. Connect your integrations to get started.
        </p>
      </div>

      {/* This Week */}
      <div className="rounded-lg border bg-white p-6">
        <h2 className="text-sm font-medium text-gray-500">This Week</h2>
        <div className="mt-4 grid grid-cols-7 gap-2">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div
              key={day}
              className="flex flex-col items-center rounded-lg border p-3"
            >
              <span className="text-xs text-gray-500">{day}</span>
              <span className="mt-1 text-sm text-gray-400">--</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-white p-6">
          <h3 className="text-sm font-medium text-gray-500">Calories</h3>
          <p className="mt-2 text-2xl font-bold">--</p>
          <p className="text-sm text-gray-400">No data yet</p>
        </div>
        <div className="rounded-lg border bg-white p-6">
          <h3 className="text-sm font-medium text-gray-500">Weight Trend</h3>
          <p className="mt-2 text-2xl font-bold">--</p>
          <p className="text-sm text-gray-400">No data yet</p>
        </div>
        <div className="rounded-lg border bg-white p-6">
          <h3 className="text-sm font-medium text-gray-500">Recovery</h3>
          <p className="mt-2 text-2xl font-bold">--</p>
          <p className="text-sm text-gray-400">No data yet</p>
        </div>
      </div>
    </div>
  );
}
