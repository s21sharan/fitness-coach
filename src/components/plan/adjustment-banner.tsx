"use client";

interface Adjustment {
  type: string;
  description: string;
  affected_days: number[];
}

interface CheckIn {
  id: string;
  ai_summary: string;
  risk_flags: string[] | null;
  adjustments: Adjustment[] | null;
}

interface AdjustmentBannerProps {
  checkIn: CheckIn | null;
  onReview: () => void;
  onDismiss: () => void;
}

export function AdjustmentBanner({ checkIn, onReview, onDismiss }: AdjustmentBannerProps) {
  if (!checkIn) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div className="text-xl">💡</div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-amber-900">Weekly Check-in: Plan Adjustment Suggested</p>
        <p className="mt-1 text-sm text-stone-600">{checkIn.ai_summary}</p>
        {checkIn.risk_flags && checkIn.risk_flags.length > 0 && (
          <div className="mt-2 space-y-1">
            {checkIn.risk_flags.map((flag, i) => (
              <p key={i} className="text-xs text-red-600">⚠ {flag}</p>
            ))}
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <button onClick={onReview} className="rounded-lg bg-black px-4 py-1.5 text-sm font-semibold text-white">
            Review Changes
          </button>
          <button onClick={onDismiss} className="rounded-lg border px-4 py-1.5 text-sm">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
