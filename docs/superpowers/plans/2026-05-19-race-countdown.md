# Race Countdown Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add race countdown pills to the DailySummaryCard, event CRUD API, RunSignUp autocomplete for race search, and an Events tab in Settings.

**Architecture:** Server-side API routes for event CRUD and RunSignUp proxy. Shared `RaceAutocomplete` component used in both onboarding and settings. DailySummaryCard gets a countdown strip below the AI text, and the daily summary prompt gets race context injected.

**Tech Stack:** Next.js App Router API routes, Supabase (existing `athlete_events` table), RunSignUp REST API, Clerk auth, React inline styles.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/app/api/events/route.ts` | Create | GET (list) + POST (create) for athlete_events |
| `src/app/api/events/[id]/route.ts` | Create | PATCH (update) + DELETE for a single event |
| `src/app/api/races/search/route.ts` | Create | Proxy to RunSignUp race search API |
| `src/components/shared/race-autocomplete.tsx` | Create | Debounced autocomplete input for race names |
| `src/components/dashboard/race-countdown-strip.tsx` | Create | Visual countdown pills for upcoming races |
| `src/components/dashboard/daily-summary-card.tsx` | Modify | Render countdown strip, pass events data |
| `src/app/api/daily-summary/route.ts` | Modify | Fetch events, inject into AI prompt |
| `src/lib/training/daily-summary-prompt.ts` | Modify | Add events to prompt builder interface + output |
| `src/components/onboarding/event-list.tsx` | Modify | Replace name input with RaceAutocomplete |
| `src/app/dashboard/settings/page.tsx` | Modify | Add "Events" tab with event management UI |
| `__tests__/api/events.test.ts` | Create | Unit tests for event CRUD |
| `__tests__/api/races-search.test.ts` | Create | Unit tests for RunSignUp proxy |
| `__tests__/components/race-countdown-strip.test.tsx` | Create | Unit tests for countdown strip |
| `__tests__/components/race-autocomplete.test.tsx` | Create | Unit tests for autocomplete |

---

### Task 1: Event CRUD API — GET + POST

**Files:**
- Create: `src/app/api/events/route.ts`
- Create: `__tests__/api/events.test.ts`

- [ ] **Step 1: Write failing tests for GET /api/events and POST /api/events**

```typescript
// __tests__/api/events.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Clerk auth
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

// Mock Supabase
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockFrom = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: mockFrom }),
}));

import { auth } from "@clerk/nextjs/server";
import { GET, POST } from "@/app/api/events/route";

function buildChain(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockResolvedValue({ data, error });
  chain.single = vi.fn().mockResolvedValue({ data, error });
  return chain;
}

describe("GET /api/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: null });
    const res = await GET(new Request("http://localhost/api/events"));
    expect(res.status).toBe(401);
  });

  it("returns upcoming events sorted by date", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "user_123" });
    const events = [
      { id: "1", name: "Local 10K", event_date: "2026-06-01", priority: "B" },
      { id: "2", name: "SF Marathon", event_date: "2026-07-12", priority: "A" },
    ];
    const chain = buildChain(events);
    mockFrom.mockReturnValue(chain);

    const res = await GET(new Request("http://localhost/api/events"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.events).toEqual(events);
    expect(chain.gte).toHaveBeenCalled();
  });

  it("includes past events when include_past=true", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "user_123" });
    const events = [{ id: "1", name: "Past Race", event_date: "2026-01-01", priority: "C" }];
    const chain = buildChain(events);
    mockFrom.mockReturnValue(chain);

    const res = await GET(new Request("http://localhost/api/events?include_past=true"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(chain.gte).not.toHaveBeenCalled();
  });
});

