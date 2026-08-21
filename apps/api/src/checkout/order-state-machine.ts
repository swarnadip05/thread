import type { OrderStatus } from "@thread/types";

export const orderTransitions: Readonly<Partial<Record<OrderStatus, readonly OrderStatus[]>>> = {
  pending_payment: ["payment_failed", "confirmed", "cancelled"],
  payment_failed: ["pending_payment", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
  delivered: ["return_requested"],
  return_requested: ["returned"],
  returned: ["refunded"],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return orderTransitions[from]?.includes(to) ?? false;
}

export function isSafeBulkTransition(from: OrderStatus, to: OrderStatus): boolean {
  return (
    (from === "confirmed" && to === "processing") || (from === "processing" && to === "packed")
  );
}
