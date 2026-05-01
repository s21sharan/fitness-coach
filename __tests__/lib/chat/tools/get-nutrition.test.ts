import { describe, it, expect } from "vitest";
import { getNutritionTool } from "@/lib/chat/tools/get-nutrition";

describe("getNutritionTool", () => {
  it("returns a tool object with correct structure", () => {
    const t = getNutritionTool("user-123");
    expect(t).toBeDefined();
    expect(typeof t).toBe("object");
  });
});
