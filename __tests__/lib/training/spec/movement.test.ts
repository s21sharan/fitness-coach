import { describe, it, expect } from "vitest";
import { classifyMovementPatterns, isLowerBodyExercise } from "@/lib/training/spec/movement";

describe("classifyMovementPatterns", () => {
  it("classifies Bulgarian split squat as loaded knee flexion", () => {
    expect(classifyMovementPatterns("Bulgarian Split Squat (rear-foot elevated, shallow depth)").has("loaded_knee_flexion")).toBe(true);
  });

  it("classifies back squat as both knee flexion and spinal loading", () => {
    const p = classifyMovementPatterns("Barbell Back Squat");
    expect(p.has("loaded_knee_flexion")).toBe(true);
    expect(p.has("spinal_loading")).toBe(true);
  });

  it("classifies RDL as a hip hinge, NOT knee flexion", () => {
    const p = classifyMovementPatterns("Romanian Deadlift (RDL)");
    expect(p.has("heavy_hinge")).toBe(true);
    expect(p.has("loaded_knee_flexion")).toBe(false);
  });

  it("classifies overhead press correctly", () => {
    expect(classifyMovementPatterns("Seated Dumbbell Overhead Press").has("overhead_press")).toBe(true);
  });

  it("returns empty for an isolation movement with no risky pattern", () => {
    expect(classifyMovementPatterns("Cable Lateral Raise").size).toBe(0);
  });
});

describe("isLowerBodyExercise", () => {
  it("treats squats and hinges as lower body", () => {
    expect(isLowerBodyExercise("Back Squat")).toBe(true);
    expect(isLowerBodyExercise("Romanian Deadlift")).toBe(true);
    expect(isLowerBodyExercise("Leg Press")).toBe(true);
  });

  it("treats upper-body work as not lower body", () => {
    expect(isLowerBodyExercise("Bench Press")).toBe(false);
    expect(isLowerBodyExercise("Lat Pulldown")).toBe(false);
  });
});
