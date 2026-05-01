"use client";

import { useState } from "react";

interface Adjustment {
  type: string;
  description: string;
  affected_days: number[];
}

interface AdjustmentReviewProps {
  checkInId: string;
  summary: string;
  adjustments: Adjustment[];
  riskFlags: string[];
  open: boolean;
  onClose: () => void;
  onApprove: (checkInId: string) => Promise<void>;
  onReject: (checkInId: string) => Promise<void>;
}

export function AdjustmentReview({ checkInId, summary, adjustments, riskFlags, open, onClose, onApprove, onReject }: AdjustmentReviewProps) {
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleApprove = async () => {
    setLoading(true);
    await onApprove(checkInId);
    setLoading(false);
    onClose();
  };

  const handleReject = async () => {
    setLoading(true);
    await onReject(checkInId);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-white p-6">
        <h3 className="text-lg font-semibold">Review Plan Adjustments</h3>
        <p className="mt-2 text-sm text-gray-600">{summary}</p>

        {adjustments.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium text-gray-700">Proposed changes:</p>
            {adjustments.map((adj, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border p-3">
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{adj.type}</span>
                <p className="text-sm text-gray-700">{adj.description}</p>
              </div>
            ))}
          </div>
        )}

        {riskFlags.length > 0 && (
          <div className="mt-4 space-y-1">
            <p className="text-sm font-medium text-red-700">Risk flags:</p>
            {riskFlags.map((flag, i) => (
              <p key={i} className="text-sm text-red-600">⚠ {flag}</p>
            ))}
          </div>
        )}

        <div className="mt-6 flex gap-3 justify-end">
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm" disabled={loading}>Cancel</button>
          <button onClick={handleReject} className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50" disabled={loading}>Reject Changes</button>
          <button onClick={handleApprove} className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-50" disabled={loading}>
            {loading ? "Applying..." : "Approve Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
