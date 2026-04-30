# Phase 3: Integrations — Design Spec

**Date:** 2026-04-29
**Status:** Approved
**Author:** Sharan + Claude

---

## 1. Overview

Phase 3 connects Hybro to four fitness data sources — MacroFactor (nutrition), Hevy (strength training), Strava (cardio), and Garmin (recovery/wearables). It introduces a Railway Express backend for background sync workers and a Python FastAPI microservice for Garmin's unofficial API.

**Architecture (Approach 2 — Split):**
- Next.js API routes handle user-facing actions: connecting/disconnecting integrations, OAuth callbacks, triggering syncs
- Railway Express backend handles background work: cron-scheduled sync workers, token refresh, data normalization
- Garmin Python microservice: thin data proxy called by the Node backend
- Supabase is the shared data layer between frontend and backend

**Integrations in scope:**
| Provider | Auth Model | Sync Method | Target Table |
|---|---|---|---|
| MacroFactor | Username/password (Firebase) | Cron every 6h | `nutrition_logs` |
| Hevy | API key | Cron every 6h | `workout_logs` |
| Strava | OAuth 2.0 | Webhook + daily fallback | `cardio_logs` |
| Garmin | Username/password (unofficial) | Cron every 12h | `recovery_logs` |

**Not in scope:** Google Calendar (deferred to Phase 6).

---

## 2. Repository Structure

Monorepo with two new directories:

```
macrofactor-agent/
├── src/                          # Existing Next.js frontend
│   └── app/
│       └── api/
│           └── integrations/     # NEW — connection/OAuth API routes
├── server/                       # NEW — Railway Express backend
│   ├── src/
│   │   ├── index.ts              # Express app entry
│   │   ├── config.ts             # Env vars, constants
│   │   ├── db.ts                 # Supabase client (service role)
│   │   ├── sync/
│   │   │   ├── scheduler.ts      # Cron job orchestrator
│   │   │   ├── macrofactor.ts    # MF sync worker
│   │   │   ├── hevy.ts           # Hevy sync worker
│   │   │   ├── strava.ts         # Strava sync worker
│   │   │   └── garmin.ts         # Garmin sync worker (calls Python service)
│   │   ├── integrations/
│   │   │   ├── macrofactor-client.ts
│   │   │   ├── hevy-client.ts
│   │   │   ├── strava-client.ts
│   │   │   └── token-manager.ts  # Token refresh logic
│   │   └── utils/
│   │       └── logger.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── services/
│   └── garmin/                   # NEW — Python FastAPI microservice
│       ├── main.py
│       ├── garmin_client.py
│       ├── requirements.txt
│       └── Dockerfile
├── supabase/
└── package.json                  # Root (frontend)
```

- `server/` has its own `package.json` and `tsconfig.json`
- `services/garmin/` is a standalone Python service with its own Dockerfile
- Both deployed to Railway as separate services
- Supabase is the shared data layer

---

## 3. Integration Connection Flows

All connection logic lives in Next.js API routes + frontend UI.

### MacroFactor (Username/Password)
1. User enters MacroFactor email + password in Settings
2. `POST /api/integrations/macrofactor/connect` receives credentials
3. Validates by attempting a test auth call. Build a custom MacroFactor API client by referencing the `@sjawhar/macrofactor-mcp` package's source code — it uses Firebase Auth (email/password sign-in) to obtain a token, then calls MacroFactor's private API. We replicate this pattern in our own client.
4. On success: stores encrypted credentials in `integrations.credentials` JSONB, sets status `active`
5. On failure: returns error to UI

### Hevy (API Key)
1. User generates an API key from Hevy app (requires Pro)
2. Enters the key in Settings
3. `POST /api/integrations/hevy/connect` validates with a test call to `https://api.hevyapp.com/v1/workouts?page=1&pageSize=1`
4. On success: stores API key in `integrations.access_token`, sets status `active`

### Strava (OAuth 2.0)
1. User clicks "Connect Strava" in Settings
2. Frontend redirects to `https://www.strava.com/oauth/authorize` with client_id, redirect_uri, scope=`activity:read_all`
3. Strava redirects to `/api/integrations/strava/callback` with auth code
4. API route exchanges code for access + refresh tokens
5. Stores both tokens in `integrations`, sets status `active`
6. Redirects user back to Settings with success message

