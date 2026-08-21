import mongoose, { Types } from "mongoose";
import type { ProductReviewDto, ProductReviewPageDto, ReviewModerationStatus } from "@thread/types";
import type { ReviewCreateInput, ReviewListQuery, ReviewUpdateInput } from "@thread/validation";

import { ProductModel } from "../models/product.model.js";
import { ReviewModel, type Review } from "../models/review.model.js";

function dto(review: Review & { _id: Types.ObjectId }): ProductReviewDto {
  return {
    id: review._id.toString(),
    userName: "Verified customer",
    rating: review.rating,
    title: review.title,
    body: review.body,
    media: review.media,
    verifiedPurchase: review.verifiedPurchase,
    moderationStatus: review.moderationStatus,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
  };
}

export interface ReviewRepository {
  listPublic(productId: string, query: ReviewListQuery): Promise<ProductReviewPageDto>;
  listAdmin(
    query: ReviewListQuery & { status?: ReviewModerationStatus },
  ): Promise<ProductReviewPageDto>;
  create(userId: string, productId: string, input: ReviewCreateInput): Promise<ProductReviewDto>;
  updateOwned(
    userId: string,
    reviewId: string,
    input: ReviewUpdateInput,
  ): Promise<ProductReviewDto | null>;
  moderate(
    reviewId: string,
    status: "approved" | "rejected",
    actorId: string,
    reason?: string,
  ): Promise<ProductReviewDto | null>;
}

export class MongooseReviewRepository implements ReviewRepository {
  async listPublic(productId: string, query: ReviewListQuery): Promise<ProductReviewPageDto> {
    const filter = {
      productId: new Types.ObjectId(productId),
      moderationStatus: "approved" as const,
      ...(query.rating ? { rating: query.rating } : {}),
    };
    const [items, total, counts] = await Promise.all([
      ReviewModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean()
        .exec(),
      ReviewModel.countDocuments(filter),
      ReviewModel.aggregate<{ _id: number; count: number }>([
        { $match: { productId: new Types.ObjectId(productId), moderationStatus: "approved" } },
        { $group: { _id: "$rating", count: { $sum: 1 } } },
      ]),
    ]);
    const ratingCounts: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const count of counts) {
      if (count._id >= 1 && count._id <= 5)
        ratingCounts[count._id as 1 | 2 | 3 | 4 | 5] = count.count;
    }
    return {
      items: items.map((item) => dto(item)),
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.max(1, Math.ceil(total / query.limit)),
      ratingCounts,
    };
  }

  async listAdmin(
    query: ReviewListQuery & { status?: ReviewModerationStatus },
  ): Promise<ProductReviewPageDto> {
    const filter: {
      moderationStatus?: ReviewModerationStatus;
      rating?: number;
    } = {
      ...(query.status ? { moderationStatus: query.status } : {}),
      ...(query.rating ? { rating: query.rating } : {}),
    };
    const [items, total] = await Promise.all([
      ReviewModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean()
        .exec(),
      ReviewModel.countDocuments(filter),
    ]);
    return {
      items: items.map((item) => dto(item)),
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.max(1, Math.ceil(total / query.limit)),
      ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
  }

  async create(
    userId: string,
    productId: string,
    input: ReviewCreateInput,
  ): Promise<ProductReviewDto> {
    const created = await ReviewModel.create({
      ...input,
      userId: new Types.ObjectId(userId),
      productId: new Types.ObjectId(productId),
      orderId: new Types.ObjectId(input.orderId),
      verifiedPurchase: true,
      moderationStatus: "pending",
    });
    return dto(created.toObject());
  }

  async updateOwned(
    userId: string,
    reviewId: string,
    input: ReviewUpdateInput,
  ): Promise<ProductReviewDto | null> {
    const updated = await ReviewModel.findOneAndUpdate(
      { _id: reviewId, userId },
      {
        ...input,
        moderationStatus: "pending",
        $unset: { moderationReason: 1, moderatedAt: 1, moderatedBy: 1 },
      },
      { new: true, runValidators: true },
    ).lean();
    if (updated) await this.recalculate(updated.productId.toString());
    return updated ? dto(updated) : null;
  }

  async moderate(
    reviewId: string,
    status: "approved" | "rejected",
    actorId: string,
    reason?: string,
  ): Promise<ProductReviewDto | null> {
    const session = await mongoose.startSession();
    let output: ProductReviewDto | null = null;
    try {
      await session.withTransaction(async () => {
        const updated = await ReviewModel.findByIdAndUpdate(
          reviewId,
          {
            moderationStatus: status,
            moderatedBy: new Types.ObjectId(actorId),
            moderatedAt: new Date(),
            ...(reason ? { moderationReason: reason } : { $unset: { moderationReason: 1 } }),
          },
          { new: true, runValidators: true, session },
        ).lean();
        if (!updated) return;
        await this.recalculate(updated.productId.toString(), session);
        output = dto(updated);
      });
      return output;
    } finally {
      await session.endSession();
    }
  }

  private async recalculate(productId: string, session?: mongoose.ClientSession): Promise<void> {
    const result = await ReviewModel.aggregate<{ average: number; count: number }>([
      { $match: { productId: new Types.ObjectId(productId), moderationStatus: "approved" } },
      { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]).session(session ?? null);
    await ProductModel.updateOne(
      { _id: productId },
      { rating: { average: result[0]?.average ?? 0, count: result[0]?.count ?? 0 } },
      session ? { session } : {},
    );
  }
}
