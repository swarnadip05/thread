import { model, models, Schema, type Model } from "../database/mongoose-runtime.js";
import type { HomepageSectionType } from "@thread/types";

export interface HomepageImageRecord {
  source: "local" | "cloudinary";
  src: string;
  publicId?: string;
  width: number;
  height: number;
  format?: "jpg" | "jpeg" | "png" | "webp" | "avif";
  mimeType?: "image/jpeg" | "image/png" | "image/webp" | "image/avif";
  bytes?: number;
  alt: string;
}

export interface HomepageItemRecord {
  id: string;
  title: string;
  subtitle?: string;
  body?: string;
  href?: string;
  image?: HomepageImageRecord;
  icon?: "card" | "headphones" | "truck" | "refresh" | "instagram";
}

export interface HomepageSectionRecord {
  id: string;
  type: HomepageSectionType;
  enabled: boolean;
  sortOrder: number;
  startsAt?: Date;
  endsAt?: Date;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  body?: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  desktopImage?: HomepageImageRecord;
  mobileImage?: HomepageImageRecord;
  collectionSlugs: string[];
  items: HomepageItemRecord[];
  needsClientReview: boolean;
}

export interface HomepageVersionRecord {
  version: number;
  sections: HomepageSectionRecord[];
  updatedAt: Date;
}

export interface HomepageContentRecord {
  key: "default";
  draft: HomepageVersionRecord;
  published: HomepageVersionRecord;
  createdAt: Date;
  updatedAt: Date;
}

const homepageImageSchema = new Schema<HomepageImageRecord>(
  {
    source: { type: String, enum: ["local", "cloudinary"], required: true },
    src: { type: String, required: true, trim: true, maxlength: 2_000 },
    publicId: { type: String, trim: true, maxlength: 255 },
    width: { type: Number, required: true, min: 300, max: 12_000 },
    height: { type: Number, required: true, min: 300, max: 12_000 },
    format: { type: String, enum: ["jpg", "jpeg", "png", "webp", "avif"] },
    mimeType: { type: String, enum: ["image/jpeg", "image/png", "image/webp", "image/avif"] },
    bytes: { type: Number, min: 1, max: 15_000_000 },
    alt: { type: String, required: true, trim: true, maxlength: 240 },
  },
  { _id: false, strict: "throw" },
);

const homepageItemSchema = new Schema<HomepageItemRecord>(
  {
    id: { type: String, required: true, trim: true, maxlength: 80 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    subtitle: { type: String, trim: true, maxlength: 240 },
    body: { type: String, trim: true, maxlength: 600 },
    href: { type: String, trim: true, maxlength: 500 },
    image: homepageImageSchema,
    icon: {
      type: String,
      enum: ["card", "headphones", "truck", "refresh", "instagram"],
    },
  },
  { _id: false, strict: "throw" },
);

const homepageLinkSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 80 },
    href: { type: String, required: true, trim: true, maxlength: 500 },
  },
  { _id: false, strict: "throw" },
);

const homepageSectionSchema = new Schema<HomepageSectionRecord>(
  {
    id: { type: String, required: true, trim: true, maxlength: 80 },
    type: {
      type: String,
      enum: [
        "announcement",
        "hero",
        "audience_cards",
        "new_arrivals",
        "best_sellers",
        "categories",
        "collections",
        "offer",
        "editorial",
        "brand_values",
        "trust_features",
        "newsletter",
        "social",
      ],
      required: true,
    },
    enabled: { type: Boolean, required: true, default: true },
    sortOrder: { type: Number, required: true, min: 0 },
    startsAt: Date,
    endsAt: Date,
    eyebrow: { type: String, trim: true, maxlength: 80 },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    subtitle: { type: String, trim: true, maxlength: 320 },
    body: { type: String, trim: true, maxlength: 1_200 },
    primaryCta: homepageLinkSchema,
    secondaryCta: homepageLinkSchema,
    desktopImage: homepageImageSchema,
    mobileImage: homepageImageSchema,
    collectionSlugs: { type: [String], default: [] },
    items: { type: [homepageItemSchema], default: [] },
    needsClientReview: { type: Boolean, required: true, default: false },
  },
  { _id: false, strict: "throw" },
);

const homepageVersionSchema = new Schema<HomepageVersionRecord>(
  {
    version: { type: Number, required: true, min: 1 },
    sections: { type: [homepageSectionSchema], required: true },
    updatedAt: { type: Date, required: true },
  },
  { _id: false, strict: "throw" },
);

const homepageContentSchema = new Schema<HomepageContentRecord>(
  {
    key: { type: String, enum: ["default"], default: "default", required: true, immutable: true },
    draft: { type: homepageVersionSchema, required: true },
    published: { type: homepageVersionSchema, required: true },
  },
  { strict: "throw", timestamps: true },
);
homepageContentSchema.index({ key: 1 }, { unique: true, name: "homepage_content_singleton" });

export const HomepageContentModel: Model<HomepageContentRecord> =
  models.HomepageContent ?? model<HomepageContentRecord>("HomepageContent", homepageContentSchema);
