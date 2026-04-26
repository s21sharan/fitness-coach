# Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the Next.js project with Clerk auth, Supabase database with full schema, app layout with navigation, and a dashboard shell page — everything needed for subsequent phases to build on.

**Architecture:** Next.js App Router on Vercel with Clerk for auth middleware, Supabase PostgreSQL for data, and a basic authenticated app shell with sidebar navigation. The backend Express API on Railway is NOT part of this phase — we scaffold frontend + database first.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Clerk, Supabase (PostgreSQL + JS client), Tailwind CSS v4, shadcn/ui

---

## File Structure

```
macrofactor-agent/
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── .env.local                          # Clerk + Supabase keys (gitignored)
├── .env.example                        # Template with placeholder keys
├── .gitignore
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql      # Full database schema
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout — ClerkProvider + fonts
│   │   ├── page.tsx                    # Landing page (public)
│   │   ├── sign-in/
│   │   │   └── [[...sign-in]]/
│   │   │       └── page.tsx            # Clerk sign-in page
│   │   ├── sign-up/
│   │   │   └── [[...sign-up]]/
│   │   │       └── page.tsx            # Clerk sign-up page
│   │   └── dashboard/
│   │       ├── layout.tsx              # Authenticated layout — sidebar + topbar
│   │       ├── page.tsx                # Dashboard home
│   │       ├── plan/
│   │       │   └── page.tsx            # My Plan (placeholder)
│   │       ├── chat/
│   │       │   └── page.tsx            # Chat (placeholder)
│   │       ├── review/
│   │       │   └── page.tsx            # Weekly Review (placeholder)
│   │       └── settings/
│   │           └── page.tsx            # Settings (placeholder)
│   ├── components/
│   │   ├── ui/                         # shadcn/ui components (auto-generated)
│   │   ├── sidebar.tsx                 # App sidebar navigation
│   │   └── topbar.tsx                  # Top bar with user menu
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts               # Supabase browser client
│   │   │   ├── server.ts               # Supabase server client (for server components)
│   │   │   └── types.ts                # Generated database types
│   │   └── utils.ts                    # cn() helper for tailwind
│   └── middleware.ts                   # Clerk auth middleware
├── __tests__/
│   ├── lib/
│   │   └── supabase/
│   │       └── client.test.ts          # Supabase client tests
│   └── components/
│       ├── sidebar.test.tsx            # Sidebar navigation tests
│       └── topbar.test.tsx             # Topbar tests
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `.gitignore`, `.env.example`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/lib/utils.ts`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd /Users/sharans/Desktop/projects/macrofactor-agent
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
```

Expected: Project scaffolded with Next.js, TypeScript, Tailwind, ESLint, App Router, src directory.

- [ ] **Step 2: Install core dependencies**

```bash
npm install @clerk/nextjs @supabase/supabase-js
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
```

- [ ] **Step 3: Create vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./__tests__/setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

Create `__tests__/setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Add test script to package.json**

Add to the `"scripts"` section of `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Create .env.example**

Create `.env.example`:

```
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
```

- [ ] **Step 6: Add .env.local to .gitignore**

Verify `.gitignore` includes `.env*.local`. If not, append:

```
.env*.local
```

- [ ] **Step 7: Initialize git repo and commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Next.js project with TypeScript, Tailwind, Vitest"
```

---

### Task 2: Clerk Authentication

**Files:**
- Create: `src/middleware.ts`, `src/app/sign-in/[[...sign-in]]/page.tsx`, `src/app/sign-up/[[...sign-up]]/page.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create .env.local with Clerk keys**

Go to https://dashboard.clerk.com, create an application, and copy the keys into `.env.local`:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_KEY
CLERK_SECRET_KEY=sk_test_YOUR_KEY
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

- [ ] **Step 2: Wrap root layout with ClerkProvider**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Hybrid Fitness Coach",
  description: "AI-powered fitness coaching platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 3: Create Clerk middleware**

Create `src/middleware.ts`:

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

- [ ] **Step 4: Create sign-in page**

Create `src/app/sign-in/[[...sign-in]]/page.tsx`:

```tsx
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  );
}
```

- [ ] **Step 5: Create sign-up page**

Create `src/app/sign-up/[[...sign-up]]/page.tsx`:

```tsx
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp />
    </div>
  );
}
```

- [ ] **Step 6: Create a minimal landing page**

Replace `src/app/page.tsx`:

```tsx
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">Hybrid Fitness Coach</h1>
      <p className="text-lg text-gray-600 max-w-md text-center">
        AI-powered coaching that connects your nutrition, training, cardio, and
        recovery data.
      </p>
      <div className="flex gap-4">
        <Link
          href="/sign-up"
          className="rounded-lg bg-black px-6 py-3 text-white font-medium hover:bg-gray-800"
        >
          Get Started
        </Link>
        <Link
          href="/sign-in"
          className="rounded-lg border border-gray-300 px-6 py-3 font-medium hover:bg-gray-50"
        >
          Sign In
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Manually test auth flow**

