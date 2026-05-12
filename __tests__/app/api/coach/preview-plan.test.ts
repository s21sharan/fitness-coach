import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDefaultAthleteProfile } from "@/lib/onboarding/types";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(() => Promise.resolve({ userId: "test-user-1" })),
}));

const mockExtract = vi.fn();

vi.mock("@/lib/llm", () => ({
  getLLMProvider: () => ({
    name: "mock",
    complete: vi.fn(),
    extractJSON: mockExtract,
  }),
  isLLMConfigured: () => true,
}));

beforeEach(() => {
  mockExtract.mockReset();
});

describe("POST /api/coach/preview-plan", () => {
  it("rejects when no profile provided", async () => {
    const { POST } = await import("@/app/api/coach/preview-plan/route");
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({}) })
    );
    expect(res.status).toBe(400);
  });

  it("returns LLM-generated preview", async () => {
    const validWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => ({
      day_label: d,
      session: d === "Sun" ? "Rest" : "Easy run",
      rationale: "test",
    }));
    mockExtract.mockResolvedValueOnce({
      narrative: "Test week",
      risks: ["watch ramp"],
      first_week: validWeek,
    });

    const { POST } = await import("@/app/api/coach/preview-plan/route");
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ profile: getDefaultAthleteProfile() }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.preview.narrative).toBe("Test week");
    expect(body.preview.first_week).toHaveLength(7);
    expect(body.scores).toBeDefined();
  });

  it("falls back to heuristic preview when LLM throws", async () => {
    mockExtract.mockRejectedValueOnce(new Error("boom"));
    const { POST } = await import("@/app/api/coach/preview-plan/route");
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ profile: getDefaultAthleteProfile() }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.preview.first_week).toHaveLength(7);
  });
});
