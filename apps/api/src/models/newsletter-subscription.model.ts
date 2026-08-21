import { model, models, Schema, type Model } from "../database/mongoose-runtime.js";

export interface NewsletterSubscription {
  email: string;
  consentAt: Date;
  source: "homepage";
  status: "subscribed";
  createdAt: Date;
  updatedAt: Date;
}

const newsletterSubscriptionSchema = new Schema<NewsletterSubscription>(
  {
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    consentAt: { type: Date, required: true },
    source: { type: String, enum: ["homepage"], required: true, immutable: true },
    status: { type: String, enum: ["subscribed"], required: true, default: "subscribed" },
  },
  { strict: "throw", timestamps: true },
);
newsletterSubscriptionSchema.index({ email: 1 }, { unique: true, name: "newsletter_email_unique" });

export const NewsletterSubscriptionModel: Model<NewsletterSubscription> =
  models.NewsletterSubscription ??
  model<NewsletterSubscription>("NewsletterSubscription", newsletterSubscriptionSchema);
