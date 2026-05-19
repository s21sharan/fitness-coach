"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: Array<{ href: string; label: string; match: (p: string) => boolean }> = [
  {
    href: "/dashboard/coach",
    label: "Chat",
    match: (p) => p === "/dashboard/coach" || (p.startsWith("/dashboard/coach") && !p.startsWith("/dashboard/coach/memory")),
  },
  {
    href: "/dashboard/coach/memory",
    label: "Memory",
    match: (p) => p.startsWith("/dashboard/coach/memory"),
  },
];

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "10px 16px",
          borderBottom: "1px solid #e5e7eb",
          background: "rgba(255,255,255,0.6)",
          backdropFilter: "blur(8px)",
          flexShrink: 0,
        }}
      >
        {TABS.map((t) => {
          const active = t.match(pathname);
          return (
            <Link
              key={t.href}
              href={t.href}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
                color: active ? "#0f172a" : "#6b7280",
                background: active ? "#e5e7eb" : "transparent",
                transition: "background .15s, color .15s",
              }}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}
