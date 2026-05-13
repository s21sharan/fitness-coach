# Trainer — AI Fitness Coaching Platform

## Project Overview

Trainer is a **review-and-advise** platform that connects users' existing fitness data sources (MacroFactor, Hevy, Strava, Garmin) into a unified intelligence layer. Users review synced activity, view insights, and get AI coaching advice on how to adjust their training.

**Trainer is NOT a workout tracker or launcher.** Users log/track workouts in their dedicated apps (Hevy, Strava, etc.). Trainer's value is the intelligence layer on top — all UI should be oriented around reviewing, analyzing, and advising.

- **App name:** Trainer (use everywhere in UI, commits, docs)
- **Target user:** Serious fitness enthusiasts (lifters, runners, hybrid athletes)
- **Monetization:** Free for MVP, monetize later

## Tech Stack

- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4, inline styles
- **Auth:** Clerk
- **Database:** Supabase (PostgreSQL) with RLS — hosted at `anjthenupycxzkvihzyf.supabase.co`
- **AI:** Claude API via Vercel AI SDK (`@ai-sdk/anthropic`, `@ai-sdk/react`)
- **Backend API:** Express on Railway (`server/` directory)
- **Garmin:** Python FastAPI microservice (`services/garmin/`)
- **Charts:** recharts + custom SVG components (`src/components/charts/`)

## App Structure

### Navigation
Top nav bar with three tabs: **Calendar** | **Coach** | **Settings**

### Pages
- `/dashboard` — Calendar page: month view with workout/cardio/recovery cards, fitness/fatigue/form charts, HR zone distribution, training load, recovery trend sparklines, weekly muscle body diagram (SVG), clickable workout cards with detail modal, clickable cardio cards with activity detail modal (timeline/HR/data tabs)
- `/dashboard/coach` — AI Coach chat: streaming Claude responses with 7 data tools, conversation history, suggested prompts
- `/dashboard/settings` — Settings: Integrations (connect/disconnect providers), Preferences (distance mi/km, weight lbs/kg), Account, Goals, Notifications, Privacy, Subscription tabs

## Key Features

### Calendar Dashboard
- Monthly training calendar with week rows showing daily workout/cardio/recovery data
- Week sidebar: total time, load, distance, kcal, elevation, fitness/fatigue/form (CTL/ATL/TSB), per-type breakdown, anatomical muscle diagram (front + back SVG)
- Clickable workout cards → detail modal with: total volume/tonnage, working sets, exercises, avg RPE, exercise breakdown table (best set, volume, e1RM via Epley), muscle groups hit
- Clickable cardio cards → activity detail modal with 3 tabs:
  - **Timeline**: pace/HR/cadence/elevation charts per split (recharts)
  - **HR**: zone table (time + %, progress bars) + zone histogram
  - **Data**: stats grid (TE aerobic/anaerobic, VO2 max, recovery time, respiration, cadence, stride, GCT) + splits table + source badge
- Cardio cards show: Training Effect badge (color-coded 1-5), max HR, VO2 max, source indicator dot (orange=Strava, blue=Garmin, purple=Merged)
- Chart cards (click to expand): Fitness/Fatigue/Form, HR Zone Distribution, Training Load, HRV, Sleep, Resting HR, Body Battery, Stress
- AI insights in expanded chart modals (via `/api/insights` using Anthropic SDK)
- Planned workout cards for future dates with compliance badges
- Connection bar with sync buttons per provider
- Unit-aware display throughout (mi/km, lbs/kg from user preferences — including activity detail modal)

### AI Coach
- Streaming chat via Vercel AI SDK v6 `streamText` + `useChat` from `@ai-sdk/react` + `DefaultChatTransport`
- 8 tools: `get_nutrition`, `get_workouts`, `get_cardio`, `get_recovery`, `get_weight_trend`, `get_training_plan`, `update_planned_workout`, `regenerate_plan`
- Tool schemas use `inputSchema` (not `parameters`) — AI SDK v6 requirement
- API route uses `toUIMessageStreamResponse()` (not `toDataStreamResponse`)
- Messages use v6 UIMessage format with `parts` array (not `content` string)
- Coach personality: direct, data-driven, concise, opinionated
- Dynamic system prompt rebuilt per request with fresh user context
- Single conversation per user, persisted to Supabase `chat_messages`
- Plan regeneration: `regenerate_plan` tool generates a proposal (not saved), shown as PlanProposalCard in chat, user clicks Accept to save via `/api/plan/accept`
- Plan proposals include last 7 days of workout history to avoid scheduling conflicts

