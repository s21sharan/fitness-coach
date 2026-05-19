import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(() => Promise.resolve({ userId: "test-user-123" })),
}));

// Supabase chain mocks
const mockSingle = vi.fn();
const mockSelectAfterInsert = vi.fn(() => ({ single: mockSingle }));
const mockInsert = vi.fn(() => ({ select: mockSelectAfterInsert }));

const mockOrder = vi.fn();
const mockGte = vi.fn(() => ({ order: mockOrder }));
const mockEqGet = vi.fn(() => ({ gte: mockGte, order: mockOrder }));
const mockSelectGet = vi.fn(() => ({ eq: mockEqGet }));

const mockFrom = vi.fn((table: string) => {
  if (table === "athlete_events") {
    return {
      select: mockSelectGet,
      insert: mockInsert,
    };
  }
  return {};
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

beforeEach(() => {
  vi.clearAllMocks();

  // Re-wire chains after clearAllMocks
  mockOrder.mockResolvedValue({ data: [], error: null });
  mockGte.mockReturnValue({ order: mockOrder });
  mockEqGet.mockReturnValue({ gte: mockGte, order: mockOrder });
  mockSelectGet.mockReturnValue({ eq: mockEqGet });
  mockFrom.mockImplementation((table: string) => {
    if (table === "athlete_events") {
      return {
        select: mockSelectGet,
        insert: mockInsert,
      };
    }
    return {};
  });

  mockSingle.mockResolvedValue({ data: null, error: null });
  mockSelectAfterInsert.mockReturnValue({ single: mockSingle });
  mockInsert.mockReturnValue({ select: mockSelectAfterInsert });
});

// ─── GET /api/events ──────────────────────────────────────────────────────────

describe("GET /api/events", () => {
  it("returns 401 when unauthenticated", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userId: null });
    const { GET } = await import("@/app/api/events/route");
    const req = new Request("http://localhost/api/events");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns events list sorted by event_date ascending (excludes past by default)", async () => {
    const events = [
      { id: "e1", user_id: "test-user-123", name: "Boston Marathon", event_date: "2026-06-01", sport_type: "run" },
      { id: "e2", user_id: "test-user-123", name: "Ironman 70.3", event_date: "2026-08-15", sport_type: "triathlon" },
    ];
    mockOrder.mockResolvedValueOnce({ data: events, error: null });

    const { GET } = await import("@/app/api/events/route");
    const req = new Request("http://localhost/api/events");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.events).toHaveLength(2);
    expect(body.events[0].name).toBe("Boston Marathon");
    // .gte() must have been called to filter out past events
    expect(mockGte).toHaveBeenCalledWith("event_date", expect.any(String));
    expect(mockOrder).toHaveBeenCalledWith("event_date", { ascending: true });
  });

  it("includes past events when include_past=true is set", async () => {
    const events = [
      { id: "e0", user_id: "test-user-123", name: "Old Race", event_date: "2025-01-10", sport_type: "run" },
    ];
    // When include_past=true, the chain goes .eq().order() — no .gte() step.
    // We need mockEqGet to return something with just .order()
    mockEqGet.mockReturnValueOnce({ gte: mockGte, order: mockOrder });
    mockOrder.mockResolvedValueOnce({ data: events, error: null });

    const { GET } = await import("@/app/api/events/route");
    const req = new Request("http://localhost/api/events?include_past=true");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.events).toHaveLength(1);
    // .gte() must NOT have been called (include_past skips the filter)
    expect(mockGte).not.toHaveBeenCalled();
  });

  it("returns 500 on database error", async () => {
    mockOrder.mockResolvedValueOnce({ data: null, error: { message: "DB error" } });

    const { GET } = await import("@/app/api/events/route");
    const req = new Request("http://localhost/api/events");
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});

// ─── POST /api/events ─────────────────────────────────────────────────────────

describe("POST /api/events", () => {
  it("returns 401 when unauthenticated", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userId: null });
    const { POST } = await import("@/app/api/events/route");
    const req = new Request("http://localhost/api/events", {
      method: "POST",
      body: JSON.stringify({ name: "Test Race", event_date: "2026-07-01" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when name is missing", async () => {
    const { POST } = await import("@/app/api/events/route");
    const req = new Request("http://localhost/api/events", {
      method: "POST",
      body: JSON.stringify({ event_date: "2026-07-01" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when event_date is missing", async () => {
    const { POST } = await import("@/app/api/events/route");
    const req = new Request("http://localhost/api/events", {
      method: "POST",
      body: JSON.stringify({ name: "Test Race" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is empty / unparseable", async () => {
    const { POST } = await import("@/app/api/events/route");
    const req = new Request("http://localhost/api/events", {
      method: "POST",
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("inserts event and returns 201 with event data", async () => {
    const newEvent = {
      id: "e-new",
      user_id: "test-user-123",
      name: "Boston Marathon",
      sport_type: "run",
      distance: 26.2,
      event_date: "2026-06-15",
      priority: "A",
      goal_type: "finish",
      goal_time: null,
      course_notes: "Hilly course",
      travel: true,
      created_at: "2026-05-19T00:00:00Z",
    };
    mockSingle.mockResolvedValueOnce({ data: newEvent, error: null });

    const { POST } = await import("@/app/api/events/route");
    const req = new Request("http://localhost/api/events", {
      method: "POST",
      body: JSON.stringify({
        name: "Boston Marathon",
        sport_type: "run",
        distance: 26.2,
        event_date: "2026-06-15",
        priority: "A",
        goal_type: "finish",
        course_notes: "Hilly course",
        travel: true,
      }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.event).toMatchObject({ id: "e-new", name: "Boston Marathon" });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "test-user-123", name: "Boston Marathon" }),
    );
  });

  it("returns 500 on database insert error", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "Insert failed" } });

    const { POST } = await import("@/app/api/events/route");
    const req = new Request("http://localhost/api/events", {
      method: "POST",
      body: JSON.stringify({ name: "Test Race", event_date: "2026-07-01" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
