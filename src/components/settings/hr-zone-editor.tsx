"use client";

import { useState, useEffect } from "react";
import type { HrZoneConfig, HrZoneMode } from "@/lib/training/zones";
import { HR_ZONE_NAMES, HR_ZONE_MODE_LABELS } from "@/lib/training/zones";
import {
  computeHrZonesFromMaxHr,
  computeHrZonesFromHrr,
  computeHrZonesFromThreshold,
  estimateMaxHrFromAge,
  getDefaultHrZones,
} from "@/lib/training/zone-calculator";
import type { ZoneBoundary } from "@/lib/training/calendar-data";
import { ZONE_COLORS } from "@/lib/training/calendar-data";

interface HrZoneEditorProps {
  config: HrZoneConfig | null;
  onSave: (config: HrZoneConfig) => void;
  saving: boolean;
  userAge?: number | null;
}

export function HrZoneEditor({ config, onSave, saving, userAge }: HrZoneEditorProps) {
  const [mode, setMode] = useState<HrZoneMode>(config?.mode ?? "percent_max");
  const [restingHr, setRestingHr] = useState<number | "">(config?.resting_hr ?? "");
  const [maxHr, setMaxHr] = useState<number | "">(config?.max_hr ?? "");
  const [thresholdHr, setThresholdHr] = useState<number | "">(config?.threshold_hr ?? "");
  const [boundaries, setBoundaries] = useState<ZoneBoundary[]>(
    config?.boundaries ?? getDefaultHrZones()
  );
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (config) {
      setMode(config.mode);
      setRestingHr(config.resting_hr ?? "");
      setMaxHr(config.max_hr ?? "");
      setThresholdHr(config.threshold_hr ?? "");
      setBoundaries(config.boundaries);
    }
  }, [config]);

  const recalculateZones = (
    newMode: HrZoneMode,
    newRestingHr: number | "",
    newMaxHr: number | "",
    newThresholdHr: number | ""
  ) => {
    let newBoundaries: ZoneBoundary[] | null = null;

    if (newMode === "percent_max" && typeof newMaxHr === "number" && newMaxHr > 0) {
      newBoundaries = computeHrZonesFromMaxHr(newMaxHr);
    } else if (
      newMode === "percent_hrr" &&
      typeof newRestingHr === "number" &&
      typeof newMaxHr === "number" &&
      newRestingHr > 0 &&
      newMaxHr > newRestingHr
    ) {
      newBoundaries = computeHrZonesFromHrr(newRestingHr, newMaxHr);
    } else if (
      newMode === "percent_threshold" &&
      typeof newThresholdHr === "number" &&
      newThresholdHr > 0
    ) {
      newBoundaries = computeHrZonesFromThreshold(newThresholdHr);
    }

    if (newBoundaries) {
      setBoundaries(newBoundaries);
    }
    setHasChanges(true);
  };

  const handleModeChange = (newMode: HrZoneMode) => {
    setMode(newMode);
    recalculateZones(newMode, restingHr, maxHr, thresholdHr);
  };

  const handleRestingHrChange = (val: string) => {
    const num = val === "" ? "" : parseInt(val, 10);
    setRestingHr(num);
    recalculateZones(mode, num, maxHr, thresholdHr);
  };

  const handleMaxHrChange = (val: string) => {
    const num = val === "" ? "" : parseInt(val, 10);
    setMaxHr(num);
    recalculateZones(mode, restingHr, num, thresholdHr);
  };

  const handleThresholdHrChange = (val: string) => {
    const num = val === "" ? "" : parseInt(val, 10);
    setThresholdHr(num);
    recalculateZones(mode, restingHr, maxHr, num);
  };

  const handleEstimateFromAge = () => {
    if (userAge && userAge > 0) {
      const estimated = estimateMaxHrFromAge(userAge);
      setMaxHr(estimated);
      recalculateZones(mode, restingHr, estimated, thresholdHr);
    }
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
      resting_hr: typeof restingHr === "number" ? restingHr : null,
      max_hr: typeof maxHr === "number" ? maxHr : null,
      threshold_hr: typeof thresholdHr === "number" ? thresholdHr : null,
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
        Heart Rate Zones
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={labelStyle}>Calculation Method</div>
        <select
          value={mode}
          onChange={(e) => handleModeChange(e.target.value as HrZoneMode)}
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
          {(Object.keys(HR_ZONE_MODE_LABELS) as HrZoneMode[]).map((m) => (
            <option key={m} value={m}>
              {HR_ZONE_MODE_LABELS[m]}
            </option>
          ))}
        </select>
      </div>

      {mode === "percent_hrr" && (
        <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
          <div>
            <div style={labelStyle}>Resting HR (bpm)</div>
            <input
              type="number"
              value={restingHr}
              onChange={(e) => handleRestingHrChange(e.target.value)}
              placeholder="50"
              style={inputStyle}
            />
          </div>
          <div>
            <div style={labelStyle}>Max HR (bpm)</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="number"
                value={maxHr}
                onChange={(e) => handleMaxHrChange(e.target.value)}
                placeholder="185"
                style={inputStyle}
              />
              {userAge && (
                <button
                  type="button"
                  onClick={handleEstimateFromAge}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    fontSize: 12,
                    color: "#475569",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Est. {estimateMaxHrFromAge(userAge)}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {mode === "percent_max" && (
        <div style={{ marginBottom: 16 }}>
          <div style={labelStyle}>Max HR (bpm)</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="number"
              value={maxHr}
              onChange={(e) => handleMaxHrChange(e.target.value)}
              placeholder="185"
              style={inputStyle}
            />
            {userAge && (
              <button
                type="button"
                onClick={handleEstimateFromAge}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  fontSize: 12,
                  color: "#475569",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Estimate from age ({estimateMaxHrFromAge(userAge)})
              </button>
            )}
          </div>
        </div>
      )}

      {mode === "percent_threshold" && (
        <div style={{ marginBottom: 16 }}>
          <div style={labelStyle}>Threshold HR (bpm)</div>
          <input
            type="number"
            value={thresholdHr}
            onChange={(e) => handleThresholdHrChange(e.target.value)}
            placeholder="165"
            style={inputStyle}
          />
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <div style={labelStyle}>Zone Boundaries</div>
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
                background: ZONE_COLORS[i] ?? "#e2e8f0",
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
                Low (bpm)
              </th>
              <th style={{ textAlign: "center", padding: "8px 0", color: "#64748b", fontWeight: 500 }}>
                High (bpm)
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
                      background: ZONE_COLORS[i] ?? "#e2e8f0",
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
                  {HR_ZONE_NAMES[i] ?? `Zone ${b.zone}`}
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
          {saving ? "Saving..." : "Save HR Zones"}
        </button>
      </div>
    </div>
  );
}
