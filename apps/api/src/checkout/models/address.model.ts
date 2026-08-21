import { model, models, Schema, type Model, type Types } from "../../database/mongoose-runtime.js";

export interface CheckoutAddress {
  userId: Types.ObjectId;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  district: string;
  state: string;
  postalCode: string;
  country: string;
  type: "home" | "work" | "other";
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema<CheckoutAddress>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 16 },
    addressLine1: { type: String, required: true, trim: true, maxlength: 200 },
    addressLine2: { type: String, trim: true, maxlength: 200 },
    landmark: { type: String, trim: true, maxlength: 160 },
    city: { type: String, required: true, trim: true, maxlength: 100 },
    district: { type: String, required: true, trim: true, maxlength: 100 },
    state: { type: String, required: true, trim: true, maxlength: 100 },
    postalCode: { type: String, required: true, trim: true, maxlength: 12 },
    country: { type: String, required: true, trim: true, maxlength: 100 },
    type: { type: String, enum: ["home", "work", "other"], required: true, default: "home" },
    isDefault: { type: Boolean, required: true, default: false },
  },
  { strict: "throw", timestamps: true },
);
addressSchema.index({ userId: 1, updatedAt: -1 }, { name: "checkout_address_user" });
addressSchema.index(
  { userId: 1, isDefault: 1 },
  { name: "checkout_address_default", partialFilterExpression: { isDefault: true } },
);

export const CheckoutAddressModel: Model<CheckoutAddress> =
  models.CheckoutAddress ?? model<CheckoutAddress>("CheckoutAddress", addressSchema);
