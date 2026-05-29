"use client";

import { useEffect, useState } from "react";
import { RaceCountdownStrip } from "./race-countdown-strip";

interface RaceEvent {
  id: string;
  name: string;
  event_date: string;
  priority: string | null;
}

interface DailySummaryData {
  summary: string | null;
  generated_at: string | null;
  cached: boolean;
}

function formatGreeting(): string {
  const now = new Date();
  const day = now.toLocaleDateString("en-US", { weekday: "long" });
  const month = now.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  return `${day}, ${month}`;
}

export function DailySummaryCard() {
  const [data, setData] = useState<DailySummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<RaceEvent[]>([]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    fetch("/api/daily-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: today }),
    })
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false));

    fetch("/api/events")
      .then((res) => res.json())
      .then((json) => setEvents(json.events || []))
      .catch(() => setEvents([]));
  }, []);

  // Error state — hide the card entirely
  if (!loading && !data) return null;

  // No data for today — show muted message
  if (!loading && data && !data.summary) {
    return (
      <div style={{
        background: "#f9fafb",
        borderRadius: 10,
        padding: "16px 20px",
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 4 }}>Today</div>
        <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>{formatGreeting()}</div>
        <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 10 }}>
          No data synced for today yet.
        </div>
        <RaceCountdownStrip events={events} />
      </div>
    );
  }

  return (
    <div style={{
      background: "#f9fafb",
      borderRadius: 10,
      padding: "16px 20px",
      marginBottom: 16,
    }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 4 }}>Today</div>
      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500, marginBottom: 10 }}>{formatGreeting()}</div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ height: 12, background: "#e5e7eb", borderRadius: 4, width: "100%", animation: "pulse 1.5s ease-in-out infinite" }} />
          <div style={{ height: 12, background: "#e5e7eb", borderRadius: 4, width: "92%", animation: "pulse 1.5s ease-in-out infinite", animationDelay: "0.2s" }} />
          <div style={{ height: 12, background: "#e5e7eb", borderRadius: 4, width: "78%", animation: "pulse 1.5s ease-in-out infinite", animationDelay: "0.4s" }} />
        </div>
      ) : (
        <div style={{ fontSize: 13, lineHeight: 1.65, color: "#374151" }}>
          {data!.summary}
        </div>
      )}

      {!loading && <RaceCountdownStrip events={events} />}
    </div>
  );
}
