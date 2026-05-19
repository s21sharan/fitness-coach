"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AthleteFact, FactLifecycle } from "@/lib/athlete-context/types";

const LIFECYCLE_LABEL: Record<FactLifecycle, string> = {
  chronic: "Long-term",
  standing: "Preferences & habits",
  recent: "Recent",
  ephemeral: "Just observed",
};

const LIFECYCLE_BADGE: Record<FactLifecycle, { bg: string; fg: string }> = {
  chronic: { bg: "#fee2e2", fg: "#991b1b" },
  standing: { bg: "#dbeafe", fg: "#1e40af" },
  recent: { bg: "#fef3c7", fg: "#92400e" },
  ephemeral: { bg: "#e2e8f0", fg: "#475569" },
};

const STATUS_BADGE: Record<string, { bg: string; fg: string }> = {
  active: { bg: "#dcfce7", fg: "#166534" },
  expired: { bg: "#f1f5f9", fg: "#475569" },
  superseded: { bg: "#fef9c3", fg: "#854d0e" },
  archived: { bg: "#fee2e2", fg: "#991b1b" },
};

interface FactsPanelProps {
  onToast: (message: string) => void;
}

export function FactsPanel({ onToast }: FactsPanelProps) {
  const [facts, setFacts] = useState<AthleteFact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<{ id: string; summary: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/athlete-facts");
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { facts: AthleteFact[] };
      setFacts(data.facts);
    } catch (e) {
      console.error("load facts failed", e);
      onToast("Couldn't load coach memory.");
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleArchive = useCallback(async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch("/api/athlete-facts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factId: id, action: "archive" }),
      });
      if (!res.ok) throw new Error();
      onToast("Fact archived.");
      await load();
    } catch {
      onToast("Failed to archive.");
    } finally {
      setBusyId(null);
    }
  }, [load, onToast]);

  const handleSaveEdit = useCallback(async () => {
    if (!editing) return;
    setBusyId(editing.id);
    try {
      const res = await fetch("/api/athlete-facts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factId: editing.id, action: "edit", summary: editing.summary }),
      });
      if (!res.ok) throw new Error();
      setEditing(null);
      onToast("Fact updated.");
      await load();
    } catch {
      onToast("Failed to update.");
    } finally {
      setBusyId(null);
    }
  }, [editing, load, onToast]);

  const visibleFacts = useMemo(
    () => facts.filter((f) => (showInactive ? true : f.status === "active")),
    [facts, showInactive],
  );

  const grouped = useMemo(() => {
    const out: Record<FactLifecycle, AthleteFact[]> = {
      chronic: [],
      standing: [],
      recent: [],
      ephemeral: [],
    };
    for (const f of visibleFacts) out[f.lifecycle].push(f);
    return out;
  }, [visibleFacts]);

  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 12 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Coach memory</div>
          <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
            Durable facts your coach has learned about you from chats, completion notes, skip
            reasons, and accepted plans. Archive anything you don&apos;t want carried forward —
            the coach will stop referencing it.
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show inactive
        </label>
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: "var(--muted)" }}>Loading…</div>
      ) : visibleFacts.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--muted)", padding: "20px 0" }}>
          No facts yet. As you chat with the coach, log completion notes, or accept plans, durable
          facts will accumulate here.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {(["chronic", "standing", "recent", "ephemeral"] as const).map((lc) => {
            const rows = grouped[lc];
            if (rows.length === 0) return null;
            const badge = LIFECYCLE_BADGE[lc];
            return (
              <div key={lc}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      padding: "2px 7px",
                      borderRadius: 4,
                      background: badge.bg,
                      color: badge.fg,
                    }}
                  >
                    {LIFECYCLE_LABEL[lc]}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    {rows.length} fact{rows.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {rows.map((f) => {
                    const isEditing = editing?.id === f.id;
                    const statusBadge = STATUS_BADGE[f.status] ?? STATUS_BADGE.active;
                    return (
                      <div
                        key={f.id}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                          background: f.status === "active" ? "#fff" : "#f8fafc",
                          opacity: f.status === "active" ? 1 : 0.7,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                              {f.category}
                            </span>
                            {f.subject && (
                              <span style={{ fontSize: 11, color: "#475569" }}>
                                · {f.subject}
                              </span>
                            )}
                            {f.status !== "active" && (
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  letterSpacing: "0.08em",
                                  textTransform: "uppercase",
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  background: statusBadge.bg,
                                  color: statusBadge.fg,
                                }}
                              >
                                {f.status}
                              </span>
                            )}
                          </div>
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            {f.status === "active" && !isEditing && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setEditing({ id: f.id, summary: f.summary })}
                                  disabled={busyId !== null}
                                  style={btnLink}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleArchive(f.id)}
                                  disabled={busyId !== null}
                                  style={btnLink}
                                >
                                  Archive
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        {isEditing ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <textarea
                              value={editing!.summary}
                              onChange={(e) => setEditing({ id: editing!.id, summary: e.target.value })}
                              autoFocus
                              maxLength={280}
                              style={{
                                width: "100%",
                                minHeight: 60,
                                padding: 8,
                                fontSize: 13,
                                borderRadius: 6,
                                border: "1px solid #cbd5e1",
                                background: "#fff",
                                resize: "vertical",
                                fontFamily: "inherit",
                                outline: "none",
                              }}
                            />
                            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                onClick={() => setEditing(null)}
                                disabled={busyId !== null}
                                style={btnSecondary}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleSaveEdit()}
                                disabled={busyId !== null || editing!.summary.trim().length < 3}
                                style={btnPrimary}
                              >
                                {busyId === editing!.id ? "Saving…" : "Save"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.5 }}>
                            {f.summary}
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
                          {formatRelative(f.observed_at)} · source: {f.source}
                          {f.expires_at && f.status === "active" && ` · expires ${formatRelative(f.expires_at)}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const btnLink: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#3b82f6",
  fontSize: 12,
  fontWeight: 600,
  padding: 0,
  cursor: "pointer",
};

const btnPrimary: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  background: "#0f172a",
  color: "#fff",
  fontSize: 12,
  fontWeight: 700,
  border: "none",
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  background: "#fff",
  color: "#0f172a",
  fontSize: 12,
  fontWeight: 700,
  border: "1px solid #cbd5e1",
  cursor: "pointer",
};

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = then - now;
  const abs = Math.abs(diff);
  const past = diff < 0;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  let value: string;
  if (abs < hour) value = `${Math.max(1, Math.round(abs / minute))}m`;
  else if (abs < day) value = `${Math.round(abs / hour)}h`;
  else if (abs < 30 * day) value = `${Math.round(abs / day)}d`;
  else value = `${Math.round(abs / (30 * day))}mo`;
  return past ? `${value} ago` : `in ${value}`;
}
