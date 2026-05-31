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
  | {
      active: true;
      status: string;
      trialEnd: string | null;
      periodEnd: string | null;
      cancelAtPeriodEnd: boolean;
    }
  | { active: false };

const ACTIVE_STATUSES = ["trialing", "active", "past_due"];

export function deriveSubscriptionState(
  row: SubscriptionRow | null
): SubscriptionState {
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

export async function getSubscriptionStatus(
  userId: string
): Promise<SubscriptionState> {
  const supabase = createServerClient();

  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  return deriveSubscriptionState(data as SubscriptionRow | null);
}
