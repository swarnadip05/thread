import { model, models, Schema, type Model } from "../../database/mongoose-runtime.js";

export interface ShippingMethod {
  name: string;
  description: string;
  ratePaise: number;
  freeShippingThresholdPaise: number | null;
  estimatedBusinessDaysMin: number | null;
  estimatedBusinessDaysMax: number | null;
  countries: string[];
  postalPrefixes: string[];
  codEligible: boolean;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const shippingMethodSchema = new Schema<ShippingMethod>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, required: true, trim: true, maxlength: 240 },
    ratePaise: { type: Number, required: true, min: 0, validate: Number.isInteger },
    freeShippingThresholdPaise: {
      type: Number,
      default: null,
      min: 0,
      validate: { validator: (value: number | null) => value === null || Number.isInteger(value) },
    },
    estimatedBusinessDaysMin: { type: Number, default: null, min: 1, max: 90 },
    estimatedBusinessDaysMax: { type: Number, default: null, min: 1, max: 90 },
    countries: [{ type: String, required: true, trim: true, maxlength: 100 }],
    postalPrefixes: [{ type: String, trim: true, maxlength: 12 }],
    codEligible: { type: Boolean, required: true, default: false },
    active: { type: Boolean, required: true, default: true },
    sortOrder: { type: Number, required: true, default: 0, min: 0 },
  },
  { strict: "throw", timestamps: true },
);
shippingMethodSchema.index({ active: 1, sortOrder: 1 }, { name: "shipping_method_public" });

export const ShippingMethodModel: Model<ShippingMethod> =
  models.ShippingMethod ?? model<ShippingMethod>("ShippingMethod", shippingMethodSchema);
