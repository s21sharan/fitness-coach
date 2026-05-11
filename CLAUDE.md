# Hybro — AI Fitness Coaching Platform

## Project Overview

Hybro is a **review-and-advise** platform that connects users' existing fitness data sources (MacroFactor, Hevy, Strava, Garmin) into a unified intelligence layer. Users review synced activity, view insights, and get AI coaching advice on how to adjust their training plan.

**Hybro is NOT a workout tracker or launcher.** Users log/track workouts in their dedicated apps (Hevy, Strava, etc.). Hybro's value is the intelligence layer on top — all UI should be oriented around reviewing, analyzing, and advising.

- **App name:** Hybro (use everywhere in UI, commits, docs)
- **Target user:** Serious fitness enthusiasts (lifters, runners, hybrid athletes)
- **Monetization:** Free for MVP, monetize later

## Tech Stack

- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui
- **Auth:** Clerk
- **Database:** Supabase (PostgreSQL) with RLS — hosted at `anjthenupycxzkvihzyf.supabase.co`
- **AI:** Claude API via Vercel AI SDK (future)
- **Backend API:** Express/Fastify on Railway (future)
- **Garmin:** Python FastAPI microservice (future)

## Key Documents

- **Design spec:** `docs/superpowers/specs/2026-04-25-hybrid-fitness-coach-design.md`
- **Phase 1 plan (Foundation):** `docs/superpowers/plans/2026-04-25-phase1-foundation.md`
- **Phase 2 plan (Onboarding):** `docs/superpowers/plans/2026-04-26-phase2-onboarding.md`

## Development Status

### Completed

**Phase 1: Foundation** — all 7 tasks done
- Next.js scaffold with TypeScript, Tailwind v4, Vitest
- Clerk auth (sign-up, sign-in, middleware, webhook user sync)
- Supabase database: 13 tables, RLS policies, indexes (migration applied)
- Type-safe Supabase clients (browser + server)
- App shell: sidebar navigation (Dashboard + Settings), topbar, dashboard layout
- Dashboard shows integration test page (connections, 30-day calendar, synced data)

**Phase 2: Onboarding** — all 9 tasks done
- Onboarding data types with conditional step visibility
- 10 step components: profile, body goal, emphasis, race, race details, cardio, experience, availability, integrations (placeholder), split result
- Height input uses feet/inches (stores cm in DB)
- Basic split recommendation logic (PPL, Arnold, Upper/Lower, Full Body, hybrid)
- Server action persists profile + goals to Supabase
- Onboarding guard redirects incomplete users from dashboard
- 24 tests passing across 7 test files

**Phase 3: Integrations** — all 13 tasks done
- Encryption utilities (AES-256-GCM) + sync_logs migration
- Railway Express backend (server/) with config, auth, health endpoint
- MacroFactor API client (Firebase auth + Firestore)
- Hevy API client (REST with pagination, incremental events)
- Strava API client + OAuth token manager
- Sync workers: MacroFactor (nutrition), Hevy (workouts), Strava (cardio), Garmin (recovery)
- Garmin Python FastAPI microservice (services/garmin/)
- Cron scheduler, sync trigger/backfill routes, Strava webhook handler
- Next.js API routes: connect, disconnect, status, sync for all 4 providers
- Settings page with integration management UI + connection modals
- Dashboard sync status + onboarding integrations wiring
- 81 tests passing (57 frontend + 24 server) across 27 test files

### Current State

- Dashboard is the integration test page (connections, data calendar, raw tables)
- Plan, Chat, Review pages removed — will be rebuilt as review/insights features
- Sidebar: Dashboard + Settings only
- Landing page mockups updated to reflect review-only philosophy

### Next Up

- Google Calendar OAuth integration
- AI-powered insights and coaching advice (review-oriented, not workout execution)
- Training plan visibility (read-only view of AI-generated plan)

## Development Rules

- Do NOT add Co-Authored-By lines to commits
- Do NOT run `npm run build` or `npm run dev` unless explicitly asked
- Do NOT run backend server unless explicitly asked
- Use TDD — write tests first
- MCP server for MacroFactor is configured in `.mcp.json`

## Running

```bash
npm run dev          # Start dev server
npm test             # Run all tests
npm run test:watch   # Watch mode
```

## Database

- Supabase project ref: `anjthenupycxzkvihzyf`
- Migration file: `supabase/migrations/001_initial_schema.sql` (already applied)
- Supabase CLI linked: `npx supabase db push` to apply new migrations
