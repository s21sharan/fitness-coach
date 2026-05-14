"use client";

import { useState, useEffect, useRef } from "react";

type Angle = "front" | "side" | "back";

interface Checkin {
  id: string;
  date: string;
  front_url: string | null;
  side_url: string | null;
  back_url: string | null;
  notes: string | null;
}

const ANGLE_TABS: { key: Angle; label: string }[] = [
  { key: "front", label: "Front" },
  { key: "side", label: "Side" },
  { key: "back", label: "Back" },
];

function getUrl(checkin: Checkin, angle: Angle): string | null {
  if (angle === "front") return checkin.front_url;
  if (angle === "side") return checkin.side_url;
  return checkin.back_url;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function PhysiqueReviewModal({ onClose }: { onClose: () => void }) {
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [angle, setAngle] = useState<Angle>("front");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [comparing, setComparing] = useState(false);
  const [compareIdx, setCompareIdx] = useState(0);
  const [activePin, setActivePin] = useState<"left" | "right">("right");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/checkins")
      .then((r) => r.json())
      .then((data) => {
        const sorted = (data.checkins || []).sort(
          (a: Checkin, b: Checkin) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        setCheckins(sorted);
        if (sorted.length > 0) {
          setSelectedIdx(sorted.length - 1);
          setCompareIdx(Math.max(0, sorted.length - 2));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleThumbClick = (idx: number) => {
    if (comparing) {
      if (activePin === "left") {
        setCompareIdx(idx);
        setActivePin("right");
      } else {
        setSelectedIdx(idx);
        setActivePin("left");
      }
    } else {
      setSelectedIdx(idx);
    }
  };

  const current = checkins[selectedIdx];
  const compare = checkins[compareIdx];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.9)",
        display: "flex", flexDirection: "column",
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Top bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>Progress Photos</div>

          {/* Angle tabs */}
          <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.1)", borderRadius: 999, padding: 3 }}>
            {ANGLE_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setAngle(tab.key)}
                style={{
                  padding: "6px 16px", borderRadius: 999, border: "none",
                  background: angle === tab.key ? "#fff" : "transparent",
                  color: angle === tab.key ? "#0F1B22" : "rgba(255,255,255,0.6)",
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {checkins.length > 0 && (
              <button
                onClick={() => { setComparing(!comparing); setActivePin("left"); }}
                style={{
                  padding: "6px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.2)",
                  background: comparing ? "#F6B7A6" : "transparent",
                  color: comparing ? "#0F1B22" : "#fff",
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}
              >
                {comparing ? "Exit Compare" : "Compare"}
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "rgba(255,255,255,0.1)", border: "none",
                color: "#fff", fontSize: 18, cursor: "pointer",
                display: "grid", placeItems: "center",
              }}
            >
              x
            </button>
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          {loading ? (
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Loading...</div>
          ) : checkins.length === 0 ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 8 }}>No check-ins yet</div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>
                Your coach will prompt you when it&apos;s time.
              </div>
            </div>
          ) : comparing ? (
            /* Compare mode — side by side */
            <div style={{ display: "flex", gap: 24, alignItems: "center", maxHeight: "70vh" }}>
              {[{ idx: compareIdx, label: "left", color: "#F6B7A6" }, { idx: selectedIdx, label: "right", color: "#B7DDEA" }].map(({ idx, label, color }) => {
                const c = checkins[idx];
                const url = c ? getUrl(c, angle) : null;
                return (
                  <div key={label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 8 }}>
                      {c ? formatDate(c.date) : "—"}
                    </div>
                    {url ? (
                      <img src={url} alt={`${angle} ${c?.date}`} style={{ maxHeight: "60vh", maxWidth: "40vw", borderRadius: 12, border: `2px solid ${color}` }} />
                    ) : (
                      <div style={{ width: 300, height: 400, borderRadius: 12, background: "rgba(255,255,255,0.05)", display: "grid", placeItems: "center", color: "rgba(255,255,255,0.3)" }}>
                        No photo
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Browse mode — single photo */
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: 12 }}>
                {current ? formatDate(current.date) : ""}
              </div>
              {current && getUrl(current, angle) ? (
                <img src={getUrl(current, angle)!} alt={`${angle} ${current.date}`} style={{ maxHeight: "65vh", maxWidth: "50vw", borderRadius: 12 }} />
              ) : (
                <div style={{ width: 350, height: 460, borderRadius: 12, background: "rgba(255,255,255,0.05)", display: "grid", placeItems: "center", color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
                  No {angle} photo
                </div>
              )}
            </div>
          )}
        </div>

        {/* Timeline scrubber */}
        {checkins.length > 0 && (
          <div style={{
            padding: "12px 24px 20px",
            borderTop: "1px solid rgba(255,255,255,0.1)",
          }}>
            <div
              ref={scrollRef}
              style={{
                display: "flex", gap: 10, overflowX: "auto",
                padding: "4px 0",
                scrollSnapType: "x mandatory",
              }}
            >
              {checkins.map((c, i) => {
                const url = getUrl(c, angle);
                const isSelected = i === selectedIdx;
                const isCompare = comparing && i === compareIdx;
                const borderColor = isSelected ? "#B7DDEA" : isCompare ? "#F6B7A6" : "transparent";

                return (
                  <div
                    key={c.id}
                    onClick={() => handleThumbClick(i)}
                    style={{
                      flexShrink: 0, scrollSnapAlign: "center",
                      cursor: "pointer", textAlign: "center",
                    }}
                  >
                    <div style={{
                      width: 56, height: 56, borderRadius: 10,
                      border: `2.5px solid ${borderColor}`,
                      overflow: "hidden",
                      background: "rgba(255,255,255,0.05)",
                    }}>
                      {url ? (
                        <img src={url} alt={c.date} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "rgba(255,255,255,0.2)", fontSize: 10 }}>
                          —
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
                      {formatDate(c.date)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
