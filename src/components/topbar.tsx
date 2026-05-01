"use client";

import { Icon } from "@/components/app/icon";

interface TopbarProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function Topbar({ title, subtitle, right }: TopbarProps) {
  return (
    <div className="tb">
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: ".12em",
            marginBottom: 2,
          }}
        >
          {subtitle || "Workspace"}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>{title}</div>
      </div>
      <div className="tb-search-wrap">
        <span className="si">
          <Icon name="search" size={16} />
        </span>
        <input className="tb-search" placeholder="Ask your coach or search…" style={{ width: "100%" }} />
      </div>
      <div className="tb-actions">
        {right}
        <div className="tb-icon">
          <Icon name="bell" size={16} />
        </div>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "linear-gradient(135deg,#F6B7A6,#EE9A85)",
            cursor: "pointer",
          }}
        ></div>
      </div>
    </div>
  );
}
