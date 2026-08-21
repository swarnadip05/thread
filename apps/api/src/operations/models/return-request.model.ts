import { model, models, Schema, type Model, type Types } from "../../database/mongoose-runtime.js";
import type { ReturnRequestStatus } from "@thread/types";

export interface ReturnRequest {
  requestNumber: string;
  orderId: Types.ObjectId;
  userId: Types.ObjectId;
  requestType: "return" | "exchange";
  reason: string;
  itemVariantIds: Types.ObjectId[];
  imageUrls: string[];
  status: ReturnRequestStatus;
  decisionReason?: string;
  pickupCarrier?: string;
  pickupTrackingNumber?: string;
  pickupTrackingUrl?: string;
  inspectionNotes?: string;
  refundId?: Types.ObjectId;
  replacementOrderId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const statuses: ReturnRequestStatus[] = [
  "requested",
  "approved",
  "rejected",
  "pickup_scheduled",
  "in_transit",
  "received",
  "inspection_approved",
  "inspection_rejected",
  "refund_pending",
  "refunded",
  "replacement_created",
  "closed",
];
const schema = new Schema<ReturnRequest>(
  {
    requestNumber: { type: String, required: true, immutable: true, uppercase: true, trim: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, immutable: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    requestType: { type: String, enum: ["return", "exchange"], required: true, immutable: true },
    reason: { type: String, required: true, immutable: true, trim: true, maxlength: 1_000 },
    itemVariantIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "ProductVariant" }],
      required: true,
      immutable: true,
    },
    imageUrls: {
      type: [String],
      default: [],
      validate: {
        validator: (values: string[]) =>
          values.length <= 5 && values.every((value) => value.startsWith("https://")),
        message: "Return images must be HTTPS URLs.",
      },
    },
    status: { type: String, enum: statuses, required: true, default: "requested" },
    decisionReason: { type: String, trim: true, maxlength: 1_000 },
    pickupCarrier: { type: String, trim: true, maxlength: 100 },
    pickupTrackingNumber: { type: String, trim: true, maxlength: 100 },
    pickupTrackingUrl: { type: String, trim: true, maxlength: 500 },
    inspectionNotes: { type: String, trim: true, maxlength: 1_000 },
    refundId: { type: Schema.Types.ObjectId, ref: "RefundRecord" },
    replacementOrderId: { type: Schema.Types.ObjectId, ref: "Order" },
  },
  { strict: "throw", timestamps: true },
);
schema.index({ requestNumber: 1 }, { unique: true, name: "return_request_number_unique" });
schema.index({ orderId: 1, userId: 1 }, { unique: true, name: "return_order_user_unique" });
schema.index({ status: 1, createdAt: -1 }, { name: "return_admin_queue" });
schema.index({ userId: 1, createdAt: -1 }, { name: "return_customer_history" });

export const ReturnRequestModel: Model<ReturnRequest> =
  models.ReturnRequest ?? model<ReturnRequest>("ReturnRequest", schema);
