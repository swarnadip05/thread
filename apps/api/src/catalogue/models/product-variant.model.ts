import { model, models, Schema, type Model, type Types } from "../../database/mongoose-runtime.js";

export interface ProductVariant {
  productId: Types.ObjectId;
  sku: string;
  colour: string;
  colourHex?: string;
  size: string;
  attributes: Map<string, string>;
  mrpPaise: number;
  salePricePaise: number;
  taxRateBps: number | null;
  hsn: string | null;
  stockOnHand: number;
  stockReserved: number;
  reorderLevel: number;
  weightGrams: number;
  dimensionsMm?: { length: number; width: number; height: number };
  imagePublicIds: string[];
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

const productVariantSchema = new Schema<ProductVariant>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, immutable: true },
    sku: { type: String, required: true, trim: true, uppercase: true, maxlength: 64 },
    colour: { type: String, required: true, trim: true, maxlength: 80 },
    colourHex: { type: String, trim: true, match: /^#[0-9A-F]{6}$/i },
    size: { type: String, required: true, trim: true, maxlength: 32 },
    attributes: { type: Map, of: String, default: {} },
    mrpPaise: { type: Number, required: true, min: 0, validate: Number.isInteger },
    salePricePaise: { type: Number, required: true, min: 0, validate: Number.isInteger },
    taxRateBps: {
      type: Number,
      default: null,
      min: 0,
      max: 10_000,
      validate: { validator: (value: number | null) => value === null || Number.isInteger(value) },
    },
    hsn: { type: String, trim: true, maxlength: 16, default: null },
    stockOnHand: { type: Number, required: true, default: 0, min: 0, validate: Number.isInteger },
    stockReserved: { type: Number, required: true, default: 0, min: 0, validate: Number.isInteger },
    reorderLevel: { type: Number, required: true, default: 0, min: 0, validate: Number.isInteger },
    weightGrams: { type: Number, required: true, min: 1, max: 100_000, validate: Number.isInteger },
    dimensionsMm: {
      length: { type: Number, min: 1 },
      width: { type: Number, min: 1 },
      height: { type: Number, min: 1 },
    },
    imagePublicIds: [{ type: String, trim: true }],
    status: { type: String, enum: ["active", "inactive"], required: true, default: "active" },
  },
  { strict: "throw", timestamps: true },
);
productVariantSchema.path("salePricePaise").validate(function (
  this: ProductVariant,
  value: number,
) {
  return value <= this.mrpPaise;
}, "Sale price cannot exceed MRP.");
productVariantSchema.index({ sku: 1 }, { unique: true, name: "product_variant_sku_unique" });
productVariantSchema.index({ productId: 1, status: 1 }, { name: "variant_product_status" });
productVariantSchema.index(
  { size: 1, colour: 1, salePricePaise: 1, status: 1 },
  { name: "variant_catalogue_facets" },
);
productVariantSchema.index(
  { productId: 1, size: 1, colour: 1 },
  { unique: true, name: "variant_product_size_colour_unique" },
);
export const ProductVariantModel: Model<ProductVariant> =
  models.ProductVariant ?? model<ProductVariant>("ProductVariant", productVariantSchema);
