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
