"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AthleteFact } from "@/lib/athlete-context/types";
import { CreateMemoryForm } from "@/components/memory/create-memory-form";
import { MemoryList } from "@/components/memory/memory-list";

interface VocabPayload {
  categories: string[];
  predicates: string[];
  lifecycles: string[];
}

export default function CoachMemoryPage() {
  const [facts, setFacts] = useState<AthleteFact[]>([]);
  const [vocab, setVocab] = useState<VocabPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/athlete-facts");
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { facts: AthleteFact[]; vocab: VocabPayload };
      setFacts(data.facts);
      setVocab(data.vocab);
    } catch (e) {
      console.error("load facts failed", e);
      setToast("Couldn't load coach memory.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  const stats = useMemo(() => {
    const active = facts.filter((f) => f.status === "active");
    const chronic = active.filter((f) => f.lifecycle === "chronic").length;
    const standing = active.filter((f) => f.lifecycle === "standing").length;
    const recent = active.filter((f) => f.lifecycle === "recent").length;
    const ephemeral = active.filter((f) => f.lifecycle === "ephemeral").length;
    return { total: active.length, chronic, standing, recent, ephemeral };
  }, [facts]);

  const handleArchive = useCallback(async (id: string) => {
    try {
      const res = await fetch("/api/athlete-facts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factId: id, action: "archive" }),
      });
      if (!res.ok) throw new Error();
      setToast("Memory archived.");
      await load();
    } catch {
      setToast("Failed to archive.");
    }
  }, [load]);

  const handleEdit = useCallback(async (id: string, summary: string) => {
    try {
      const res = await fetch("/api/athlete-facts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factId: id, action: "edit", summary }),
      });
      if (!res.ok) throw new Error();
      setToast("Memory updated.");
      await load();
    } catch {
      setToast("Failed to update.");
    }
  }, [load]);

  return (
    <div style={{ padding: "24px 24px 64px", maxWidth: 960, margin: "0 auto", overflowY: "auto", height: "100%" }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>
          Coach Memory
        </h1>
        <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.55, maxWidth: 640, marginTop: 6 }}>
          Durable knowledge your coach uses to ground every reply. Memories are extracted
          automatically from chats and workout notes — and you can add your own here.
        </p>
      </header>

      <StatRow stats={stats} loading={loading} />

      <div style={{ height: 20 }} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
        {vocab && (
          <CreateMemoryForm
            categories={vocab.categories}
            predicates={vocab.predicates}
            onCreated={load}
            onToast={setToast}
          />
        )}

        <MemoryList
          facts={facts}
          loading={loading}
          showInactive={showInactive}
          onShowInactiveChange={setShowInactive}
          onArchive={handleArchive}
          onEdit={handleEdit}
        />
      </div>

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#0f172a",
            color: "#fff",
            padding: "10px 16px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            zIndex: 100,
            boxShadow: "0 8px 24px rgba(15,23,42,0.25)",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function StatRow({
  stats,
  loading,
}: {
  stats: { total: number; chronic: number; standing: number; recent: number; ephemeral: number };
  loading: boolean;
}) {
  const cells = [
    { label: "Active total", value: stats.total },
    { label: "Permanent", value: stats.chronic },
    { label: "Long-term", value: stats.standing },
    { label: "Recent", value: stats.recent },
    { label: "Brief", value: stats.ephemeral },
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: 8,
      }}
    >
      {cells.map((c) => (
        <div
          key={c.label}
          style={{
            background: "#fff",
            border: "1px solid var(--line, #e2e8f0)",
            borderRadius: 12,
            padding: "12px 14px",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: ".08em",
              marginBottom: 4,
            }}
          >
            {c.label}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>
            {loading ? "—" : c.value}
          </div>
        </div>
      ))}
    </div>
  );
}
