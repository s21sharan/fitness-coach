/**
 * Display-friendly formatting for snake_case fact fields.
 *
 * Storage uses snake_case for consistency between LLM-extracted and
 * manually-entered facts; the UI should never show users raw underscores.
 */
export function humanize(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const spaced = trimmed.replace(/[_\-]+/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Normalize a user-typed subject ("Left Knee" / "left-knee") into the
 * snake_case form the rest of the system uses. Empty → null so the deduper
 * groups all "global" facts together.
 */
export function normalizeSubject(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

import type { AthleteFact } from "./types";

/**
 * Render durable athlete facts as a plain-text block for the planning LLM
 * calls (regenerate_plan / propose_next_block / onboarding gen). The
 * planning models see this as the "what the athlete has told us about
 * themselves" section and must respect it when assigning sessions to days.
 *
 * Returns null when there are no facts so the caller can omit the section
 * entirely.
 */
export function formatFactsForPlanPrompt(facts: AthleteFact[]): string | null {
  if (!facts || facts.length === 0) return null;
  const order: Record<string, number> = { chronic: 0, standing: 1, recent: 2, ephemeral: 3 };
  const buckets: Record<string, string[]> = {
    chronic: [],
    standing: [],
    recent: [],
    ephemeral: [],
  };
  for (const f of [...facts].sort((a, b) => order[a.lifecycle] - order[b.lifecycle])) {
    const subj = f.subject ? `[${humanize(f.subject)}] ` : "";
    buckets[f.lifecycle]?.push(`${subj}${f.summary}`);
  }
  const label: Record<string, string> = {
    chronic: "Permanent",
    standing: "Long-term preferences & habits",
    recent: "Recent state",
    ephemeral: "Brief observations",
  };
  const sections: string[] = [];
  for (const key of ["chronic", "standing", "recent", "ephemeral"]) {
    const rows = buckets[key];
    if (!rows || rows.length === 0) continue;
    sections.push(`${label[key]}:\n${rows.map((r) => `  - ${r}`).join("\n")}`);
  }
  if (sections.length === 0) return null;
  return sections.join("\n\n");
}
