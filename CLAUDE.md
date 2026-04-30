# Hybro — AI Fitness Coaching Platform

## Project Overview

Hybro is a web-based AI fitness coaching platform that connects users' existing fitness data sources (MacroFactor, Hevy, Strava, Garmin) into a unified intelligence layer. It generates personalized training splits, auto-adjusts weekly based on progress/recovery, and provides a 24/7 AI chatbot coach.

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
- App shell: sidebar navigation, topbar, dashboard layout
- Dashboard with placeholder cards + placeholder pages (Plan, Chat, Review, Settings)

**Phase 2: Onboarding** — all 9 tasks done
- Onboarding data types with conditional step visibility
- 10 step components: profile, body goal, emphasis, race, race details, cardio, experience, availability, integrations (placeholder), split result
- Height input uses feet/inches (stores cm in DB)
- Basic split recommendation logic (PPL, Arnold, Upper/Lower, Full Body, hybrid)
- Server action persists profile + goals to Supabase
- Onboarding guard redirects incomplete users from dashboard
- 24 tests passing across 7 test files

### Next Up

**Phase 3: Integrations** — not started
- MacroFactor sync (via `@sjawhar/macrofactor-mcp` package)
- Hevy sync (official REST API v1, requires Pro)
- Strava sync (OAuth 2.0 + webhooks)
- Garmin sync (Python microservice, unofficial)
- Backend API on Railway (Express/Fastify)
- Integration Manager with cron-based sync workers

**Remaining phases:**
- Phase 4: Training Plan Engine (AI split generation, weekly view)
- Phase 5: AI Chat Coach (Claude agent with tools, chat UI)
- Phase 6: Weekly Check-in & Calendar (auto-adjust, Google Cal)
- Phase 7: Dashboard & Polish (wire real data, landing page)

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
