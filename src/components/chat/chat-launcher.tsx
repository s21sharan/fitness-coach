"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { ChatPanel } from "./chat-panel";

export function ChatLauncher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("hybro-chat-panel-open");
    if (saved === "true") setOpen(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("hybro-chat-panel-open", String(open));
  }, [open]);

  if (pathname === "/dashboard/chat") return null;

  return (
    <>
      <ChatPanel open={open} onClose={() => setOpen(false)} />

      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/40 hover:shadow-xl hover:shadow-indigo-500/50 transition-shadow"
        >
          <span className="text-lg font-bold text-white">C</span>
        </button>
      )}
    </>
  );
}
