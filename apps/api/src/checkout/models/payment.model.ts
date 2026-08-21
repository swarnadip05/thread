import { model, models, Schema, type Model, type Types } from "../../database/mongoose-runtime.js";

export interface PaymentRecord {
  orderId: Types.ObjectId;
  checkoutSessionId: Types.ObjectId;
  userId: Types.ObjectId;
  provider: "razorpay" | "mock" | "cod";
  providerOrderId?: string;
  providerPaymentId?: string;
  amountPaise: number;
  currency: "INR";
  status:
    "awaiting_method" | "authorized" | "pending_verification" | "captured" | "failed" | "refunded";
  idempotencyKeyHash: string;
  creationToken?: string;
  creationStartedAt?: Date;
  signatureVerifiedAt?: Date;
  providerVerifiedAt?: Date;
  capturedAt?: Date;
  method?: string;
  amountRefundedPaise: number;
  failureCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<PaymentRecord>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, immutable: true },
    checkoutSessionId: {
      type: Schema.Types.ObjectId,
      ref: "CheckoutSession",
      required: true,
      immutable: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    provider: {
      type: String,
      enum: ["razorpay", "mock", "cod"],
      required: true,
      immutable: true,
    },
    providerOrderId: { type: String, trim: true, maxlength: 255 },
    providerPaymentId: { type: String, trim: true, maxlength: 255 },
    amountPaise: { type: Number, required: true, min: 0, validate: Number.isInteger },
    currency: { type: String, enum: ["INR"], required: true, default: "INR", immutable: true },
    status: {
      type: String,
      enum: [
        "awaiting_method",
        "authorized",
        "pending_verification",
        "captured",
        "failed",
        "refunded",
      ],
      required: true,
    },
    idempotencyKeyHash: {
      type: String,
      required: true,
      immutable: true,
      select: false,
      maxlength: 64,
    },
    creationToken: { type: String, select: false, maxlength: 64 },
    creationStartedAt: Date,
    signatureVerifiedAt: Date,
    providerVerifiedAt: Date,
    capturedAt: Date,
    method: { type: String, trim: true, maxlength: 64 },
    amountRefundedPaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: Number.isInteger,
    },
    failureCode: { type: String, trim: true, maxlength: 120 },
  },
  { strict: "throw", timestamps: true },
);
paymentSchema.index({ checkoutSessionId: 1 }, { unique: true, name: "payment_checkout_unique" });
paymentSchema.index(
  { provider: 1, providerOrderId: 1 },
  {
    unique: true,
    name: "payment_provider_order_unique",
    partialFilterExpression: { providerOrderId: { $type: "string" } },
  },
);
paymentSchema.index(
  { provider: 1, providerPaymentId: 1 },
  {
    unique: true,
    name: "payment_provider_payment_unique",
    partialFilterExpression: { providerPaymentId: { $type: "string" } },
  },
);
paymentSchema.index({ orderId: 1, createdAt: -1 }, { name: "payment_order_history" });

export const PaymentRecordModel: Model<PaymentRecord> =
  models.PaymentRecord ?? model<PaymentRecord>("PaymentRecord", paymentSchema);
