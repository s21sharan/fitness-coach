"use client";

import Link from "next/link";

interface BlockBannerProps {
  blockType: string;
  endDate: string;
  daysUntilEnd: number;
}

const BLOCK_TYPE_LABELS: Record<string, string> = {
  base: "Base",
  build: "Build",
  peak: "Peak",
  taper: "Taper",
  accumulation: "Accumulation",
  intensification: "Intensification",
  deload: "Deload",
};

export function BlockBanner({ blockType, endDate, daysUntilEnd }: BlockBannerProps) {
  if (daysUntilEnd > 3 || daysUntilEnd < 0) return null;

  const endDay = new Date(endDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" });
  const label = BLOCK_TYPE_LABELS[blockType] || blockType;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "8px 16px", marginBottom: 12,
      background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8,
      fontSize: 13, color: "#92400e",
    }}>
      <span>
        Your <strong>{label}</strong> block ends {endDay}
      </span>
      <Link
        href="/dashboard/coach"
        style={{
          color: "#d97706", fontWeight: 600, textDecoration: "none",
          fontSize: 12,
        }}
      >
        Ask Coach →
      </Link>
    </div>
  );
}
