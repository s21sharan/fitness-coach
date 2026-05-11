"use client";

import { useEffect, useCallback } from "react";

interface ChartModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  insight?: string | null;
  insightLoading?: boolean;
}

export function ChartModal({ open, onClose, title, children, insight, insightLoading }: ChartModalProps) {
  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [open, handleEsc]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff", borderRadius: 12,
          width: "min(90vw, 1000px)", maxHeight: "85vh",
          overflow: "auto", padding: 28,
          boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0 }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: "#f3f4f6", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, color: "#6b7280",
            }}
          >
            ×
          </button>
        </div>

        {/* Chart */}
        <div style={{ marginBottom: 20 }}>
          {children}
        </div>

        {/* AI Insight */}
        {(insight || insightLoading) && (
          <div style={{
            background: "#f8fafc", border: "1px solid #e2e8f0",
            borderRadius: 8, padding: "14px 16px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 12 }}>🤖</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                AI Coach Insight
              </span>
            </div>
            {insightLoading ? (
              <div style={{ color: "#94a3b8", fontSize: 13, fontStyle: "italic" }}>Analyzing your data...</div>
            ) : (
              <p style={{ fontSize: 13, lineHeight: 1.65, color: "#334155", margin: 0 }}>{insight}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
