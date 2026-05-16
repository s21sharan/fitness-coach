"use client";

interface BetaAcknowledgeModalProps {
  open: boolean;
  onClose: () => void;
  onAcknowledge: () => void;
}

export function BetaAcknowledgeModal({ open, onClose, onAcknowledge }: BetaAcknowledgeModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Garmin</h3>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              background: "var(--lemon-soft, #fef3c7)",
              color: "var(--lemon-deep, #92400e)",
              borderRadius: 999,
              padding: "2px 8px",
            }}
          >
            Beta
          </span>
        </div>

        <div className="mt-4 space-y-3 text-sm text-gray-700">
          <p>
            Garmin is a beta integration. Unlike Hevy and Strava, it uses an unofficial Garmin
            Connect endpoint instead of a sanctioned developer API.
          </p>
          <p className="font-semibold">What to expect:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Garmin aggressively rate-limits this endpoint — first sync may fail with an IP block, sometimes for hours or days.</li>
            <li>If Garmin changes their internal API, sync can stop working with no warning.</li>
            <li>Fixes aren't guaranteed to land quickly.</li>
            <li>Your data (HRV, sleep, VO2 max, training effect, HR zones, splits, recovery time) only flows in when sync succeeds.</li>
          </ul>
          <p>
            For most users Hevy + Strava is the smoother path. Connect Garmin if you specifically
            want recovery metrics and activity enrichment.
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onAcknowledge}
            className="rounded-lg bg-black px-4 py-2 text-sm text-white"
          >
            I understand, connect Garmin
          </button>
        </div>
      </div>
    </div>
  );
}
