# Race Countdown Dashboard — Design Spec

**Date:** 2026-05-19
**Status:** Draft

## Overview

Add race countdown functionality to the Trainer dashboard. Users add races during onboarding (already exists) and manage them in Settings. The DailySummaryCard shows a visual countdown strip plus AI-generated race context in the summary narrative. Race entry is enhanced with RunSignUp autocomplete so users can search real races and auto-fill event details.

## Goals

- Surface upcoming race countdowns prominently on the dashboard
- Let users manage races post-onboarding (add/edit/remove in Settings)
- Enhance race entry with RunSignUp autocomplete (onboarding + settings)
- Inject race context into the AI daily summary for coaching relevance

## Non-Goals

- Race results tracking or post-race analysis
- Integration with RunSignUp for registration/payment
- Social/sharing features around races
- Storing RunSignUp-specific metadata beyond what `athlete_events` already captures

---

## 1. Data Layer

### 1.1 Database Schema

No schema changes required. The existing `athlete_events` table covers all needed fields:

```sql
-- Already exists in 005_athlete_context.sql
create table if not exists public.athlete_events (
  id           uuid      primary key default gen_random_uuid(),
  user_id      text      not null references public.users(id) on delete cascade,
  name         text      not null,
  sport_type   text,
  distance     text,
  event_date   date,
  priority     text      check (priority in ('A', 'B', 'C')),
  goal_type    text,
  goal_time    text,
  course_notes text,
  travel       boolean   not null default false,
  created_at   timestamptz not null default now()
);
```

### 1.2 Event CRUD API

New API routes for managing events post-onboarding:

**`GET /api/events`**
- Returns all `athlete_events` for the authenticated user, sorted by `event_date` ascending
- Filters out past events by default (events where `event_date < today`)
- Optional query param `?include_past=true` to include past events

**`POST /api/events`**
- Creates a new event
- Body: `{ name, sport_type, distance, event_date, priority, goal_type?, goal_time?, course_notes?, travel? }`
- Validates required fields: `name`, `event_date`
- Returns the created event

**`PATCH /api/events/[id]`**
- Updates an existing event
- Body: partial event fields
- Validates the event belongs to the authenticated user
- Returns the updated event

**`DELETE /api/events/[id]`**
- Deletes an event
- Validates the event belongs to the authenticated user
- Returns `{ success: true }`

### 1.3 Race Search API

**`GET /api/races/search`**
- Server-side proxy to RunSignUp API (keeps API key on the server)
- Query params: `q` (search text, required), `location` (zip code, optional), `radius` (miles, optional, default 50)
- Calls RunSignUp `GET /Api/races` with: `name=<q>`, `zipcode=<location>`, `radius=<radius>`, `start_date=today`, `results_per_page=10`, `sort=date+ASC`
- Returns simplified results:

```typescript
interface RaceSearchResult {
  name: string;
  date: string;          // ISO date
  city: string;
  state: string;
  distance: string;      // e.g., "26.2 mi", "Half Marathon"
  sport_type: string;    // mapped to our sport types: "running", "cycling", "triathlon", etc.
  url: string;           // registration URL
  runsignup_id: number;
}
```

- Environment variable: `RUNSIGNUP_API_KEY` (added to `.env.local`)
- Rate limiting: debounced on the client side (300ms), server-side we rely on RunSignUp's 2-concurrent-request limit being sufficient for single-user queries

---

## 2. UI Components

### 2.1 RaceAutocomplete Component

A shared autocomplete input used in both onboarding and settings for race name entry.

**Location:** `src/components/shared/race-autocomplete.tsx`

**Behavior:**
- Text input with placeholder "Search races or type a name..."
- On input change, debounce 300ms, then call `GET /api/races/search?q=<input>`
- Show a dropdown below the input with matching races
- Each dropdown item shows: race name (bold), date, city/state, distance
- Selecting a race auto-fills: `name`, `event_date`, `sport_type`, `distance`
- If the user types a name that doesn't match any result, they keep the free-text value (not all races are on RunSignUp)
- Dropdown closes on selection or blur
- Loading state: subtle spinner inside the input while fetching
- Empty state: "No races found" with muted text
- Minimum 2 characters before searching

**Props:**
```typescript
interface RaceAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelectRace: (race: RaceSearchResult) => void;
  placeholder?: string;
}
```

### 2.2 Settings — Events Section

**Location:** New section in `src/app/dashboard/settings/page.tsx`

**Placement:** New "Events" tab in the settings sidebar, between "Preferences" and "Account".

**Layout:**
- Header: "Races & Events" with subtitle "Manage your upcoming races and goal events"
- List of event cards, same visual style as onboarding's `EventList`
- Each card shows: name, date, distance, priority badge, sport type
- Cards are expandable to edit (same fields as onboarding: goal_type, goal_time, course_notes, travel)
- Name field uses `RaceAutocomplete` instead of plain text input
- Delete button on each card with confirmation ("Remove this event?")
- "Add Race" button at the bottom opens a new empty card in editing mode
- Cards sorted by event_date ascending

