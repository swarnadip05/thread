import { Schema, type Types } from "mongoose";

export interface AddressSnapshot {
  sourceAddressId: Types.ObjectId;
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
}
export interface ShippingSnapshot {
  sourceShippingMethodId: Types.ObjectId;
  name: string;
  description: string;
  ratePaise: number;
  freeShippingThresholdPaise?: number;
  estimatedBusinessDaysMin?: number;
  estimatedBusinessDaysMax?: number;
  codEligible: boolean;
  active: boolean;
  sortOrder: number;
}
export interface OrderItemSnapshot {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  sku: string;
  title: string;
  slug: string;
  colour: string;
  size: string;
  quantity: number;
  mrpPaise: number;
  unitPricePaise: number;
  lineSubtotalPaise: number;
  taxRateBps?: number;
  taxPaise: number;
  imageUrl?: string;
  imageAlt?: string;
  priceChanged: boolean;
}
export interface TotalsSnapshot {
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  taxPaise: number;
  totalPaise: number;
}

const integerMoney = { type: Number, required: true, min: 0, validate: Number.isInteger };
export const addressSnapshotSchema = new Schema<AddressSnapshot>(
  {
    sourceAddressId: { type: Schema.Types.ObjectId, required: true, immutable: true },
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
    type: { type: String, enum: ["home", "work", "other"], required: true },
    isDefault: { type: Boolean, required: true },
  },
  { _id: false, strict: "throw" },
);
export const shippingSnapshotSchema = new Schema<ShippingSnapshot>(
  {
    sourceShippingMethodId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, required: true, trim: true, maxlength: 240 },
    ratePaise: integerMoney,
    freeShippingThresholdPaise: { type: Number, min: 0 },
    estimatedBusinessDaysMin: { type: Number, min: 1, max: 90 },
    estimatedBusinessDaysMax: { type: Number, min: 1, max: 90 },
    codEligible: { type: Boolean, required: true },
    active: { type: Boolean, required: true },
    sortOrder: { type: Number, required: true, min: 0 },
  },
  { _id: false, strict: "throw" },
);
export const orderItemSnapshotSchema = new Schema<OrderItemSnapshot>(
  {
    productId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    variantId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    sku: { type: String, required: true, trim: true, maxlength: 64 },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    slug: { type: String, required: true, trim: true, maxlength: 160 },
    colour: { type: String, required: true, trim: true, maxlength: 80 },
    size: { type: String, required: true, trim: true, maxlength: 32 },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
    mrpPaise: integerMoney,
    unitPricePaise: integerMoney,
    lineSubtotalPaise: integerMoney,
    taxRateBps: { type: Number, min: 0, max: 10_000 },
    taxPaise: integerMoney,
    imageUrl: { type: String, trim: true, maxlength: 2_048 },
    imageAlt: { type: String, trim: true, maxlength: 240 },
    priceChanged: { type: Boolean, required: true },
  },
  { _id: false, strict: "throw" },
);
export const totalsSnapshotSchema = new Schema<TotalsSnapshot>(
  {
    subtotalPaise: integerMoney,
    discountPaise: integerMoney,
    shippingPaise: integerMoney,
    taxPaise: integerMoney,
    totalPaise: integerMoney,
  },
  { _id: false, strict: "throw" },
);
