import { model, models, Schema, type Model, type Types } from "../../database/mongoose-runtime.js";
import type { CheckoutPaymentMethod, OrderStatus } from "@thread/types";

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

export interface Order {
  orderNumber: string;
  userId: Types.ObjectId;
  checkoutSessionId: Types.ObjectId;
  status: OrderStatus;
  address: AddressSnapshot;
  shippingMethod: ShippingSnapshot;
  items: OrderItemSnapshot[];
  totals: TotalsSnapshot;
  couponId?: Types.ObjectId;
  couponCode?: string;
  paymentMethod: CheckoutPaymentMethod;
  trackingCarrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  deliveredAt?: Date;
  statusHistory: Array<{ status: OrderStatus; at: Date; actorId?: Types.ObjectId; note?: string }>;
  createdAt: Date;
  updatedAt: Date;
}

const statusValues: OrderStatus[] = [
  "pending_payment",
  "payment_failed",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "return_requested",
  "returned",
  "refunded",
];
const orderSchema = new Schema<Order>(
  {
    orderNumber: { type: String, required: true, trim: true, uppercase: true, immutable: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    checkoutSessionId: {
      type: Schema.Types.ObjectId,
      ref: "CheckoutSession",
      required: true,
      immutable: true,
    },
    status: { type: String, enum: statusValues, required: true },
    address: { type: addressSnapshotSchema, required: true, immutable: true },
    shippingMethod: { type: shippingSnapshotSchema, required: true, immutable: true },
    items: { type: [orderItemSnapshotSchema], required: true, immutable: true },
    totals: { type: totalsSnapshotSchema, required: true, immutable: true },
    couponId: { type: Schema.Types.ObjectId, ref: "Coupon", immutable: true },
    couponCode: { type: String, trim: true, uppercase: true, maxlength: 40, immutable: true },
    paymentMethod: {
      type: String,
      enum: ["payment_placeholder", "cod"],
      required: true,
      immutable: true,
    },
    trackingCarrier: { type: String, trim: true, maxlength: 100 },
    trackingNumber: { type: String, trim: true, maxlength: 100 },
    trackingUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      validate: {
        validator: (value: string | undefined) => !value || value.startsWith("https://"),
        message: "Tracking links must use HTTPS.",
      },
    },
    deliveredAt: Date,
    statusHistory: [
      {
        _id: false,
        status: { type: String, enum: statusValues, required: true },
        at: { type: Date, required: true },
        actorId: { type: Schema.Types.ObjectId, ref: "User" },
        note: { type: String, trim: true, maxlength: 500 },
      },
    ],
  },
  { strict: "throw", timestamps: true },
);
orderSchema.index({ orderNumber: 1 }, { unique: true, name: "order_number_unique" });
orderSchema.index(
  { checkoutSessionId: 1 },
  { unique: true, name: "order_checkout_session_unique" },
);
orderSchema.index({ userId: 1, createdAt: -1 }, { name: "order_user_history" });
orderSchema.index({ status: 1, updatedAt: -1 }, { name: "order_status_queue" });

export const OrderModel: Model<Order> = models.Order ?? model<Order>("Order", orderSchema);

interface OrderSequence {
  key: string;
  value: number;
}
const sequenceSchema = new Schema<OrderSequence>(
  {
    key: { type: String, required: true, immutable: true },
    value: { type: Number, required: true, default: 0, min: 0 },
  },
  { strict: "throw", timestamps: true },
);
sequenceSchema.index({ key: 1 }, { unique: true, name: "order_sequence_key_unique" });
export const OrderSequenceModel: Model<OrderSequence> =
  models.OrderSequence ?? model<OrderSequence>("OrderSequence", sequenceSchema);