**Data flow:**
- On mount: `GET /api/events` to load existing events
- On add: `POST /api/events` → append to list
- On edit: `PATCH /api/events/[id]` → update in list
- On delete: `DELETE /api/events/[id]` → remove from list

**Reuse:** Extract the event card editing UI from `src/components/onboarding/event-list.tsx` into a shared `EventCard` component that both onboarding and settings use. The onboarding version manages local state (passed up via `onChange`), while the settings version calls the CRUD API directly.

### 2.3 Onboarding Enhancement

**File:** `src/components/onboarding/screen-events.tsx` + `event-list.tsx`

**Changes:**
- Replace the free-text `name` input with `RaceAutocomplete`
- When a race is selected from autocomplete, auto-fill `event_date`, `sport_type`, `distance`
- No other changes to the onboarding flow

### 2.4 DailySummaryCard — Countdown Strip

**File:** `src/components/dashboard/daily-summary-card.tsx`

**Visual design:**
A row of compact race pills rendered below the AI summary text, separated by a subtle divider line.

```
┌─────────────────────────────────────────────────────────┐
│ Today — Monday, May 19                                  │
│                                                         │
│ Rest day. Your HRV is trending up after last week's     │
│ build block. Good time to stay easy — SF Marathon is     │
│ 53 days out and your fitness curve is on track.          │
│                                                         │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│ 📅 SF Marathon        53d 🔴A    📅 Local 10K    12d ●B │
└─────────────────────────────────────────────────────────┘
```

**Pill design:**
- Calendar icon (inline SVG, 14px, muted gray)
- Race name — medium weight, truncated at ~20 chars with ellipsis
- Countdown badge — rounded pill background:
  - Default: `#f3f4f6` (light gray) with `#374151` text
  - ≤ 7 days: `#fef2f2` (light red) with `#dc2626` text (urgency)
  - Today: shows "Today" in red instead of "0d"
- Priority dot — small filled circle:
  - A race: `#f87171` (coral)
  - B race: `#fbbf24` (amber)
  - C race: `#9ca3af` (gray)

**Behavior:**
- Fetch events from `/api/events` on mount (or receive them as props from dashboard data)
- Show max 3 upcoming events, sorted by date ascending
- If no events exist, the strip doesn't render (no divider either)
- Pills are not clickable for MVP (future: navigate to settings events section)

**Responsive:**
- On mobile (< 640px), stack pills vertically instead of horizontal row
- Truncate race names more aggressively on small screens

---

## 3. Daily Summary AI Enhancement

**File:** `src/app/api/daily-summary/route.ts`

**Change:** Before generating the daily summary, fetch upcoming events from `athlete_events` where `event_date >= today`. Inject them into the AI prompt:

```
Upcoming races:
- SF Marathon (A race) on 2026-07-12 — 53 days away, goal time 3:50:00
- Local 10K (B race) on 2026-06-01 — 12 days away
```

The existing prompt already asks Claude to generate a contextual daily summary. Adding race data lets it naturally reference countdowns, training readiness relative to race dates, and taper timing without any prompt restructuring.

---

## 4. Testing Strategy

**Unit tests:**
- `RaceAutocomplete`: renders, debounces input, shows dropdown, auto-fills on selection, handles empty results
- Event CRUD API routes: create/read/update/delete, auth validation, past-event filtering
- Race search API: proxies to RunSignUp, handles errors, maps response format
- Countdown strip: renders pills, correct countdown math, urgency styling at ≤7 days, "Today" label, max 3 events, hidden when no events

**Integration:**
- Onboarding flow: search a race → select → fields auto-fill → save → event appears in DB
- Settings: load events → edit one → save → reload confirms changes
- Daily summary: event data appears in AI prompt context

---

## 5. Environment Variables

**New:**
- `RUNSIGNUP_API_KEY` — added to `.env.local`, used by `/api/races/search`

---

## 6. File Summary

| File | Action | Purpose |
|---|---|---|
| `src/app/api/races/search/route.ts` | New | RunSignUp proxy endpoint |
| `src/app/api/events/route.ts` | New | Event CRUD (GET, POST) |
| `src/app/api/events/[id]/route.ts` | New | Event CRUD (PATCH, DELETE) |
| `src/components/shared/race-autocomplete.tsx` | New | Autocomplete input component |
| `src/components/shared/event-card.tsx` | New | Shared event card (extracted from onboarding) |
| `src/components/dashboard/daily-summary-card.tsx` | Modify | Add countdown strip below AI summary |
| `src/components/onboarding/event-list.tsx` | Modify | Use RaceAutocomplete + shared EventCard |
| `src/app/dashboard/settings/page.tsx` | Modify | Add Events tab |
| `src/app/api/daily-summary/route.ts` | Modify | Inject race data into AI prompt |
