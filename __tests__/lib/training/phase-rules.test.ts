import { describe, it, expect } from "vitest";
import { getNextBlockType, getBlockTypeForRace } from "@/lib/training/phase-rules";

describe("getBlockTypeForRace", () => {
  it("returns base when >12 weeks out", () => {
    expect(getBlockTypeForRace(16)).toBe("base");
  });

  it("returns build when 8-12 weeks out", () => {
    expect(getBlockTypeForRace(10)).toBe("build");
    expect(getBlockTypeForRace(8)).toBe("build");
    expect(getBlockTypeForRace(12)).toBe("build");
  });

  it("returns peak when 3-7 weeks out", () => {
    expect(getBlockTypeForRace(5)).toBe("peak");
    expect(getBlockTypeForRace(3)).toBe("peak");
    expect(getBlockTypeForRace(7)).toBe("peak");
  });

  it("returns taper when 1-2 weeks out", () => {
    expect(getBlockTypeForRace(2)).toBe("taper");
    expect(getBlockTypeForRace(1)).toBe("taper");
  });

  it("returns deload when 0 or negative weeks (race passed)", () => {
    expect(getBlockTypeForRace(0)).toBe("deload");
    expect(getBlockTypeForRace(-1)).toBe("deload");
  });
});

describe("getNextBlockType", () => {
  it("returns race-anchored phase when race date is set", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 70);
    const raceDate = futureDate.toISOString().slice(0, 10);
    expect(getNextBlockType({ raceDate, currentBlockType: "base", blockNumber: 1 })).toBe("build");
  });

  it("returns deload after race date passes", () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 7);
    const raceDate = pastDate.toISOString().slice(0, 10);
    expect(getNextBlockType({ raceDate, currentBlockType: "taper", blockNumber: 4 })).toBe("deload");
  });

  it("follows cyclical rotation for non-race users", () => {
    const opts = { raceDate: null, currentBlockType: null, blockNumber: 0 };
    expect(getNextBlockType({ ...opts, currentBlockType: null, blockNumber: 0 })).toBe("accumulation");
    expect(getNextBlockType({ ...opts, currentBlockType: "accumulation", blockNumber: 1 })).toBe("accumulation");
    expect(getNextBlockType({ ...opts, currentBlockType: "accumulation", blockNumber: 2 })).toBe("deload");
    expect(getNextBlockType({ ...opts, currentBlockType: "deload", blockNumber: 3 })).toBe("intensification");
    expect(getNextBlockType({ ...opts, currentBlockType: "intensification", blockNumber: 4 })).toBe("intensification");
    expect(getNextBlockType({ ...opts, currentBlockType: "intensification", blockNumber: 5 })).toBe("deload");
    expect(getNextBlockType({ ...opts, currentBlockType: "deload", blockNumber: 6 })).toBe("accumulation");
  });

  it("starts non-race users with accumulation", () => {
    expect(getNextBlockType({ raceDate: null, currentBlockType: null, blockNumber: 0 })).toBe("accumulation");
  });
});
