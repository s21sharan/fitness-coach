export type BlockType =
  | "base" | "build" | "peak" | "taper"
  | "accumulation" | "intensification" | "deload";

/** Race-anchored phase from weeks remaining */
export function getBlockTypeForRace(weeksToRace: number): BlockType {
  if (weeksToRace <= 0) return "deload";
  if (weeksToRace <= 2) return "taper";
  if (weeksToRace <= 7) return "peak";
  if (weeksToRace <= 12) return "build";
  return "base";
}

const CYCLE: BlockType[] = [
  "accumulation", "accumulation", "deload",
  "intensification", "intensification", "deload",
];

export function getNextBlockType(opts: {
  raceDate: string | null;
  currentBlockType: BlockType | string | null;
  blockNumber: number;
}): BlockType {
  if (opts.raceDate) {
    const race = new Date(opts.raceDate);
    const now = new Date();
    const diffMs = race.getTime() - now.getTime();
    const weeksOut = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
    return getBlockTypeForRace(weeksOut);
  }

  if (!opts.currentBlockType || opts.blockNumber === 0) {
    return "accumulation";
  }

  const cycleIndex = (opts.blockNumber) % CYCLE.length;
  return CYCLE[cycleIndex];
}

/** Human-readable label for a block type */
export function blockTypeLabel(type: BlockType): string {
  const labels: Record<BlockType, string> = {
    base: "Base",
    build: "Build",
    peak: "Peak",
    taper: "Taper",
    accumulation: "Accumulation",
    intensification: "Intensification",
    deload: "Deload",
  };
  return labels[type] || type;
}