```bash
npm run dev
```

1. Open http://localhost:3000 — should see landing page
2. Click "Get Started" — should redirect to Clerk sign-up
3. Sign up with email — should redirect to /dashboard (will 404, that's fine)
4. Visit http://localhost:3000 while signed in — should redirect to /dashboard

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add Clerk authentication with sign-in, sign-up, and middleware"
```

---

### Task 3: Supabase Database Schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Create a Supabase project**

Go to https://supabase.com/dashboard, create a new project. Copy the project URL and keys into `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
```

- [ ] **Step 2: Write the migration file**

Create `supabase/migrations/001_initial_schema.sql`:

```sql
-- Enable pgvector for future RAG knowledge base
create extension if not exists vector;

-- ============================================================
-- USERS & PROFILES
-- ============================================================

create table public.users (
  id text primary key,                  -- Clerk user ID
  email text not null,
  created_at timestamptz not null default now(),
  onboarding_completed boolean not null default false
);

create table public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  height numeric,                       -- cm
  weight numeric,                       -- lbs (user's preferred unit)
  age integer,
  sex text check (sex in ('M', 'F', 'Other')),
  activity_level numeric,
  training_experience text check (training_experience in ('beginner', 'intermediate', 'advanced')),
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create table public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  body_goal text not null check (body_goal in ('gain_muscle', 'lose_weight', 'maintain', 'other')),
  body_goal_other text,
  emphasis text check (emphasis in ('shoulders', 'chest', 'back', 'arms', 'legs', 'glutes', 'none')),
  training_for_race boolean not null default false,
  race_type text check (race_type in (
    '5k', '10k', 'half_marathon', 'marathon', 'ultra',
    'sprint_tri', 'olympic_tri', 'half_ironman', 'ironman', 'other'
  )),
  race_type_other text,
  race_date date,
  goal_time text,
  does_cardio boolean not null default false,
  cardio_types text[],
  days_per_week integer not null default 4 check (days_per_week between 3 and 7),
  lifting_days integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

-- ============================================================
-- INTEGRATIONS
-- ============================================================

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  provider text not null check (provider in (
    'macrofactor', 'hevy', 'strava', 'garmin', 'google_calendar'
  )),
  access_token text,                    -- encrypted at app level
  refresh_token text,                   -- encrypted at app level
  provider_user_id text,
  credentials jsonb,                    -- for username/password integrations (encrypted)
  last_synced_at timestamptz,
  status text not null default 'active' check (status in ('active', 'expired', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider)
);

-- ============================================================
-- SYNCED DATA
-- ============================================================

create table public.nutrition_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  date date not null,
  calories numeric,
  protein numeric,
  carbs numeric,
  fat numeric,
  fiber numeric,
  sugar numeric,
  sodium numeric,
  meals jsonb,                          -- array of food entries
  synced_at timestamptz not null default now(),
  unique(user_id, date)
);

create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  date date not null,
  workout_id text,                      -- external ID from Hevy
  name text,
  duration_minutes integer,
  exercises jsonb,                      -- sets, reps, weight, RPE
  synced_at timestamptz not null default now(),
  unique(user_id, workout_id)
);

create table public.cardio_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  date date not null,
  activity_id text,                     -- external ID from Strava
  type text check (type in ('run', 'bike', 'swim', 'other')),
  distance numeric,                     -- meters
  duration integer,                     -- seconds
  avg_hr integer,
  calories numeric,
  pace_or_speed numeric,
  elevation numeric,
  synced_at timestamptz not null default now(),
  unique(user_id, activity_id)
);

create table public.recovery_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  date date not null,
  resting_hr integer,
  hrv integer,
  sleep_hours numeric,
  sleep_score integer,
  body_battery integer,
  stress_level integer,
  steps integer,
  synced_at timestamptz not null default now(),
  unique(user_id, date)
);

