"use client";

interface IntegrationCardProps {
  name: string;
  description: string;
  provider: string;
  connected: boolean;
  status: string;
  lastSyncedAt: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: "Connected", className: "bg-green-100 text-green-700" },
  error: { label: "Sync error", className: "bg-red-100 text-red-700" },
  expired: { label: "Expired", className: "bg-yellow-100 text-yellow-700" },
  disconnected: { label: "Not connected", className: "bg-gray-100 text-gray-500" },
};

export function IntegrationCard({
  name,
  description,
  provider,
  connected,
  status,
  lastSyncedAt,
  onConnect,
  onDisconnect,
}: IntegrationCardProps) {
  const badge = STATUS_BADGE[status] || STATUS_BADGE.disconnected;

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <p className="font-medium">{name}</p>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
            {badge.label}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-gray-500">{description}</p>
        {connected && lastSyncedAt && (
          <p className="mt-0.5 text-xs text-gray-400">
            Last synced {formatTimeAgo(lastSyncedAt)}
          </p>
        )}
      </div>
      <div>
        {connected ? (
          <button
            type="button"
            onClick={onDisconnect}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Connect
          </button>
        )}
      </div>
    </div>
  );
}
