"use client";

type CardColor = "coral" | "mint" | "sky" | "lemon";
type CardSize = "md" | "lg";

interface OptionCardProps {
  emoji?: string;
  label: string;
  sub?: string;
  selected: boolean;
  color?: CardColor;
  size?: CardSize;
  onClick: () => void;
}

const colorMap: Record<CardColor, string> = {
  coral: "var(--coral-soft)",
  mint: "var(--mint-soft)",
  sky: "var(--sky-soft)",
  lemon: "var(--lemon)",
};

export function OptionCard({
  emoji,
  label,
  sub,
  selected,
  color = "coral",
  size = "md",
  onClick,
}: OptionCardProps) {
  const isLg = size === "lg";

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: isLg ? 10 : 6,
        padding: isLg ? "22px 16px" : "14px 12px",
        borderRadius: "var(--r-lg)",
        border: selected ? "2px solid var(--ink)" : "1px solid var(--line)",
        background: selected ? colorMap[color] : "#fff",
        cursor: "pointer",
        transition: "transform 0.15s, box-shadow 0.15s, background 0.15s",
        transform: selected ? "translateY(-3px)" : "none",
        boxShadow: selected
          ? "0 8px 24px rgba(15,27,34,0.12)"
          : "0 1px 0 var(--line-2)",
        textAlign: "center",
        width: "100%",
      }}
    >
      {selected && (
        <span
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "var(--ink)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
            <path
              d="M2 6l3 3 5-5"
              stroke="#fff"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}
      {emoji && (
        <span style={{ fontSize: isLg ? 38 : 28, lineHeight: 1 }}>{emoji}</span>
      )}
      <span
        style={{
          fontSize: isLg ? 18 : 15,
          fontWeight: 800,
          color: "var(--ink)",
          lineHeight: 1.2,
        }}
      >
        {label}
      </span>
      {sub && (
        <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>
          {sub}
        </span>
      )}
    </button>
  );
}