### Integrations
- **Hevy** — Workout logs (exercises, sets, reps, weight, RPE) via API key
- **Strava** — Cardio logs (runs, rides, swims) via OAuth. Populates `start_time` and `source: "strava"` on cardio_logs
- **Garmin** — Two sync types:
  - **Recovery**: HRV, sleep, RHR, body battery, stress, steps → `recovery_logs`
  - **Activities**: Runs, rides, swims with training effect, VO2 max, HR zones, per-lap splits, running dynamics (cadence, stride length, ground contact time), recovery time → `cardio_logs`
  - Uses Python FastAPI microservice on port 8001 with endpoints: `/sync` (recovery), `/sync-activities` (activities), `/debug` (raw API inspection)
  - Activity sync uses `get_activity_splits()` for per-lap data and `get_activity_hr_in_timezones()` for HR zone breakdown
- **Strava + Garmin Dedup**: When both sources have the same activity, they are merged. Matching criteria: same date + same type + start times within 10min + duration within 20%. Strava keeps GPS data (distance, pace, elevation), Garmin adds enrichment (TE, VO2, HR zones, splits, dynamics). Merged rows have `source: "merged"`. Unmatched rows keep `source: "strava"` or `source: "garmin"`
- **MacroFactor** — Nutrition logs (calories, macros) via Firebase auth (API key: `AIzaSyA17Uwy37irVEQSwz6PIyX3wnkHrDBeleA` — extracted from MCP package)
- Dashboard shows 3 integrations: Hevy, Strava, Garmin (MacroFactor removed from dashboard)
- Encrypted credential storage (AES-256-GCM)
- Connect routes store credentials directly without external validation (Firebase/Garmin validation removed for local dev)
- Cron-based sync workers on Railway Express backend
- Express backend dev script uses `node --env-file=.env` for env loading

### Training Plan
- AI-generated plans via Claude `generateObject` with structured output (schema in `src/lib/training/schemas.ts`)
- Initial plan generated during onboarding via `generatePlanFromOnboarding()`
- Coach can regenerate full plan via chat — generates proposal, user approves, then saved
- Rolling 2-week plan generation based on recent activity data
- Planned workouts with targets (distance, duration, pace, HR zone, muscle focus)
- Compliance tracking: matches planned sessions to actual Hevy/Strava data
- Plan accept/reject: `/api/plan/accept` saves proposed plan + creates 2 weeks of `planned_workouts`

### Exercise → Muscle Mapping
- `src/lib/exercise-muscles.ts` — keyword-based fuzzy matching of Hevy exercise names to 11 muscle groups
- `computeMuscleVolume()` computes sets + volume per muscle group
- Anatomical SVG body diagram (front + back) with red intensity coloring per volume

## Key Documents

- **Design spec:** `docs/superpowers/specs/2026-04-25-hybrid-fitness-coach-design.md`
- **Phase 1 plan:** `docs/superpowers/plans/2026-04-25-phase1-foundation.md`
- **Phase 2 plan:** `docs/superpowers/plans/2026-04-26-phase2-onboarding.md`
- **Phase 3 plan:** `docs/superpowers/plans/2026-04-29-phase3-integrations.md`
- **Phase 4 plan:** `docs/superpowers/plans/2026-05-01-phase4-training-engine.md`
- **Phase 5 plan:** `docs/superpowers/plans/2026-05-01-phase5-ai-chat-coach.md`
- **AI training plan spec:** `docs/superpowers/specs/2026-05-11-ai-training-plan-design.md`
- **Garmin activities spec:** `docs/superpowers/specs/2026-05-12-garmin-activities-dedup-design.md`

## Development Status

### Completed

**Phase 1: Foundation** — Next.js scaffold, Clerk auth, Supabase DB, app shell

