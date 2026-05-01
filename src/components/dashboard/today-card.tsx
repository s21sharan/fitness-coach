"use client";

import { Icon } from "@/components/app/icon";
import { Ring } from "@/components/app/ring";

export function TodayCard() {
  return (
    <div
      className="card"
      style={{
        background: "linear-gradient(120deg, var(--coral) 0%, var(--coral-deep) 100%)",
        color: "var(--ink)",
        position: "relative",
        overflow: "hidden",
        padding: 32,
        marginBottom: 18,
      }}
    >
      <div
        className="blob"
        style={{
          width: 280,
          height: 280,
          background: "#fff",
          opacity: 0.18,
          top: -100,
          right: -60,
          animation: "float-1 12s ease-in-out infinite",
        }}
      />
      <div
        className="blob"
        style={{
          width: 200,
          height: 200,
          background: "var(--lemon)",
          opacity: 0.4,
          bottom: -100,
          left: 120,
          animation: "float-2 14s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 32,
          alignItems: "center",
        }}
      >
        <div>
          <div className="eyebrow" style={{ color: "var(--ink)", opacity: 0.6 }}>
            Today · Friday May 1
          </div>
          <h1
            style={{
              fontSize: 44,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              margin: "8px 0 4px",
              lineHeight: 1.05,
            }}
          >
            Push Day · Chest + Shoulders
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "var(--ink-2)",
              margin: "0 0 18px",
              maxWidth: 480,
            }}
          >
            HRV is up 8% from your baseline — green light to push intensity. 6 main lifts, ~58 min.
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button className="btn-ink">
              <Icon name="play" size={14} /> Start workout
            </button>
            <button
              className="btn-ghost"
              style={{ background: "rgba(255,255,255,0.5)" }}
            >
              <Icon name="chat" size={14} /> Ask coach
            </button>
            <span
              style={{
                display: "inline-flex",
                gap: 6,
                alignItems: "center",
                fontSize: 12,
                fontWeight: 700,
                padding: "8px 14px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.55)",
              }}
            >
              <Icon name="zap" size={12} /> Recovery 78
            </span>
          </div>
        </div>
        <div style={{ display: "grid", placeItems: "center" }}>
          <Ring size={140} stroke={14} value={0.64} color="var(--ink)" track="rgba(255,255,255,0.4)">
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                }}
              >
                8/12
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--ink-2)",
                  fontWeight: 700,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                }}
              >
                sets
              </div>
            </div>
          </Ring>
        </div>
      </div>
    </div>
  );
}
