"use client";

import { useState, useRef } from "react";
import { FrontPoseSVG, SidePoseSVG, BackPoseSVG } from "./pose-silhouettes";
import { resizeImage } from "@/lib/image-resize";

type Angle = "front" | "side" | "back";

interface CheckinCardData {
  type: "checkin_prompt";
  date: string;
  message: string;
}

const ANGLES: { key: Angle; label: string; Svg: typeof FrontPoseSVG }[] = [
  { key: "front", label: "Front", Svg: FrontPoseSVG },
  { key: "side", label: "Side", Svg: SidePoseSVG },
  { key: "back", label: "Back", Svg: BackPoseSVG },
];

export function CheckInCard({ data }: { data: CheckinCardData }) {
  const [photos, setPhotos] = useState<Record<Angle, { file: File; preview: string } | null>>({
    front: null, side: null, back: null,
  });
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [status, setStatus] = useState<"pending" | "uploading" | "done" | "error">("pending");
  const fileRefs = useRef<Record<Angle, HTMLInputElement | null>>({ front: null, side: null, back: null });

  const allUploaded = photos.front && photos.side && photos.back;

  const handleFileSelect = async (angle: Angle, file: File) => {
    const resized = await resizeImage(file);
    const preview = URL.createObjectURL(resized);
    const resizedFile = new File([resized], `${angle}.jpg`, { type: "image/jpeg" });
    setPhotos((prev) => ({ ...prev, [angle]: { file: resizedFile, preview } }));
  };

  const handleSubmit = async () => {
    if (!allUploaded) return;
    setStatus("uploading");

    const formData = new FormData();
    formData.append("front", photos.front!.file);
    formData.append("side", photos.side!.file);
    formData.append("back", photos.back!.file);
    if (notes.trim()) formData.append("notes", notes.trim());

    try {
      const res = await fetch("/api/checkins/upload", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        setStatus("done");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const handleClear = (angle: Angle) => {
    if (photos[angle]?.preview) URL.revokeObjectURL(photos[angle]!.preview);
    setPhotos((prev) => ({ ...prev, [angle]: null }));
  };

  return (
    <div style={{
      background: "linear-gradient(135deg, #0F1B22 0%, #1a2d3a 100%)",
      borderRadius: 20, padding: 24, color: "#fff",
      position: "relative", overflow: "hidden",
    }}>
      {/* Decorative blobs */}
      <div style={{ position: "absolute", top: -40, right: -30, width: 140, height: 140, borderRadius: "50%", background: "#B7DDEA", opacity: 0.12, filter: "blur(40px)" }} />
      <div style={{ position: "absolute", bottom: -30, left: -20, width: 120, height: 120, borderRadius: "50%", background: "#F6B7A6", opacity: 0.12, filter: "blur(40px)" }} />

      <div style={{ position: "relative" }}>
        {/* Header */}
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#B7DDEA", marginBottom: 6 }}>
          {status === "done" ? "Check-in Saved" : "Weekly Check-in"}
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>
          {status === "done" ? "Looking good!" : data.message}
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 20 }}>
          {data.date}
        </div>

        {/* Upload zones */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
          {ANGLES.map(({ key, label, Svg }) => {
            const photo = photos[key];
            return (
              <div key={key}>
                <div
                  onClick={() => status === "pending" && fileRefs.current[key]?.click()}
                  style={{
                    aspectRatio: "3/4",
                    borderRadius: 14,
                    border: photo ? "2px solid #22c55e" : "2px dashed rgba(255,255,255,0.2)",
                    background: photo ? "transparent" : "rgba(255,255,255,0.03)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: status === "pending" ? "pointer" : "default",
                    position: "relative", overflow: "hidden",
                  }}
                >
                  {photo ? (
                    <>
                      <img src={photo.preview} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }} />
                      {status === "pending" && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleClear(key); }}
                          style={{
                            position: "absolute", top: 6, right: 6,
                            width: 22, height: 22, borderRadius: "50%",
                            background: "rgba(0,0,0,0.7)", border: "none",
                            color: "#fff", fontSize: 12, cursor: "pointer",
                            display: "grid", placeItems: "center",
                          }}
                        >
                          x
                        </button>
                      )}
                    </>
                  ) : (
                    <Svg width={80} height={160} />
                  )}
                  <input
                    ref={(el) => { fileRefs.current[key] = el; }}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(key, file);
                      e.target.value = "";
                    }}
                  />
                </div>
                <div style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>
                  {label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Notes */}
        {status === "pending" && (
          showNotes ? (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How are you feeling? Any changes you notice?"
              style={{
                width: "100%", minHeight: 60, borderRadius: 10,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff", padding: 10, fontSize: 13, resize: "vertical",
                outline: "none", marginBottom: 16, fontFamily: "inherit",
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowNotes(true)}
              style={{
                background: "none", border: "none", color: "rgba(255,255,255,0.4)",
                fontSize: 12, cursor: "pointer", marginBottom: 16, padding: 0,
              }}
            >
              + Add a note...
            </button>
          )
        )}

        {/* Actions */}
        {status === "done" ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 20px", borderRadius: 999,
            background: "#22c55e", color: "#fff",
            fontSize: 13, fontWeight: 800, width: "fit-content",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L20 7" />
            </svg>
            Check-in saved
          </div>
        ) : status === "error" ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#fca5a5" }}>Upload failed. Try again.</span>
            <button onClick={handleSubmit} style={{
              background: "#F6B7A6", color: "#0F1B22", border: "none",
              borderRadius: 999, padding: "10px 22px", fontSize: 13, fontWeight: 800, cursor: "pointer",
            }}>
              Retry
            </button>
          </div>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!allUploaded || status === "uploading"}
            style={{
              background: allUploaded ? "#F6B7A6" : "rgba(255,255,255,0.1)",
              color: allUploaded ? "#0F1B22" : "rgba(255,255,255,0.3)",
              border: "none", borderRadius: 999, padding: "10px 22px",
              fontSize: 13, fontWeight: 800,
              cursor: allUploaded ? "pointer" : "not-allowed",
              opacity: status === "uploading" ? 0.7 : 1,
            }}
          >
            {status === "uploading" ? "Uploading..." : "Submit Check-in"}
          </button>
        )}
      </div>
    </div>
  );
}
