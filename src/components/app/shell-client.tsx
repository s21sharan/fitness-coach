"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1.03 1.56V21a2 2 0 11-4 0v-.09a1.7 1.7 0 00-1.11-1.56 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.7 1.7 0 00.34-1.87 1.7 1.7 0 00-1.56-1.03H3a2 2 0 110-4h.09A1.7 1.7 0 004.65 8.6a1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06a1.7 1.7 0 001.87.34H9a1.7 1.7 0 001.03-1.56V3a2 2 0 114 0v.09c0 .67.4 1.27 1.03 1.56a1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06a1.7 1.7 0 00-.34 1.87V9c.29.63.89 1.03 1.56 1.03H21a2 2 0 110 4h-.09a1.7 1.7 0 00-1.51 1.03z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function AnalyticsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 3 3 5-6" />
    </svg>
  );
}

function CoachIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

const linkBase: React.CSSProperties = {
  padding: "6px 10px", borderRadius: 8, fontSize: 13, fontWeight: 600,
  textDecoration: "none", display: "flex", alignItems: "center", gap: 6,
  transition: "background .15s, color .15s",
};

function navLinkStyle(active: boolean): React.CSSProperties {
  return {
    ...linkBase,
    color: active ? "#0F1B22" : "#6b7280",
    background: active ? "#f3f4f6" : "transparent",
  };
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSettings = pathname.startsWith("/dashboard/settings");
  const isCoach = pathname.startsWith("/dashboard/coach");
  const isAnalytics = pathname.startsWith("/dashboard/analytics");
  const isCalendar = !isSettings && !isCoach && !isAnalytics;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg, #f5f7f8)" }}>
      <nav style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        height: 56,
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #e5e7eb",
        flexShrink: 0,
      }}>
        <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit" }}>
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-0.02em" }}>Trainer</span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Link href="/dashboard" style={navLinkStyle(isCalendar)}>
            <CalendarIcon /> Calendar
          </Link>
          <Link href="/dashboard/analytics" style={navLinkStyle(isAnalytics)}>
            <AnalyticsIcon /> Analytics
          </Link>
          <Link href="/dashboard/coach" style={navLinkStyle(isCoach)}>
            <CoachIcon /> Coach
          </Link>
          <Link href="/dashboard/settings" style={navLinkStyle(isSettings)}>
            <SettingsIcon /> Settings
          </Link>
        </div>
      </nav>

      <div style={{ flex: 1, overflow: "auto" }}>
        {children}
      </div>
    </div>
  );
}