describe("POST /api/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: null });
    const res = await POST(new Request("http://localhost/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test", event_date: "2026-08-01" }),
    }));
    expect(res.status).toBe(401);
  });

  it("creates an event and returns it", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "user_123" });
    const created = { id: "new-1", name: "Boston Marathon", event_date: "2026-10-01", priority: "A" };
    const chain = buildChain(created);
    mockFrom.mockReturnValue(chain);

    const res = await POST(new Request("http://localhost/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Boston Marathon", event_date: "2026-10-01", priority: "A", sport_type: "running", distance: "Marathon" }),
    }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.event).toEqual(created);
  });

  it("returns 400 when name is missing", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "user_123" });
    const res = await POST(new Request("http://localhost/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_date: "2026-08-01" }),
    }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/api/events.test.ts`
Expected: FAIL — module `@/app/api/events/route` not found

- [ ] **Step 3: Implement GET and POST handlers**

```typescript
// src/app/api/events/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const url = new URL(req.url);
  const includePast = url.searchParams.get("include_past") === "true";
  const today = new Date().toISOString().slice(0, 10);

  let query = supabase
    .from("athlete_events")
    .select("*")
    .eq("user_id", userId);

  if (!includePast) {
    query = query.gte("event_date", today);
  }

  const { data, error } = await query.order("event_date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data || [] });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (!body.name || !body.event_date) {
    return NextResponse.json({ error: "name and event_date are required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await supabase
    .from("athlete_events")
    .insert({
      user_id: userId,
      name: body.name,
      sport_type: body.sport_type || null,
      distance: body.distance || null,
      event_date: body.event_date,
      priority: body.priority || null,
      goal_type: body.goal_type || null,
      goal_time: body.goal_time || null,
      course_notes: body.course_notes || null,
      travel: body.travel || false,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ event: data });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/api/events.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/events/route.ts __tests__/api/events.test.ts
git commit -m "feat: add event CRUD API — GET and POST routes"
```

---

### Task 2: Event CRUD API — PATCH + DELETE

**Files:**
- Create: `src/app/api/events/[id]/route.ts`
- Modify: `__tests__/api/events.test.ts`

- [ ] **Step 1: Write failing tests for PATCH and DELETE**

Add to `__tests__/api/events.test.ts`:

```typescript
import { PATCH, DELETE } from "@/app/api/events/[id]/route";

function makeReqWithParams(url: string, method: string, body?: unknown) {
  const req = new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return req;
}

describe("PATCH /api/events/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: null });
    const res = await PATCH(
      makeReqWithParams("http://localhost/api/events/abc", "PATCH", { name: "Updated" }),
      { params: Promise.resolve({ id: "abc" }) },
    );
    expect(res.status).toBe(401);
  });

  it("updates an event and returns it", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "user_123" });
    const updated = { id: "abc", name: "Updated Marathon", event_date: "2026-07-12" };
    const chain = buildChain(updated);
    mockFrom.mockReturnValue(chain);

    const res = await PATCH(
      makeReqWithParams("http://localhost/api/events/abc", "PATCH", { name: "Updated Marathon" }),
      { params: Promise.resolve({ id: "abc" }) },
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.event).toEqual(updated);
  });
});

describe("DELETE /api/events/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: null });
    const res = await DELETE(
      new Request("http://localhost/api/events/abc", { method: "DELETE" }),
      { params: Promise.resolve({ id: "abc" }) },
    );
    expect(res.status).toBe(401);
  });

  it("deletes an event and returns success", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "user_123" });
    const chain = buildChain(null);
    chain.delete = vi.fn().mockReturnValue(chain);
    mockFrom.mockReturnValue(chain);

    const res = await DELETE(
      new Request("http://localhost/api/events/abc", { method: "DELETE" }),
      { params: Promise.resolve({ id: "abc" }) },
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/api/events.test.ts`
Expected: FAIL — module `@/app/api/events/[id]/route` not found

- [ ] **Step 3: Implement PATCH and DELETE handlers**

```typescript
// src/app/api/events/[id]/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const allowedFields = ["name", "sport_type", "distance", "event_date", "priority", "goal_type", "goal_time", "course_notes", "travel"];
  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await supabase
    .from("athlete_events")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ event: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error } = await supabase
    .from("athlete_events")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/api/events.test.ts`
Expected: All 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/events/[id]/route.ts __tests__/api/events.test.ts
git commit -m "feat: add event PATCH and DELETE API routes"
```

---

### Task 3: RunSignUp Race Search Proxy

**Files:**
- Create: `src/app/api/races/search/route.ts`
- Create: `__tests__/api/races-search.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/api/races-search.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

// Mock global fetch for RunSignUp calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { auth } from "@clerk/nextjs/server";
import { GET } from "@/app/api/races/search/route";

describe("GET /api/races/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RUNSIGNUP_API_KEY = "test-key";
  });

  it("returns 401 when unauthenticated", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: null });
    const res = await GET(new Request("http://localhost/api/races/search?q=marathon"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when q param is missing", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "user_123" });
    const res = await GET(new Request("http://localhost/api/races/search"));
    expect(res.status).toBe(400);
  });

  it("proxies to RunSignUp and returns simplified results", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "user_123" });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        races: [
          {
            race: {
              race_id: 12345,
              name: "SF Marathon",
              next_date: "2026-07-12",
              address: { city: "San Francisco", state: "CA" },
              distance_units: "Miles",
              events: [{ distance: "26.2", event_type: "running_race" }],
              url: "https://runsignup.com/Race/CA/SanFrancisco/SFMarathon",
            },
          },
        ],
      }),
    });

    const res = await GET(new Request("http://localhost/api/races/search?q=SF+Marathon"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.races).toHaveLength(1);
    expect(json.races[0].name).toBe("SF Marathon");
    expect(json.races[0].city).toBe("San Francisco");
    expect(json.races[0].runsignup_id).toBe(12345);
  });

  it("returns empty array when RunSignUp returns no results", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "user_123" });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ races: [] }),
    });

    const res = await GET(new Request("http://localhost/api/races/search?q=nonexistent"));
    const json = await res.json();
    expect(json.races).toEqual([]);
  });

  it("returns 502 when RunSignUp API fails", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "user_123" });
    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: "Internal Server Error" });

    const res = await GET(new Request("http://localhost/api/races/search?q=marathon"));
    expect(res.status).toBe(502);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/api/races-search.test.ts`
