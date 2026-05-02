"use client";

import { Icon } from "@/components/app/icon";

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
  visible?: boolean;
  onApprove?: (checkInId: string) => void;
  onReject?: (checkInId: string) => void;
  /** Legacy prop — opens a review modal */
  onReview?: () => void;
  /** Legacy prop — dismisses without action */
  onDismiss?: () => void;
}

export function AdjustmentBanner({
  checkIn,
  visible = true,
  onApprove,
  onReject,
  onReview,
  onDismiss,
}: AdjustmentBannerProps) {
  if (!checkIn || !visible) return null;

  const changeCount = checkIn.adjustments?.length ?? 0;

  const handleApprove = () => {
    if (onApprove) onApprove(checkIn.id);
    else if (onReview) onReview();
  };

  const handleReject = () => {
    if (onReject) onReject(checkIn.id);
    else if (onDismiss) onDismiss();
  };

  return (
    <div
      className="card"
      style={{
        padding: 18,
        marginBottom: 18,
        background: "linear-gradient(120deg, var(--ink) 0%, #1f2c38 100%)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        gap: 18,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Coral blob overlay */}
      <div
        className="blob"
        style={{
          width: 200,
          height: 200,
          background: "var(--coral)",
          opacity: 0.3,
          top: -60,
          right: 80,
        }}
      />

      {/* Sparkle icon */}
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          background: "var(--coral)",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          position: "relative",
        }}
      >
        <Icon name="sparkle" size={20} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, position: "relative" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: "var(--coral)",
            letterSpacing: ".1em",
            textTransform: "uppercase",
            marginBottom: 2,
          }}
        >
          Coach proposal · awaiting approval
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: "rgba(255,255,255,0.85)",
            lineHeight: 1.5,
          }}
        >
          {checkIn.ai_summary}
        </p>
        {checkIn.risk_flags && checkIn.risk_flags.length > 0 && (
          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {checkIn.risk_flags.map((flag, i) => (
              <span
                key={i}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.65)",
                  background: "rgba(255,255,255,0.1)",
                  padding: "2px 8px",
                  borderRadius: 6,
                }}
              >
                ⚠ {flag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, position: "relative" }}>
        <button
          onClick={handleReject}
          className="btn-ghost"
          style={{
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "#fff",
          }}
        >
          Reject
        </button>
        <button onClick={handleApprove} className="btn-coral">
          Approve{changeCount > 0 ? ` · ${changeCount} change${changeCount !== 1 ? "s" : ""}` : ""}
        </button>
      </div>
    </div>
  );
}