-- ============================================================
-- TRAINING PLANS
-- ============================================================

create table public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  split_type text not null check (split_type in (
    'full_body', 'upper_lower', 'ppl', 'arnold', 'phul',
    'bro_split', 'hybrid_upper_lower', 'hybrid_nick_bare'
  )),
  body_goal text,
  race_type text,
  status text not null default 'active' check (status in ('active', 'paused', 'completed')),
  plan_config jsonb,                    -- periodization settings, split details
  last_adjusted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.planned_workouts (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.training_plans(id) on delete cascade,
  date date not null,
  day_of_week integer not null check (day_of_week between 0 and 6),
  session_type text not null,           -- "Push", "Pull", "Legs", "Easy Run (Zone 2)", etc.
  ai_notes text,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'skipped', 'moved')),
  calendar_event_id text,
  approved boolean not null default false,
  synced_at timestamptz
);

-- ============================================================
-- CHAT
-- ============================================================

create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  tool_calls jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- WEEKLY CHECK-INS
-- ============================================================

create table public.weekly_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  week_start_date date not null,
  weight_trend numeric,
  avg_calories numeric,
  training_volume numeric,
  training_compliance numeric,          -- percentage 0-100
  ai_summary text,
  plan_adjustments jsonb,
  user_approved boolean,
  created_at timestamptz not null default now(),
  unique(user_id, week_start_date)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.users enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_goals enable row level security;
alter table public.integrations enable row level security;
alter table public.nutrition_logs enable row level security;
alter table public.workout_logs enable row level security;
alter table public.cardio_logs enable row level security;
alter table public.recovery_logs enable row level security;
alter table public.training_plans enable row level security;
alter table public.planned_workouts enable row level security;
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.weekly_checkins enable row level security;

-- RLS policies: users can only access their own data
-- Using service role key from backend bypasses RLS

create policy "Users can view own data" on public.users
  for select using (id = current_setting('app.current_user_id', true));
create policy "Users can update own data" on public.users
  for update using (id = current_setting('app.current_user_id', true));

create policy "Users can manage own profile" on public.user_profiles
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can manage own goals" on public.user_goals
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can manage own integrations" on public.integrations
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can view own nutrition" on public.nutrition_logs
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can view own workouts" on public.workout_logs
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can view own cardio" on public.cardio_logs
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can view own recovery" on public.recovery_logs
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can manage own plans" on public.training_plans
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can manage own planned workouts" on public.planned_workouts
  for all using (
    plan_id in (
      select id from public.training_plans
      where user_id = current_setting('app.current_user_id', true)
    )
  );

create policy "Users can manage own conversations" on public.chat_conversations
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can manage own messages" on public.chat_messages
  for all using (
    conversation_id in (
      select id from public.chat_conversations
      where user_id = current_setting('app.current_user_id', true)
    )
  );

create policy "Users can manage own checkins" on public.weekly_checkins
  for all using (user_id = current_setting('app.current_user_id', true));

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_nutrition_logs_user_date on public.nutrition_logs(user_id, date);
create index idx_workout_logs_user_date on public.workout_logs(user_id, date);
create index idx_cardio_logs_user_date on public.cardio_logs(user_id, date);
create index idx_recovery_logs_user_date on public.recovery_logs(user_id, date);
create index idx_planned_workouts_plan_date on public.planned_workouts(plan_id, date);
create index idx_chat_messages_conversation on public.chat_messages(conversation_id, created_at);
create index idx_weekly_checkins_user_week on public.weekly_checkins(user_id, week_start_date);
```

- [ ] **Step 3: Run the migration in Supabase**

Go to your Supabase dashboard → SQL Editor → paste the contents of `001_initial_schema.sql` → Run.

Verify: go to Table Editor and confirm all 13 tables exist.

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: add initial database schema with all tables and RLS policies"
```

---

### Task 4: Supabase Client Setup

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/types.ts`
- Test: `__tests__/lib/supabase/client.test.ts`

- [ ] **Step 1: Write failing test for Supabase client**

Create `__tests__/lib/supabase/client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Supabase module
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: vi.fn() })),
}));