Expected: FAIL — module `@/app/api/races/search/route` not found

- [ ] **Step 3: Implement the RunSignUp proxy**

```typescript
// src/app/api/races/search/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

interface RunSignUpRace {
  race: {
    race_id: number;
    name: string;
    next_date: string;
    address?: { city?: string; state?: string };
    events?: { distance?: string; event_type?: string }[];
    url?: string;
  };
}

const EVENT_TYPE_MAP: Record<string, string> = {
  running_race: "running",
  trail_race: "running",
  ultra: "running",
  triathlon: "triathlon",
  duathlon: "triathlon",
  bike_race: "cycling",
  swim: "swimming",
  obstacle_course: "other",
  virtual_race: "other",
};

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  if (!q || q.length < 2) {
    return NextResponse.json({ error: "q param required (min 2 chars)" }, { status: 400 });
  }

  const location = url.searchParams.get("location") || "";
  const radius = url.searchParams.get("radius") || "50";
  const today = new Date().toISOString().slice(0, 10);

  const apiKey = process.env.RUNSIGNUP_API_KEY;
  const params = new URLSearchParams({
    name: q,
    start_date: today,
    results_per_page: "10",
    sort: "date ASC",
    format: "json",
    ...(apiKey ? { api_key: apiKey } : {}),
    ...(location ? { zipcode: location, radius } : {}),
  });

  const apiUrl = `https://runsignup.com/Rest/races?${params.toString()}`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      return NextResponse.json({ error: "RunSignUp API error" }, { status: 502 });
    }

    const data = await response.json();
    const races = (data.races || []).map((item: RunSignUpRace) => {
      const r = item.race;
      const firstEvent = r.events?.[0];
      const eventType = firstEvent?.event_type || "";
      return {
        name: r.name,
        date: r.next_date,
        city: r.address?.city || "",
        state: r.address?.state || "",
        distance: firstEvent?.distance || "",
        sport_type: EVENT_TYPE_MAP[eventType] || "other",
        url: r.url || "",
        runsignup_id: r.race_id,
      };
    });

    return NextResponse.json({ races });
  } catch {
    return NextResponse.json({ error: "Failed to fetch races" }, { status: 502 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/api/races-search.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/races/search/route.ts __tests__/api/races-search.test.ts
git commit -m "feat: add RunSignUp race search proxy API"
```

---

### Task 4: RaceAutocomplete Component

**Files:**
- Create: `src/components/shared/race-autocomplete.tsx`
- Create: `__tests__/components/race-autocomplete.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// __tests__/components/race-autocomplete.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { RaceAutocomplete } from "@/components/shared/race-autocomplete";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("RaceAutocomplete", () => {
  const onChange = vi.fn();
  const onSelectRace = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders input with placeholder", () => {
    render(<RaceAutocomplete value="" onChange={onChange} onSelectRace={onSelectRace} />);
    expect(screen.getByPlaceholderText("Search races or type a name...")).toBeTruthy();
  });

  it("calls onChange on typing", () => {
    render(<RaceAutocomplete value="" onChange={onChange} onSelectRace={onSelectRace} />);
    fireEvent.change(screen.getByPlaceholderText("Search races or type a name..."), {
      target: { value: "marathon" },
    });
    expect(onChange).toHaveBeenCalledWith("marathon");
  });

  it("does not fetch with less than 2 characters", async () => {
    render(<RaceAutocomplete value="m" onChange={onChange} onSelectRace={onSelectRace} />);
    await act(async () => { vi.advanceTimersByTime(400); });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fetches after 300ms debounce with 2+ chars", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ races: [{ name: "SF Marathon", date: "2026-07-12", city: "San Francisco", state: "CA", distance: "26.2", sport_type: "running", url: "", runsignup_id: 1 }] }),
    });

    const { rerender } = render(<RaceAutocomplete value="ma" onChange={onChange} onSelectRace={onSelectRace} />);
    rerender(<RaceAutocomplete value="mar" onChange={onChange} onSelectRace={onSelectRace} />);

    await act(async () => { vi.advanceTimersByTime(400); });
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/api/races/search?q=mar"));
  });

  it("shows dropdown results and calls onSelectRace on click", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        races: [{ name: "SF Marathon", date: "2026-07-12", city: "San Francisco", state: "CA", distance: "26.2 mi", sport_type: "running", url: "", runsignup_id: 1 }],
      }),
    });

    render(<RaceAutocomplete value="SF" onChange={onChange} onSelectRace={onSelectRace} />);
    await act(async () => { vi.advanceTimersByTime(400); });

    await waitFor(() => {
      expect(screen.getByText("SF Marathon")).toBeTruthy();
    });

    fireEvent.mouseDown(screen.getByText("SF Marathon"));
    expect(onSelectRace).toHaveBeenCalledWith(expect.objectContaining({ name: "SF Marathon" }));
  });

  it("shows 'No races found' for empty results", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ races: [] }),
    });

    render(<RaceAutocomplete value="zzz" onChange={onChange} onSelectRace={onSelectRace} />);
    await act(async () => { vi.advanceTimersByTime(400); });

    await waitFor(() => {
      expect(screen.getByText("No races found")).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/components/race-autocomplete.test.tsx`
Expected: FAIL — module `@/components/shared/race-autocomplete` not found

- [ ] **Step 3: Implement the RaceAutocomplete component**

```tsx
// src/components/shared/race-autocomplete.tsx
"use client";

import { useState, useEffect, useRef } from "react";

export interface RaceSearchResult {
  name: string;
  date: string;
  city: string;
  state: string;
  distance: string;
  sport_type: string;
  url: string;
  runsignup_id: number;
}

interface RaceAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelectRace: (race: RaceSearchResult) => void;
  placeholder?: string;
  inputStyle?: React.CSSProperties;
}

export function RaceAutocomplete({
  value,
  onChange,
  onSelectRace,
  placeholder = "Search races or type a name...",
  inputStyle: customInputStyle,
}: RaceAutocompleteProps) {
  const [results, setResults] = useState<RaceSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (value.length < 2) {
      setResults([]);
      setOpen(false);
      setSearched(false);
      return;
    }

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/races/search?q=${encodeURIComponent(value)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.races || []);
          setSearched(true);
          setOpen(true);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value]);

  const handleSelect = (race: RaceSearchResult) => {
    onSelectRace(race);
    onChange(race.name);
    setOpen(false);
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (containerRef.current?.contains(e.relatedTarget as Node)) return;
    setOpen(false);
  };

  const defaultInput: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1.5px solid var(--line, #e5e7eb)",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    background: "#fff",
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }} onBlur={handleBlur}>
      <div style={{ position: "relative" }}>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ ...defaultInput, ...customInputStyle }}
        />
        {loading && (
          <div style={{
            position: "absolute",
            right: 12,
            top: "50%",
            transform: "translateY(-50%)",
            width: 14,
            height: 14,
            border: "2px solid #e5e7eb",
            borderTopColor: "#6b7280",
            borderRadius: "50%",
            animation: "spin 0.6s linear infinite",
          }} />
        )}
      </div>

      {open && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          marginTop: 4,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          zIndex: 50,
          maxHeight: 260,
          overflowY: "auto",
        }}>
          {results.length === 0 && searched && (
            <div style={{ padding: "12px 14px", fontSize: 13, color: "#9ca3af" }}>
              No races found
            </div>
          )}
          {results.map((race) => (
            <button
              key={race.runsignup_id}
              type="button"
              onMouseDown={() => handleSelect(race)}
              style={{
                display: "block",
                width: "100%",
                padding: "10px 14px",
                textAlign: "left",
                background: "transparent",
                border: "none",
                borderBottom: "1px solid #f3f4f6",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{race.name}</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                {race.date} · {race.city}{race.state ? `, ${race.state}` : ""}{race.distance ? ` · ${race.distance}` : ""}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/components/race-autocomplete.test.tsx`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/race-autocomplete.tsx __tests__/components/race-autocomplete.test.tsx
git commit -m "feat: add RaceAutocomplete component with debounced search"
```

---

### Task 5: Race Countdown Strip Component

**Files:**
- Create: `src/components/dashboard/race-countdown-strip.tsx`
- Create: `__tests__/components/race-countdown-strip.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// __tests__/components/race-countdown-strip.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { RaceCountdownStrip } from "@/components/dashboard/race-countdown-strip";

describe("RaceCountdownStrip", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-19"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when no events provided", () => {
    const { container } = render(<RaceCountdownStrip events={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders a pill for each event (max 3)", () => {
    const events = [
      { id: "1", name: "Race A", event_date: "2026-06-01", priority: "A" },
      { id: "2", name: "Race B", event_date: "2026-07-01", priority: "B" },
      { id: "3", name: "Race C", event_date: "2026-08-01", priority: "C" },
      { id: "4", name: "Race D", event_date: "2026-09-01", priority: "A" },
    ];
    render(<RaceCountdownStrip events={events} />);
    expect(screen.getByText("Race A")).toBeTruthy();
    expect(screen.getByText("Race B")).toBeTruthy();
    expect(screen.getByText("Race C")).toBeTruthy();
    expect(screen.queryByText("Race D")).toBeNull();
  });

  it("shows correct day countdown", () => {
    const events = [
      { id: "1", name: "Test Race", event_date: "2026-06-01", priority: "B" },
    ];
    render(<RaceCountdownStrip events={events} />);
    // May 19 to Jun 1 = 13 days
    expect(screen.getByText("13d")).toBeTruthy();
  });

  it("shows 'Today' for same-day events", () => {
    const events = [
      { id: "1", name: "Race Day", event_date: "2026-05-19", priority: "A" },
    ];
    render(<RaceCountdownStrip events={events} />);
    expect(screen.getByText("Today")).toBeTruthy();
  });

  it("applies urgency styling for events within 7 days", () => {
    const events = [
      { id: "1", name: "Soon Race", event_date: "2026-05-23", priority: "A" },
    ];
    const { container } = render(<RaceCountdownStrip events={events} />);
    // 4 days away — should have urgency red background (#fef2f2)
    const badge = screen.getByText("4d");
    expect(badge.style.background).toBe("rgb(254, 242, 242)");
  });

  it("shows correct priority dot colors", () => {
    const events = [
      { id: "1", name: "A Race", event_date: "2026-06-01", priority: "A" },
      { id: "2", name: "B Race", event_date: "2026-07-01", priority: "B" },
      { id: "3", name: "C Race", event_date: "2026-08-01", priority: "C" },
    ];
    render(<RaceCountdownStrip events={events} />);
    // Priority labels are rendered
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("B")).toBeTruthy();
    expect(screen.getByText("C")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/components/race-countdown-strip.test.tsx`
Expected: FAIL — module `@/components/dashboard/race-countdown-strip` not found

- [ ] **Step 3: Implement the countdown strip**

```tsx
// src/components/dashboard/race-countdown-strip.tsx
"use client";

interface RaceEvent {
  id: string;
  name: string;
  event_date: string;
  priority: string | null;
}

interface RaceCountdownStripProps {
  events: RaceEvent[];
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <rect x="1" y="3" width="14" height="12" rx="2" stroke="#9ca3af" strokeWidth="1.5" fill="none" />
      <path d="M1 7h14" stroke="#9ca3af" strokeWidth="1.5" />
      <path d="M5 1v4M11 1v4" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function getDaysUntil(eventDate: string): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(eventDate + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

const PRIORITY_COLORS: Record<string, string> = {
  A: "#f87171",
  B: "#fbbf24",
  C: "#9ca3af",
};

export function RaceCountdownStrip({ events }: RaceCountdownStripProps) {
  if (events.length === 0) return null;

  const upcoming = events.slice(0, 3);

  return (
    <>
      <div style={{
        borderTop: "1px solid #e5e7eb",
        margin: "12px 0 0 0",
        paddingTop: 12,
      }}>
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
        }}>
          {upcoming.map((ev) => {
            const days = getDaysUntil(ev.event_date);
            const isUrgent = days <= 7;
            const isToday = days === 0;
            const priority = ev.priority || "C";

            return (
              <div
                key={ev.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: "#f9fafb",
                  border: "1px solid #f3f4f6",
                }}
              >
                <CalendarIcon />
                <span style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#374151",
                  maxWidth: 140,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {ev.name}
                </span>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: isUrgent ? "#fef2f2" : "#f3f4f6",
                  color: isUrgent ? "#dc2626" : "#374151",
                }}>
                  {isToday ? "Today" : `${days}d`}
                </span>
                <span style={{
                  fontSize: 10,
                  fontWeight: 800,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: PRIORITY_COLORS[priority] || "#9ca3af",
                  color: "#fff",
                }}>
                  {priority}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/components/race-countdown-strip.test.tsx`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/race-countdown-strip.tsx __tests__/components/race-countdown-strip.test.tsx
git commit -m "feat: add RaceCountdownStrip component with urgency styling"
```

---

### Task 6: Wire Countdown Strip into DailySummaryCard

**Files:**
- Modify: `src/components/dashboard/daily-summary-card.tsx`

- [ ] **Step 1: Update DailySummaryCard to fetch events and render the strip**

Edit `src/components/dashboard/daily-summary-card.tsx` — replace the entire file:

```tsx
"use client";

import { useEffect, useState } from "react";
import { RaceCountdownStrip } from "./race-countdown-strip";

interface DailySummaryData {
  summary: string | null;
  generated_at: string | null;
  cached: boolean;
}

interface RaceEvent {
  id: string;
  name: string;
  event_date: string;
  priority: string | null;
}

function formatGreeting(): string {
  const now = new Date();
  const day = now.toLocaleDateString("en-US", { weekday: "long" });
  const month = now.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  return `${day}, ${month}`;
}

export function DailySummaryCard() {
  const [data, setData] = useState<DailySummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<RaceEvent[]>([]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    fetch("/api/daily-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: today }),
    })
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false));

    fetch("/api/events")
      .then((res) => res.json())
      .then((json) => setEvents(json.events || []))
      .catch(() => setEvents([]));
  }, []);

  // Error state — hide the card entirely
  if (!loading && !data) return null;

  // No data for today — show muted message (still show countdown if events exist)
  if (!loading && data && !data.summary) {
    return (
      <div style={{
        background: "#f9fafb",
        borderRadius: 10,
        padding: "16px 20px",
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 4 }}>Today</div>
        <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>{formatGreeting()}</div>
        <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 10 }}>
          No data synced for today yet.
        </div>
        <RaceCountdownStrip events={events} />
      </div>
    );
  }

  return (
    <div style={{
      background: "#f9fafb",
      borderRadius: 10,
      padding: "16px 20px",
      marginBottom: 16,
    }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 4 }}>Today</div>
      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500, marginBottom: 10 }}>{formatGreeting()}</div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ height: 12, background: "#e5e7eb", borderRadius: 4, width: "100%", animation: "pulse 1.5s ease-in-out infinite" }} />
          <div style={{ height: 12, background: "#e5e7eb", borderRadius: 4, width: "92%", animation: "pulse 1.5s ease-in-out infinite", animationDelay: "0.2s" }} />
          <div style={{ height: 12, background: "#e5e7eb", borderRadius: 4, width: "78%", animation: "pulse 1.5s ease-in-out infinite", animationDelay: "0.4s" }} />
        </div>
      ) : (
        <div style={{ fontSize: 13, lineHeight: 1.65, color: "#374151" }}>
          {data!.summary}
        </div>
      )}

      {!loading && <RaceCountdownStrip events={events} />}
    </div>
  );
}
```

- [ ] **Step 2: Verify the app compiles (no runtime test needed — visual check)**

Run: `npx vitest run __tests__/components/race-countdown-strip.test.tsx`
Expected: All existing tests still PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/daily-summary-card.tsx
git commit -m "feat: wire RaceCountdownStrip into DailySummaryCard"
```

