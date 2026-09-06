import type { RequestHandler } from "express";
import pino from "pino";
import request from "supertest";
import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import type { ProductStatus, ProductSummaryDto, UserRole } from "@thread/types";
import { catalogueQuerySchema } from "@thread/validation";

import { createApp } from "../src/app.js";
import type { AuthContext } from "../src/auth/auth.types.js";
import type { AuditRepository } from "../src/auth/repositories/audit.repository.js";
import { CatalogueService } from "../src/catalogue/catalogue.service.js";
import type {
  AdminProductRecord,
  CatalogueFacets,
  CatalogueRepository,
  PageResult,
  ProductMutationInput,
} from "../src/catalogue/catalogue.types.js";
import { createCatalogueRouter } from "../src/catalogue/http/catalogue.router.js";
import type {
  MediaProvider,
  SignedUpload,
  UploadedMediaMetadata,
} from "../src/catalogue/media/cloudinary.provider.js";
import { ProductVariantModel } from "../src/catalogue/models/product-variant.model.js";
import { ProductModel } from "../src/catalogue/models/product.model.js";
import { ProductPreviewTokenService } from "../src/catalogue/security/preview-token.js";

const productId = "64b000000000000000000001";
const variantId = "64b000000000000000000011";
const categoryId = "64b000000000000000000021";
const now = "2026-07-26T00:00:00.000Z";
const context: AuthContext = { requestId: "catalogue-test" };
const silentLogger = pino({ enabled: false });

