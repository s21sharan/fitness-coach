"use client";

import Link from "next/link";
import { Icon } from "@/components/app/icon";
import { PulsePill } from "@/components/app/pulse-pill";

type ActiveKey = "home" | "plan" | "chat" | "review" | "settings";

interface SidebarProps {
  active?: ActiveKey;
}

const items: { key: ActiveKey; label: string; icon: string; href: string; badge?: string }[] = [
  { key: "home", label: "Today", icon: "home", href: "/dashboard" },
  { key: "plan", label: "My Plan", icon: "plan", href: "/dashboard/plan" },
  { key: "chat", label: "Coach", icon: "chat", href: "/dashboard/chat", badge: "AI" },
  { key: "review", label: "Weekly Review", icon: "review", href: "/dashboard/review" },
  { key: "settings", label: "Settings", icon: "settings", href: "/dashboard/settings" },
];

export function Sidebar({ active = "home" }: SidebarProps) {
  return (
    <aside className="sb">
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
      <div className="sb-section">Workspace</div>
      {items.map((it) => (
        <Link key={it.key} href={it.href} className={`sb-link ${active === it.key ? "active" : ""}`}>
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
      <div className="sb-section">Today&apos;s pulse</div>
      <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        <PulsePill label="Recovery" value="78" tone="mint" />
        <PulsePill label="Calories" value="1,847" tone="coral" />
        <PulsePill label="Sleep" value="7h 12m" tone="sky" />
      </div>
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
