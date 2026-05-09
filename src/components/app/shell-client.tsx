"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

type ActiveKey = "home" | "plan" | "chat" | "review" | "settings";

function getActiveKey(pathname: string): ActiveKey {
  if (pathname.startsWith("/dashboard/plan")) return "plan";
  if (pathname.startsWith("/dashboard/chat")) return "chat";
  if (pathname.startsWith("/dashboard/review")) return "review";
  if (pathname.startsWith("/dashboard/settings")) return "settings";
  return "home";
}

function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activeKey = getActiveKey(pathname);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell">
      {/* Mobile backdrop overlay */}
      <div
        className={`sb-backdrop${sidebarOpen ? " active" : ""}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <Sidebar
        active={activeKey}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", height: "100%" }}>
        {/* Mobile top bar — visible only on mobile via CSS */}
        <div className="mobile-topbar">
          <button
            className="hamburger-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <HamburgerIcon />
          </button>
          <span className="mobile-topbar-brand">Hybro</span>
        </div>

        {children}
      </div>
    </div>
  );
}