### Garmin (Username/Password)
1. User enters Garmin Connect email + password in Settings
2. `POST /api/integrations/garmin/connect` calls the Python service `POST /auth/validate` to test credentials
3. On success: stores encrypted credentials in `integrations.credentials` JSONB, sets status `active`

### Disconnection (all providers)
- `DELETE /api/integrations/[provider]/disconnect` removes the row from `integrations` table
- Next sync cycle skips that provider

### Credential Storage
- OAuth tokens: `access_token` and `refresh_token` columns
- Username/password: `integrations.credentials` JSONB column
- Encryption: AES-256-GCM using a shared `ENCRYPTION_KEY` env var
- Encrypt/decrypt utility functions shared between frontend API routes and backend

---

## 4. Sync Architecture

### Sync Intervals
| Provider | Interval | Reason |
|---|---|---|
| MacroFactor | Every 6 hours | Food logging happens throughout the day |
| Hevy | Every 6 hours | Users typically log 1 workout/day |
| Strava | Webhook (real-time) + daily fallback | Strava supports webhooks natively |
| Garmin | Every 12 hours | Conservative — unofficial API |

### Worker Flow (shared pattern)

```
1. Scheduler triggers worker for provider X
2. Query integrations table: all users with provider=X, status=active
3. For each user:
   a. Read credentials/tokens from DB
   b. Decrypt credentials
   c. Check token expiry → refresh if needed (Strava)
   d. Fetch data from provider API (since last_synced_at, or last 24h)
   e. Normalize into our schema
   f. Upsert into Supabase (ON CONFLICT update)
   g. Update integrations.last_synced_at
   h. Log to sync_logs table
   i. On error: set status='error' after 3 consecutive failures, log, continue to next user
```

### What Each Worker Syncs

**MacroFactor → `nutrition_logs`**
- Daily calories, protein, carbs, fat, fiber
- Individual meal/food entries in the `meals` JSONB column
- Weight entries

**Hevy → `workout_logs`**
- Workout name, date, duration
- Exercises as JSONB: exercise name, sets array (reps, weight, RPE)

**Strava → `cardio_logs`**
- Activity type (run/bike/swim), distance, duration
- Avg heart rate, pace/speed, elevation, calories

**Garmin → `recovery_logs`**
- Resting HR, HRV, sleep hours, sleep score
- Body battery, stress level, steps

### Strava Webhooks
- Register webhook subscription: `POST https://api.hybro.dev/webhooks/strava`
- Backend receives activity create/update/delete events
- Fetches full activity, normalizes, upserts
- Daily cron as fallback

### Initial Sync (Backfill)
- When a user first connects, trigger immediate sync
- Backfill last 30 days (where API allows)
- Frontend calls Railway `POST /sync/backfill`

### Error Handling
- Per-user failures don't block other users
- 3 consecutive sync failures → mark integration as `error`
- Dashboard shows error indicator
- User can retry via "Reconnect" in Settings

---

## 5. Garmin Python Microservice

Minimal FastAPI service — validates credentials and fetches data. The Node backend calls it over HTTP.

### Endpoints

```
POST /auth/validate
  Body: { email, password }
  Response: { valid: true } or { valid: false, error: "..." }

POST /sync
  Body: { email, password, since: "2026-04-01" }
  Response: {
    resting_hr: [...],
    hrv: [...],
    sleep: [...],
    body_battery: [...],
    stress: [...],
    steps: [...]
  }
```

### Libraries
- `garminconnect` — data fetching
- `garth` — auth/session management
- `fastapi` + `uvicorn` — HTTP server

### Key Decisions
- **Stateless** — each request authenticates fresh. No session caching. Simple, avoids expiry bugs.
- **No direct DB access** — returns JSON only. Node backend handles all Supabase writes.
- **Internal only** — Railway private networking. No public access, no auth needed.
- **Structured errors** — `{ error: "auth_failed" }`, `{ error: "rate_limited" }`, `{ error: "garmin_unavailable" }`

### Deployment
- Separate Railway service in the same project
- Dockerfile: Python 3.12 slim, install requirements, run uvicorn
- Node backend reaches it via `http://garmin-service.railway.internal:8000`

---

## 6. API Design

### Next.js API Routes (user-facing)

