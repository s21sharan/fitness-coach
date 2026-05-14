"use client";

import { useState, useRef, useEffect } from "react";
import { Icon } from "@/components/app/icon";

interface ChatInputDropdownProps {
  onReviewCheckins: () => void;
}

export function ChatInputDropdown({ onReviewCheckins }: ChatInputDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: 32, height: 32, borderRadius: "50%",
          background: open ? "var(--bg-2, #f0f0f0)" : "transparent",
          border: "none", cursor: "pointer",
          display: "grid", placeItems: "center",
          color: "var(--ink-2, #6b7280)", flexShrink: 0,
        }}
      >
        <Icon name="more" size={16} />
      </button>

      {open && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: 0,
          background: "#fff", borderRadius: 12, padding: 4,
          boxShadow: "0 4px 20px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)",
          minWidth: 180, zIndex: 50,
        }}>
          <button
            type="button"
            onClick={() => { onReviewCheckins(); setOpen(false); }}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              width: "100%", padding: "10px 12px", borderRadius: 8,
              border: "none", background: "transparent",
              fontSize: 13, color: "var(--ink, #0F1B22)",
              cursor: "pointer", textAlign: "left",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-2, #f5f5f5)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <Icon name="camera" size={15} />
            Review Check-ins
          </button>
        </div>
      )}
    </div>
  );
}