---

### Task 7: Inject Race Context into Daily Summary AI Prompt

**Files:**
- Modify: `src/lib/training/daily-summary-prompt.ts`
- Modify: `src/app/api/daily-summary/route.ts`

- [ ] **Step 1: Add events to the prompt builder interface and output**

Edit `src/lib/training/daily-summary-prompt.ts` — add the events field to the interface and append a section to the prompt:

Add to `DailySummaryPromptInput` interface (after `trainingHistory: TrainingHistory`):

```typescript
  upcomingEvents?: { name: string; event_date: string; priority: string | null; goal_time: string | null; days_away: number }[];
```

Add to the end of `buildDailySummaryPrompt`, before the final `return lines.join("\n")`:

```typescript
  // Upcoming races
  if (input.upcomingEvents && input.upcomingEvents.length > 0) {
    lines.push("UPCOMING RACES:");
    for (const ev of input.upcomingEvents) {
      const parts = [`${ev.name} (${ev.priority || "?"} race)`];
      parts.push(`${ev.event_date} — ${ev.days_away} days away`);
      if (ev.goal_time) parts.push(`goal: ${ev.goal_time}`);
      lines.push(`- ${parts.join(", ")}`);
    }
    lines.push("");
  }
```

- [ ] **Step 2: Fetch events in the daily summary API route and pass them to the prompt builder**

