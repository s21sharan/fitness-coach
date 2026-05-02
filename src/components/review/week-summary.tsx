"use client";

import { Ring } from "@/components/app/ring";

export function WeekSummary() {
  return (
    <div
      className="card"
      style={{
        padding: 32,
        marginBottom: 18,
        background: "linear-gradient(135deg, var(--mint) 0%, var(--sky) 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        className="blob"
        style={{
          width: 300,
          height: 300,
          background: "#fff",
          opacity: 0.3,
          top: -80,
          right: -80,
          animation: "float-1 14s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "1fr auto",
          alignItems: "center",
          gap: 32,
        }}
      >
        <div>
          <div className="eyebrow">This week&apos;s verdict</div>
          <h1
            style={{
              fontSize: 44,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              margin: "10px 0 8px",
              lineHeight: 1.05,
            }}
          >
            Strong week.{" "}
            <span style={{ color: "var(--ink-2)" }}>Keep this rhythm.</span>
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              color: "var(--ink-2)",
              lineHeight: 1.55,
              maxWidth: 560,
            }}
          >
            You hit 5/5 sessions, slept 7.1h average, and added 5 lb to your
            bench top set. HRV is trending up — green light to push intensity
            next week.
          </p>
        </div>
        <Ring size={140} stroke={14} value={0.92} color="var(--ink)" track="rgba(255,255,255,0.4)">
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 34,
                fontWeight: 800,
                letterSpacing: "-0.02em",
              }}
            >
              92
            </div>
            <div
              style={{
                fontSize: 10,
                color: "var(--ink-2)",
                fontWeight: 700,
                letterSpacing: ".08em",
                textTransform: "uppercase",
              }}
            >
              Score
            </div>
          </div>
        </Ring>
      </div>
    </div>
  );
}
