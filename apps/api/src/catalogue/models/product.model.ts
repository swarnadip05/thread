import { model, models, Schema, type Model, type Types } from "../../database/mongoose-runtime.js";
import type { ProductAudience, ProductStatus } from "@thread/types";

export interface ProductMedia {
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
  format: "jpg" | "jpeg" | "png" | "webp" | "avif";
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/avif";
  bytes: number;
  alt: string;
  sortOrder: number;
  primary: boolean;
}
export interface Product {
  title: string;
  slug: string;
  previousSlugs: string[];
  shortDescription: string;
  descriptionHtml: string;
  categoryIds: Types.ObjectId[];
  collectionIds: Types.ObjectId[];
  audience: ProductAudience;
  brand: string;
  tags: string[];
  media: ProductMedia[];
  fit?: string;
  material?: string | null;
  care: string[];
  status: ProductStatus;
  featured: boolean;
  newArrival?: boolean;
  seo: { title?: string; description?: string; noIndex: boolean };
  rating: { average: number; count: number };
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const mediaSchema = new Schema<ProductMedia>(
  {
    publicId: { type: String, required: true, trim: true },
    secureUrl: { type: String, required: true, trim: true },
    width: { type: Number, required: true, min: 300, max: 12_000 },
    height: { type: Number, required: true, min: 300, max: 12_000 },
    format: { type: String, enum: ["jpg", "jpeg", "png", "webp", "avif"], required: true },
    mimeType: {
      type: String,
      enum: ["image/jpeg", "image/png", "image/webp", "image/avif"],
      required: true,
    },
    bytes: { type: Number, required: true, min: 1, max: 15_000_000 },
    alt: { type: String, required: true, trim: true, maxlength: 240 },
    sortOrder: { type: Number, required: true, min: 0 },
    primary: { type: Boolean, required: true, default: false },
  },
  { _id: false, strict: "throw" },
);

const productSchema = new Schema<Product>(
  {
    title: { type: String, required: true, trim: true, maxlength: 180 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    previousSlugs: [{ type: String, trim: true, lowercase: true, maxlength: 160 }],
    shortDescription: { type: String, required: true, trim: true, maxlength: 320 },
    descriptionHtml: { type: String, required: true, maxlength: 50_000 },
    categoryIds: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    collectionIds: [{ type: Schema.Types.ObjectId, ref: "Collection" }],
    audience: { type: String, enum: ["men", "women", "unisex", "accessories"], required: true },
    brand: { type: String, required: true, trim: true, maxlength: 100 },
    tags: [{ type: String, trim: true, maxlength: 60 }],
    media: { type: [mediaSchema], default: [] },
    fit: { type: String, trim: true, maxlength: 80 },
    material: { type: String, trim: true, maxlength: 240, default: null },
    care: [{ type: String, trim: true, maxlength: 240 }],
    status: {
      type: String,
      enum: ["draft", "active", "inactive", "archived"],
      required: true,
      default: "draft",
    },
    featured: { type: Boolean, required: true, default: false },
    newArrival: { type: Boolean, default: false },
    seo: {
      title: { type: String, trim: true, maxlength: 70 },
      description: { type: String, trim: true, maxlength: 180 },
      noIndex: { type: Boolean, required: true, default: false },
    },
    rating: {
      average: { type: Number, required: true, default: 0, min: 0, max: 5 },
      count: { type: Number, required: true, default: 0, min: 0 },
    },
    publishedAt: Date,
  },
  { strict: "throw", timestamps: true },
);
productSchema.index({ slug: 1 }, { unique: true, name: "product_slug_unique" });
productSchema.index(
  { previousSlugs: 1, status: 1, publishedAt: -1 },
  { name: "product_previous_slug" },
);
productSchema.index(
  { title: "text", shortDescription: "text", tags: "text", brand: "text" },
  {
    weights: { title: 10, tags: 5, brand: 3, shortDescription: 2 },
    name: "product_catalogue_search",
  },
);
productSchema.index(
  { status: 1, publishedAt: -1, audience: 1 },
  { name: "product_public_listing" },
);
productSchema.index({ categoryIds: 1, status: 1 }, { name: "product_category_status" });
productSchema.index({ collectionIds: 1, status: 1 }, { name: "product_collection_status" });
productSchema.index({ "media.publicId": 1 }, { name: "product_media_reference" });
export const ProductModel: Model<Product> =
  models.Product ?? model<Product>("Product", productSchema);