Edit `src/app/api/daily-summary/route.ts` — add an events query to the `Promise.all` and pass them to `buildDailySummaryPrompt`.

Add to the `Promise.all` array (after the `recovery7Res` entry):

```typescript
    supabase.from("athlete_events").select("name, event_date, priority, goal_time").eq("user_id", userId).gte("event_date", date).order("event_date", { ascending: true }).limit(5),
```

After the existing variable assignments (around line 44), add:

```typescript
  const eventsRes = /* the 7th element from Promise.all */;
  const upcomingEvents = (eventsRes.data || []).map((ev: { name: string; event_date: string; priority: string | null; goal_time: string | null }) => {
    const target = new Date(ev.event_date + "T00:00:00");
    const today = new Date(date + "T00:00:00");
    const days_away = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return { ...ev, days_away };
  });
```

Pass `upcomingEvents` to the `buildDailySummaryPrompt` call:

```typescript
  const prompt = buildDailySummaryPrompt({
    // ...existing fields...
    upcomingEvents,
  });
```

Also include `upcomingEvents` in the `dataForHash` computation so cache invalidates when events change:

```typescript
  const dataForHash = JSON.stringify({ recovery, workoutsToday, cardioToday, trainingHistory, upcomingEvents });
```

- [ ] **Step 3: Run all tests to verify nothing broke**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/training/daily-summary-prompt.ts src/app/api/daily-summary/route.ts
git commit -m "feat: inject upcoming race context into daily summary AI prompt"
```

---

### Task 8: Add RaceAutocomplete to Onboarding EventList

**Files:**
- Modify: `src/components/onboarding/event-list.tsx`

- [ ] **Step 1: Replace the name text input with RaceAutocomplete**

Edit `src/components/onboarding/event-list.tsx`:

Add import at the top:

```typescript
import { RaceAutocomplete, type RaceSearchResult } from "@/components/shared/race-autocomplete";
```

In the `EventCard` component, replace the name `<input>` block (the `<input type="text" value={ev.name} ... placeholder="Event name (e.g. SF Marathon)" ...>`) with:

```tsx
        <RaceAutocomplete
          value={ev.name}
          onChange={(name) => onPatch({ name })}
          onSelectRace={(race: RaceSearchResult) => {
            onPatch({
              name: race.name,
              event_date: race.date,
              sport_type: race.sport_type,
              distance: race.distance,
            });
          }}
          placeholder="Search races or type a name..."
          inputStyle={{ fontSize: 16, fontWeight: 800 }}
        />
