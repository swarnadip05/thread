import { model, models, Schema, type Model, type Types } from "../../database/mongoose-runtime.js";
import type { ReviewModerationStatus } from "@thread/types";

export interface ReviewMedia {
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
  alt: string;
}

export interface Review {
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  orderId: Types.ObjectId;
  rating: number;
  title: string;
  body: string;
  media: ReviewMedia[];
  verifiedPurchase: boolean;
  moderationStatus: ReviewModerationStatus;
  moderationReason?: string;
  moderatedBy?: Types.ObjectId;
  moderatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const reviewMediaSchema = new Schema<ReviewMedia>(
  {
    publicId: { type: String, required: true, trim: true, maxlength: 255 },
    secureUrl: { type: String, required: true, trim: true, maxlength: 2_048 },
    width: { type: Number, required: true, min: 1, max: 12_000 },
    height: { type: Number, required: true, min: 1, max: 12_000 },
    alt: { type: String, required: true, trim: true, maxlength: 240 },
  },
  { _id: false, strict: "throw" },
);

const reviewSchema = new Schema<Review>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, required: true, trim: true, maxlength: 5_000 },
    media: { type: [reviewMediaSchema], default: [] },
    verifiedPurchase: { type: Boolean, required: true, default: true },
    moderationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      required: true,
      default: "pending",
    },
    moderationReason: { type: String, trim: true, maxlength: 500 },
    moderatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    moderatedAt: Date,
  },
  { strict: "throw", timestamps: true },
);

reviewSchema.index(
  { userId: 1, productId: 1, orderId: 1 },
  { unique: true, name: "review_purchase_unique" },
);
reviewSchema.index(
  { productId: 1, moderationStatus: 1, rating: 1, createdAt: -1 },
  { name: "review_public_listing" },
);
reviewSchema.index({ moderationStatus: 1, createdAt: -1 }, { name: "review_moderation_queue" });

export const ReviewModel: Model<Review> = models.Review ?? model<Review>("Review", reviewSchema);