describe("createBrowserClient", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  });

  it("creates a Supabase client with correct config", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const { createBrowserClient } = await import("@/lib/supabase/client");

    const client = createBrowserClient();

    expect(createClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "test-anon-key"
    );
    expect(client).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/lib/supabase/client.test.ts
```

Expected: FAIL — module `@/lib/supabase/client` not found.

- [ ] **Step 3: Create the database types file**

Create `src/lib/supabase/types.ts`:

```typescript
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          created_at: string;
          onboarding_completed: boolean;
        };
        Insert: {
          id: string;
          email: string;
          created_at?: string;
          onboarding_completed?: boolean;
        };
        Update: {
          id?: string;
          email?: string;
          created_at?: string;
          onboarding_completed?: boolean;
        };
      };
      user_profiles: {
        Row: {
          id: string;
          user_id: string;
          height: number | null;
          weight: number | null;
          age: number | null;
          sex: "M" | "F" | "Other" | null;
          activity_level: number | null;
          training_experience: "beginner" | "intermediate" | "advanced" | null;
          timezone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          height?: number | null;
          weight?: number | null;
          age?: number | null;
          sex?: "M" | "F" | "Other" | null;
          activity_level?: number | null;
          training_experience?: "beginner" | "intermediate" | "advanced" | null;
          timezone?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["user_profiles"]["Insert"]>;
      };
      user_goals: {
        Row: {
          id: string;
          user_id: string;
          body_goal: "gain_muscle" | "lose_weight" | "maintain" | "other";
          body_goal_other: string | null;
          emphasis: "shoulders" | "chest" | "back" | "arms" | "legs" | "glutes" | "none" | null;
          training_for_race: boolean;
          race_type: "5k" | "10k" | "half_marathon" | "marathon" | "ultra" | "sprint_tri" | "olympic_tri" | "half_ironman" | "ironman" | "other" | null;
          race_type_other: string | null;
          race_date: string | null;
          goal_time: string | null;
          does_cardio: boolean;
          cardio_types: string[] | null;
          days_per_week: number;
          lifting_days: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          body_goal: "gain_muscle" | "lose_weight" | "maintain" | "other";
          body_goal_other?: string | null;
          emphasis?: "shoulders" | "chest" | "back" | "arms" | "legs" | "glutes" | "none" | null;
          training_for_race?: boolean;
          race_type?: "5k" | "10k" | "half_marathon" | "marathon" | "ultra" | "sprint_tri" | "olympic_tri" | "half_ironman" | "ironman" | "other" | null;
          race_type_other?: string | null;
          race_date?: string | null;
          goal_time?: string | null;
          does_cardio?: boolean;
          cardio_types?: string[] | null;
          days_per_week?: number;
          lifting_days?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["user_goals"]["Insert"]>;
      };
      integrations: {
        Row: {
          id: string;
          user_id: string;
          provider: "macrofactor" | "hevy" | "strava" | "garmin" | "google_calendar";
          access_token: string | null;
          refresh_token: string | null;
          provider_user_id: string | null;
          credentials: Record<string, unknown> | null;
          last_synced_at: string | null;
          status: "active" | "expired" | "error";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: "macrofactor" | "hevy" | "strava" | "garmin" | "google_calendar";
          access_token?: string | null;
          refresh_token?: string | null;
          provider_user_id?: string | null;
          credentials?: Record<string, unknown> | null;
          last_synced_at?: string | null;
          status?: "active" | "expired" | "error";
        };
        Update: Partial<Database["public"]["Tables"]["integrations"]["Insert"]>;
      };
      nutrition_logs: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          calories: number | null;
          protein: number | null;
          carbs: number | null;
          fat: number | null;
          fiber: number | null;
          sugar: number | null;
          sodium: number | null;
          meals: Record<string, unknown>[] | null;
          synced_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          calories?: number | null;
          protein?: number | null;
          carbs?: number | null;
          fat?: number | null;
          fiber?: number | null;
          sugar?: number | null;
          sodium?: number | null;
          meals?: Record<string, unknown>[] | null;
        };
        Update: Partial<Database["public"]["Tables"]["nutrition_logs"]["Insert"]>;
      };
      workout_logs: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          workout_id: string | null;
          name: string | null;
          duration_minutes: number | null;
          exercises: Record<string, unknown>[] | null;
          synced_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          workout_id?: string | null;
          name?: string | null;
          duration_minutes?: number | null;
          exercises?: Record<string, unknown>[] | null;
        };
        Update: Partial<Database["public"]["Tables"]["workout_logs"]["Insert"]>;
      };
      cardio_logs: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          activity_id: string | null;
          type: "run" | "bike" | "swim" | "other" | null;
          distance: number | null;
          duration: number | null;
          avg_hr: number | null;
          calories: number | null;
          pace_or_speed: number | null;
          elevation: number | null;
          synced_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          activity_id?: string | null;
          type?: "run" | "bike" | "swim" | "other" | null;
          distance?: number | null;
          duration?: number | null;
          avg_hr?: number | null;
          calories?: number | null;
          pace_or_speed?: number | null;
          elevation?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["cardio_logs"]["Insert"]>;
      };
      recovery_logs: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          resting_hr: number | null;
          hrv: number | null;
          sleep_hours: number | null;
          sleep_score: number | null;
          body_battery: number | null;
          stress_level: number | null;
          steps: number | null;
          synced_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          resting_hr?: number | null;
          hrv?: number | null;
          sleep_hours?: number | null;
          sleep_score?: number | null;
          body_battery?: number | null;
          stress_level?: number | null;
          steps?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["recovery_logs"]["Insert"]>;
      };
      training_plans: {
        Row: {
          id: string;
          user_id: string;
          split_type: "full_body" | "upper_lower" | "ppl" | "arnold" | "phul" | "bro_split" | "hybrid_upper_lower" | "hybrid_nick_bare";
          body_goal: string | null;
          race_type: string | null;
          status: "active" | "paused" | "completed";
          plan_config: Record<string, unknown> | null;
          last_adjusted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          split_type: "full_body" | "upper_lower" | "ppl" | "arnold" | "phul" | "bro_split" | "hybrid_upper_lower" | "hybrid_nick_bare";
          body_goal?: string | null;
          race_type?: string | null;
          status?: "active" | "paused" | "completed";
          plan_config?: Record<string, unknown> | null;
          last_adjusted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["training_plans"]["Insert"]>;
      };
      planned_workouts: {
        Row: {
          id: string;
          plan_id: string;
          date: string;
          day_of_week: number;
          session_type: string;
          ai_notes: string | null;
          status: "scheduled" | "completed" | "skipped" | "moved";
          calendar_event_id: string | null;
          approved: boolean;
          synced_at: string | null;
        };
        Insert: {
          id?: string;
          plan_id: string;
          date: string;
          day_of_week: number;
          session_type: string;
          ai_notes?: string | null;
          status?: "scheduled" | "completed" | "skipped" | "moved";
          calendar_event_id?: string | null;
          approved?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["planned_workouts"]["Insert"]>;
      };
      chat_conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["chat_conversations"]["Insert"]>;
      };
      chat_messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: "user" | "assistant";
          content: string;
          tool_calls: Record<string, unknown>[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: "user" | "assistant";
          content: string;
          tool_calls?: Record<string, unknown>[] | null;
        };
        Update: Partial<Database["public"]["Tables"]["chat_messages"]["Insert"]>;
      };
      weekly_checkins: {
        Row: {
          id: string;
          user_id: string;
          week_start_date: string;
          weight_trend: number | null;
          avg_calories: number | null;
          training_volume: number | null;
          training_compliance: number | null;
          ai_summary: string | null;
          plan_adjustments: Record<string, unknown> | null;
          user_approved: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          week_start_date: string;
          weight_trend?: number | null;
          avg_calories?: number | null;
          training_volume?: number | null;
          training_compliance?: number | null;
          ai_summary?: string | null;
          plan_adjustments?: Record<string, unknown> | null;
          user_approved?: boolean | null;
        };
        Update: Partial<Database["public"]["Tables"]["weekly_checkins"]["Insert"]>;
      };
    };
  };
};
```

- [ ] **Step 4: Create browser client**

Create `src/lib/supabase/client.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export function createBrowserClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 5: Create server client**

