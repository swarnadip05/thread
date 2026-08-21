import { model, models, Schema, type Model, type Types } from "../../database/mongoose-runtime.js";

export interface PaymentWebhookEvent {
  provider: "razorpay" | "mock";
  eventId: string;
  payloadHash: string;
  eventType: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  status: "processing" | "processed" | "ignored" | "failed";
  processedAt?: Date;
  failureCode?: string;
  relatedOrderId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const paymentWebhookEventSchema = new Schema<PaymentWebhookEvent>(
  {
    provider: { type: String, enum: ["razorpay", "mock"], required: true, immutable: true },
    eventId: { type: String, required: true, trim: true, maxlength: 255, immutable: true },
    payloadHash: { type: String, required: true, maxlength: 64, immutable: true },
    eventType: { type: String, required: true, trim: true, maxlength: 120, immutable: true },
    providerOrderId: { type: String, trim: true, maxlength: 255, immutable: true },
    providerPaymentId: { type: String, trim: true, maxlength: 255, immutable: true },
    status: {
      type: String,
      enum: ["processing", "processed", "ignored", "failed"],
      required: true,
      default: "processing",
    },
    processedAt: Date,
    failureCode: { type: String, trim: true, maxlength: 120 },
    relatedOrderId: { type: Schema.Types.ObjectId, ref: "Order" },
  },
  { strict: "throw", timestamps: true },
);
paymentWebhookEventSchema.index(
  { provider: 1, eventId: 1 },
  { unique: true, name: "payment_webhook_provider_event_unique" },
);
paymentWebhookEventSchema.index(
  { provider: 1, payloadHash: 1 },
  { unique: true, name: "payment_webhook_provider_payload_unique" },
);
paymentWebhookEventSchema.index(
  { status: 1, createdAt: 1 },
  { name: "payment_webhook_processing_queue" },
);

export const PaymentWebhookEventModel: Model<PaymentWebhookEvent> =
  models.PaymentWebhookEvent ??
  model<PaymentWebhookEvent>("PaymentWebhookEvent", paymentWebhookEventSchema);
