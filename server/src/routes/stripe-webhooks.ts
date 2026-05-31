import { Router, type Request, type Response } from "express";
import express from "express";
import Stripe from "stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

function toISO(epoch: number | null | undefined): string | null {
  if (epoch == null) return null;
  return new Date(epoch * 1000).toISOString();
}

function upsertSubscription(
  supabase: SupabaseClient,
  sub: Stripe.Subscription,
  userId: string,
) {
  return supabase.from("subscriptions").upsert(
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
    { onConflict: "id" },
  );
}

export async function handleWebhookEvent(
  event: Stripe.Event,
  supabase: SupabaseClient,
  stripeClient?: Stripe,
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      if (!userId) {
        logger.warn("Stripe webhook: checkout.session.completed missing user_id metadata");
        return;
      }

      // Update user's stripe_customer_id
      await supabase
        .from("users")
        .update({ stripe_customer_id: session.customer as string })
        .eq("id", userId);

      // Retrieve full subscription and upsert
      if (session.subscription) {
        const stripe = stripeClient ?? new Stripe(config.stripeSecretKey);
        const sub = await stripe.subscriptions.retrieve(
          session.subscription as string,
        );
        await upsertSubscription(supabase, sub, userId);
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.user_id;
      if (!userId) {
        logger.warn(`Stripe webhook: ${event.type} missing user_id metadata`);
        return;
      }
      await upsertSubscription(supabase, sub, userId);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.user_id;
      if (!userId) {
        logger.warn("Stripe webhook: customer.subscription.deleted missing user_id metadata");
        return;
      }
      await upsertSubscription(supabase, sub, userId);
      break;
    }

    case "invoice.payment_succeeded":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.subscription) {
        const stripe = stripeClient ?? new Stripe(config.stripeSecretKey);
        const sub = await stripe.subscriptions.retrieve(
          invoice.subscription as string,
        );
        const userId = sub.metadata?.user_id;
        if (!userId) {
          logger.warn(`Stripe webhook: ${event.type} subscription missing user_id metadata`);
          return;
        }
        await upsertSubscription(supabase, sub, userId);
      }
      break;
    }

    default:
      logger.info("Stripe webhook: unhandled event type", { type: event.type });
  }
}

export function createStripeWebhookRouter(): Router {
  const router = Router();

  router.post(
    "/stripe",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const stripe = new Stripe(config.stripeSecretKey);
      const sig = req.headers["stripe-signature"] as string;

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(
          req.body as Buffer,
          sig,
          config.stripeWebhookSecret,
        );
      } catch (err) {
        logger.error("Stripe webhook signature verification failed", {
          error: String(err),
        });
        res.status(400).json({ error: "Invalid signature" });
        return;
      }

      const supabase = createClient(
        config.supabaseUrl,
        config.supabaseServiceKey,
      );

      try {
        await handleWebhookEvent(event, supabase, stripe);
        res.json({ received: true });
      } catch (err) {
        logger.error("Stripe webhook processing failed", {
          error: String(err),
          type: event.type,
        });
        res.status(500).json({ error: "Webhook processing failed" });
      }
    },
  );

  return router;
}
