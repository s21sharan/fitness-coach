import { describe, it, expect } from "vitest";
import {
  buildWorkoutContractFromSessionText,
  formatContractOutline,
  inferWorkoutSport,
} from "@/lib/training/workout-contract";

describe("inferWorkoutSport", () => {
  it("detects swim, bike, run, and strength keywords", () => {
    expect(inferWorkoutSport("Pool CSS")).toBe("swim");
    expect(inferWorkoutSport("Zwift endurance")).toBe("bike");
    expect(inferWorkoutSport("Morning easy run")).toBe("run");
    expect(inferWorkoutSport("Push day")).toBe("strength");
  });
});

describe("buildWorkoutContractFromSessionText", () => {
  it("returns null for empty or rest", () => {
    expect(buildWorkoutContractFromSessionText(null)).toBeNull();
    expect(buildWorkoutContractFromSessionText("  ")).toBeNull();
    expect(buildWorkoutContractFromSessionText("Rest")).toBeNull();
  });

  it("creates a repeat block for interval-style run text", () => {
    const t = buildWorkoutContractFromSessionText("6 x 800m @ threshold", {
      source: "onboarding_preview",
    });
    expect(t?.contract?.steps.some((s) => s.type === "repeat")).toBe(true);
    expect(t?.contract?.source).toBe("onboarding_preview");
    expect(t?.target_duration_min).toBeGreaterThan(0);
  });

  it("uses longer Z2-style work for long easy sessions", () => {
    const t = buildWorkoutContractFromSessionText("Long easy run Z2", { source: "coach" });
    const work = t?.contract?.steps.find((s) => s.type === "work");
    expect(work?.target_hr_zone).toBe(2);
    expect(work?.duration_sec).toBe(3600);
  });
});

describe("formatContractOutline", () => {
  it("summarizes repeat intervals with zones", () => {
    const t = buildWorkoutContractFromSessionText("Track intervals");
    expect(t?.contract).toBeDefined();
    const line = formatContractOutline(t!.contract!);
    expect(line).toMatch(/\d+×/);
    expect(line).toContain("Z");
  });
});
