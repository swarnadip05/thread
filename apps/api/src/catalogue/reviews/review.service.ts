import sanitizeHtml from "sanitize-html";
import mongoose, { Types } from "mongoose";
import type { ReviewModerationStatus } from "@thread/types";
import type { ReviewCreateInput, ReviewListQuery, ReviewUpdateInput } from "@thread/validation";

import type { AuditRepository } from "../../auth/repositories/audit.repository.js";
import type { AuthContext } from "../../auth/auth.types.js";
import { HttpError } from "../../middleware/error-handler.js";
import { ProductModel } from "../models/product.model.js";
import type { ReviewRepository } from "./review.repository.js";

interface OrderPurchaseProjection {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  status: string;
  items: Array<{ productId: Types.ObjectId }>;
}

export interface PurchaseVerificationProvider {
  isDeliveredPurchase(userId: string, productId: string, orderId: string): Promise<boolean>;
}

export class MongoosePurchaseVerificationProvider implements PurchaseVerificationProvider {
  async isDeliveredPurchase(userId: string, productId: string, orderId: string): Promise<boolean> {
    if (![userId, productId, orderId].every(Types.ObjectId.isValid)) return false;
    const order = await mongoose.connection.collection<OrderPurchaseProjection>("orders").findOne({
      _id: new Types.ObjectId(orderId),
      userId: new Types.ObjectId(userId),
      status: "delivered",
      "items.productId": new Types.ObjectId(productId),
    });
    return Boolean(order);
  }
}

function plain(value: string): string {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).trim();
}

export class ReviewService {
  constructor(
    private readonly reviews: ReviewRepository,
    private readonly purchases: PurchaseVerificationProvider,
    private readonly audits: AuditRepository,
  ) {}

  async listBySlug(slug: string, query: ReviewListQuery) {
    const product = await ProductModel.findOne({
      slug,
      status: "active",
      publishedAt: { $lte: new Date() },
    })
      .select({ _id: 1 })
      .lean();
    if (!product) throw new HttpError(404, "PRODUCT_NOT_FOUND", "Product not found.");
    return this.reviews.listPublic(product._id.toString(), query);
  }

  listAdmin(query: ReviewListQuery & { status?: ReviewModerationStatus }) {
    return this.reviews.listAdmin(query);
  }

  async create(userId: string, productId: string, input: ReviewCreateInput, context: AuthContext) {
    const eligible = await this.purchases.isDeliveredPurchase(userId, productId, input.orderId);
    if (!eligible)
      throw new HttpError(
        403,
        "REVIEW_NOT_ELIGIBLE",
        "A delivered purchase of this product is required to leave a review.",
      );
    try {
      const review = await this.reviews.create(userId, productId, {
        ...input,
        title: plain(input.title),
        body: plain(input.body),
      });
      await this.audits.record({
        actorId: userId,
        action: "review.created",
        entity: "Review",
        entityId: review.id,
        context,
      });
      return review;
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11_000)
        throw new HttpError(409, "REVIEW_EXISTS", "This purchase has already been reviewed.");
      throw error;
    }
  }

  async update(userId: string, reviewId: string, input: ReviewUpdateInput, context: AuthContext) {
    const review = await this.reviews.updateOwned(userId, reviewId, {
      ...input,
      title: plain(input.title),
      body: plain(input.body),
    });
    if (!review) throw new HttpError(404, "REVIEW_NOT_FOUND", "Review not found.");
    await this.audits.record({
      actorId: userId,
      action: "review.updated",
      entity: "Review",
      entityId: review.id,
      context,
    });
    return review;
  }

  async moderate(
    reviewId: string,
    status: "approved" | "rejected",
    reason: string | undefined,
    actorId: string,
    context: AuthContext,
  ) {
    const review = await this.reviews.moderate(reviewId, status, actorId, reason && plain(reason));
    if (!review) throw new HttpError(404, "REVIEW_NOT_FOUND", "Review not found.");
    await this.audits.record({
      actorId,
      action: `review.${status}`,
      entity: "Review",
      entityId: reviewId,
      metadata: reason ? { reason: plain(reason) } : {},
      context,
    });
    return review;
  }
}
