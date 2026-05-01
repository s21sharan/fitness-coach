"use client";

export function CoachNudge() {
  return (
    <div
      className="card"
      style={{
        padding: 20,
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        background: "#fff",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "var(--ink)",
          color: "#fff",
          display: "grid",
          placeItems: "center",
          fontWeight: 800,
          fontSize: 14,
          flexShrink: 0,
        }}
      >
        H
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            fontWeight: 800,
            color: "var(--mint-deep)",
            marginBottom: 4,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--mint-deep)",
              animation: "pulse-dot 2.4s infinite",
            }}
          />
          COACH · 9:14 AM
        </div>
        <p
          style={{
            margin: "0 0 10px",
            fontSize: 14,
            lineHeight: 1.55,
            color: "var(--ink-2)",
          }}
        >
          You&apos;ve got{" "}
          <b style={{ color: "var(--ink)" }}>82g protein</b> left and a 6pm
          window before your run. I&apos;d front-load it now — chicken bowl?
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn-coral"
            style={{ padding: "7px 14px", fontSize: 12 }}
          >
            See meals
          </button>
          <button
            className="btn-ghost"
            style={{ padding: "7px 14px", fontSize: 12 }}
          >
            Ignore
          </button>
        </div>
      </div>
    </div>
  );
}
