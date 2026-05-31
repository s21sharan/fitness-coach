# Subscription Layer Design

## Overview

Stripe-powered monthly subscription ($11.99/mo) with a 3-day free trial. Card is collected during onboarding. Trial clock starts after onboarding completes. Hard paywall when trial expires or subscription lapses — users can only access Settings (to resubscribe). Cancel-at-period-end semantics.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Trial/lapse behavior | Hard paywall — no dashboard access | Simplest to implement, strongest conversion signal |
| Card collection timing | During onboarding (step 10) | Seamless flow, no deferred friction |
| Trial start | After onboarding completes | Users don't lose trial time to setup |
| Expired user access | Settings page only | Needed to resubscribe or manage account |
| Cancellation | Cancel at period end | Standard SaaS pattern, user retains access until paid period ends |
| Stripe integration split | Next.js: Checkout + Portal sessions. Railway Express: webhooks + subscription state | Keeps webhook processing colocated with existing backend workers |

## Architecture

### Next.js (API Routes)

- `POST /api/stripe/checkout` — creates a Stripe Checkout session with 3-day trial, redirects user to Stripe
- `POST /api/stripe/portal` — creates a Stripe Customer Portal session for managing/cancelling subscription
- Dashboard layout gating — checks subscription status, restricts access when lapsed

### Railway Express (Backend)

- `POST /api/webhooks/stripe` — receives and processes Stripe webhook events
- Updates `subscriptions` table in Supabase based on events
- Webhook secret verified via `stripe.webhooks.constructEvent()`

### Webhook Events Handled

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create `subscriptions` row, set `stripe_customer_id` on `users` |
| `customer.subscription.created` | Create/update subscription row |
| `customer.subscription.updated` | Update status, period dates, `cancel_at_period_end` |
| `customer.subscription.deleted` | Set status to `canceled` |
| `invoice.payment_succeeded` | Update status to `active`, update period dates |
| `invoice.payment_failed` | Update status to `past_due` |

## Data Model

### New table: `subscriptions`

```sql
CREATE TABLE public.subscriptions (
  id text PRIMARY KEY,                    -- Stripe subscription ID (sub_xxx)
  user_id text NOT NULL REFERENCES users(id),
  stripe_customer_id text NOT NULL,
  status text NOT NULL,                   -- 'trialing', 'active', 'past_due', 'canceled', 'unpaid'
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  canceled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- One active subscription per user
CREATE UNIQUE INDEX idx_subscriptions_user ON subscriptions(user_id) WHERE status IN ('trialing', 'active', 'past_due');

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own subscription" ON subscriptions FOR SELECT USING (user_id = current_setting('app.user_id'));
CREATE POLICY "Service role full access" ON subscriptions FOR ALL USING (current_setting('role') = 'service_role');
```

### Alter `users` table

```sql
ALTER TABLE users ADD COLUMN stripe_customer_id text;
```

## User Flows

### New User Sign-Up

1. Clerk sign-up -> webhook creates `users` row
2. Onboarding steps 1-9 (existing profile/goals flow)
3. **New step 10:** Stripe Checkout (embedded or redirect) — collects card, creates subscription with `trial_period_days: 3`
4. Stripe fires `checkout.session.completed` -> Railway webhook creates `subscriptions` row with `status: 'trialing'`, `trial_end` set to 3 days from now
5. Onboarding completes -> user enters dashboard with full access

### Trial Auto-Renew (Happy Path)

- After 3 days, Stripe automatically charges the card
- `invoice.payment_succeeded` webhook -> Railway updates status to `active`
- `customer.subscription.updated` webhook -> updates period dates
- User continues using the app uninterrupted

### Cancel During Trial

1. User goes to Settings -> Subscription -> clicks "Cancel"
2. Opens Stripe Customer Portal -> user confirms cancellation
3. `customer.subscription.updated` webhook -> sets `cancel_at_period_end: true`
4. User retains access until `trial_end`
5. At trial end, `customer.subscription.deleted` webhook -> status becomes `canceled`
6. Next dashboard visit -> paywall redirect to Settings

### Active Subscriber Cancels

1. Settings -> Subscription -> "Manage Subscription" -> Stripe Customer Portal
2. User cancels in Portal
3. `customer.subscription.updated` webhook -> `cancel_at_period_end: true`
4. User keeps full access until `current_period_end`
5. At period end, `customer.subscription.deleted` -> status `canceled`
6. Paywall kicks in

### Lapsed User Resubscribes

1. User visits any dashboard page -> paywall redirects to Settings
2. Settings shows "Your subscription has expired" + "Resubscribe" button
3. Button creates a new Stripe Checkout session (**no trial** — `trial_period_days` omitted)
4. `checkout.session.completed` webhook -> new `subscriptions` row with `status: 'active'`
5. Access restored immediately

### Payment Failure

