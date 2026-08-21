import { model, models, Schema, type Model, type Types } from "../../database/mongoose-runtime.js";

export interface RefundRecord {
  orderId: Types.ObjectId;
  paymentId: Types.ObjectId;
  actorId: Types.ObjectId;
  provider: "razorpay" | "mock";
  providerPaymentId: string;
  providerRefundId: string;
  amountPaise: number;
  currency: "INR";
  reason: string;
  receipt: string;
  status: "pending" | "processed" | "failed";
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const refundSchema = new Schema<RefundRecord>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, immutable: true },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "PaymentRecord",
      required: true,
      immutable: true,
    },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    provider: {
      type: String,
      enum: ["razorpay", "mock"],
      required: true,
      immutable: true,
    },
    providerPaymentId: { type: String, required: true, trim: true, immutable: true },
    providerRefundId: { type: String, required: true, trim: true, immutable: true },
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isInteger,
      immutable: true,
    },
    currency: { type: String, enum: ["INR"], required: true, immutable: true },
    reason: { type: String, required: true, trim: true, maxlength: 500, immutable: true },
    receipt: { type: String, required: true, trim: true, maxlength: 40, immutable: true },
    status: {
      type: String,
      enum: ["pending", "processed", "failed"],
      required: true,
    },
    processedAt: Date,
  },
  { strict: "throw", timestamps: true },
);
refundSchema.index({ orderId: 1 }, { unique: true, name: "refund_order_unique" });
refundSchema.index(
  { provider: 1, providerRefundId: 1 },
  { unique: true, name: "refund_provider_id_unique" },
);

export const RefundRecordModel: Model<RefundRecord> =
  models.RefundRecord ?? model<RefundRecord>("RefundRecord", refundSchema);
