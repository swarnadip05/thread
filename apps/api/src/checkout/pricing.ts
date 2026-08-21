export interface CouponCalculation {
  readonly discountType: "fixed" | "percentage";
  readonly maximumDiscountPaise: number | null;
  readonly valueBps: number | null;
  readonly valuePaise: number | null;
}

export interface CouponEligibility {
  readonly active: boolean;
  readonly endsAt: Date;
  readonly minimumSubtotalPaise: number;
  readonly perUserLimit: number;
  readonly priorUserUsage: number;
  readonly redeemedCount: number;
  readonly scopeApplies: boolean;
  readonly startsAt: Date;
  readonly usageLimit: number | null;
}

function requireInteger(value: number, field: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || value < minimum)
    throw new RangeError(`${field} must be a safe integer greater than or equal to ${minimum}.`);
  return value;
}

/** Money enters domain calculations only as integer paise. */
export function moneyPaise(value: number): number {
  return requireInteger(value, "Money");
}

export function lineSubtotalPaise(unitPricePaise: number, quantity: number): number {
  requireInteger(unitPricePaise, "Unit price");
  requireInteger(quantity, "Quantity", 1);
  const total = unitPricePaise * quantity;
  if (!Number.isSafeInteger(total)) throw new RangeError("Line subtotal exceeds the safe range.");
  return total;
}

export function percentageOfPaise(amountPaise: number, rateBps: number): number {
  requireInteger(amountPaise, "Amount");
  requireInteger(rateBps, "Rate");
  if (rateBps > 10_000) throw new RangeError("Rate cannot exceed 10,000 basis points.");
  return Math.round((amountPaise * rateBps) / 10_000);
}

export function taxForLinePaise(linePaise: number, taxRateBps: number | null): number {
  return taxRateBps === null ? 0 : percentageOfPaise(linePaise, taxRateBps);
}

export function couponDiscountPaise(coupon: CouponCalculation, subtotalPaise: number): number {
  requireInteger(subtotalPaise, "Subtotal");
  const raw =
    coupon.discountType === "fixed"
      ? moneyPaise(coupon.valuePaise ?? 0)
      : percentageOfPaise(subtotalPaise, coupon.valueBps ?? 0);
  const maximum =
    coupon.maximumDiscountPaise === null ? raw : moneyPaise(coupon.maximumDiscountPaise);
  return Math.min(subtotalPaise, maximum, raw);
}

export function couponIsEligible(
  coupon: CouponEligibility,
  subtotalPaise: number,
  now: Date,
): boolean {
  return (
    coupon.active &&
    coupon.startsAt <= now &&
    coupon.endsAt > now &&
    subtotalPaise >= coupon.minimumSubtotalPaise &&
    coupon.scopeApplies &&
    (coupon.usageLimit === null || coupon.redeemedCount < coupon.usageLimit) &&
    coupon.priorUserUsage < coupon.perUserLimit
  );
}

export function shippingChargePaise(
  ratePaise: number,
  freeShippingThresholdPaise: number | null,
  discountedSubtotalPaise: number,
): number {
  moneyPaise(ratePaise);
  moneyPaise(discountedSubtotalPaise);
  if (
    freeShippingThresholdPaise !== null &&
    discountedSubtotalPaise >= moneyPaise(freeShippingThresholdPaise)
  )
    return 0;
  return ratePaise;
}

export function availableStock(stockOnHand: number, stockReserved: number): number {
  requireInteger(stockOnHand, "Stock on hand");
  requireInteger(stockReserved, "Reserved stock");
  return Math.max(0, stockOnHand - stockReserved);
}

export function hasAvailableStock(
  stockOnHand: number,
  stockReserved: number,
  requestedQuantity: number,
): boolean {
  requireInteger(requestedQuantity, "Requested quantity", 1);
  return availableStock(stockOnHand, stockReserved) >= requestedQuantity;
}
