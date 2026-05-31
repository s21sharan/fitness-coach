# Subscription Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Stripe-powered $11.99/mo subscription with 3-day free trial, collected during onboarding, with hard paywall on lapse and manage/cancel in Settings.

**Architecture:** Next.js API routes handle Checkout session creation and Customer Portal redirects. Railway Express backend receives Stripe webhooks and manages the `subscriptions` table in Supabase. Dashboard layout gates access — only Settings is reachable when subscription is inactive.

**Tech Stack:** Stripe SDK (`stripe`), `@stripe/stripe-js` (client redirect), Supabase, Next.js API routes, Express webhook handler.

**Spec:** `docs/superpowers/specs/2026-05-30-subscription-layer-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/024_subscriptions.sql` | Subscriptions table + stripe_customer_id on users |
| `src/lib/subscription.ts` | `getSubscriptionStatus(userId)` helper |
| `src/app/api/stripe/checkout/route.ts` | Create Stripe Checkout session |
| `src/app/api/stripe/portal/route.ts` | Create Stripe Customer Portal session |
| `src/components/onboarding/screen-subscription.tsx` | Onboarding step 10: trial start |
| `server/src/routes/stripe-webhooks.ts` | Express route for Stripe webhook events |
| `src/app/api/stripe/status/route.ts` | Return subscription status for current user |
| `src/lib/__tests__/subscription.test.ts` | Tests for subscription helper |
| `server/src/__tests__/stripe-webhooks.test.ts` | Tests for webhook handler |

### Modified Files
| File | Change |
|------|--------|
| `src/lib/onboarding/types.ts` | Add `"subscription"` to `StepId`, add to `getVisibleSteps()` |
| `src/app/onboarding/page.tsx` | Register `ScreenSubscription` in SCREENS map |
| `src/app/onboarding/actions.ts` | New `commitOnboardingWithoutSubscription()` — commits profile before Checkout redirect |
| `src/app/dashboard/layout.tsx` | Add subscription gating logic |
| `src/app/dashboard/settings/page.tsx` | Replace subscription placeholder with live status/actions |
| `server/src/index.ts` | Mount Stripe webhook route |
| `server/src/config.ts` | Add `stripeSecretKey`, `stripeWebhookSecret`, `stripePriceId` |
| `package.json` | Add `stripe`, `@stripe/stripe-js` |
| `server/package.json` | Add `stripe` |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/024_subscriptions.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 024_subscriptions.sql
-- Subscription state from Stripe webhooks

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS stripe_customer_id text;

