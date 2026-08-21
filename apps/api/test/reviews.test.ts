import { describe, expect, it } from "vitest";
import type { ProductReviewDto, ProductReviewPageDto } from "@thread/types";
import type { ReviewCreateInput, ReviewListQuery, ReviewUpdateInput } from "@thread/validation";

import type { AuditRepository } from "../src/auth/repositories/audit.repository.js";
import type { ReviewRepository } from "../src/catalogue/reviews/review.repository.js";
import {
  ReviewService,
  type PurchaseVerificationProvider,
} from "../src/catalogue/reviews/review.service.js";
import { RulesBasedDeliveryProvider } from "../src/catalogue/delivery/delivery.provider.js";

const id = "507f1f77bcf86cd799439011";
const orderId = "507f1f77bcf86cd799439012";
const context = { requestId: "review-test" };

class MemoryReviews implements ReviewRepository {
  created?: ReviewCreateInput;
  async listPublic(_productId: string, query: ReviewListQuery): Promise<ProductReviewPageDto> {
    return {
      items: [],
      ...query,
      total: 0,
      pages: 1,
      ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
  }
  listAdmin(query: ReviewListQuery): Promise<ProductReviewPageDto> {
    return this.listPublic(id, query);
  }
  async create(
    _userId: string,
    _productId: string,
    input: ReviewCreateInput,
  ): Promise<ProductReviewDto> {
    this.created = input;
    return {
      id,
      userName: "Verified customer",
      ...input,
      verifiedPurchase: true,
      moderationStatus: "pending",
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    };
  }
  async updateOwned(
    _userId: string,
    _reviewId: string,
    _input: ReviewUpdateInput,
  ): Promise<ProductReviewDto | null> {
    return null;
  }
  async moderate(): Promise<ProductReviewDto | null> {
    return null;
  }
}

const audits: AuditRepository = { record: async () => undefined };

describe("verified-purchase reviews", () => {
  it("rejects a review when the delivered purchase cannot be verified", async () => {
    const purchases: PurchaseVerificationProvider = {
      isDeliveredPurchase: async () => false,
    };
    const service = new ReviewService(new MemoryReviews(), purchases, audits);
    await expect(
      service.create(
        id,
        id,
        {
          orderId,
          rating: 5,
          title: "Great fit",
          body: "Comfortable and well finished.",
          media: [],
        },
        context,
      ),
    ).rejects.toMatchObject({ statusCode: 403, code: "REVIEW_NOT_ELIGIBLE" });
  });

  it("strips markup before storing an eligible review", async () => {
    const repository = new MemoryReviews();
    const purchases: PurchaseVerificationProvider = {
      isDeliveredPurchase: async () => true,
    };
    const service = new ReviewService(repository, purchases, audits);
    await service.create(
      id,
      id,
      {
        orderId,
        rating: 5,
        title: "<b>Great fit</b>",
        body: "<script>alert(1)</script>Comfortable and well finished.",
        media: [],
      },
      context,
    );
    expect(repository.created?.title).toBe("Great fit");
    expect(repository.created?.body).not.toContain("<");
  });
});

describe("rules-based delivery checking", () => {
  it("requires confirmation when no operational prefixes are configured", async () => {
    await expect(new RulesBasedDeliveryProvider([]).check("700159")).resolves.toMatchObject({
      status: "confirmation_required",
    });
  });

  it("matches only configured prefixes", async () => {
    const provider = new RulesBasedDeliveryProvider(["70"]);
    await expect(provider.check("700159")).resolves.toMatchObject({ status: "serviceable" });
    await expect(provider.check("560001")).resolves.toMatchObject({ status: "not_serviceable" });
  });
});
