import { model, models, Schema, type Model } from "../database/mongoose-runtime.js";

interface ContentSection {
  id: string;
  heading?: string;
  paragraphs: string[];
  items: string[];
}
export interface ContentPageRecord {
  slug: string;
  title: string;
  eyebrow?: string;
  summary: string;
  sections: ContentSection[];
  active: boolean;
  needsClientReview: boolean;
  reviewNotes: string[];
  createdAt: Date;
  updatedAt: Date;
}

const sectionSchema = new Schema<ContentSection>(
  {
    id: { type: String, required: true, trim: true },
    heading: { type: String, trim: true, maxlength: 120 },
    paragraphs: { type: [String], default: [] },
    items: { type: [String], default: [] },
  },
  { _id: false, strict: "throw" },
);
const contentPageSchema = new Schema<ContentPageRecord>(
  {
    slug: { type: String, required: true, trim: true, lowercase: true, immutable: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    eyebrow: { type: String, trim: true, maxlength: 80 },
    summary: { type: String, required: true, trim: true, maxlength: 500 },
    sections: { type: [sectionSchema], default: [] },
    active: { type: Boolean, default: true, required: true },
    needsClientReview: { type: Boolean, default: false, required: true },
    reviewNotes: { type: [String], default: [] },
  },
  { strict: "throw", timestamps: true },
);
contentPageSchema.index({ slug: 1 }, { unique: true, name: "content_page_slug_unique" });
contentPageSchema.index({ active: 1, slug: 1 }, { name: "content_page_public" });
contentPageSchema.index({ needsClientReview: 1, updatedAt: -1 }, { name: "content_page_review" });

export const ContentPageModel: Model<ContentPageRecord> =
  models.ContentPage ?? model<ContentPageRecord>("ContentPage", contentPageSchema);
