import { auth } from "@clerk/nextjs/server";

export default async function SettingsPage() {
  const { userId } = await auth();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="rounded-lg border bg-white p-6">
        <h2 className="text-lg font-semibold">Integrations</h2>
        <p className="mt-1 text-sm text-gray-500">
          Connect your fitness apps to get started.
        </p>
        <div className="mt-4 space-y-3">
          {["MacroFactor", "Hevy", "Strava", "Garmin", "Google Calendar"].map(
            (name) => (
              <div
                key={name}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <span className="font-medium">{name}</span>
                <span className="text-sm text-gray-400">Not connected</span>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