**Phase 2: Onboarding** — 10-step flow, profile/goals persistence, onboarding guard

**Phase 3: Integrations** — All 4 providers (MacroFactor, Hevy, Strava, Garmin), Railway Express backend, sync workers, cron scheduler, settings UI

**Phase 4: Training Plan Engine** — AI plan generation, planned workouts with targets, compliance badges, plan approval flow

**Phase 5: AI Chat Coach** — Streaming chat with 7 tools, coach personality, conversation persistence, plan regeneration via chat

**Post-phase polish:**
- Unit preferences (mi/km, lbs/kg) in settings — respected throughout all modals and cards
- Mobile responsiveness (collapsible sidebar, scrollable grids, full-width chat panel)
- Workout detail modal (volume, e1RM, RPE, muscle breakdown)
- Activity detail modal (timeline charts, HR zone analysis, splits table, running dynamics)
- Anatomical muscle body diagram (SVG front + back view per week)
- Exercise-to-muscle-group mapping utility
- App renamed from Hybro to Trainer
- Calendar page with recharts: fitness curves, recovery trends, HR zone distribution, training load
- AI insights in expanded chart modals (Anthropic SDK, personalized to user's data)
- Landing page redesigned with pastel aesthetic (powder-blue, coral/mint/sky/lemon)
- Dashboard wired to real API data (recovery, workouts, cardio from Supabase)
- Day columns show sleep, RHR, HRV, steps with color-coded thresholds
- Week totals include fitness/fatigue/form (CTL/ATL/TSB), elevation, kcal
- Future weeks show no totals
- Garmin activity sync with Strava dedup (time-based matching, field-level merge)
- Garmin backfill working (30 days recovery + 90 days activities with splits/HR zones)
- Cardio cards enriched: Training Effect badge, max HR, VO2 max, source indicator
- Recovery bar shows Garmin recovery time estimate
- AI SDK v6 migration: useChat, DefaultChatTransport, inputSchema, toUIMessageStreamResponse, parts-based messages
- PlanProposalCard in chat with accept/modify flow

## Development Rules

- Do NOT add Co-Authored-By lines to commits
- Do NOT run `npm run build` or `npm run dev` unless explicitly asked
- Do NOT run backend server unless explicitly asked
- Use TDD — write tests first
- MCP server for MacroFactor is configured in `.mcp.json`

## Running

```bash
npm run dev                        # Start Next.js dev server (port 3000)
npm test                           # Run all frontend tests
cd server && npm run dev           # Start Express backend (port 3001, loads server/.env)
cd services/garmin && source .venv/bin/activate && uvicorn main:app --port 8001  # Garmin service
```

## Database

- Supabase project ref: `anjthenupycxzkvihzyf`
- Migrations: `supabase/migrations/001_initial_schema.sql` through `008_garmin_activities.sql`
- `008_garmin_activities.sql` adds 13 columns to `cardio_logs`: start_time, max_hr, training_effect_aerobic/anaerobic, vo2_max, recovery_time_min, avg_respiration, avg_cadence, avg_stride_length, ground_contact_time, hr_zones (jsonb), splits (jsonb), source
- Supabase CLI linked: `npx supabase db push` to apply new migrations

## Environment Variables

### Next.js (`.env.local`)
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REDIRECT_URI`
- `MACROFACTOR_FIREBASE_API_KEY`, `ENCRYPTION_KEY`
- `ANTHROPIC_API_KEY`
- `RAILWAY_BACKEND_URL`, `RAILWAY_API_SECRET`

### Express Backend (`server/.env`)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `API_SECRET`, `ENCRYPTION_KEY`, `ANTHROPIC_API_KEY`
- `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`
- `MACROFACTOR_FIREBASE_API_KEY`
- `GARMIN_SERVICE_URL` (default: `http://localhost:8001`)

## Known Issues
- MacroFactor sync fails on Firestore data path (nutrition path format changed) — needs client update to match MCP package's approach
- Clerk webhook doesn't fire locally — users must be manually inserted into Supabase `users` table for local dev
- Sparkline component uses `useId()` for gradient IDs (fixes hydration mismatch from `Math.random()`)
