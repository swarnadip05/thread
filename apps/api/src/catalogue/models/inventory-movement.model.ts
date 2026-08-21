import { model, models, Schema, type Model, type Types } from "../../database/mongoose-runtime.js";

export interface InventoryMovement {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  type: "manual_adjustment" | "order_confirmed" | "return_restock";
  quantityDelta: number;
  stockBefore: number;
  stockAfter: number;
  reason: string;
  actorId?: Types.ObjectId;
  orderId?: Types.ObjectId;
  requestId?: string;
  createdAt: Date;
  updatedAt: Date;
}
const inventoryMovementSchema = new Schema<InventoryMovement>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, immutable: true },
    variantId: {
      type: Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
      immutable: true,
    },
    type: {
      type: String,
      enum: ["manual_adjustment", "order_confirmed", "return_restock"],
      required: true,
      immutable: true,
    },
    quantityDelta: {
      type: Number,
      required: true,
      validate: { validator: (value: number) => Number.isInteger(value) && value !== 0 },
    },
    stockBefore: { type: Number, required: true, min: 0 },
    stockAfter: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true, trim: true, minlength: 5, maxlength: 500 },
    actorId: { type: Schema.Types.ObjectId, ref: "User", immutable: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", immutable: true },
    requestId: { type: String, trim: true, maxlength: 128 },
  },
  { strict: "throw", timestamps: true },
);
inventoryMovementSchema.index(
  { variantId: 1, createdAt: -1 },
  { name: "inventory_variant_history" },
);
inventoryMovementSchema.index({ orderId: 1 }, { name: "inventory_order_history" });
inventoryMovementSchema.index(
  { productId: 1, createdAt: -1 },
  { name: "inventory_product_history" },
);
export const InventoryMovementModel: Model<InventoryMovement> =
  models.InventoryMovement ??
  model<InventoryMovement>("InventoryMovement", inventoryMovementSchema);
