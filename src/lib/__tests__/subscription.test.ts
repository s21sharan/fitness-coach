import { describe, it, expect } from "vitest";
import { deriveSubscriptionState, SubscriptionRow } from "../subscription";

const baseRow: SubscriptionRow = {
  id: "sub_123",
  user_id: "user_abc",
  stripe_customer_id: "cus_xyz",
  status: "active",
  current_period_start: "2026-05-01T00:00:00Z",
  current_period_end: "2026-06-01T00:00:00Z",
  trial_end: null,
  cancel_at_period_end: false,
  canceled_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-05-01T00:00:00Z",
};

describe("deriveSubscriptionState", () => {
  it("returns inactive when row is null", () => {
    const result = deriveSubscriptionState(null);
    expect(result).toEqual({ active: false });
  });

  it("returns active state for status=active", () => {
    const result = deriveSubscriptionState({ ...baseRow, status: "active" });
    expect(result).toEqual({
      active: true,
      status: "active",
      trialEnd: null,
      periodEnd: "2026-06-01T00:00:00Z",
      cancelAtPeriodEnd: false,
    });
  });

  it("returns active state for status=trialing", () => {
    const row: SubscriptionRow = {
      ...baseRow,
      status: "trialing",
      trial_end: "2026-06-15T00:00:00Z",
    };
    const result = deriveSubscriptionState(row);
    expect(result).toEqual({
      active: true,
      status: "trialing",
      trialEnd: "2026-06-15T00:00:00Z",
      periodEnd: "2026-06-01T00:00:00Z",
      cancelAtPeriodEnd: false,
    });
  });

  it("returns active state for status=past_due", () => {
    const result = deriveSubscriptionState({ ...baseRow, status: "past_due" });
    expect(result).toEqual({
      active: true,
      status: "past_due",
      trialEnd: null,
      periodEnd: "2026-06-01T00:00:00Z",
      cancelAtPeriodEnd: false,
    });
  });

  it("returns inactive for status=canceled", () => {
    const result = deriveSubscriptionState({
      ...baseRow,
      status: "canceled",
      canceled_at: "2026-04-15T00:00:00Z",
    });
    expect(result).toEqual({ active: false });
  });

  it("returns inactive for status=incomplete", () => {
    const result = deriveSubscriptionState({ ...baseRow, status: "incomplete" });
    expect(result).toEqual({ active: false });
  });

  it("reflects cancelAtPeriodEnd=true in active state", () => {
    const result = deriveSubscriptionState({
      ...baseRow,
      status: "active",
      cancel_at_period_end: true,
    });
    expect(result).toEqual({
      active: true,
      status: "active",
      trialEnd: null,
      periodEnd: "2026-06-01T00:00:00Z",
      cancelAtPeriodEnd: true,
    });
  });
});