1. `invoice.payment_failed` webhook -> status set to `past_due`
2. Stripe retries payment per its retry schedule (Smart Retries)
3. If retries succeed -> `invoice.payment_succeeded` -> status back to `active`
4. If all retries fail -> `customer.subscription.deleted` -> status `canceled` -> paywall

## Paywall Gating

### Dashboard Layout (`src/app/dashboard/layout.tsx`)

```
fetch subscription from Supabase WHERE user_id = clerkUserId
  AND status IN ('trialing', 'active', 'past_due')

if no matching row:
  if current path is /dashboard/settings:
    render settings with "subscription expired" banner
  else:
    redirect to /dashboard/settings
```

- `past_due` is treated as active (Stripe is still retrying payment)
- No subscription row or `canceled` status -> paywall

### Helper: `getSubscriptionStatus(userId)`

Utility function in `src/lib/subscription.ts` that returns:
- `{ active: true, status, trialEnd, periodEnd, cancelAtPeriodEnd }` for valid subscriptions
- `{ active: false }` for no/canceled subscription

Used by dashboard layout and Settings page.

## Settings Subscription UI

Replace the current "Free Plan" placeholder in Settings. Display varies by state:

### Trialing
- Badge: "Free Trial"
- Text: "Your free trial ends on [date]. Your card will be charged $11.99/mo after."
- Button: "Cancel Trial" (opens Stripe Customer Portal)

### Active
- Badge: "Pro Plan"
- Text: "$11.99/mo - Next billing date: [date]"
- Button: "Manage Subscription" (opens Stripe Customer Portal)

### Cancelling (active but `cancel_at_period_end: true`)
- Badge: "Pro Plan - Cancelling"
- Text: "Your access continues until [date]. After that, your subscription will end."
- Button: "Resume Subscription" (opens Stripe Customer Portal)

### Expired / Canceled
- Badge: "No Active Plan"
- Text: "Your subscription has expired. Resubscribe to access your training data and AI coach."
- Button: "Resubscribe - $11.99/mo" (creates new Checkout session)

## Onboarding Integration

### Current Flow (steps 1-9)
1. Welcome
2. Basic info (age, sex)
3. Body metrics (height, weight)
4. Activity level
5. Training experience
6. Goals (body composition)
7. Race goals
8. Training frequency & preferences
9. Review & confirm

### Updated Flow (step 10 added)
10. **Subscription** — "Start your 3-day free trial"
    - Shows: plan details ($11.99/mo after trial), what's included
    - Button: "Start Free Trial" -> redirects to Stripe Checkout
    - Stripe Checkout has `success_url` pointing to `/onboarding?step=complete`
    - On return, `commitOnboardingData()` fires, sets `onboarding_completed = true`

### Checkout Session Parameters
```
mode: 'subscription'
line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }]
subscription_data: { trial_period_days: 3 }
customer_email: user's Clerk email
metadata: { user_id: clerkUserId }
success_url: /onboarding?step=complete
cancel_url: /onboarding?step=10
```

## Stripe Configuration

### Product & Price
- Product name: "Trainer Pro"
- Price: $11.99/mo recurring (USD)
- Trial: 3 days (set per-checkout, not on the price object)
- Created via Stripe Dashboard or API

### Customer Portal
- Enable in Stripe Dashboard
- Allow: cancel subscription, update payment method
- Redirect URL: `/dashboard/settings`

### Webhook Endpoint
- URL: `https://<railway-backend-url>/api/webhooks/stripe`
- Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
- Secret: `STRIPE_WEBHOOK_SECRET` env var on Railway

## Environment Variables

### Next.js (`.env.local`)
```
STRIPE_SECRET_KEY=sk_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_PRICE_ID=price_...
```

### Railway Express (`server/.env`)
```
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
```

## Dependencies

### Next.js
```
stripe          -- Stripe Node SDK (server-side)
@stripe/stripe-js  -- Stripe.js (client-side, for redirect to Checkout)
```

### Railway Express
```
stripe          -- Stripe Node SDK (webhook verification + API calls)
```

## Files to Create/Modify

### New Files
- `supabase/migrations/023_subscriptions.sql` — subscriptions table + users alter
- `src/lib/subscription.ts` — `getSubscriptionStatus()` helper
- `src/app/api/stripe/checkout/route.ts` — create Checkout session
- `src/app/api/stripe/portal/route.ts` — create Customer Portal session
- `server/src/webhooks/stripe.ts` — Stripe webhook handler
- `server/src/routes/stripe.ts` — Express route mounting webhook

### Modified Files
- `src/app/dashboard/layout.tsx` — add subscription gating
- `src/app/dashboard/settings/page.tsx` — replace subscription section with live status/actions
- `src/app/onboarding/page.tsx` — add step 10 (Checkout)
- `src/app/onboarding/actions.ts` — handle post-checkout return
- `server/src/index.ts` — mount Stripe webhook route
- `package.json` — add `stripe`, `@stripe/stripe-js`
- `server/package.json` — add `stripe`
