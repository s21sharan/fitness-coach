"use client";

import { useEffect, useState } from "react";

interface IntegrationStatus {
  provider: string;
  connected: boolean;
  status: string;
  lastSyncedAt: string | null;
}

const PROVIDER_LABELS: Record<string, string> = {
  macrofactor: "MF",
  hevy: "Hevy",
  strava: "Strava",
  garmin: "Garmin",
};

const STATUS_DOT: Record<string, string> = {
  active: "bg-green-500",
  error: "bg-red-500",
  disconnected: "bg-gray-300",
};

export function SyncStatus() {
  const [statuses, setStatuses] = useState<IntegrationStatus[]>([]);

  useEffect(() => {
    fetch("/api/integrations/status")
      .then((res) => res.json())
      .then((data) => setStatuses(data.integrations))
      .catch(() => {});
  }, []);

  if (statuses.length === 0) return null;

  const connected = statuses.filter((s) => s.connected);
  if (connected.length === 0) return null;

  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="text-sm font-medium text-gray-500">Data Sources</h3>
      <div className="mt-2 flex gap-4">
        {statuses.map((s) => (
          <div key={s.provider} className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${STATUS_DOT[s.status] || STATUS_DOT.disconnected}`} />
            <span className={`text-sm ${s.connected ? "text-gray-700" : "text-gray-400"}`}>
              {PROVIDER_LABELS[s.provider] || s.provider}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