Create `src/lib/supabase/server.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export function createServerClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
npm test -- __tests__/lib/supabase/client.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Supabase client setup with database types"
```

---

### Task 5: Install shadcn/ui and App Layout

**Files:**
- Create: `src/components/ui/*` (auto-generated), `src/components/sidebar.tsx`, `src/components/topbar.tsx`
- Create: `src/app/dashboard/layout.tsx`
- Test: `__tests__/components/sidebar.test.tsx`

- [ ] **Step 1: Initialize shadcn/ui**

```bash
npx shadcn@latest init -d
```

When prompted, select defaults (New York style, Zinc base color, CSS variables).

- [ ] **Step 2: Add required shadcn components**

```bash
npx shadcn@latest add button avatar dropdown-menu separator
```

- [ ] **Step 3: Write failing test for sidebar**

Create `__tests__/components/sidebar.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "@/components/sidebar";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

describe("Sidebar", () => {
  it("renders all navigation links", () => {
    render(<Sidebar />);

    expect(screen.getByText("Dashboard")).toBeDefined();
    expect(screen.getByText("My Plan")).toBeDefined();
    expect(screen.getByText("Chat")).toBeDefined();
    expect(screen.getByText("Weekly Review")).toBeDefined();
    expect(screen.getByText("Settings")).toBeDefined();
  });

  it("highlights the active link", () => {
    render(<Sidebar />);

    const dashboardLink = screen.getByText("Dashboard").closest("a");
    expect(dashboardLink?.className).toContain("bg-");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
npm test -- __tests__/components/sidebar.test.tsx
```

