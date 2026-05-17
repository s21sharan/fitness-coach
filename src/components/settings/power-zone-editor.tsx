"use client";

import { useState, useEffect } from "react";
import type { PowerZoneConfig, PowerZoneMode } from "@/lib/training/zones";
import { POWER_ZONE_NAMES, POWER_ZONE_MODE_LABELS } from "@/lib/training/zones";
import {
  computePowerZonesFromFtp,
  getDefaultPowerZones,
} from "@/lib/training/zone-calculator";
import type { ZoneBoundary } from "@/lib/training/calendar-data";

const POWER_ZONE_COLORS = [
  "#93c5fd",
  "#86efac",
  "#fde047",
  "#fb923c",
  "#f87171",
  "#e879f9",
  "#c084fc",
];

interface PowerZoneEditorProps {
  config: PowerZoneConfig | null;
  onSave: (config: PowerZoneConfig) => void;
  saving: boolean;
}

export function PowerZoneEditor({ config, onSave, saving }: PowerZoneEditorProps) {
  const [mode, setMode] = useState<PowerZoneMode>(config?.mode ?? "percent_ftp");
  const [ftp, setFtp] = useState<number | "">(config?.ftp ?? "");
  const [boundaries, setBoundaries] = useState<ZoneBoundary[]>(
    config?.boundaries ?? getDefaultPowerZones()
  );
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (config) {
      setMode(config.mode);
      setFtp(config.ftp ?? "");
      setBoundaries(config.boundaries);
    }
  }, [config]);

  const recalculateZones = (newMode: PowerZoneMode, newFtp: number | "") => {
    if (newMode === "percent_ftp" && typeof newFtp === "number" && newFtp > 0) {
      setBoundaries(computePowerZonesFromFtp(newFtp));
    }
    setHasChanges(true);
  };

  const handleModeChange = (newMode: PowerZoneMode) => {
    setMode(newMode);
    recalculateZones(newMode, ftp);
  };

  const handleFtpChange = (val: string) => {
    const num = val === "" ? "" : parseInt(val, 10);
    setFtp(num);
    recalculateZones(mode, num);
  };

  const handleBoundaryChange = (zone: number, field: "low" | "high", val: string) => {
    const num = parseInt(val, 10) || 0;
    setBoundaries((prev) =>
      prev.map((b) => (b.zone === zone ? { ...b, [field]: num } : b))
    );
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave({
      mode,
      ftp: typeof ftp === "number" ? ftp : null,
      boundaries,
      updated_at: new Date().toISOString(),
    });
    setHasChanges(false);
  };

  const inputStyle = {
    width: 80,
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid #e2e8f0",
    fontSize: 14,
    textAlign: "center" as const,
  };

  const labelStyle = {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 4,
  };

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 10,
        border: "1px solid #e2e8f0",
        padding: 20,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
        Power Zones
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={labelStyle}>Calculation Method</div>
        <select
          value={mode}
          onChange={(e) => handleModeChange(e.target.value as PowerZoneMode)}
          style={{
            width: "100%",
            maxWidth: 280,
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #e2e8f0",
            fontSize: 14,
            background: "#fff",
          }}
        >
          {(Object.keys(POWER_ZONE_MODE_LABELS) as PowerZoneMode[]).map((m) => (
            <option key={m} value={m}>
              {POWER_ZONE_MODE_LABELS[m]}
            </option>
          ))}
        </select>
      </div>

      {mode === "percent_ftp" && (
        <div style={{ marginBottom: 16 }}>
          <div style={labelStyle}>FTP (watts)</div>
          <input
            type="number"
            value={ftp}
            onChange={(e) => handleFtpChange(e.target.value)}
            placeholder="250"
            style={inputStyle}
          />
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
            Functional Threshold Power - your max sustainable power for 1 hour
          </div>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <div style={labelStyle}>Zone Boundaries (Coggan 7-Zone Model)</div>
        <div
          style={{
            display: "flex",
            height: 12,
            borderRadius: 6,
            overflow: "hidden",
            marginBottom: 12,
          }}
        >
          {boundaries.map((b, i) => (
            <div
              key={b.zone}
              style={{
                flex: 1,
                background: POWER_ZONE_COLORS[i] ?? "#e2e8f0",
              }}
            />
          ))}
        </div>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
              <th style={{ textAlign: "left", padding: "8px 0", color: "#64748b", fontWeight: 500 }}>
                Zone
              </th>
              <th style={{ textAlign: "left", padding: "8px 0", color: "#64748b", fontWeight: 500 }}>
                Name
              </th>
              <th style={{ textAlign: "center", padding: "8px 0", color: "#64748b", fontWeight: 500 }}>
                Low (W)
              </th>
              <th style={{ textAlign: "center", padding: "8px 0", color: "#64748b", fontWeight: 500 }}>
                High (W)
              </th>
            </tr>
          </thead>
          <tbody>
            {boundaries.map((b, i) => (
              <tr key={b.zone} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 0" }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      background: POWER_ZONE_COLORS[i] ?? "#e2e8f0",
                      textAlign: "center",
                      lineHeight: "20px",
                      fontWeight: 600,
                      fontSize: 12,
                    }}
                  >
                    {b.zone}
                  </span>
                </td>
                <td style={{ padding: "8px 0", color: "#334155" }}>
                  {POWER_ZONE_NAMES[i] ?? `Zone ${b.zone}`}
                </td>
                <td style={{ padding: "8px 0", textAlign: "center" }}>
                  {mode === "custom" ? (
                    <input
                      type="number"
                      value={b.low}
                      onChange={(e) => handleBoundaryChange(b.zone, "low", e.target.value)}
                      style={{ ...inputStyle, width: 60 }}
                    />
                  ) : (
                    <span style={{ color: "#64748b" }}>{b.low}</span>
                  )}
                </td>
                <td style={{ padding: "8px 0", textAlign: "center" }}>
                  {mode === "custom" ? (
                    <input
                      type="number"
                      value={b.high}
                      onChange={(e) => handleBoundaryChange(b.zone, "high", e.target.value)}
                      style={{ ...inputStyle, width: 60 }}
                    />
                  ) : (
                    <span style={{ color: "#64748b" }}>{b.high}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            background: hasChanges ? "#0f172a" : "#94a3b8",
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
            cursor: hasChanges && !saving ? "pointer" : "default",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving..." : "Save Power Zones"}
        </button>
      </div>
    </div>
  );
}