```
POST   /api/integrations/macrofactor/connect    — validate + store MF credentials
POST   /api/integrations/hevy/connect           — validate + store Hevy API key
GET    /api/integrations/strava/authorize        — redirect to Strava OAuth
GET    /api/integrations/strava/callback         — exchange code, store tokens, redirect to Settings
POST   /api/integrations/garmin/connect          — call Python service to validate, store credentials
DELETE /api/integrations/[provider]/disconnect    — remove integration row
GET    /api/integrations/status                  — return all integrations for current user
POST   /api/integrations/[provider]/sync         — trigger immediate sync via Railway backend
```

All routes protected by Clerk auth.

### Railway Backend Endpoints

```
POST   /sync/trigger          — { provider, userId? } — sync one provider (all users or specific)
POST   /sync/backfill         — { provider, userId, since } — initial 30-day backfill
GET    /webhooks/strava       — webhook verification (Strava challenge)
POST   /webhooks/strava       — receive activity events
GET    /health                — service health check
```

Authentication:
- Shared `API_SECRET` header (`X-API-Key`) for calls from Next.js
- Strava's webhook verification token for webhook endpoints
- Railway internal networking for Garmin Python service

### Communication Flow Example (Connect MacroFactor)

```
1. User enters credentials in Settings UI
2. Frontend → POST /api/integrations/macrofactor/connect { email, password }
3. Next.js API route validates credentials (test auth call)
4. Saves encrypted credentials to Supabase integrations table
5. Calls Railway → POST /sync/backfill { provider: "macrofactor", userId, since: "30 days ago" }
6. Railway fetches 30 days of nutrition data, upserts to nutrition_logs
7. Frontend polls /api/integrations/status until last_synced_at updates
8. Settings UI shows "Connected — last synced just now"
```

---

## 7. Frontend UI Changes

### Settings Page — Integration Management

Replace the current placeholder with a real integration management panel. Each integration card shows:
- Provider name + icon
- Connection status badge (connected / disconnected / error)
- Last synced timestamp (relative: "2 hours ago")
- Error message if sync failed
- Connect / Disconnect button

### Connection Modals

Three variants:
1. **Credentials modal** (MacroFactor, Garmin) — email + password fields, loading state during validation
2. **API key modal** (Hevy) — API key field, link to "How to get your API key"
3. **OAuth redirect** (Strava) — no modal, redirects directly. Returns to Settings with success/error toast

### Dashboard — Sync Status

Small sync status section on the dashboard. Row of provider icons with green/gray/red status dots. Last synced timestamps. Keeps the dashboard glanceable.

### Onboarding Step 8 — Wire Up

Wire the existing `step-integrations.tsx` "Connect" buttons to the same connection flows as Settings. User must connect at least one integration to proceed to the split result step.

---

## 8. Database Changes

The existing schema covers most needs. One addition:

```sql
create table public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  provider text not null,
  status text not null check (status in ('success', 'error')),
  records_synced integer default 0,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.sync_logs enable row level security;

create policy "Users can view own sync logs" on public.sync_logs
  for select using (user_id = current_setting('app.current_user_id', true));

create index idx_sync_logs_user_provider on public.sync_logs(user_id, provider, started_at);
```

Existing tables used as-is: `integrations`, `nutrition_logs`, `workout_logs`, `cardio_logs`, `recovery_logs`.

---

## 9. Environment Variables

### Next.js (`.env.local`)
```
ENCRYPTION_KEY=              # AES-256 key for credential encryption
RAILWAY_API_SECRET=          # Shared secret for calling Railway backend
RAILWAY_BACKEND_URL=         # https://api.hybro.dev or Railway URL
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_REDIRECT_URI=         # https://hybro.dev/api/integrations/strava/callback
```

### Railway Backend
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=   # Service role — bypasses RLS for sync operations
ENCRYPTION_KEY=              # Same key as frontend
API_SECRET=                  # Same as RAILWAY_API_SECRET
GARMIN_SERVICE_URL=          # http://garmin-service.railway.internal:8000
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_WEBHOOK_VERIFY_TOKEN=
```

### Garmin Python Service
No environment variables needed — credentials come per-request.

---

## 10. Testing Strategy

- **Unit tests:** Encrypt/decrypt utilities, data normalization functions (raw API response → our schema), sync worker logic with mocked API responses
- **Integration tests:** Connection API routes with mocked provider APIs, sync trigger flow
- **Each sync worker** gets tests verifying: correct API calls, proper data normalization, upsert behavior, error handling (auth failure, rate limit, network error)
- **Frontend:** Integration card component tests, connection modal tests, Settings page tests