```

Remove the `onFocus={onEdit}` that was on the old input — the autocomplete handles its own focus. Instead, add `onFocus={onEdit}` behavior by wrapping the autocomplete in a div with `onFocus={onEdit}`.

- [ ] **Step 2: Run existing tests to verify nothing broke**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/event-list.tsx
git commit -m "feat: replace onboarding event name input with RaceAutocomplete"
```

---

### Task 9: Add Events Tab to Settings Page

**Files:**
- Modify: `src/app/dashboard/settings/page.tsx`

- [ ] **Step 1: Add "Events" to NAV_ITEMS**

Edit `src/app/dashboard/settings/page.tsx`:

Insert a new entry into `NAV_ITEMS` between "preferences" and "zones":

```typescript
  { id: "events", label: "Races & Events" },
```

So the array becomes:

```typescript
const NAV_ITEMS = [
  { id: "integrations", label: "Integrations" },
  { id: "preferences", label: "Preferences" },
  { id: "events", label: "Races & Events" },
  { id: "zones", label: "Training Zones" },
  { id: "account", label: "Account" },
  { id: "goals", label: "Goals & body" },
  { id: "notifications", label: "Notifications" },
  { id: "privacy", label: "Privacy & data" },
  { id: "subscription", label: "Subscription" },
];
```