function record(overrides: Partial<AdminProductRecord> = {}): AdminProductRecord {
  return {
    id: productId,
    title: "THREAD Essential Tee",
    slug: "thread-essential-tee",
    shortDescription: "A core THREAD tee.",
    descriptionHtml: "<p>A core THREAD tee.</p>",
    audience: "men",
    brand: "THREAD",
    fit: "classic",
    material: "cotton",
    colours: [{ name: "Black", hex: "#111111" }],
    minMrpPaise: 129_900,
    minSalePricePaise: 99_900,
    ratingAverage: 4.5,
    ratingCount: 12,
    available: true,
    publishedAt: now,
    care: [],
    tags: ["essential"],
    categoryIds: [categoryId],
    collectionIds: [],
    media: [],
    variants: [
      {
        id: variantId,
        sku: "THREAD-TEE-BLK-M",
        colour: "Black",
        size: "M",
        mrpPaise: 129_900,
        salePricePaise: 99_900,
        availableStock: 5,
        status: "active",
      },
    ],
    status: "active",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

class MemoryAudit implements AuditRepository {
  readonly actions: string[] = [];
  async record(input: { action: string }): Promise<void> {
    this.actions.push(input.action);
  }
}

class MemoryMedia implements MediaProvider {
  deleted: string[] = [];
  verified = false;
  async verifyConfiguration(): Promise<void> {
    this.verified = true;
  }
  createSignedUpload(): SignedUpload {
    return {
      apiKey: "key",
      cloudName: "thread",
      folder: "thread/products",
      signature: "signature",
      timestamp: 1,
      signedParameters: {
        allowed_formats: "jpg",
        folder: "thread/products",
        timestamp: 1,
      },
      constraints: {
        allowedFormats: ["jpg"],
        maxBytes: 15_000_000,
        minWidth: 300,
        minHeight: 300,
        svgAllowed: false,
      },
      uploadUrl: "https://api.cloudinary.com/v1_1/thread/image/upload",
    };
  }
  async delete(publicId: string): Promise<void> {
    this.deleted.push(publicId);
  }
  validateMetadata(metadata: UploadedMediaMetadata): boolean {
    return (
      metadata.publicId.startsWith("thread/products/") &&
      metadata.secureUrl.startsWith("https://res.cloudinary.com/thread/") &&
      metadata.format !== "svg" &&
      metadata.mimeType.startsWith("image/")
    );
  }
}

class MemoryCatalogue implements CatalogueRepository {
  readonly records: AdminProductRecord[] = [
    record(),
    record({
      id: "64b000000000000000000002",
      slug: "thread-draft-tee",
      status: "draft",
      title: "Draft Tee",
    }),
    record({
      id: "64b000000000000000000003",
      slug: "thread-women-tee",
      audience: "women",
      title: "Women Tee",
      minMrpPaise: 89_900,
      minSalePricePaise: 79_900,
      ratingAverage: 4.8,
      variants: [
        {
          id: "64b000000000000000000013",
          sku: "THREAD-W-TEE-PNK-S",
          colour: "Pink",
          size: "S",
          mrpPaise: 89_900,
          salePricePaise: 79_900,
          availableStock: 0,
          status: "active",
        },
      ],
    }),
  ];
  inventory = 5;
  movementReasons: string[] = [];

  async listPublic(
    query: Parameters<CatalogueRepository["listPublic"]>[0],
  ): Promise<PageResult<ProductSummaryDto>> {
    let items = this.records.filter((item) => item.status === "active");
    if (query.audience?.length)
      items = items.filter((item) => query.audience?.includes(item.audience));
    if (query.category?.length)
      items = items.filter((item) => item.categoryIds.some((id) => query.category?.includes(id)));
    if (query.size?.length)
      items = items.filter((item) =>
        item.variants.some((variant) => query.size?.includes(variant.size)),
      );
    if (query.colour?.length)
      items = items.filter((item) =>
        item.variants.some((variant) => query.colour?.includes(variant.colour)),
      );
    if (query.fit?.length)
      items = items.filter((item) => item.fit && query.fit?.includes(item.fit));
    if (query.material?.length)
      items = items.filter((item) => item.material && query.material?.includes(item.material));
    if (query.minPrice !== undefined)
      items = items.filter((item) => item.minSalePricePaise >= query.minPrice!);
    if (query.maxPrice !== undefined)
      items = items.filter((item) => item.minSalePricePaise <= query.maxPrice!);
    if (query.rating !== undefined)
      items = items.filter((item) => item.ratingAverage >= query.rating!);
    if (query.discount !== undefined)
      items = items.filter(
        (item) =>
          item.minMrpPaise > 0 &&
          ((item.minMrpPaise - item.minSalePricePaise) / item.minMrpPaise) * 100 >= query.discount!,
      );
    if (query.availability === "in_stock")
      items = items.filter((item) => item.variants.some((variant) => variant.availableStock > 0));
    if (query.search)
      items = items.filter((item) =>
        `${item.title} ${item.brand} ${item.tags.join(" ")}`
          .toLowerCase()
          .includes(query.search!.toLowerCase()),
      );
    if (query.sort === "price_low_high")
      items.sort((left, right) => left.minSalePricePaise - right.minSalePricePaise);
    if (query.sort === "price_high_low")
      items.sort((left, right) => right.minSalePricePaise - left.minSalePricePaise);
    if (query.sort === "rating")
      items.sort((left, right) => right.ratingAverage - left.ratingAverage);
    const total = items.length;
    const pageItems = items.slice((query.page - 1) * query.limit, query.page * query.limit);
    return {
      items: pageItems,
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.ceil(total / query.limit),
    };
  }
  async facets(): Promise<CatalogueFacets> {
    return {
      audiences: [],
      categories: [],
      collections: [],
      sizes: [],
      colours: [],
      fits: [],
      materials: [],
      ratings: [],
      availability: [],
      discounts: [],
      price: { minPaise: 0, maxPaise: 0 },
    };
  }
  analytics: Array<{ queryHash: string; queryLength: number; resultCount: number }> = [];
  async suggestions(search: string) {
    return {
      products: this.records
        .filter(
          (item) =>
            item.status === "active" && item.title.toLowerCase().includes(search.toLowerCase()),
        )
        .slice(0, 5)
        .map((item) => ({
          id: item.id,
          title: item.title,
          slug: item.slug,
          minSalePricePaise: item.minSalePricePaise,
        })),
      categories: [{ name: "T-Shirts", slug: "t-shirts" }],
    };
  }
  async recordSearchAnalytics(input: {
    queryHash: string;
    queryLength: number;
    resultCount: number;
  }) {
    this.analytics.push(input);
  }
  async findPublicBySlug(slug: string) {
    return this.records.find((item) => item.slug === slug && item.status === "active") ?? null;
  }
  async findPublicSlugRedirect() {
    return null;
  }
  async related(slug: string, limit: number) {
    return this.records
      .filter((item) => item.status === "active" && item.slug !== slug)
      .slice(0, limit);
  }
  async listAdmin(input: {
    page: number;
    limit: number;
    search?: string;
    status?: ProductStatus;
  }): Promise<PageResult<AdminProductRecord>> {
    const items = this.records.filter((item) => !input.status || item.status === input.status);
    return {
      items,
      page: input.page,
      limit: input.limit,
      total: items.length,
      pages: Math.ceil(items.length / input.limit),
    };
  }
  async findAdminById(id: string) {
    return this.records.find((item) => item.id === id) ?? null;
  }
  async create(_input: ProductMutationInput) {
    return record();
  }
  async update(id: string) {
    return this.findAdminById(id);
  }
  async setStatus(id: string, status: ProductStatus) {
    const item = await this.findAdminById(id);
    return item ? { ...item, status } : null;
  }
  async replaceVariants(id: string) {
    return this.findAdminById(id);
  }
  async bulkUpdate() {
    return 1;
  }
  async attachMedia(id: string) {
    return this.findAdminById(id);
  }
  async reorderMedia(id: string) {
    return this.findAdminById(id);
  }
  async countMediaReferences() {
    return 0;
  }
  async removeMediaReference() {
    return true;
  }
  async exportAll() {
    return this.records;
  }
  async adjustInventory(input: { quantityDelta: number; reason: string }) {
    const stockBefore = this.inventory;
    const stockAfter = stockBefore + input.quantityDelta;
    if (stockAfter < 0)
      throw new Error("Inventory adjustment would make available stock negative.");
    this.inventory = stockAfter;
    this.movementReasons.push(input.reason);
    return { productId, stockBefore, stockAfter };
  }
}

function service(
  repository = new MemoryCatalogue(),
  audit = new MemoryAudit(),
  media = new MemoryMedia(),
) {
  return {
    audit,
    media,
    repository,
    service: new CatalogueService(
      repository,
      audit,
      media,
      new ProductPreviewTokenService("catalogue-preview-test-secret-32-characters"),
    ),
  };
}

describe("public catalogue", () => {
  it("applies catalogue filters, sorting, and pagination while excluding drafts", async () => {
    const setup = service();
    const query = catalogueQuerySchema.parse({
      audience: "men",
      category: categoryId,
      size: "M",
      colour: "Black",
      fit: "classic",
      material: "cotton",
      minPrice: "90000",
      maxPrice: "100000",
      rating: "4",
      discount: "20",
      availability: "in_stock",
      search: "essential",
      sort: "price_low_high",
      page: "1",
      limit: "12",
    });
    const result = await setup.service.listPublic(query);
    expect(result.items.map((item) => item.slug)).toEqual(["thread-essential-tee"]);
    expect(result.items.some((item) => item.slug === "thread-draft-tee")).toBe(false);
  });

  it("does not return draft product details or draft products as related items", async () => {
    const setup = service();
    await expect(setup.service.detail("thread-draft-tee")).rejects.toMatchObject({
      code: "PRODUCT_NOT_FOUND",
    });
    await expect(setup.service.related("thread-essential-tee")).resolves.toHaveLength(1);
  });

  it("returns safe suggestions and stores only hashed search analytics", async () => {
    const setup = service();
    await expect(setup.service.suggestions("essential")).resolves.toMatchObject({
      products: [{ slug: "thread-essential-tee" }],
      categories: [{ slug: "t-shirts" }],
    });
    await setup.service.recordSearchAnalytics("  Essential   Tee ", 1);
    expect(setup.repository.analytics).toHaveLength(1);
    expect(setup.repository.analytics[0]).toMatchObject({ queryLength: 13, resultCount: 1 });
    expect(setup.repository.analytics[0]?.queryHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(setup.repository.analytics)).not.toContain("Essential");
  });
});

describe("catalogue integrity", () => {
  it("declares unique slug, SKU, and product-size-colour indexes", () => {
    expect(ProductModel.schema.indexes()).toEqual(
      expect.arrayContaining([[{ slug: 1 }, expect.objectContaining({ unique: true })]]),
    );
    expect(ProductVariantModel.schema.indexes()).toEqual(
      expect.arrayContaining([
        [{ sku: 1 }, expect.objectContaining({ unique: true })],
        [{ productId: 1, size: 1, colour: 1 }, expect.objectContaining({ unique: true })],
      ]),
    );
  });

  it("rejects negative stock and a sale price above MRP at the model boundary", async () => {
    const invalid = new ProductVariantModel({
      productId: new Types.ObjectId(productId),
      sku: "THREAD-BAD-SKU",
      colour: "Black",
      size: "M",
      attributes: {},
      mrpPaise: 90_000,
      salePricePaise: 100_000,
      taxRateBps: null,
      hsn: null,
      stockOnHand: -1,
      stockReserved: 0,
      reorderLevel: 0,
      weightGrams: 200,
      imagePublicIds: [],
      status: "active",
    });
    await expect(invalid.validate()).rejects.toMatchObject({ name: "ValidationError" });
  });

  it("sanitises rich descriptions before repository writes", async () => {
    const setup = service();
    let description = "";
    setup.repository.create = async (input) => {
      description = input.descriptionHtml;
      return record();
    };
    await setup.service.create(
      {
        title: "THREAD Tee",
        slug: "thread-tee",
        shortDescription: "THREAD tee",
        descriptionHtml: '<script>alert(1)</script><p onclick="bad()">Safe</p>',
        categoryIds: [],
        collectionIds: [],
        audience: "unisex",
        brand: "THREAD",
        tags: [],
        material: null,
        care: [],
        featured: false,
        status: "draft",
        seo: { noIndex: false },
        variants: [
          {
            sku: "THREAD-TEE-001",
            colour: "Black",
            size: "M",
            attributes: {},
            mrpPaise: 100_000,
            salePricePaise: 90_000,
            taxRateBps: null,
            hsn: null,
            weightGrams: 200,
            status: "active",
          },
        ],
      },
      productId,
      context,
    );
    expect(description).toBe("<p>Safe</p>");
    expect(setup.audit.actions).toContain("catalogue.product_created");
  });

  it("exports formula-like catalogue values as inert spreadsheet text", async () => {
    const setup = service();
    setup.repository.exportAll = async () => [record({ title: '=WEBSERVICE("https://invalid")' })];

    const csv = await setup.service.exportCsv();

    expect(csv).toContain(`"'=WEBSERVICE(""https://invalid"")"`);
    expect(csv).not.toContain(`,"=WEBSERVICE`);
  });
});

describe("catalogue authorization and stock", () => {
  const roleAuth: RequestHandler = (incoming, _response, next) => {
    const role = incoming.header("x-test-role") as UserRole | undefined;
    incoming.auth = {
      userId: productId,
      roles: role ? [role] : [],
      sessionFamilyId: "test-family",
    };
    next();
  };

  it("allows upload signatures only for authorised catalogue roles", async () => {
    const setup = service();
    const app = createApp({
      catalogueRouter: createCatalogueRouter(setup.service, roleAuth),
      isReady: () => true,
      logger: silentLogger,
      webOrigin: "http://localhost:3000",
    });
    await request(app)
      .post("/api/v1/admin/media/upload-signature")
      .set("x-test-role", "customer")
      .expect(403);
    await request(app)
      .post("/api/v1/admin/media/upload-signature")
      .set("x-test-role", "catalog_manager")
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.constraints.svgAllowed).toBe(false);
        expect(body.data).not.toHaveProperty("apiSecret");
      });
    expect(setup.media.verified).toBe(true);
  });

  it("records inventory adjustments with a reason and prevents negative stock", async () => {
    const setup = service();
    await expect(
      setup.service.adjustInventory(
        variantId,
        -2,
        "Correction after stock count",
        productId,
        context,
      ),
    ).resolves.toMatchObject({ stockAfter: 3 });
    expect(setup.repository.movementReasons).toEqual(["Correction after stock count"]);
    await expect(
      setup.service.adjustInventory(
        variantId,
        -10,
        "Invalid negative correction",
        productId,
        context,
      ),
    ).rejects.toMatchObject({ code: "INVALID_INVENTORY_ADJUSTMENT" });
    expect(setup.audit.actions).toContain("catalogue.inventory_adjusted");
  });

  it("rejects non-provider media metadata before persisting it", async () => {
    const setup = service();
    await expect(
      setup.service.attachMedia(
        productId,
        {
          publicId: "outside/image",
          secureUrl: "https://example.com/image.jpg",
          width: 800,
          height: 1000,
          format: "jpg",
          mimeType: "image/jpeg",
          bytes: 1000,
          alt: "THREAD tee",
          primary: true,
        },
        productId,
        context,
      ),
    ).rejects.toMatchObject({ code: "INVALID_MEDIA_METADATA" });
  });
});
