import { model, models, Schema, type Model, type Types } from "../../database/mongoose-runtime.js";

export interface OrderNote {
  orderId: Types.ObjectId;
  actorId: Types.ObjectId;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<OrderNote>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, immutable: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    body: { type: String, required: true, trim: true, maxlength: 2_000 },
  },
  { strict: "throw", timestamps: true },
);
schema.index({ orderId: 1, createdAt: -1 }, { name: "order_internal_notes" });
export const OrderNoteModel: Model<OrderNote> =
  models.OrderNote ?? model<OrderNote>("OrderNote", schema);