- [ ] **Step 2: Add imports and state for events management**

Add imports at the top of the file:

```typescript
import { RaceAutocomplete, type RaceSearchResult } from "@/components/shared/race-autocomplete";
```

Add state inside `SettingsPage`:

```typescript
const [events, setEvents] = useState<Array<{
  id: string;
  name: string;
  sport_type: string | null;
  distance: string | null;
  event_date: string | null;
  priority: string | null;
  goal_type: string | null;
  goal_time: string | null;
  course_notes: string | null;
  travel: boolean;
}>>([]);
const [eventsLoading, setEventsLoading] = useState(false);
const [editingEventId, setEditingEventId] = useState<string | null>(null);
```

Add a fetch effect (inside the existing `useEffect` or a new one):

```typescript
useEffect(() => {
  if (activeNav === "events") {
    setEventsLoading(true);
    fetch("/api/events?include_past=true")
      .then((r) => r.json())
      .then((d) => setEvents(d.events || []))
      .catch(() => setEvents([]))
      .finally(() => setEventsLoading(false));
  }
}, [activeNav]);
```

- [ ] **Step 3: Add event CRUD handler functions**

Add these functions inside `SettingsPage`:

```typescript
const addEvent = async () => {
  const res = await fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "", event_date: new Date().toISOString().slice(0, 10), priority: "A", sport_type: "running" }),
  });
  if (res.ok) {
    const { event } = await res.json();
    setEvents((prev) => [...prev, event]);
    setEditingEventId(event.id);
  }
};

const updateEvent = async (id: string, patch: Record<string, unknown>) => {
  setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  await fetch(`/api/events/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
};

