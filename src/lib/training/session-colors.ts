// Shared session-type → color mapping. Used by the chat proposal cards (and
// anywhere else that needs to color a session at a glance) so the palette
// stays consistent with the calendar modal's zone-aware scheme.
//
// Designed to read on the chat panel's dark gradient — muted, low-saturation,
// no bright pastels. If you change a value, update both PlanProposalCard and
// BlockProposalCard usage at once.

export type SessionSport = "run" | "bike" | "swim" | "strength" | "rest" | "other";

export interface SessionColor {
  /** Subtle background for a chip / cell on a dark surface. */
  bg: string;
  /** Solid accent — use for the sport dot, the left rail, etc. */
  accent: string;
  /** Foreground text on top of bg. Light enough for dark surfaces. */
  text: string;
}

const PALETTE: Record<SessionSport, SessionColor> = {
  // Strength: warm slate. Neutral but distinct from rest.
  strength: { bg: "rgba(148,163,184,0.16)", accent: "#94a3b8", text: "#e2e8f0" },
  // Run: emerald — matches Z3 in PlannedWorkoutModal.
  run:      { bg: "rgba(16,185,129,0.16)",  accent: "#10b981", text: "#d1fae5" },
  // Bike: amber — matches Z4.
  bike:     { bg: "rgba(245,158,11,0.16)",  accent: "#f59e0b", text: "#fef3c7" },
  // Swim: cyan — distinct from run.
  swim:     { bg: "rgba(6,182,212,0.16)",   accent: "#06b6d4", text: "#cffafe" },
  // Rest day: very low-contrast.
  rest:     { bg: "rgba(148,163,184,0.07)", accent: "#475569", text: "#94a3b8" },
  // Anything else (mobility / yoga / unknown): muted indigo.
  other:    { bg: "rgba(129,140,248,0.14)", accent: "#818cf8", text: "#e0e7ff" },
};

const SPORT_KEYWORDS: Array<[RegExp, SessionSport]> = [
  [/\b(rest|off|recover(y|ing)?)\b/i, "rest"],
  [/\b(run|jog|tempo|threshold|interval|stride|track|mile|marathon|5k|10k|half|easy\s+run|long\s+run)\b/i, "run"],
  [/\b(bike|ride|cycling|trainer|zwift|spin|ftp|watt)\b/i, "bike"],
  [/\b(swim|pool|css|drill|stroke|laps?)\b/i, "swim"],
  [/\b(push|pull|legs?|upper|lower|squat|dead|bench|lift|strength|hypertrophy|gym|chest|back|shoulder|arm|core|abs)\b/i, "strength"],
  [/\b(yoga|mobility|stretch|flow|mindful|breathwork)\b/i, "other"],
];

export function sportForSession(label: string | null | undefined): SessionSport {
  if (!label) return "rest";
  for (const [re, sport] of SPORT_KEYWORDS) {
    if (re.test(label)) return sport;
  }
  return "other";
}

export function colorForSession(label: string | null | undefined): SessionColor {
  return PALETTE[sportForSession(label)];
}

export function colorForSport(sport: SessionSport): SessionColor {
  return PALETTE[sport];
}
