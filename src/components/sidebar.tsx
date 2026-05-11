"use client";

import Link from "next/link";
import { Icon } from "@/components/app/icon";

type ActiveKey = "home" | "settings";

interface SidebarProps {
  active?: ActiveKey;
  open?: boolean;
  onClose?: () => void;
}

const items: { key: ActiveKey; label: string; icon: string; href: string; badge?: string }[] = [
  { key: "home", label: "Dashboard", icon: "home", href: "/dashboard" },
  { key: "settings", label: "Settings", icon: "settings", href: "/dashboard/settings" },
];

export function Sidebar({ active = "home", open = false, onClose }: SidebarProps) {
  return (
    <aside className={`sb${open ? " open" : ""}`}>
      <div className="sb-brand-close-row">
        <div className="sb-brand">
          <div className="mark">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 4v16M5 12h7M12 4v16M19 7l3 3-3 3M19 14l3 3-3 3"
                stroke="#F6B7A6"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          Hybro
        </div>
        {onClose && (
          <button className="sb-close-btn" onClick={onClose} aria-label="Close sidebar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <div className="sb-section">Workspace</div>
      {items.map((it) => (
        <Link
          key={it.key}
          href={it.href}
          className={`sb-link ${active === it.key ? "active" : ""}`}
          onClick={onClose}
        >
          <span className="ico">
            <Icon name={it.icon} size={18} />
          </span>
          <span style={{ flex: 1 }}>{it.label}</span>
          {it.badge && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                padding: "2px 7px",
                borderRadius: 6,
                background: active === it.key ? "var(--coral)" : "var(--coral-soft)",
                color: active === it.key ? "var(--ink)" : "var(--coral-deep)",
                letterSpacing: ".06em",
              }}
            >
              {it.badge}
            </span>
          )}
        </Link>
      ))}
      <div className="sb-foot">
        <div className="ava"></div>
        <div className="info">
          <p>Athlete</p>
          <h5>Alex Carter</h5>
        </div>
        <Icon name="settings" size={16} />
      </div>
    </aside>
  );
}
