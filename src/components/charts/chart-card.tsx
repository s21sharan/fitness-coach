"use client";

import { useState, type ReactNode } from "react";

interface ChartCardProps {
  title: string;
  description?: string;
  onClick?: () => void;
  children: ReactNode;
  accent?: string;
}

export function ChartCard({ title, description, onClick, children, accent }: ChartCardProps) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 16,
        cursor: onClick ? "pointer" : "default",
        transition: "transform .15s ease, box-shadow .15s ease, border-color .15s ease",
        boxShadow: hover ? "0 12px 28px rgba(15, 27, 34, 0.08)" : "0 1px 2px rgba(15, 27, 34, 0.03)",
        borderColor: hover ? "#d1d5db" : "#e5e7eb",
        transform: hover && onClick ? "translateY(-1px)" : "translateY(0)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {accent && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, ${accent}, transparent)`,
        }} />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: description ? 4 : 10, gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#111827", letterSpacing: "-0.01em" }}>{title}</span>
        {onClick && (
          <span style={{
            fontSize: 9, fontWeight: 700, color: "#6b7280",
            background: "#f3f4f6", borderRadius: 999, padding: "3px 8px",
            textTransform: "uppercase", letterSpacing: "0.04em",
            opacity: hover ? 1 : 0.6, transition: "opacity .15s",
          }}>Expand</span>
        )}
      </div>
      {description && (
        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 12, lineHeight: 1.5 }}>{description}</div>
      )}
      {children}
    </div>
  );
}
