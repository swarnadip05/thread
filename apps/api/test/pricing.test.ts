import { describe, expect, it } from "vitest";

import {
  availableStock,
  couponDiscountPaise,
  couponIsEligible,
  hasAvailableStock,
  lineSubtotalPaise,
  moneyPaise,
  shippingChargePaise,
  taxForLinePaise,
} from "../src/checkout/pricing.js";

describe("integer-paise money", () => {
  it("calculates safe integer line totals and rejects fractional money", () => {
    expect(moneyPaise(59_900)).toBe(59_900);
    expect(lineSubtotalPaise(59_900, 3)).toBe(179_700);
    expect(() => moneyPaise(599.5)).toThrow(RangeError);
  });
});

describe("discounts and coupon eligibility", () => {
  it("caps percentage and fixed discounts without producing a negative subtotal", () => {
    expect(
      couponDiscountPaise(
        {
          discountType: "percentage",
          valueBps: 1_500,
          valuePaise: null,
          maximumDiscountPaise: 10_000,
        },
        100_000,
      ),
    ).toBe(10_000);
    expect(
      couponDiscountPaise(
        {
          discountType: "fixed",
          valueBps: null,
          valuePaise: 150_000,
          maximumDiscountPaise: null,
        },
        100_000,
      ),
    ).toBe(100_000);
  });

  it("requires the active window, spend, scope and usage limits", () => {
    const now = new Date("2026-07-27T12:00:00.000Z");
    const eligible = {
      active: true,
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: new Date("2027-01-01T00:00:00.000Z"),
      minimumSubtotalPaise: 50_000,
      scopeApplies: true,
      usageLimit: 100,
      redeemedCount: 10,
      perUserLimit: 1,
      priorUserUsage: 0,
    };
    expect(couponIsEligible(eligible, 75_000, now)).toBe(true);
    expect(couponIsEligible({ ...eligible, priorUserUsage: 1 }, 75_000, now)).toBe(false);
    expect(couponIsEligible({ ...eligible, scopeApplies: false }, 75_000, now)).toBe(false);
  });
});

describe("tax and shipping calculators", () => {
  it("rounds configured basis points and never invents tax when configuration is absent", () => {
    expect(taxForLinePaise(99_900, 500)).toBe(4_995);
    expect(taxForLinePaise(99_900, null)).toBe(0);
  });

  it("applies free shipping only after the configured threshold", () => {
    expect(shippingChargePaise(7_900, 150_000, 149_999)).toBe(7_900);
    expect(shippingChargePaise(7_900, 150_000, 150_000)).toBe(0);
    expect(shippingChargePaise(7_900, null, 999_999)).toBe(7_900);
  });
});

describe("stock availability", () => {
  it("uses on-hand minus reserved and does not expose a negative value", () => {
    expect(availableStock(10, 4)).toBe(6);
    expect(hasAvailableStock(10, 4, 6)).toBe(true);
    expect(hasAvailableStock(10, 4, 7)).toBe(false);
    expect(availableStock(2, 3)).toBe(0);
  });
});
