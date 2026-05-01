"use client";

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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activeKey = getActiveKey(pathname);

  return (
    <div className="app-shell">
      <Sidebar active={activeKey} />
      <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", height: "100%" }}>
        {children}
      </div>
    </div>
  );
}
