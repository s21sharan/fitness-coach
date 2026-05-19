import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(() => Promise.resolve({ userId: "test-user-123" })),
}));

const mockRunSignUpRaces = [
  {
    race: {
      race_id: 12345,
      name: "Bay Area 5K",
      next_date: "2026-06-15",
      address: { city: "San Francisco", state: "CA" },
      events: [{ distance: "5K", event_type: "running_race" }],
      url: "https://runsignup.com/Race/CA/SanFrancisco/BayArea5K",
    },
  },
  {
    race: {
      race_id: 67890,
      name: "Iron Tri",
      next_date: "2026-07-20",
      address: { city: "Austin", state: "TX" },
      events: [{ distance: "140.6mi", event_type: "triathlon" }],
      url: "https://runsignup.com/Race/TX/Austin/IronTri",
    },
  },
];

describe("GET /api/races/search", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
    delete process.env.RUNSIGNUP_API_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 401 when unauthenticated", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userId: null });

    const { GET } = await import("@/app/api/races/search/route");
    const req = new Request("http://localhost/api/races/search?q=marathon");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when q param is missing", async () => {
    const { GET } = await import("@/app/api/races/search/route");
    const req = new Request("http://localhost/api/races/search");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when q param is less than 2 chars", async () => {
    const { GET } = await import("@/app/api/races/search/route");
    const req = new Request("http://localhost/api/races/search?q=m");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns mapped race results on successful proxy", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ races: mockRunSignUpRaces }),
    });

    const { GET } = await import("@/app/api/races/search/route");
    const req = new Request("http://localhost/api/races/search?q=marathon");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.races).toHaveLength(2);

    expect(body.races[0]).toMatchObject({
      runsignup_id: 12345,
      name: "Bay Area 5K",
      date: "2026-06-15",
      city: "San Francisco",
      state: "CA",
      distance: "5K",
      sport_type: "running",
      url: "https://runsignup.com/Race/CA/SanFrancisco/BayArea5K",
    });

    expect(body.races[1]).toMatchObject({
      runsignup_id: 67890,
      name: "Iron Tri",
      sport_type: "triathlon",
    });
  });

  it("passes name, start_date, results_per_page, sort, format to RunSignUp", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ races: [] }),
    });

    const { GET } = await import("@/app/api/races/search/route");
    const req = new Request("http://localhost/api/races/search?q=marathon");
    await GET(req);

    expect(mockFetch).toHaveBeenCalledOnce();
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("name=marathon");
    expect(calledUrl).toContain("results_per_page=10");
    expect(calledUrl).toContain("format=json");
    expect(calledUrl).toContain("sort=date+ASC");
    expect(calledUrl).toContain("start_date=");
  });

  it("includes location params when provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ races: [] }),
    });

    const { GET } = await import("@/app/api/races/search/route");
    const req = new Request("http://localhost/api/races/search?q=marathon&location=94105&radius=25");
    await GET(req);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("zipcode=94105");
    expect(calledUrl).toContain("radius=25");
  });

  it("uses default radius of 50 when location provided but no radius", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ races: [] }),
    });

    const { GET } = await import("@/app/api/races/search/route");
    const req = new Request("http://localhost/api/races/search?q=marathon&location=94105");
    await GET(req);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("zipcode=94105");
    expect(calledUrl).toContain("radius=50");
  });

  it("includes api_key when RUNSIGNUP_API_KEY env var is set", async () => {
    process.env.RUNSIGNUP_API_KEY = "test-api-key";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ races: [] }),
    });

    const { GET } = await import("@/app/api/races/search/route");
    const req = new Request("http://localhost/api/races/search?q=marathon");
    await GET(req);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("api_key=test-api-key");
  });

  it("does not include api_key when RUNSIGNUP_API_KEY is not set", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ races: [] }),
    });

    const { GET } = await import("@/app/api/races/search/route");
    const req = new Request("http://localhost/api/races/search?q=marathon");
    await GET(req);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).not.toContain("api_key=");
  });

  it("returns empty races array when RunSignUp returns no results", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ races: [] }),
    });

    const { GET } = await import("@/app/api/races/search/route");
    const req = new Request("http://localhost/api/races/search?q=obscurerace");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.races).toEqual([]);
  });

  it("returns 502 when RunSignUp API returns non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
    });

    const { GET } = await import("@/app/api/races/search/route");
    const req = new Request("http://localhost/api/races/search?q=marathon");
    const res = await GET(req);
    expect(res.status).toBe(502);
  });

  it("returns 502 when fetch throws (network error)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { GET } = await import("@/app/api/races/search/route");
    const req = new Request("http://localhost/api/races/search?q=marathon");
    const res = await GET(req);
    expect(res.status).toBe(502);
  });

  it("maps event types correctly", async () => {
    const racesWithTypes = [
      { race: { race_id: 1, name: "Trail Run", next_date: "2026-06-01", address: { city: "Denver", state: "CO" }, events: [{ distance: "10K", event_type: "trail_race" }], url: "https://runsignup.com/1" } },
      { race: { race_id: 2, name: "Ultra 50", next_date: "2026-06-01", address: { city: "Denver", state: "CO" }, events: [{ distance: "50mi", event_type: "ultra" }], url: "https://runsignup.com/2" } },
      { race: { race_id: 3, name: "Duathlon", next_date: "2026-06-01", address: { city: "Denver", state: "CO" }, events: [{ distance: "sprint", event_type: "duathlon" }], url: "https://runsignup.com/3" } },
      { race: { race_id: 4, name: "Bike Race", next_date: "2026-06-01", address: { city: "Denver", state: "CO" }, events: [{ distance: "100K", event_type: "bike_race" }], url: "https://runsignup.com/4" } },
      { race: { race_id: 5, name: "Open Swim", next_date: "2026-06-01", address: { city: "Denver", state: "CO" }, events: [{ distance: "1mi", event_type: "swim" }], url: "https://runsignup.com/5" } },
      { race: { race_id: 6, name: "Fun Run", next_date: "2026-06-01", address: { city: "Denver", state: "CO" }, events: [{ distance: "5K", event_type: "fun_run" }], url: "https://runsignup.com/6" } },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ races: racesWithTypes }),
    });

    const { GET } = await import("@/app/api/races/search/route");
    const req = new Request("http://localhost/api/races/search?q=denver");
    const res = await GET(req);
    const body = await res.json();

    expect(body.races[0].sport_type).toBe("running");   // trail_race
    expect(body.races[1].sport_type).toBe("running");   // ultra
    expect(body.races[2].sport_type).toBe("triathlon"); // duathlon
    expect(body.races[3].sport_type).toBe("cycling");   // bike_race
    expect(body.races[4].sport_type).toBe("swimming");  // swim
    expect(body.races[5].sport_type).toBe("other");     // fun_run
  });
});
