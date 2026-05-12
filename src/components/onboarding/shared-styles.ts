import type { CSSProperties } from "react";

export const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: "var(--r-md)",
  border: "1.5px solid var(--line)",
  padding: "12px 14px",
  fontSize: 15,
  fontWeight: 600,
  color: "var(--ink)",
  background: "#fff",
  outline: "none",
  fontFamily: "inherit",
};

export const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--muted)",
  marginBottom: 6,
};

export const cardStyle: CSSProperties = {
  background: "#fff",
  borderRadius: "var(--r-lg)",
  border: "1px solid var(--line)",
  padding: 20,
};

export const sectionTitleStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "var(--ink)",
  margin: 0,
};

export const subtleStyle: CSSProperties = {
  fontSize: 13,
  color: "var(--muted)",
  fontWeight: 500,
};

export const pillButtonStyle = (selected: boolean): CSSProperties => ({
  padding: "8px 14px",
  borderRadius: 999,
  border: selected ? "2px solid var(--ink)" : "1.5px solid var(--line)",
  background: selected ? "var(--ink)" : "#fff",
  color: selected ? "#fff" : "var(--ink)",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "all 0.15s",
});
