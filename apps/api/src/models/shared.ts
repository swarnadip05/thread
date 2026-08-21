import { Schema, type InferSchemaType } from "mongoose";

export const mediaAssetSchema = new Schema(
  {
    url: { type: String, required: true, trim: true },
    publicId: { type: String, trim: true },
    alt: { type: String, required: true, trim: true, maxlength: 240 },
    width: { type: Number, min: 1 },
    height: { type: Number, min: 1 },
    sortOrder: { type: Number, default: 0, min: 0 },
  },
  { _id: false, strict: "throw" },
);

export const seoSchema = new Schema(
  {
    title: { type: String, trim: true, maxlength: 70 },
    description: { type: String, trim: true, maxlength: 180 },
    canonicalUrl: { type: String, trim: true },
    noIndex: { type: Boolean, default: false },
  },
  { _id: false, strict: "throw" },
);

export type MediaAsset = InferSchemaType<typeof mediaAssetSchema>;
export type SeoFields = InferSchemaType<typeof seoSchema>;