Expected: FAIL — module `@/components/sidebar` not found.

- [ ] **Step 5: Create the sidebar component**

Create `src/components/sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Calendar,
  MessageSquare,
  BarChart3,
  Settings,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Plan", href: "/dashboard/plan", icon: Calendar },
  { label: "Chat", href: "/dashboard/chat", icon: MessageSquare },
  { label: "Weekly Review", href: "/dashboard/review", icon: BarChart3 },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-white">
      <div className="flex h-14 items-center border-b px-6">
        <span className="text-lg font-bold">Hybrid Coach</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-gray-100 text-black"
                  : "text-gray-600 hover:bg-gray-50 hover:text-black"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 6: Install lucide-react**

```bash
npm install lucide-react
```

- [ ] **Step 7: Run test to verify it passes**

```bash
npm test -- __tests__/components/sidebar.test.tsx
```

Expected: PASS

- [ ] **Step 8: Create the topbar component**

Create `src/components/topbar.tsx`:

```tsx
import { UserButton } from "@clerk/nextjs";

export function Topbar() {
  return (
    <header className="flex h-14 items-center justify-end border-b bg-white px-6">
      <UserButton afterSignOutUrl="/" />
    </header>
  );
}
```

- [ ] **Step 9: Create the dashboard layout**

Create `src/app/dashboard/layout.tsx`:

```tsx
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add app layout with sidebar navigation and topbar"
```

---

### Task 6: Dashboard Shell and Placeholder Pages

**Files:**
- Create: `src/app/dashboard/page.tsx`, `src/app/dashboard/plan/page.tsx`, `src/app/dashboard/chat/page.tsx`, `src/app/dashboard/review/page.tsx`, `src/app/dashboard/settings/page.tsx`

- [ ] **Step 1: Create the dashboard home page**

Create `src/app/dashboard/page.tsx`:

```tsx
import { auth } from "@clerk/nextjs/server";

export default async function DashboardPage() {
  const { userId } = await auth();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Today Card */}
      <div className="rounded-lg border bg-white p-6">
        <h2 className="text-sm font-medium text-gray-500">Today</h2>
        <p className="mt-2 text-xl font-semibold">Rest Day</p>
        <p className="mt-1 text-sm text-gray-500">
          No session planned. Connect your integrations to get started.
        </p>
      </div>

      {/* This Week */}
      <div className="rounded-lg border bg-white p-6">
        <h2 className="text-sm font-medium text-gray-500">This Week</h2>
        <div className="mt-4 grid grid-cols-7 gap-2">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div
              key={day}
              className="flex flex-col items-center rounded-lg border p-3"
            >
              <span className="text-xs text-gray-500">{day}</span>
              <span className="mt-1 text-sm text-gray-400">--</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-white p-6">
          <h3 className="text-sm font-medium text-gray-500">Calories</h3>
          <p className="mt-2 text-2xl font-bold">--</p>
          <p className="text-sm text-gray-400">No data yet</p>
        </div>
        <div className="rounded-lg border bg-white p-6">
          <h3 className="text-sm font-medium text-gray-500">Weight Trend</h3>
          <p className="mt-2 text-2xl font-bold">--</p>
          <p className="text-sm text-gray-400">No data yet</p>
        </div>
        <div className="rounded-lg border bg-white p-6">
          <h3 className="text-sm font-medium text-gray-500">Recovery</h3>
          <p className="mt-2 text-2xl font-bold">--</p>
          <p className="text-sm text-gray-400">No data yet</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create placeholder pages**

