import { model, models, Schema, type Model, type Types } from "../../database/mongoose-runtime.js";
import type { CheckoutPaymentMethod } from "@thread/types";

import {
  addressSnapshotSchema,
  orderItemSnapshotSchema,
  shippingSnapshotSchema,
  totalsSnapshotSchema,
  type AddressSnapshot,
  type OrderItemSnapshot,
  type ShippingSnapshot,
  type TotalsSnapshot,
} from "./checkout-shared.js";

export interface CheckoutSession {
  userId: Types.ObjectId;
  idempotencyKeyHash: string;
  status: "active" | "expired" | "cancelled" | "payment_failed" | "converted";
  expiresAt: Date;
  address: AddressSnapshot;
  shippingMethod: ShippingSnapshot;
  items: OrderItemSnapshot[];
  totals: TotalsSnapshot;
  couponId?: Types.ObjectId;
  couponCode?: string;
  paymentMethod: CheckoutPaymentMethod;
  policyAcceptedAt: Date;
  codConfirmationAcceptedAt?: Date;
  orderId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const checkoutSessionSchema = new Schema<CheckoutSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    idempotencyKeyHash: {
      type: String,
      required: true,
      immutable: true,
      select: false,
      maxlength: 64,
    },
    status: {
      type: String,
      enum: ["active", "expired", "cancelled", "payment_failed", "converted"],
      required: true,
      default: "active",
    },
    expiresAt: { type: Date, required: true },
    address: { type: addressSnapshotSchema, required: true },
    shippingMethod: { type: shippingSnapshotSchema, required: true },
    items: { type: [orderItemSnapshotSchema], required: true },
    totals: { type: totalsSnapshotSchema, required: true },
    couponId: { type: Schema.Types.ObjectId, ref: "Coupon" },
    couponCode: { type: String, trim: true, uppercase: true, maxlength: 40 },
    paymentMethod: {
      type: String,
      enum: ["payment_placeholder", "cod"],
      required: true,
    },
    policyAcceptedAt: { type: Date, required: true, immutable: true },
    codConfirmationAcceptedAt: { type: Date, immutable: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
  },
  { strict: "throw", timestamps: true },
);
checkoutSessionSchema.index(
  { userId: 1, idempotencyKeyHash: 1 },
  { unique: true, name: "checkout_user_idempotency_unique" },
);
checkoutSessionSchema.index(
  { status: 1, expiresAt: 1 },
  { name: "checkout_expiry_reconciliation" },
);

export const CheckoutSessionModel: Model<CheckoutSession> =
  models.CheckoutSession ?? model<CheckoutSession>("CheckoutSession", checkoutSessionSchema);
