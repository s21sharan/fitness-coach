"use client";

import { useEffect, useState, useCallback } from "react";
import { HrZoneEditor } from "./hr-zone-editor";
import { PowerZoneEditor } from "./power-zone-editor";
import type { HrZoneConfig, PowerZoneConfig } from "@/lib/training/zones";

type ZoneScope = "global" | "run" | "bike";

interface ZoneData {
  hr?: HrZoneConfig | null;
  power?: PowerZoneConfig | null;
}

interface ZonesResponse {
  zones: {
    global: ZoneData;
    run: ZoneData;
    bike: ZoneData;
  };
}

interface TrainingZonesPanelProps {
  onToast?: (message: string) => void;
  userAge?: number | null;
}

export function TrainingZonesPanel({ onToast, userAge }: TrainingZonesPanelProps) {
  const [activeScope, setActiveScope] = useState<ZoneScope>("global");
  const [zones, setZones] = useState<ZonesResponse["zones"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchZones = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/settings/zones");
    if (res.ok) {
      const data: ZonesResponse = await res.json();
      setZones(data.zones);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  const handleSaveHr = async (config: HrZoneConfig) => {
    setSaving(true);
    const res = await fetch("/api/settings/zones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: activeScope, hr: config }),
    });
    setSaving(false);
    if (res.ok) {
      onToast?.("HR zones saved");
      fetchZones();
    } else {
      onToast?.("Failed to save HR zones");
    }
  };

  const handleSavePower = async (config: PowerZoneConfig) => {
    setSaving(true);
    const res = await fetch("/api/settings/zones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: activeScope, power: config }),
    });
    setSaving(false);
    if (res.ok) {
      onToast?.("Power zones saved");
      fetchZones();
    } else {
      onToast?.("Failed to save power zones");
    }
  };

  const currentZones = zones?.[activeScope] ?? { hr: null, power: null };

  const SCOPE_TABS: { id: ZoneScope; label: string }[] = [
    { id: "global", label: "Global" },
    { id: "run", label: "Running" },
    { id: "bike", label: "Cycling" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div
        style={{
          background: "#f8fafc",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          padding: 24,
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>
          Training Zones
        </div>
        <div style={{ color: "#64748b", fontSize: 14, marginBottom: 16 }}>
          Configure your heart rate and power zones. These zones will be used throughout the app for training analysis.
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {SCOPE_TABS.map((tab) => {
            const isActive = activeScope === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveScope(tab.id)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: isActive ? "#0f172a" : "#e2e8f0",
                  color: isActive ? "#fff" : "#475569",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
            Loading zones...
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <HrZoneEditor
              config={currentZones.hr ?? null}
              onSave={handleSaveHr}
              saving={saving}
              userAge={userAge}
            />

            {(activeScope === "global" || activeScope === "bike") && (
              <PowerZoneEditor
                config={currentZones.power ?? null}
                onSave={handleSavePower}
                saving={saving}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
