import { model, models, Schema, type Model, type Types } from "../../database/mongoose-runtime.js";

export interface StockReservation {
  checkoutSessionId: Types.ObjectId;
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  quantity: number;
  status: "active" | "released" | "committed";
  expiresAt: Date;
  releasedAt?: Date;
  releaseReason?: "expired" | "cancelled" | "payment_failed";
  committedAt?: Date;
  orderId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const stockReservationSchema = new Schema<StockReservation>(
  {
    checkoutSessionId: {
      type: Schema.Types.ObjectId,
      ref: "CheckoutSession",
      required: true,
      immutable: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, immutable: true },
    variantId: {
      type: Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
      immutable: true,
    },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger, immutable: true },
    status: {
      type: String,
      enum: ["active", "released", "committed"],
      required: true,
      default: "active",
    },
    expiresAt: { type: Date, required: true },
    releasedAt: Date,
    releaseReason: { type: String, enum: ["expired", "cancelled", "payment_failed"] },
    committedAt: Date,
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
  },
  { strict: "throw", timestamps: true },
);
stockReservationSchema.index(
  { checkoutSessionId: 1, variantId: 1 },
  { unique: true, name: "reservation_session_variant_unique" },
);
stockReservationSchema.index(
  { status: 1, expiresAt: 1 },
  { name: "reservation_expiry_reconciliation" },
);
stockReservationSchema.index({ variantId: 1, status: 1 }, { name: "reservation_variant_status" });

export const StockReservationModel: Model<StockReservation> =
  models.StockReservation ?? model<StockReservation>("StockReservation", stockReservationSchema);
