import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/config.js", () => ({
  config: {
    stripeSecretKey: "sk_test_fake",
    stripeWebhookSecret: "whsec_fake",
    stripePriceId: "price_fake",
  },
}));
vi.mock("../../src/utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { handleWebhookEvent } from "../../src/routes/stripe-webhooks.js";
import type Stripe from "stripe";

function createMockSupabase() {
  const fromCalls: Array<{ table: string; chain: any }> = [];

  const from = vi.fn((table: string) => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    };
    fromCalls.push({ table, chain });
    return chain;
  });

  return { from, fromCalls };
}

describe("handleWebhookEvent", () => {
  it("checkout.session.completed — updates user stripe_customer_id and upserts subscription", async () => {
    const { from, fromCalls } = createMockSupabase();

    const event = {
      type: "checkout.session.completed",
      data: {
        object: {
          customer: "cus_123",
          subscription: "sub_456",
          metadata: { user_id: "user_abc" },
        },
      },
    } as unknown as Stripe.Event;

    const mockStripe = {
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          id: "sub_456",
          customer: "cus_123",
          status: "active",
          current_period_start: 1700000000,
          current_period_end: 1702592000,
          trial_end: null,
          cancel_at_period_end: false,
          canceled_at: null,
          metadata: { user_id: "user_abc" },
        }),
      },
    };

    await handleWebhookEvent(event, { from } as any, mockStripe as any);

    // Should call from("users") to update stripe_customer_id
    const usersCall = fromCalls.find((c) => c.table === "users");
    expect(usersCall).toBeDefined();
    expect(usersCall!.chain.update).toHaveBeenCalledWith({
      stripe_customer_id: "cus_123",
    });
    expect(usersCall!.chain.eq).toHaveBeenCalledWith("id", "user_abc");

    // Should call from("subscriptions") to upsert
    const subsCall = fromCalls.find((c) => c.table === "subscriptions");
    expect(subsCall).toBeDefined();
    expect(subsCall!.chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "sub_456",
        user_id: "user_abc",
        stripe_customer_id: "cus_123",
        status: "active",
        cancel_at_period_end: false,
      }),
      { onConflict: "id" },
    );
  });

  it("customer.subscription.updated — upserts subscription with correct fields", async () => {
    const { from, fromCalls } = createMockSupabase();

    const event = {
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_456",
          customer: "cus_123",
          status: "active",
          current_period_start: 1700000000,
          current_period_end: 1702592000,
          trial_end: 1701000000,
          cancel_at_period_end: false,
          canceled_at: null,
          metadata: { user_id: "user_abc" },
        },
      },
    } as unknown as Stripe.Event;

    await handleWebhookEvent(event, { from } as any);

    const subsCall = fromCalls.find((c) => c.table === "subscriptions");
    expect(subsCall).toBeDefined();
    expect(subsCall!.chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "sub_456",
        user_id: "user_abc",
        stripe_customer_id: "cus_123",
        status: "active",
        trial_end: new Date(1701000000 * 1000).toISOString(),
        cancel_at_period_end: false,
        canceled_at: null,
      }),
      { onConflict: "id" },
    );
  });

  it("customer.subscription.deleted — upserts with canceled status", async () => {
    const { from, fromCalls } = createMockSupabase();

    const event = {
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_456",
          customer: "cus_123",
          status: "canceled",
          current_period_start: 1700000000,
          current_period_end: 1702592000,
          trial_end: null,
          cancel_at_period_end: false,
          canceled_at: 1701500000,
          metadata: { user_id: "user_abc" },
        },
      },
    } as unknown as Stripe.Event;

    await handleWebhookEvent(event, { from } as any);

    const subsCall = fromCalls.find((c) => c.table === "subscriptions");
    expect(subsCall).toBeDefined();
    expect(subsCall!.chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "sub_456",
        status: "canceled",
        canceled_at: new Date(1701500000 * 1000).toISOString(),
      }),
      { onConflict: "id" },
    );
  });
});
