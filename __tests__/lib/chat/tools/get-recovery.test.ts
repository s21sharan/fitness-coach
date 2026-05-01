import { describe, it, expect } from "vitest";
import { getRecoveryTool } from "@/lib/chat/tools/get-recovery";

describe("getRecoveryTool", () => {
  it("returns a tool object with correct structure", () => {
    const t = getRecoveryTool("user-123");
    expect(t).toBeDefined();
    expect(typeof t).toBe("object");
  });
});