Create `src/app/dashboard/plan/page.tsx`:

```tsx
export default function PlanPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">My Plan</h1>
      <p className="mt-2 text-gray-500">
        Complete onboarding to generate your training plan.
      </p>
    </div>
  );
}
```

Create `src/app/dashboard/chat/page.tsx`:

```tsx
export default function ChatPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Chat with Coach</h1>
      <p className="mt-2 text-gray-500">
        Your AI coach will be available after you connect at least one
        integration.
      </p>
    </div>
  );
}
```

Create `src/app/dashboard/review/page.tsx`:

```tsx
export default function ReviewPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Weekly Review</h1>
      <p className="mt-2 text-gray-500">
        Your first weekly review will appear after one week of training data.
      </p>
    </div>
  );
}
```

Create `src/app/dashboard/settings/page.tsx`:

```tsx
import { auth } from "@clerk/nextjs/server";

export default async function SettingsPage() {
  const { userId } = await auth();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="rounded-lg border bg-white p-6">
        <h2 className="text-lg font-semibold">Integrations</h2>
        <p className="mt-1 text-sm text-gray-500">
          Connect your fitness apps to get started.
        </p>
        <div className="mt-4 space-y-3">
          {["MacroFactor", "Hevy", "Strava", "Garmin", "Google Calendar"].map(
            (name) => (
              <div
                key={name}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <span className="font-medium">{name}</span>
                <span className="text-sm text-gray-400">Not connected</span>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Manually test the full app**

```bash
npm run dev
```

1. Open http://localhost:3000 — landing page with sign-in/sign-up
2. Sign in — redirects to /dashboard
3. Dashboard shows today card, week strip, quick stats (all placeholder data)
4. Click each sidebar link — all pages render
5. Sidebar highlights the active page
6. User avatar in top-right shows Clerk user menu
7. Sign out returns to landing page

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add dashboard shell with placeholder pages for plan, chat, review, settings"
```

---

### Task 7: User Sync on Sign-In

**Files:**
- Create: `src/app/api/webhooks/clerk/route.ts`

- [ ] **Step 1: Create Clerk webhook handler to sync users to Supabase**

When a user signs up or signs in via Clerk, we need to upsert them into our `users` table.

Create `src/app/api/webhooks/clerk/route.ts`:

```typescript
import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error("Missing CLERK_WEBHOOK_SECRET environment variable");
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return new Response("Webhook verification failed", { status: 400 });
  }

  const supabase = createServerClient();

  if (evt.type === "user.created" || evt.type === "user.updated") {
    const { id, email_addresses } = evt.data;
    const email = email_addresses[0]?.email_address;

    if (!email) {
      return new Response("No email found", { status: 400 });
    }

    const { error } = await supabase.from("users").upsert(
      { id, email },
      { onConflict: "id" }
    );

    if (error) {
      console.error("Failed to upsert user:", error);
      return new Response("Database error", { status: 500 });
    }
  }

  return new Response("OK", { status: 200 });
}
```

- [ ] **Step 2: Install svix dependency**

```bash
npm install svix
```

- [ ] **Step 3: Set up Clerk webhook**

1. Go to Clerk Dashboard → Webhooks → Add Endpoint
2. URL: `https://your-domain.com/api/webhooks/clerk` (use ngrok for local testing)
3. Events: subscribe to `user.created` and `user.updated`
4. Copy the signing secret and add to `.env.local`:

```
CLERK_WEBHOOK_SECRET=whsec_xxx
```

Also add to `.env.example`:

```
CLERK_WEBHOOK_SECRET=whsec_xxx
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Clerk webhook to sync users to Supabase on sign-up"
```

---

## Phase 1 Summary

After completing all 7 tasks, you have:

- Next.js project with TypeScript, Tailwind, Vitest
- Clerk authentication (sign-up, sign-in, middleware, webhook sync)
- Supabase database with all 13 tables, RLS policies, and indexes
- Type-safe Supabase clients (browser + server)
- App shell with sidebar navigation and topbar
- Dashboard with placeholder cards (today, week, stats)
- Placeholder pages for Plan, Chat, Review, Settings
- User records auto-created in Supabase on Clerk sign-up

**Next:** Phase 2 (Onboarding) builds the 9-step onboarding flow on top of this foundation.