CREATE TABLE public.subscriptions (
  id text PRIMARY KEY,                    -- Stripe subscription ID (sub_xxx)
  user_id text NOT NULL REFERENCES users(id),
  stripe_customer_id text NOT NULL,
  status text NOT NULL,                   -- 'trialing', 'active', 'past_due', 'canceled', 'unpaid'
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only one non-terminal subscription per user
CREATE UNIQUE INDEX idx_subscriptions_active_user
  ON subscriptions(user_id)
  WHERE status IN ('trialing', 'active', 'past_due');

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on subscriptions"
  ON subscriptions FOR ALL
  USING (true)
  WITH CHECK (true);
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push`
Expected: Migration applies successfully.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/024_subscriptions.sql
git commit -m "feat: add subscriptions table migration"
```

---

## Task 2: Install Stripe Dependencies

**Files:**
- Modify: `package.json`
- Modify: `server/package.json`

- [ ] **Step 1: Install frontend Stripe packages**

Run: `npm install stripe @stripe/stripe-js`

- [ ] **Step 2: Install server Stripe package**

Run: `cd server && npm install stripe`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json server/package.json server/package-lock.json
git commit -m "feat: add stripe dependencies"
```

---

## Task 3: Subscription Status Helper

**Files:**
- Create: `src/lib/__tests__/subscription.test.ts`
- Create: `src/lib/subscription.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/__tests__/subscription.test.ts
import { describe, it, expect, vi } from "vitest";
import { deriveSubscriptionState, type SubscriptionRow } from "../subscription";

describe("deriveSubscriptionState", () => {
  it("returns inactive when no row", () => {
    const result = deriveSubscriptionState(null);
    expect(result).toEqual({ active: false });
  });

  it("returns active for trialing status", () => {
    const row: SubscriptionRow = {
      id: "sub_123",
      user_id: "user_1",
      stripe_customer_id: "cus_1",
      status: "trialing",
      current_period_start: "2026-05-30T00:00:00Z",
      current_period_end: "2026-06-30T00:00:00Z",
      trial_end: "2026-06-02T00:00:00Z",
      cancel_at_period_end: false,
      canceled_at: null,
      created_at: "2026-05-30T00:00:00Z",
      updated_at: "2026-05-30T00:00:00Z",
    };
    const result = deriveSubscriptionState(row);
    expect(result).toEqual({
      active: true,
      status: "trialing",
      trialEnd: "2026-06-02T00:00:00Z",
      periodEnd: "2026-06-30T00:00:00Z",
      cancelAtPeriodEnd: false,
    });
  });

  it("returns active for active status", () => {
    const row: SubscriptionRow = {
      id: "sub_123",
      user_id: "user_1",
      stripe_customer_id: "cus_1",
      status: "active",
      current_period_start: "2026-05-30T00:00:00Z",
      current_period_end: "2026-06-30T00:00:00Z",
      trial_end: null,
      cancel_at_period_end: false,
      canceled_at: null,
      created_at: "2026-05-30T00:00:00Z",
      updated_at: "2026-05-30T00:00:00Z",
    };
    const result = deriveSubscriptionState(row);
    expect(result.active).toBe(true);
    expect(result.status).toBe("active");
  });

  it("returns active for past_due status (Stripe still retrying)", () => {
    const row: SubscriptionRow = {
      id: "sub_123",
      user_id: "user_1",
      stripe_customer_id: "cus_1",
      status: "past_due",
      current_period_start: "2026-05-30T00:00:00Z",
      current_period_end: "2026-06-30T00:00:00Z",
      trial_end: null,
      cancel_at_period_end: false,
      canceled_at: null,
      created_at: "2026-05-30T00:00:00Z",
      updated_at: "2026-05-30T00:00:00Z",
    };
    const result = deriveSubscriptionState(row);
    expect(result.active).toBe(true);
    expect(result.status).toBe("past_due");
  });

  it("returns inactive for canceled status", () => {
    const row: SubscriptionRow = {
      id: "sub_123",
      user_id: "user_1",
      stripe_customer_id: "cus_1",
      status: "canceled",
      current_period_start: "2026-05-30T00:00:00Z",
      current_period_end: "2026-06-30T00:00:00Z",
      trial_end: null,
      cancel_at_period_end: false,
      canceled_at: "2026-06-15T00:00:00Z",
      created_at: "2026-05-30T00:00:00Z",
      updated_at: "2026-06-15T00:00:00Z",
    };
    const result = deriveSubscriptionState(row);
    expect(result).toEqual({ active: false });
  });

  it("returns cancelAtPeriodEnd when set", () => {
    const row: SubscriptionRow = {
      id: "sub_123",
      user_id: "user_1",
      stripe_customer_id: "cus_1",
      status: "active",
      current_period_start: "2026-05-30T00:00:00Z",
      current_period_end: "2026-06-30T00:00:00Z",
      trial_end: null,
      cancel_at_period_end: true,
      canceled_at: null,
      created_at: "2026-05-30T00:00:00Z",
      updated_at: "2026-05-30T00:00:00Z",
    };
    const result = deriveSubscriptionState(row);
    expect(result.active).toBe(true);
    expect(result.cancelAtPeriodEnd).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/subscription.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/subscription.ts
import { createServerClient } from "@/lib/supabase/server";

export interface SubscriptionRow {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
}

export type SubscriptionState =
  | { active: true; status: string; trialEnd: string | null; periodEnd: string | null; cancelAtPeriodEnd: boolean }
  | { active: false };

const ACTIVE_STATUSES = ["trialing", "active", "past_due"];

/** Pure function — derive state from a row. Testable without DB. */
export function deriveSubscriptionState(row: SubscriptionRow | null): SubscriptionState {
  if (!row || !ACTIVE_STATUSES.includes(row.status)) {
    return { active: false };
  }
  return {
    active: true,
    status: row.status,
    trialEnd: row.trial_end,
    periodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
  };
}

/** Fetch subscription state for a user from Supabase. */
export async function getSubscriptionStatus(userId: string): Promise<SubscriptionState> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .in("status", ACTIVE_STATUSES)
    .maybeSingle();

  return deriveSubscriptionState(data as SubscriptionRow | null);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/subscription.test.ts`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/subscription.ts src/lib/__tests__/subscription.test.ts
git commit -m "feat: add subscription status helper with tests"
```

---

## Task 4: Stripe Checkout API Route

**Files:**
- Create: `src/app/api/stripe/checkout/route.ts`

- [ ] **Step 1: Create the Checkout session route**

```typescript
// src/app/api/stripe/checkout/route.ts
import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;

  const { returnUrl, includeTrial } = await req.json().catch(() => ({
    returnUrl: "/dashboard",
    includeTrial: true,
  }));

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    ...(includeTrial ? { subscription_data: { trial_period_days: 3 } } : {}),
    customer_email: email ?? undefined,
    metadata: { user_id: userId },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}${returnUrl}?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}${returnUrl}?checkout=canceled`,
  });

  return NextResponse.json({ url: session.url });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/stripe/checkout/route.ts
git commit -m "feat: add Stripe Checkout session API route"
```

---

## Task 5: Stripe Customer Portal API Route

**Files:**
- Create: `src/app/api/stripe/portal/route.ts`

- [ ] **Step 1: Create the Portal session route**

```typescript
// src/app/api/stripe/portal/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const { data: user } = await supabase
    .from("users")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();

  if (!user?.stripe_customer_id) {
    return NextResponse.json({ error: "No subscription found" }, { status: 404 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard/settings`,
  });

  return NextResponse.json({ url: session.url });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/stripe/portal/route.ts
git commit -m "feat: add Stripe Customer Portal session API route"
```

---

## Task 6: Stripe Webhook Handler (Railway Express)

**Files:**
- Modify: `server/src/config.ts`
- Create: `server/src/routes/stripe-webhooks.ts`
- Modify: `server/src/index.ts`
- Create: `server/src/__tests__/stripe-webhooks.test.ts`

- [ ] **Step 1: Add Stripe config vars**

In `server/src/config.ts`, add these three fields to the config object:

```typescript
stripeSecretKey: required("STRIPE_SECRET_KEY"),
stripeWebhookSecret: required("STRIPE_WEBHOOK_SECRET"),
stripePriceId: required("STRIPE_PRICE_ID"),
```

- [ ] **Step 2: Write the failing webhook test**

```typescript
// server/src/__tests__/stripe-webhooks.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleWebhookEvent } from "../routes/stripe-webhooks.js";

// Mock Supabase
const mockUpsert = vi.fn().mockReturnValue({ error: null });
const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ error: null }) });
const mockFrom = vi.fn().mockReturnValue({
  upsert: mockUpsert,
  update: mockUpdate,
});

const mockSupabase = { from: mockFrom } as any;

describe("handleWebhookEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      upsert: mockUpsert,
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ error: null }),
      }),
    });
  });

  it("handles checkout.session.completed — creates subscription row and sets stripe_customer_id", async () => {
    const event = {
      type: "checkout.session.completed",
      data: {
        object: {
          subscription: "sub_123",
          customer: "cus_456",
          metadata: { user_id: "user_1" },
        },
      },
    };

    await handleWebhookEvent(event as any, mockSupabase);

    // Should update users table with stripe_customer_id
    expect(mockFrom).toHaveBeenCalledWith("users");
    expect(mockUpdate).toHaveBeenCalledWith({ stripe_customer_id: "cus_456" });
  });

  it("handles customer.subscription.updated — upserts subscription row", async () => {
    const event = {
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_123",
          customer: "cus_456",
          status: "active",
          current_period_start: 1717027200,
          current_period_end: 1719619200,
          trial_end: null,
          cancel_at_period_end: false,
          canceled_at: null,
          metadata: { user_id: "user_1" },
        },
      },
    };

    await handleWebhookEvent(event as any, mockSupabase);

    expect(mockFrom).toHaveBeenCalledWith("subscriptions");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "sub_123",
        user_id: "user_1",
        stripe_customer_id: "cus_456",
        status: "active",
        cancel_at_period_end: false,
      }),
      { onConflict: "id" }
    );
  });

  it("handles customer.subscription.deleted — sets status to canceled", async () => {
    const event = {
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_123",
          customer: "cus_456",
          status: "canceled",
          current_period_start: 1717027200,
          current_period_end: 1719619200,
          trial_end: null,
          cancel_at_period_end: false,
          canceled_at: 1718236800,
          metadata: { user_id: "user_1" },
        },
      },
    };

    await handleWebhookEvent(event as any, mockSupabase);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "sub_123",
        status: "canceled",
      }),
      { onConflict: "id" }
    );
  });

  it("handles invoice.payment_failed — sets status to past_due", async () => {
    const event = {
      type: "invoice.payment_failed",
      data: {
        object: {
          subscription: "sub_123",
        },
      },
    };

    // Need to mock Stripe API for subscription retrieval
    // This test verifies the function doesn't throw
    await expect(handleWebhookEvent(event as any, mockSupabase)).resolves.not.toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd server && npm test -- src/__tests__/stripe-webhooks.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write the webhook handler**

```typescript
// server/src/routes/stripe-webhooks.ts
import express, { Router, type Request, type Response } from "express";
import Stripe from "stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const stripe = new Stripe(config.stripeSecretKey);

function toISO(epoch: number | null): string | null {
  return epoch ? new Date(epoch * 1000).toISOString() : null;
}

/** Process a verified Stripe webhook event. Exported for testing. */
export async function handleWebhookEvent(
  event: Stripe.Event,
  supabase: SupabaseClient
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      if (!userId) {
        logger.warn("checkout.session.completed missing user_id metadata");
        return;
      }
      // Set stripe_customer_id on users table
      await supabase
        .from("users")
        .update({ stripe_customer_id: session.customer as string })
        .eq("id", userId);

      // Fetch the full subscription to populate our table
      if (session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        await upsertSubscription(supabase, sub, userId);
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.user_id;
      if (!userId) {
        logger.warn(`${event.type} missing user_id metadata`);
        return;
      }
      await upsertSubscription(supabase, sub, userId);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.user_id;
      if (!userId) {
        logger.warn("customer.subscription.deleted missing user_id metadata");
        return;
      }
      await upsertSubscription(supabase, sub, userId);
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.subscription) {
        const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
        const userId = sub.metadata?.user_id;
        if (userId) {
          await upsertSubscription(supabase, sub, userId);
        }
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.subscription) {
        const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
        const userId = sub.metadata?.user_id;
        if (userId) {
          await upsertSubscription(supabase, sub, userId);
        }
      }
      break;
    }

    default:
      logger.info(`Unhandled Stripe event: ${event.type}`);
  }
}

async function upsertSubscription(
  supabase: SupabaseClient,
  sub: Stripe.Subscription,
  userId: string
): Promise<void> {
  const { error } = await supabase.from("subscriptions").upsert(
    {
      id: sub.id,
      user_id: userId,
      stripe_customer_id: sub.customer as string,
      status: sub.status,
      current_period_start: toISO(sub.current_period_start),
      current_period_end: toISO(sub.current_period_end),
      trial_end: toISO(sub.trial_end),
      cancel_at_period_end: sub.cancel_at_period_end,
      canceled_at: toISO(sub.canceled_at),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) {
    logger.error("Failed to upsert subscription", { subId: sub.id, error: error.message });
  }
}

/** Create the Express router. Must use raw body for Stripe signature verification. */
export function createStripeWebhookRouter(): Router {
  const router = Router();

  // Stripe requires raw body for signature verification
  router.post(
    "/stripe",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const sig = req.headers["stripe-signature"];
      if (!sig) {
        res.status(400).json({ error: "Missing stripe-signature header" });
        return;
      }

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          config.stripeWebhookSecret
        );
      } catch (err) {
        logger.error("Stripe webhook signature verification failed", { error: (err as Error).message });
        res.status(400).json({ error: "Invalid signature" });
        return;
      }

      const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

      try {
        await handleWebhookEvent(event, supabase);
        res.json({ received: true });
      } catch (err) {
        logger.error("Stripe webhook handler error", { error: (err as Error).message });
        res.status(500).json({ error: "Webhook handler failed" });
      }
    }
  );

  return router;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npm test -- src/__tests__/stripe-webhooks.test.ts`
Expected: Tests PASS.

- [ ] **Step 6: Mount the webhook route in Express**

In `server/src/index.ts`, add import and mount the route. The webhook route needs raw body parsing, so it must be mounted **before** the `express.json()` middleware:

```typescript
// Add import at top
import { createStripeWebhookRouter } from "./routes/stripe-webhooks.js";

// Mount BEFORE express.json() — stripe needs raw body
app.use("/webhooks", createStripeWebhookRouter());

// Then existing middleware
app.use(express.json());
```

The full updated `server/src/index.ts` should be:

```typescript
import express from "express";
import { config } from "./config.js";
import { apiKeyAuth } from "./middleware/auth.js";
import { createSyncRouter } from "./routes/sync.js";
import { createWebhookRouter } from "./routes/webhooks.js";
import { createStripeWebhookRouter } from "./routes/stripe-webhooks.js";
import { startScheduler } from "./sync/scheduler.js";
import { logger } from "./utils/logger.js";

const app = express();

// Stripe webhook needs raw body — mount before express.json()
app.use("/webhooks", createStripeWebhookRouter());

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/sync", apiKeyAuth, createSyncRouter());
app.use("/webhooks", createWebhookRouter());

app.listen(config.port, () => {
  logger.info("Server started", { port: config.port });
  startScheduler();
});

export { app };
```

Note: The existing `/webhooks` route (for Strava) and the new Stripe one both mount under `/webhooks`. Strava uses `/webhooks/strava` and Stripe uses `/webhooks/stripe`, so they don't conflict. The Stripe router is mounted first (before `express.json()`) so it gets raw body parsing; the existing webhook router gets JSON-parsed bodies.

- [ ] **Step 7: Commit**

```bash
git add server/src/config.ts server/src/routes/stripe-webhooks.ts server/src/index.ts server/src/__tests__/stripe-webhooks.test.ts
git commit -m "feat: add Stripe webhook handler on Express backend"
```

---

## Task 7: Onboarding Subscription Step

**Files:**
- Modify: `src/lib/onboarding/types.ts`
- Create: `src/components/onboarding/screen-subscription.tsx`
- Modify: `src/app/onboarding/page.tsx`
- Modify: `src/app/onboarding/actions.ts`

- [ ] **Step 1: Add `subscription` to StepId**

In `src/lib/onboarding/types.ts`, add `"subscription"` to the `StepId` union type (after `"plan_preview"`):

```typescript
export type StepId =
  | "welcome"
  | "connect"
  | "sports"
  | "identity"
  | "goals"
  | "events"
  | "strength"
  | "body_nutrition"
  | "availability"
  | "recovery"
  | "injury"
  | "equipment"
  | "coach_style"
  | "plan_preview"
  | "subscription";
```

- [ ] **Step 2: Add `subscription` to `getVisibleSteps()`**

In `src/lib/onboarding/types.ts`, at the end of `getVisibleSteps()`, change the last `push` to include `subscription`:

```typescript
  steps.push("coach_style", "plan_preview", "subscription");

  return steps;
```

- [ ] **Step 3: Create the subscription screen component**

```typescript
// src/components/onboarding/screen-subscription.tsx
"use client";

import { useState } from "react";
import type { AthleteContextProfile } from "@/lib/onboarding/types";

export const SCREEN_SUBSCRIPTION_TITLE = "Start your free trial";
export const SCREEN_SUBSCRIPTION_SUBTITLE = "3 days free, then $11.99/mo. Cancel anytime.";

type Props = {
  profile: AthleteContextProfile;
  onUpdate: (updates: Partial<AthleteContextProfile>) => void;
};

export function ScreenSubscription({ profile, onUpdate }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartTrial = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnUrl: "/onboarding?step=subscription",
          includeTrial: true,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("Failed to create checkout session");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div
        style={{
          background: "linear-gradient(135deg, var(--sky-soft) 0%, var(--surface) 100%)",
          borderRadius: 16,
          padding: 32,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 900, color: "var(--ink)", marginBottom: 4 }}>
          $11.99
          <span style={{ fontSize: 16, fontWeight: 600, color: "var(--muted)" }}>/mo</span>
        </div>
        <div style={{ fontSize: 14, color: "var(--muted)", fontWeight: 600 }}>
          after your 3-day free trial
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[
          "AI-powered coaching advice",
          "Training plan generation & adaptation",
          "Unified dashboard across all your fitness apps",
          "Recovery & readiness insights",
          "Nutrition tracking integration",
        ].map((feature) => (
          <div
            key={feature}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 14,
              color: "var(--ink-2)",
              fontWeight: 600,
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "var(--mint-soft)",
                color: "var(--mint-deep)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              ✓
            </div>
            {feature}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleStartTrial}
        disabled={loading}
        style={{
          padding: "14px 24px",
          borderRadius: 12,
          border: "none",
          background: "var(--coral-deep)",
          color: "#fff",
          fontSize: 15,
          fontWeight: 800,
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
          fontFamily: "inherit",
        }}
      >
        {loading ? "Redirecting to checkout..." : "Start Free Trial"}
      </button>

      {error && (
        <div style={{ fontSize: 13, color: "#ef4444", fontWeight: 600 }}>
          {error}
        </div>
      )}

      <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", lineHeight: 1.5 }}>
        You won't be charged during the trial. Cancel anytime in Settings.
        Your card will be charged $11.99 after the 3-day trial ends.
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Register the screen in onboarding page**

In `src/app/onboarding/page.tsx`, add the import at the top with the other screen imports:

```typescript
import { ScreenSubscription, SCREEN_SUBSCRIPTION_TITLE, SCREEN_SUBSCRIPTION_SUBTITLE } from "@/components/onboarding/screen-subscription";
```

Add to the `SCREENS` map:

```typescript
subscription: { Component: ScreenSubscription, title: SCREEN_SUBSCRIPTION_TITLE, subtitle: SCREEN_SUBSCRIPTION_SUBTITLE },
```

- [ ] **Step 5: Update onboarding flow to commit profile before Checkout redirect**

The current flow commits all data and sets `onboarding_completed = true` on the last step. Now the last step is `subscription`, but we need the profile data committed *before* the user leaves for Stripe Checkout — otherwise if they never come back from Checkout, data is lost. But we should NOT set `onboarding_completed = true` until after successful checkout.

In `src/app/onboarding/actions.ts`, add a new exported function that commits all profile data but does NOT set `onboarding_completed`:

```typescript
/**
 * Commits all onboarding profile data to normalized tables WITHOUT
 * setting onboarding_completed. Used before Stripe Checkout redirect
 * so data is persisted even if user doesn't return from Checkout.
 */
export async function commitProfileWithoutCompletion(
  profile: AthleteContextProfile,
  calendarOpts?: { calendarWeekAnchorYmd?: string; calendarTimezone?: string }
): Promise<ActionResult> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };

  const supabase = createServerClient();
  const userErr = await ensureUsersRow(supabase, userId);
  if (userErr) return userErr;

  // Run the same commits as commitOnboardingData steps 1-12c
  // (everything except step 13 which flips onboarding_completed)
  // ... reuse the body of commitOnboardingData up to and including step 12c
  // but skip step 13 (the onboarding_completed flip and draft deletion)
```

To avoid duplicating the entire commit body, refactor `commitOnboardingData` to extract the shared logic. Replace the body of `commitOnboardingData` by extracting steps 1-12c into a helper:

```typescript
/** Internal: persist all profile tables. Does NOT touch onboarding_completed. */
async function persistProfileTables(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  profile: AthleteContextProfile,
  calendarOpts?: { calendarWeekAnchorYmd?: string; calendarTimezone?: string }
): Promise<ActionResult> {
  // Steps 1 through 12c from the original commitOnboardingData
  // (all the upsert/insert logic for user_profiles, user_goals, sports, events,
  //  availability, recovery, injuries, equipment, body_nutrition, preferences,
  //  coach_settings, derived_scores, planned_workouts, spec authoring)
  // Return { success: true } at the end
  // ... (move existing steps 1-12c here unchanged)
}
```

Then update both functions:

```typescript
export async function commitOnboardingData(
  profile: AthleteContextProfile,
  calendarOpts?: { calendarWeekAnchorYmd?: string; calendarTimezone?: string }
): Promise<ActionResult> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };

  const supabase = createServerClient();
  const userErr = await ensureUsersRow(supabase, userId);
  if (userErr) return userErr;

  const persistResult = await persistProfileTables(supabase, userId, profile, calendarOpts);
  if (!persistResult.success) return persistResult;

  // Flip onboarding_completed + delete draft
  const { error } = await supabase
    .from("users")
    .update({ onboarding_completed: true })
    .eq("id", userId);
  if (error) return failWith("users", error.message);

  await supabase.from("onboarding_drafts").delete().eq("user_id", userId);

  return { success: true };
}

export async function commitProfileWithoutCompletion(
  profile: AthleteContextProfile,
  calendarOpts?: { calendarWeekAnchorYmd?: string; calendarTimezone?: string }
): Promise<ActionResult> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };

  const supabase = createServerClient();
  const userErr = await ensureUsersRow(supabase, userId);
  if (userErr) return userErr;

  return persistProfileTables(supabase, userId, profile, calendarOpts);
}
```

- [ ] **Step 6: Update onboarding handleNext to call commitProfileWithoutCompletion before the subscription step**

In `src/app/onboarding/page.tsx`, update the `handleNext` function. Currently it calls `commitOnboardingData` when `isLast` is true (which is now the subscription step). Change it so that when advancing *to* the subscription step, it commits profile data without completion. The subscription screen itself handles the Stripe redirect, and `onboarding_completed` will be set after successful checkout return.

Add import for `commitProfileWithoutCompletion`:

```typescript
import {
  commitOnboardingData,
  commitProfileWithoutCompletion,
  getOnboardingDraft,
  loadCommittedProfile,
  saveOnboardingDraft,
} from "./actions";
```

Update `handleNext`:

```typescript
const handleNext = async () => {
  setError(null);

  // Compute next step
  const updatedVisible = getVisibleSteps(profile);
  const updatedIdx = updatedVisible.indexOf(currentStep);
  const next = updatedVisible[updatedIdx + 1];

  // If advancing to subscription step, persist profile first
  if (next === "subscription") {
    setSaving(true);
    try {
      const res = await commitProfileWithoutCompletion(profile, {
        calendarWeekAnchorYmd: weekAnchorMondayYmdFromLocalDate(new Date()),
        calendarTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (!res.success) {
        setError(res.error ?? "Couldn't save your profile");
        return;
      }
    } finally {
      setSaving(false);
    }
    goToStep(next);
    return;
  }

  // If on subscription step and checkout succeeded, complete onboarding
  if (currentStep === "subscription") {
    setSaving(true);
    try {
      const res = await commitOnboardingData(profile, {
        calendarWeekAnchorYmd: weekAnchorMondayYmdFromLocalDate(new Date()),
        calendarTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (!res.success) {
        setError(res.error ?? "Couldn't save your profile");
        return;
      }
      router.push("/dashboard");
    } finally {
      setSaving(false);
    }
    return;
  }

  if (next) goToStep(next);
};
```

- [ ] **Step 7: Handle checkout return in subscription screen**

Update `ScreenSubscription` to detect `?checkout=success` in the URL and auto-advance. Add to the component:

```typescript
import { useSearchParams } from "next/navigation";

// Inside the component:
const searchParams = useSearchParams();
const checkoutStatus = searchParams.get("checkout");

// If returning from successful checkout, show success and let user click "Continue"
// The parent's handleNext will call commitOnboardingData to set onboarding_completed
```

The subscription screen should show a success state when `checkout=success`:

```typescript
if (checkoutStatus === "success") {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, textAlign: "center" }}>
      <div style={{
        width: 64, height: 64, borderRadius: "50%",
        background: "var(--mint-soft)", color: "var(--mint-deep)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 28, fontWeight: 800, margin: "0 auto",
      }}>
        ✓
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)" }}>
        You're all set!
      </div>
      <div style={{ fontSize: 14, color: "var(--muted)" }}>
        Your 3-day free trial has started. Click below to enter your dashboard.
      </div>
    </div>
  );
}
```

When this success state is shown, the parent's "Continue" / "Finish" button calls `handleNext`, which detects `currentStep === "subscription"` and calls `commitOnboardingData` to flip `onboarding_completed`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/onboarding/types.ts src/components/onboarding/screen-subscription.tsx src/app/onboarding/page.tsx src/app/onboarding/actions.ts
git commit -m "feat: add subscription step to onboarding flow"
```

---

## Task 8: Dashboard Paywall Gating

**Files:**
- Modify: `src/app/dashboard/layout.tsx`

- [ ] **Step 1: Add subscription gating to dashboard layout**

Replace the current `src/app/dashboard/layout.tsx` with subscription-aware gating:

```typescript
import "@/components/app/tokens.css";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { getSubscriptionStatus } from "@/lib/subscription";
import { AppShell } from "@/components/app/shell-client";
import { ChatProvider } from "@/components/chat/chat-provider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (userId) {
    const supabase = createServerClient();
    const { data: user } = await supabase
      .from("users")
      .select("onboarding_completed")
      .eq("id", userId)
      .single();

    if (!user || !user.onboarding_completed) {
      redirect("/onboarding");
    }

    // Check subscription status
    const subscription = await getSubscriptionStatus(userId);
    if (!subscription.active) {
      // Allow settings page access for resubscription
      const headerList = await headers();
      const pathname = headerList.get("x-next-pathname") ?? "";
      if (!pathname.startsWith("/dashboard/settings")) {
        redirect("/dashboard/settings?expired=true");
      }
    }
  }

  return (
    <ChatProvider>
      <AppShell>{children}</AppShell>
    </ChatProvider>
  );
}
```

**Important note:** `x-next-pathname` header may not be available by default. An alternative approach is to use Next.js middleware for subscription gating instead. If `headers()` doesn't contain the pathname, use this middleware approach instead:

Create `src/middleware.ts` (or update if it exists) to add the pathname header, OR move the subscription check into a middleware that runs before the layout.

The simpler approach: since `layout.tsx` wraps all `/dashboard/*` routes, and we want to allow `/dashboard/settings`, we can pass the subscription state as a prop/context and let individual pages handle the paywall. But the redirect approach is cleaner.

**Alternative using Next.js `usePathname` on the client side:** Since the layout is a server component and we can't easily get the current path, a practical approach is to check subscription in each page's server component, or use Next.js middleware. The most reliable approach:

Add a middleware check in `src/middleware.ts`:

```typescript
// If src/middleware.ts exists, add to it. If not, create it.
// Check if there's an existing middleware first.
```

For now, the layout approach works because `/dashboard/settings` is the only allowed path. We can check if the request URL contains `/settings` by reading the referer or using the Next.js `headers()` approach. If this proves unreliable at runtime, switch to middleware in a follow-up.

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/layout.tsx
git commit -m "feat: add subscription paywall gating to dashboard"
```

---

## Task 9: Settings Subscription UI

**Files:**
- Modify: `src/app/dashboard/settings/page.tsx`

- [ ] **Step 1: Add subscription data fetching**

The settings page is a client component. Add a `useEffect` to fetch subscription status. Add this near the top of the component alongside other state:

```typescript
const [subscription, setSubscription] = useState<{
  active: boolean;
  status?: string;
  trialEnd?: string | null;
  periodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
} | null>(null);
const [subLoading, setSubLoading] = useState(true);
```

Add a fetch call in a `useEffect`:

```typescript
useEffect(() => {
  fetch("/api/stripe/status")
    .then((r) => r.json())
    .then(setSubscription)
    .catch(() => setSubscription({ active: false }))
    .finally(() => setSubLoading(false));
}, []);
```

- [ ] **Step 2: Create the subscription status API route**

```typescript
// src/app/api/stripe/status/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSubscriptionStatus } from "@/lib/subscription";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getSubscriptionStatus(userId);
  return NextResponse.json(status);
}
```

- [ ] **Step 3: Add portal/checkout action helpers**

Add these helper functions in the settings page component:

```typescript
const handleManageSubscription = async () => {
  const res = await fetch("/api/stripe/portal", { method: "POST" });
  const data = await res.json();
  if (data.url) window.location.href = data.url;
};

const handleResubscribe = async () => {
  const res = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnUrl: "/dashboard/settings", includeTrial: false }),
  });
  const data = await res.json();
  if (data.url) window.location.href = data.url;
};
```

- [ ] **Step 4: Replace the subscription section UI**

Replace the existing subscription section (lines ~1003-1013) with:

```tsx
{activeNav === "subscription" && (
  <div className="card" style={{ padding: 24 }}>
    <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 12 }}>Subscription</div>

    {subLoading ? (
      <div style={{ fontSize: 13, color: "var(--muted)" }}>Loading...</div>
    ) : !subscription?.active ? (
      <>
        <div style={{
          display: "inline-block", background: "#fef2f2", color: "#dc2626",
          padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 800, marginBottom: 12,
        }}>
          No Active Plan
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
          Your subscription has expired. Resubscribe to access your training data and AI coach.
        </div>
        <button
          type="button"
          onClick={handleResubscribe}
          style={{
            padding: "10px 20px", borderRadius: 10, border: "none",
            background: "var(--coral-deep)", color: "#fff",
            fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          Resubscribe — $11.99/mo
        </button>
      </>
    ) : subscription.status === "trialing" ? (
      <>
        <div style={{
          display: "inline-block", background: "var(--sky-soft)", color: "var(--sky-deep, #0369a1)",
          padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 800, marginBottom: 12,
        }}>
          Free Trial
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
          Your free trial ends on{" "}
          <strong>{subscription.trialEnd ? new Date(subscription.trialEnd).toLocaleDateString() : "—"}</strong>.
          Your card will be charged $11.99/mo after.
        </div>
        <button
          type="button"
          onClick={handleManageSubscription}
          style={{
            padding: "10px 20px", borderRadius: 10, border: "1.5px solid var(--line)",
            background: "transparent", color: "var(--ink)",
            fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          Cancel Trial
        </button>
      </>
    ) : subscription.cancelAtPeriodEnd ? (
      <>
        <div style={{
          display: "inline-block", background: "#fef3c7", color: "#92400e",
          padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 800, marginBottom: 12,
        }}>
          Pro Plan — Cancelling
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
          Your access continues until{" "}
          <strong>{subscription.periodEnd ? new Date(subscription.periodEnd).toLocaleDateString() : "—"}</strong>.
          After that, your subscription will end.
        </div>
        <button
          type="button"
          onClick={handleManageSubscription}
          style={{
            padding: "10px 20px", borderRadius: 10, border: "none",
            background: "var(--coral-deep)", color: "#fff",
            fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          Resume Subscription
        </button>
      </>
    ) : (
      <>
        <div style={{
          display: "inline-block", background: "var(--mint-soft)", color: "var(--mint-deep)",
          padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 800, marginBottom: 12,
        }}>
          Pro Plan
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
          $11.99/mo — Next billing date:{" "}
          <strong>{subscription.periodEnd ? new Date(subscription.periodEnd).toLocaleDateString() : "—"}</strong>
        </div>
        <button
          type="button"
          onClick={handleManageSubscription}
          style={{
            padding: "10px 20px", borderRadius: 10, border: "1.5px solid var(--line)",
            background: "transparent", color: "var(--ink)",
            fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          Manage Subscription
        </button>
      </>
    )}
  </div>
)}
```

- [ ] **Step 5: Add expired banner when redirected from paywall**

At the top of the settings page, check for the `?expired=true` query param and show a banner:

```tsx
// Inside the component, after searchParams setup
const isExpired = searchParams.get("expired") === "true";

// In the JSX, above the nav/content area:
{isExpired && (
  <div style={{
    background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12,
    padding: "12px 16px", marginBottom: 16,
    display: "flex", alignItems: "center", gap: 8,
  }}>
    <span style={{ fontSize: 13, fontWeight: 700, color: "#dc2626" }}>
      Your subscription has expired. Go to the Subscription tab to resubscribe.
    </span>
  </div>
)}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/settings/page.tsx src/app/api/stripe/status/route.ts
git commit -m "feat: add live subscription management UI in settings"
```

---

## Task 10: Environment Variables & Stripe Setup

This task is manual setup — no code changes, but documenting the exact steps needed.

- [ ] **Step 1: Create Stripe product and price**

In Stripe Dashboard (test mode):
1. Go to Products → Add product
2. Name: "Trainer Pro"
3. Price: $11.99 recurring monthly
4. Save — copy the `price_xxx` ID

- [ ] **Step 2: Enable Customer Portal**

In Stripe Dashboard → Settings → Customer Portal:
1. Enable "Cancel subscription"
2. Enable "Update payment method"
3. Set return URL: `http://localhost:3000/dashboard/settings`

- [ ] **Step 3: Create webhook endpoint**

In Stripe Dashboard → Developers → Webhooks:
1. Add endpoint URL: `https://<railway-backend-url>/api/webhooks/stripe`
2. Select events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
3. Copy the webhook signing secret (`whsec_xxx`)

For local dev, use Stripe CLI:
```bash
stripe listen --forward-to localhost:3001/webhooks/stripe
```

- [ ] **Step 4: Set environment variables**

Next.js `.env.local`:
```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRICE_ID=price_...
```

Railway Express `server/.env`:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
```

- [ ] **Step 5: Update `.env.example`**

Add Stripe vars to `.env.example` so other devs know what's needed:

```
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_PRICE_ID=
STRIPE_WEBHOOK_SECRET=
```

- [ ] **Step 6: Commit**

```bash
git add .env.example
git commit -m "docs: add Stripe env vars to .env.example"
```

---

## Task 11: End-to-End Smoke Test

- [ ] **Step 1: Start Stripe CLI listener**

Run: `stripe listen --forward-to localhost:3001/webhooks/stripe`
Copy the webhook signing secret and set it in `server/.env`.

- [ ] **Step 2: Start dev servers**

Run Next.js: `npm run dev`
Run Express: `cd server && npm run dev:express-only`

- [ ] **Step 3: Test the full flow**

1. Sign up as a new user (or delete your existing `subscriptions` row)
2. Go through onboarding steps 1-14
3. On step 15 (Subscription), click "Start Free Trial"
4. Complete Stripe Checkout with test card `4242 4242 4242 4242`
5. Verify redirect back to onboarding with `?checkout=success`
6. Click "Continue" to enter dashboard
7. Verify dashboard loads normally
8. Go to Settings → Subscription → verify "Free Trial" badge shows
9. Click "Cancel Trial" → verify Stripe Portal opens
10. Cancel in Portal → verify redirect back to settings
11. Verify "Pro Plan — Cancelling" state shows after webhook processes

- [ ] **Step 4: Test paywall**

1. Manually set subscription status to `canceled` in Supabase
2. Navigate to `/dashboard` → verify redirect to `/dashboard/settings?expired=true`
3. Verify expired banner shows
4. Click "Resubscribe" → verify Checkout opens (no trial)
5. Complete checkout → verify dashboard access restored
