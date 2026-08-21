import { model, models, Schema, type Model, type Types } from "../../database/mongoose-runtime.js";

export interface Coupon {
  code: string;
  description: string;
  discountType: "fixed" | "percentage";
  valuePaise: number | null;
  valueBps: number | null;
  minimumSubtotalPaise: number;
  maximumDiscountPaise: number | null;
  startsAt: Date;
  endsAt: Date;
  usageLimit: number | null;
  redeemedCount: number;
  perUserLimit: number;
  categoryIds: Types.ObjectId[];
  productIds: Types.ObjectId[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const couponSchema = new Schema<Coupon>(
  {
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    description: { type: String, trim: true, maxlength: 240, default: "" },
    discountType: { type: String, enum: ["fixed", "percentage"], required: true },
    valuePaise: { type: Number, default: null, min: 1 },
    valueBps: { type: Number, default: null, min: 1, max: 10_000 },
    minimumSubtotalPaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: Number.isInteger,
    },
    maximumDiscountPaise: { type: Number, default: null, min: 1 },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    usageLimit: { type: Number, default: null, min: 1 },
    redeemedCount: { type: Number, required: true, default: 0, min: 0 },
    perUserLimit: { type: Number, required: true, default: 1, min: 1 },
    categoryIds: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    productIds: [{ type: Schema.Types.ObjectId, ref: "Product" }],
    active: { type: Boolean, required: true, default: true },
  },
  { strict: "throw", timestamps: true },
);
couponSchema.index({ code: 1 }, { unique: true, name: "coupon_code_unique" });
couponSchema.index({ active: 1, startsAt: 1, endsAt: 1 }, { name: "coupon_validity" });
couponSchema.index({ categoryIds: 1, active: 1 }, { name: "coupon_category_scope" });
couponSchema.index({ productIds: 1, active: 1 }, { name: "coupon_product_scope" });

export const CouponModel: Model<Coupon> = models.Coupon ?? model<Coupon>("Coupon", couponSchema);