const deleteEvent = async (id: string) => {
  setEvents((prev) => prev.filter((e) => e.id !== id));
  await fetch(`/api/events/${id}`, { method: "DELETE" });
};
```

- [ ] **Step 4: Add the events tab panel content**

Add the conditional render block alongside the other tabs (where `{activeNav === "zones" && ...}` etc. are):

```tsx
{activeNav === "events" && (
  <div>
    <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", marginBottom: 4 }}>Races & Events</h2>
    <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>Manage your upcoming races and goal events.</p>

    {eventsLoading ? (
      <div style={{ color: "#9ca3af", fontSize: 13 }}>Loading events...</div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {events.map((ev) => {
          const isEditing = editingEventId === ev.id;
          return (
            <div key={ev.id} style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <RaceAutocomplete
                    value={ev.name}
                    onChange={(name) => updateEvent(ev.id, { name })}
                    onSelectRace={(race: RaceSearchResult) => {
                      updateEvent(ev.id, {
                        name: race.name,
                        event_date: race.date,
                        sport_type: race.sport_type,
                        distance: race.distance,
                      });
                    }}
                    placeholder="Search races or type a name..."
                    inputStyle={{ fontSize: 15, fontWeight: 700 }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => deleteEvent(ev.id)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    background: "transparent",
                    cursor: "pointer",
                    color: "#9ca3af",
                    fontFamily: "inherit",
                    fontSize: 13,
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 4, display: "block" }}>Date</label>
                  <input
                    type="date"
                    value={ev.event_date ?? ""}
                    onChange={(e) => updateEvent(ev.id, { event_date: e.target.value || null })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 4, display: "block" }}>Goal time</label>
                  <input
                    type="text"
                    value={ev.goal_time ?? ""}
                    onChange={(e) => updateEvent(ev.id, { goal_time: e.target.value || null })}
                    placeholder="3:50:00"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 4, display: "block" }}>Priority</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["A", "B", "C"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => updateEvent(ev.id, { priority: p })}
                      style={{
                        flex: 1,
                        padding: "8px",
                        borderRadius: 8,
                        border: ev.priority === p ? "2px solid #111827" : "1.5px solid #e5e7eb",
                        background: ev.priority === p ? "#111827" : "#fff",
                        color: ev.priority === p ? "#fff" : "#111827",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      {p} — {p === "A" ? "Goal" : p === "B" ? "Tune-up" : "Training"}
                    </button>
                  ))}
                </div>
              </div>

              {!isEditing && (
                <button
                  type="button"
                  onClick={() => setEditingEventId(ev.id)}
                  style={{ alignSelf: "flex-start", fontSize: 12, color: "#6b7280", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}
                >
                  + More options
                </button>
              )}

              {isEditing && (
                <>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 4, display: "block" }}>Course notes</label>
                    <textarea
                      value={ev.course_notes ?? ""}
                      onChange={(e) => updateEvent(ev.id, { course_notes: e.target.value })}
                      rows={2}
                      placeholder="Hilly, hot, altitude…"
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
                    />
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#374151" }}>
                    <input
                      type="checkbox"
                      checked={ev.travel}
                      onChange={(e) => updateEvent(ev.id, { travel: e.target.checked })}
                    />
                    Travel involved
                  </label>
                </>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={addEvent}
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            border: "1.5px dashed #d1d5db",
            background: "transparent",
            fontSize: 13,
            fontWeight: 700,
            color: "#6b7280",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          + Add race
        </button>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 5: Run all tests to verify nothing broke**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/settings/page.tsx
git commit -m "feat: add Races & Events tab to Settings with full CRUD"
```

---

### Task 10: Add RUNSIGNUP_API_KEY to Environment

**Files:**
- Modify: `.env.local` (add the key)

- [ ] **Step 1: Add the environment variable**

Add to `.env.local`:

```
RUNSIGNUP_API_KEY=<your-runsignup-api-key>
```

Note: You need to register at https://runsignup.com/API/GettingStarted to get a free API key. The app will still work without it (RunSignUp allows unauthenticated requests with lower rate limits), but having the key ensures reliable access.

- [ ] **Step 2: Commit (do NOT commit .env.local — just verify it's in .gitignore)**

Run: `grep ".env.local" .gitignore`
Expected: `.env.local` is listed in `.gitignore`

No git commit for this step — env files are not committed.

---

### Task 11: Final Integration Test

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Manual verification checklist**

If the dev server is running (`npm run dev`):

1. Open `/dashboard` — verify the DailySummaryCard shows countdown pills if you have events in `athlete_events`
2. Open `/dashboard/settings` — click "Races & Events" tab, verify events load, add/edit/delete works
3. In the events tab, type a race name — verify RunSignUp autocomplete dropdown appears after 300ms
4. Select a race from autocomplete — verify date, sport, distance auto-fill
5. Check that the daily summary AI text references upcoming races (may need to clear the `daily_summaries` cache row for today)

- [ ] **Step 3: Final commit if any adjustments were needed**

```bash
git add -A
git commit -m "fix: integration adjustments for race countdown feature"
```
