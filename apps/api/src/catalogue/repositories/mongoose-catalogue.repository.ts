import mongoose, { Types } from "mongoose";
import type {
  ProductDetailDto,
  ProductMediaDto,
  ProductStatus,
  ProductSummaryDto,
  ProductVariantDto,
} from "@thread/types";
import type { CatalogueQuery, VariantInput } from "@thread/validation";

import { OrderModel } from "../../checkout/models/order.model.js";
import { CategoryModel } from "../../models/category.model.js";
import { CollectionModel } from "../models/collection.model.js";
import { InventoryMovementModel } from "../models/inventory-movement.model.js";
import { ProductVariantModel, type ProductVariant } from "../models/product-variant.model.js";
import { ProductModel, type Product, type ProductMedia } from "../models/product.model.js";
import { SearchQueryEventModel } from "../models/search-query-event.model.js";
import type {
  AdminProductListInput,
  AdminProductRecord,
  CatalogueFacets,
  CatalogueRepository,
  PageResult,
  ProductMutationInput,
  ProductPatchMutation,
} from "../catalogue.types.js";

interface AggregateProduct extends Product {
  _id: Types.ObjectId;
  variants: Array<ProductVariant & { _id: Types.ObjectId }>;
  minMrpPaise: number;
  minSalePricePaise: number;
  available: boolean;
  textScore?: number;
}

function escapedRegex(value: string): RegExp {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

function mediaDto(media: ProductMedia): ProductMediaDto {
  return {
    publicId: media.publicId,
    secureUrl: media.secureUrl,
    width: media.width,
    height: media.height,
    format: media.format,
    mimeType: media.mimeType,
    bytes: media.bytes,
    alt: media.alt,
    sortOrder: media.sortOrder,
    primary: media.primary,
  };
}
function variantDto(variant: ProductVariant & { _id?: Types.ObjectId }): ProductVariantDto {
  const available = Math.max(0, variant.stockOnHand - variant.stockReserved);
  return {
    id: variant._id?.toString() ?? "",
    sku: variant.sku,
    colour: variant.colour,
    ...(variant.colourHex ? { colourHex: variant.colourHex } : {}),
    size: variant.size,
    mrpPaise: variant.mrpPaise,
    salePricePaise: variant.salePricePaise,
    availableStock: available,
    status: variant.status,
  };
}
function summaryDto(product: AggregateProduct): ProductSummaryDto {
  const orderedMedia = [...product.media].sort((a, b) => a.sortOrder - b.sortOrder);
  const primary = product.media.find((item) => item.primary) ?? orderedMedia[0];
  const secondary = orderedMedia.find((item) => item.publicId !== primary?.publicId);
  const colours = [
    ...new Map(
      product.variants.map((variant) => [
        variant.colour.toLowerCase(),
        {
          name: variant.colour,
          ...(variant.colourHex ? { hex: variant.colourHex } : {}),
        },
      ]),
    ).values(),
  ];
  return {
    id: product._id.toString(),
    title: product.title,
    slug: product.slug,
    shortDescription: product.shortDescription,
    audience: product.audience,
    brand: product.brand,
    ...(product.fit ? { fit: product.fit } : {}),
    ...(product.material ? { material: product.material } : {}),
    ...(primary ? { primaryImage: mediaDto(primary) } : {}),
    ...(secondary ? { secondaryImage: mediaDto(secondary) } : {}),
    colours,
    minMrpPaise: product.minMrpPaise,
    minSalePricePaise: product.minSalePricePaise,
    ratingAverage: product.rating.average,
    ratingCount: product.rating.count,
    available: product.available,
    publishedAt: product.publishedAt?.toISOString() ?? product.createdAt.toISOString(),
  };
}
function detailDto(product: AggregateProduct): ProductDetailDto {
  return {
    ...summaryDto(product),
    seo: product.seo,
    descriptionHtml: product.descriptionHtml,
    care: product.care,
    tags: product.tags,
    categoryIds: product.categoryIds.map(String),
    collectionIds: product.collectionIds.map(String),
    media: [...product.media].sort((a, b) => a.sortOrder - b.sortOrder).map(mediaDto),
    variants: product.variants.map(variantDto),
  };
}
function adminDto(product: AggregateProduct): AdminProductRecord {
  return {
    ...detailDto(product),
    status: product.status,
    featured: product.featured,
    newArrival: product.newArrival ?? false,
    seo: product.seo,
    variants: product.variants.map((variant) => ({
      ...variantDto(variant),
      stockOnHand: variant.stockOnHand,
      stockReserved: variant.stockReserved,
      reorderLevel: variant.reorderLevel,
      weightGrams: variant.weightGrams,
      taxRateBps: variant.taxRateBps,
      hsn: variant.hsn,
      attributes:
        variant.attributes instanceof Map
          ? Object.fromEntries(variant.attributes)
          : variant.attributes,
      ...(variant.dimensionsMm ? { dimensionsMm: variant.dimensionsMm } : {}),
    })),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

export class MongooseCatalogueRepository implements CatalogueRepository {
  private async ensureAssignments(
    categoryIds: readonly string[] | undefined,
    collectionIds: readonly string[] | undefined,
  ): Promise<void> {
    if (categoryIds) {
      const count = await CategoryModel.countDocuments({ _id: { $in: categoryIds } });
      if (count !== new Set(categoryIds).size) throw new Error("INVALID_PRODUCT_ASSIGNMENT");
    }
    if (collectionIds) {
      const count = await CollectionModel.countDocuments({ _id: { $in: collectionIds } });
      if (count !== new Set(collectionIds).size) throw new Error("INVALID_PRODUCT_ASSIGNMENT");
    }
  }

  private async resolveIds(
    values: readonly string[] | undefined,
    kind: "category" | "collection",
  ): Promise<Types.ObjectId[] | undefined> {
    if (!values?.length) return undefined;
    const validIds = values
      .filter(Types.ObjectId.isValid)
      .map((value) => new Types.ObjectId(value));
    const slugs = values.filter((value) => !Types.ObjectId.isValid(value));
    if (!slugs.length) return validIds;
    const found =
      kind === "category"
        ? await CategoryModel.find({ slug: { $in: slugs }, active: true })
            .select("_id")
            .lean()
            .exec()
        : await CollectionModel.find({ slug: { $in: slugs }, active: true })
            .select("_id")
            .lean()
            .exec();
    return [...validIds, ...found.map((item) => item._id)];
  }

  private async publicStages(query: CatalogueQuery): Promise<mongoose.PipelineStage[]> {
    const categoryIds = await this.resolveIds(query.category, "category");
    const collectionIds = await this.resolveIds(query.collection, "collection");
    const productMatch: mongoose.PipelineStage.Match["$match"] = {
      status: "active",
      publishedAt: { $lte: new Date() },
    };
    if (query.newArrival) productMatch.newArrival = query.newArrival === "true";
    if (query.featured) productMatch.featured = query.featured === "true";
    if (categoryIds) productMatch.categoryIds = { $in: categoryIds };
    if (collectionIds) productMatch.collectionIds = { $in: collectionIds };
    if (query.audience?.length) productMatch.audience = { $in: query.audience };
    if (query.fit?.length) productMatch.fit = { $in: query.fit };
    if (query.material?.length) productMatch.material = { $in: query.material };
    if (query.rating !== undefined) productMatch["rating.average"] = { $gte: query.rating };
    if (query.search) productMatch.$text = { $search: query.search };

    const variantExpressions: unknown[] = [{ $eq: ["$productId", "$$productId"] }];
    if (query.discount !== undefined)
      variantExpressions.push(
        { $gt: ["$mrpPaise", 0] },
        {
          $gte: [
            {
              $multiply: [
                { $divide: [{ $subtract: ["$mrpPaise", "$salePricePaise"] }, "$mrpPaise"] },
                100,
              ],
            },
            query.discount,
          ],
        },
      );
    if (query.availability === "in_stock")
      variantExpressions.push({
        $gt: [{ $subtract: ["$stockOnHand", "$stockReserved"] }, 0],
      });
    const variantMatch: Record<string, unknown> = {
      $expr: variantExpressions.length === 1 ? variantExpressions[0] : { $and: variantExpressions },
      status: "active",
    };
    if (query.minPrice !== undefined || query.maxPrice !== undefined)
      variantMatch.salePricePaise = {
        ...(query.minPrice !== undefined ? { $gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { $lte: query.maxPrice } : {}),
      };
    if (query.size?.length) variantMatch.size = { $in: query.size };
    if (query.colour?.length) variantMatch.colour = { $in: query.colour };
    return [
      { $match: productMatch },
      {
        $lookup: {
          from: ProductVariantModel.collection.name,
          let: { productId: "$_id" },
          pipeline: [{ $match: variantMatch }],
          as: "variants",
        },
      },
      { $match: { "variants.0": { $exists: true } } },
      {
        $addFields: {
          minMrpPaise: { $min: "$variants.mrpPaise" },
          minSalePricePaise: { $min: "$variants.salePricePaise" },
          maxDiscountPercent: {
            $max: {
              $map: {
                input: "$variants",
                as: "variant",
                in: {
                  $cond: [
                    { $gt: ["$$variant.mrpPaise", 0] },
                    {
                      $divide: [
                        { $subtract: ["$$variant.mrpPaise", "$$variant.salePricePaise"] },
                        "$$variant.mrpPaise",
                      ],
                    },
                    0,
                  ],
                },
              },
            },
          },
          available: {
            $anyElementTrue: {
              $map: {
                input: "$variants",
                as: "variant",
                in: {
                  $gt: [{ $subtract: ["$$variant.stockOnHand", "$$variant.stockReserved"] }, 0],
                },
              },
            },
          },
          ...(query.search ? { textScore: { $meta: "textScore" } } : {}),
        },
      },
    ];
  }

  async listPublic(query: CatalogueQuery): Promise<PageResult<ProductSummaryDto>> {
    const stages = await this.publicStages(query);
    if (query.bestSellers === "true")
      stages.push(
        {
          $lookup: {
            from: OrderModel.collection.name,
            let: { productId: "$_id" },
            pipeline: [
              {
                $match: {
                  status: "delivered",
                  $expr: { $in: ["$$productId", "$items.productId"] },
                },
              },
              { $unwind: "$items" },
              { $match: { $expr: { $eq: ["$items.productId", "$$productId"] } } },
              { $group: { _id: null, quantity: { $sum: "$items.quantity" } } },
            ],
            as: "sales",
          },
        },
        { $match: { "sales.0.quantity": { $gt: 0 } } },
        { $addFields: { soldQuantity: { $first: "$sales.quantity" } } },
      );
    const sort: Record<string, 1 | -1 | { $meta: "textScore" }> =
      query.bestSellers === "true"
        ? { soldQuantity: -1, _id: 1 }
        : query.sort === "price_low_high"
          ? { minSalePricePaise: 1, _id: 1 }
          : query.sort === "price_high_low"
            ? { minSalePricePaise: -1, _id: 1 }
            : query.sort === "discount"
              ? { maxDiscountPercent: -1, _id: 1 }
              : query.sort === "rating"
                ? { "rating.average": -1, "rating.count": -1 }
                : query.sort === "relevance" && query.search
                  ? { textScore: { $meta: "textScore" } }
                  : { publishedAt: -1, _id: -1 };
    const [items, counts] = await Promise.all([
      ProductModel.aggregate<AggregateProduct>([
        ...stages,
        { $sort: sort },
        { $skip: (query.page - 1) * query.limit },
        { $limit: query.limit },
      ]).exec(),
      ProductModel.aggregate<{ total: number }>([...stages, { $count: "total" }]).exec(),
    ]);
    const total = counts[0]?.total ?? 0;
    return {
      items: items.map(summaryDto),
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.ceil(total / query.limit),
    };
  }

  async facets(query: CatalogueQuery): Promise<CatalogueFacets> {
    interface FacetAggregation {
      audiences: Array<{ _id: unknown; count: number }>;
      categories: Array<{ _id: unknown; count: number }>;
      collections: Array<{ _id: unknown; count: number }>;
      sizes: Array<{ _id: unknown; count: number }>;
      colours: Array<{ _id: unknown; count: number }>;
      fits: Array<{ _id: unknown; count: number }>;
      materials: Array<{ _id: unknown; count: number }>;
      ratings: Array<{ _id: unknown; count: number }>;
      availability: Array<{ _id: unknown; count: number }>;
      discounts: Array<{
        _id: null;
        d10: number;
        d20: number;
        d30: number;
        d40: number;
        d50: number;
      }>;
      price: Array<{ minPaise: number; maxPaise: number }>;
    }
    const group = (field: string): mongoose.PipelineStage.FacetPipelineStage[] => [
      { $unwind: field },
      { $group: { _id: field, count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
    ];
    const stages = await this.publicStages(query);
    const [result] = await ProductModel.aggregate<FacetAggregation>([
      ...stages,
      {
        $facet: {
          audiences: [
            { $group: { _id: "$audience", count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } },
          ],
          categories: group("$categoryIds"),
          collections: group("$collectionIds"),
          sizes: group("$variants.size"),
          colours: group("$variants.colour"),
          fits: [
            { $match: { fit: { $type: "string", $ne: "" } } },
            { $group: { _id: "$fit", count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } },
          ],
          materials: [
            { $match: { material: { $type: "string", $ne: "" } } },
            { $group: { _id: "$material", count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } },
          ],
          ratings: [
            { $group: { _id: { $floor: "$rating.average" }, count: { $sum: 1 } } },
            { $sort: { _id: -1 } },
          ],
          availability: [
            {
              $group: {
                _id: { $cond: ["$available", "in_stock", "out_of_stock"] },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
          discounts: [
            {
              $group: {
                _id: null,
                d10: { $sum: { $cond: [{ $gte: ["$maxDiscountPercent", 0.1] }, 1, 0] } },
                d20: { $sum: { $cond: [{ $gte: ["$maxDiscountPercent", 0.2] }, 1, 0] } },
                d30: { $sum: { $cond: [{ $gte: ["$maxDiscountPercent", 0.3] }, 1, 0] } },
                d40: { $sum: { $cond: [{ $gte: ["$maxDiscountPercent", 0.4] }, 1, 0] } },
                d50: { $sum: { $cond: [{ $gte: ["$maxDiscountPercent", 0.5] }, 1, 0] } },
              },
            },
          ],
          price: [
            { $unwind: "$variants" },
            {
              $group: {
                _id: null,
                minPaise: { $min: "$variants.salePricePaise" },
                maxPaise: { $max: "$variants.salePricePaise" },
              },
            },
          ],
        },
      },
    ]).exec();
    const values = (items: Array<{ _id: unknown; count: number }> | undefined) =>
      (items ?? []).map((item) => ({
        value: String(item._id),
        label: String(item._id),
        count: item.count,
      }));
    const categoryIds = (result?.categories ?? []).map((item) => item._id);
    const collectionIds = (result?.collections ?? []).map((item) => item._id);
    const [categories, collections] = await Promise.all([
      CategoryModel.find({ _id: { $in: categoryIds } })
        .select("name slug")
        .lean()
        .exec(),
      CollectionModel.find({ _id: { $in: collectionIds } })
        .select("name slug")
        .lean()
        .exec(),
    ]);
    const categoryLabels = new Map(
      categories.map((category) => [
        String(category._id),
        { label: category.name, value: category.slug },
      ]),
    );
    const collectionLabels = new Map(
      collections.map((collection) => [
        String(collection._id),
        { label: collection.name, value: collection.slug },
      ]),
    );
    const labelled = (
      items: Array<{ _id: unknown; count: number }> | undefined,
      labels: ReadonlyMap<string, { label: string; value: string }>,
    ) =>
      (items ?? []).flatMap((item) => {
        const label = labels.get(String(item._id));
        return label ? [{ ...label, count: item.count }] : [];
      });
    const discounts = result?.discounts[0];
    return {
      audiences: values(result?.audiences),
      categories: labelled(result?.categories, categoryLabels),
      collections: labelled(result?.collections, collectionLabels),
      sizes: values(result?.sizes),
      colours: values(result?.colours),
      fits: values(result?.fits),
      materials: values(result?.materials),
      ratings: values(result?.ratings),
      availability: values(result?.availability),
      discounts: discounts
        ? [
            { value: "10", label: "10% and above", count: discounts.d10 },
            { value: "20", label: "20% and above", count: discounts.d20 },
            { value: "30", label: "30% and above", count: discounts.d30 },
            { value: "40", label: "40% and above", count: discounts.d40 },
            { value: "50", label: "50% and above", count: discounts.d50 },
          ].filter((item) => item.count > 0)
        : [],
      price: {
        minPaise: result?.price[0]?.minPaise ?? 0,
        maxPaise: result?.price[0]?.maxPaise ?? 0,
      },
    };
  }

  async suggestions(search: string) {
    const [page, categories] = await Promise.all([
      this.listPublic({
        page: 1,
        limit: 5,
        availability: "all",
        search,
        sort: "relevance",
      }),
      CategoryModel.find({ active: true, name: escapedRegex(search) })
        .select("name slug")
        .sort({ sortOrder: 1, name: 1 })
        .limit(5)
        .lean()
        .exec(),
    ]);
    return {
      products: page.items.map((product) => ({
        id: product.id,
        title: product.title,
        slug: product.slug,
        minSalePricePaise: product.minSalePricePaise,
        ...(product.primaryImage ? { primaryImage: product.primaryImage } : {}),
      })),
      categories: categories.map((category) => ({
        name: category.name,
        slug: category.slug,
      })),
    };
  }

  async recordSearchAnalytics(input: {
    queryHash: string;
    queryLength: number;
    resultCount: number;
  }): Promise<void> {
    await SearchQueryEventModel.create({ ...input, occurredAt: new Date() });
  }

  private async aggregateOne(
    match: Record<string, unknown>,
    activeVariantsOnly = false,
  ): Promise<AggregateProduct | null> {
    const lookup = activeVariantsOnly
      ? {
          from: ProductVariantModel.collection.name,
          let: { productId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$productId", "$$productId"] }, status: "active" } },
          ],
          as: "variants",
        }
      : {
          from: ProductVariantModel.collection.name,
          localField: "_id",
          foreignField: "productId",
          as: "variants",
        };
    const [product] = await ProductModel.aggregate<AggregateProduct>([
      { $match: match },
      { $lookup: lookup },
      {
        $addFields: {
          minMrpPaise: { $ifNull: [{ $min: "$variants.mrpPaise" }, 0] },
          minSalePricePaise: { $ifNull: [{ $min: "$variants.salePricePaise" }, 0] },
          available: {
            $anyElementTrue: {
              $map: {
                input: "$variants",
                as: "variant",
                in: {
                  $and: [
                    { $eq: ["$$variant.status", "active"] },
                    {
                      $gt: [{ $subtract: ["$$variant.stockOnHand", "$$variant.stockReserved"] }, 0],
                    },
                  ],
                },
              },
            },
          },
        },
      },
    ]).exec();
    return product ?? null;
  }
  async findPublicBySlug(slug: string) {
    const product = await this.aggregateOne(
      { slug, status: "active", publishedAt: { $lte: new Date() } },
      true,
    );
    return product?.variants.length ? detailDto(product) : null;
  }
  async findPublicSlugRedirect(slug: string): Promise<string | null> {
    const product = await ProductModel.findOne({
      previousSlugs: slug,
      publishedAt: { $lte: new Date() },
      status: "active",
    })
      .select("slug")
      .lean()
      .exec();
    return product?.slug ?? null;
  }
  async related(slug: string, limit: number) {
    const source = await ProductModel.findOne({
      slug,
      status: "active",
      publishedAt: { $lte: new Date() },
    })
      .lean()
      .exec();
    if (!source) return [];
    const items = await ProductModel.aggregate<AggregateProduct>([
      {
        $match: {
          _id: { $ne: source._id },
          status: "active",
          publishedAt: { $lte: new Date() },
          $or: [{ categoryIds: { $in: source.categoryIds } }, { audience: source.audience }],
        },
      },
      {
        $lookup: {
          from: ProductVariantModel.collection.name,
          let: { productId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$productId", "$$productId"] }, status: "active" } },
          ],
          as: "variants",
        },
      },
      { $match: { "variants.0": { $exists: true } } },
      {
        $addFields: {
          minMrpPaise: { $min: "$variants.mrpPaise" },
          minSalePricePaise: { $min: "$variants.salePricePaise" },
          available: {
            $anyElementTrue: {
              $map: {
                input: "$variants",
                as: "variant",
                in: {
                  $gt: [{ $subtract: ["$$variant.stockOnHand", "$$variant.stockReserved"] }, 0],
                },
              },
            },
          },
        },
      },
      { $sort: { featured: -1, publishedAt: -1 } },
      { $limit: limit },
    ]).exec();
    return items.map(summaryDto);
  }

  async listAdmin(input: AdminProductListInput): Promise<PageResult<AdminProductRecord>> {
    const match: Record<string, unknown> = {};
    if (input.status) match.status = input.status;
    if (input.audience) match.audience = input.audience;
    if (input.search) {
      const skuProducts = await ProductVariantModel.find({
        sku: escapedRegex(input.search),
      }).distinct("productId");
      match.$or = [
        { title: escapedRegex(input.search) },
        { slug: escapedRegex(input.search) },
        { _id: { $in: skuProducts } },
      ];
    }
    if (input.categoryId && Types.ObjectId.isValid(input.categoryId))
      match.categoryIds = new Types.ObjectId(input.categoryId);
    if (input.collectionId && Types.ObjectId.isValid(input.collectionId))
      match.collectionIds = new Types.ObjectId(input.collectionId);
    if (input.sku) {
      const productIds = await ProductVariantModel.find({ sku: escapedRegex(input.sku) })
        .distinct("productId")
        .exec();
      match._id = { $in: productIds };
    }
    const total = await ProductModel.countDocuments(match);
    const products = await ProductModel.find(match)
      .sort({ updatedAt: -1 })
      .skip((input.page - 1) * input.limit)
      .limit(input.limit)
      .lean()
      .exec();
    const items = (
      await Promise.all(products.map((product) => this.aggregateOne({ _id: product._id })))
    )
      .filter((item): item is AggregateProduct => item !== null)
      .map(adminDto);
    return {
      items,
      page: input.page,
      limit: input.limit,
      total,
      pages: Math.ceil(total / input.limit),
    };
  }
  async findAdminById(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    const product = await this.aggregateOne({ _id: new Types.ObjectId(id) });
    return product ? adminDto(product) : null;
  }

  async create(input: ProductMutationInput, actorId?: string): Promise<AdminProductRecord> {
    await this.ensureAssignments(input.categoryIds, input.collectionIds);
    let productId = "";
    await mongoose.connection.transaction(async (session) => {
      const product = new ProductModel({
        title: input.title,
        slug: input.slug,
        shortDescription: input.shortDescription,
        descriptionHtml: input.descriptionHtml,
        categoryIds: input.categoryIds.map((id) => new Types.ObjectId(id)),
        collectionIds: input.collectionIds.map((id) => new Types.ObjectId(id)),
        audience: input.audience,
        brand: input.brand,
        tags: input.tags,
        media: [],
        ...(input.fit ? { fit: input.fit } : {}),
        material: input.material ?? null,
        care: input.care,
        status: input.status,
        featured: input.featured,
        newArrival: input.newArrival ?? false,
        seo: input.seo,
        rating: { average: 0, count: 0 },
        ...(input.status === "active" ? { publishedAt: new Date() } : {}),
      });
      await product.save({ session });
      productId = product.id;
      for (const variant of input.variants) {
        const document = new ProductVariantModel({
          productId: product._id,
          sku: variant.sku,
          colour: variant.colour,
          ...(variant.colourHex ? { colourHex: variant.colourHex } : {}),
          size: variant.size,
          attributes: new Map(Object.entries(variant.attributes)),
          mrpPaise: variant.mrpPaise,
          salePricePaise: variant.salePricePaise,
          taxRateBps: variant.taxRateBps,
          hsn: variant.hsn,
          stockOnHand: variant.initialStock ?? 0,
          stockReserved: 0,
          reorderLevel: variant.reorderLevel ?? 0,
          weightGrams: variant.weightGrams,
          ...(variant.dimensionsMm ? { dimensionsMm: variant.dimensionsMm } : {}),
          imagePublicIds: [],
          status: variant.status,
        });
        await document.save({ session });
        await this.recordInitialStock(document, session, actorId);
      }
    });
    return (await this.findAdminById(productId))!;
  }
  async update(id: string, input: ProductPatchMutation, actorId?: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    const existing = await ProductModel.findById(id)
      .select("status publishedAt slug previousSlugs")
      .lean()
      .exec();
    if (!existing) return null;
    await this.ensureAssignments(input.categoryIds, input.collectionIds);
    const update = Object.fromEntries(
      Object.entries(input).filter((entry) => entry[1] !== undefined && entry[0] !== "variants"),
    ) as Record<string, unknown>;
    if (input.categoryIds)
      update.categoryIds = input.categoryIds.map((value) => new Types.ObjectId(value));
    if (input.collectionIds)
      update.collectionIds = input.collectionIds.map((value) => new Types.ObjectId(value));
    if (input.status === "active" && (existing.status !== "active" || !existing.publishedAt))
      update.publishedAt = new Date();
    const operators: Record<string, unknown> = { $set: update };
    if (input.slug && input.slug !== existing.slug) {
      update.previousSlugs = [
        ...new Set([...(existing.previousSlugs ?? []), existing.slug]),
      ].filter((slug) => slug !== input.slug);
    }
    await mongoose.connection.transaction(async (session) => {
      await ProductModel.updateOne({ _id: id }, operators, { runValidators: true, session }).exec();
      if (input.variants) await this.writeVariants(id, input.variants, session, actorId);
    });
    return this.findAdminById(id);
  }
  async setStatus(id: string, status: ProductStatus) {
    return this.update(id, { status });
  }
  private async recordInitialStock(
    variant: ProductVariant & { _id: Types.ObjectId },
    session: mongoose.ClientSession,
    actorId?: string,
  ) {
    if (!variant.stockOnHand) return;
    await InventoryMovementModel.create(
      [
        {
          productId: variant.productId,
          variantId: variant._id,
          type: "manual_adjustment",
          quantityDelta: variant.stockOnHand,
          stockBefore: 0,
          stockAfter: variant.stockOnHand,
          reason: "Initial stock entered in product editor",
          ...(actorId ? { actorId } : {}),
        },
      ],
      { session },
    );
  }
  async replaceVariants(id: string, variants: readonly VariantInput[], actorId?: string) {
    if (!Types.ObjectId.isValid(id) || !(await ProductModel.exists({ _id: id }))) return null;
    await mongoose.connection.transaction((session) =>
      this.writeVariants(id, variants, session, actorId),
    );
    return this.findAdminById(id);
  }
  private async writeVariants(
    id: string,
    variants: readonly VariantInput[],
    session: mongoose.ClientSession,
    actorId?: string,
  ) {
    const ids = variants.flatMap((variant) => (variant.id ? [variant.id] : []));
    if (new Set(ids).size !== ids.length) throw new Error("INVALID_VARIANT_MATRIX");
    const keep: Types.ObjectId[] = [];
    for (const variant of variants) {
      const fields = {
        sku: variant.sku,
        colour: variant.colour,
        size: variant.size,
        attributes: new Map(Object.entries(variant.attributes)),
        mrpPaise: variant.mrpPaise,
        salePricePaise: variant.salePricePaise,
        taxRateBps: variant.taxRateBps,
        hsn: variant.hsn,
        weightGrams: variant.weightGrams,
        ...(variant.reorderLevel !== undefined ? { reorderLevel: variant.reorderLevel } : {}),
        ...(variant.colourHex ? { colourHex: variant.colourHex } : {}),
        ...(variant.dimensionsMm ? { dimensionsMm: variant.dimensionsMm } : {}),
        status: variant.status,
      };
      if (variant.id && Types.ObjectId.isValid(variant.id)) {
        const updated = await ProductVariantModel.updateOne(
          { _id: variant.id, productId: id },
          { $set: fields, ...(!variant.colourHex ? { $unset: { colourHex: 1 } } : {}) },
          { session, runValidators: true },
        );
        if (updated.matchedCount !== 1) throw new Error("INVALID_VARIANT_MATRIX");
        keep.push(new Types.ObjectId(variant.id));
      } else {
        const created = new ProductVariantModel({
          ...fields,
          productId: new Types.ObjectId(id),
          stockOnHand: variant.initialStock ?? 0,
          stockReserved: 0,
          reorderLevel: variant.reorderLevel ?? 0,
          imagePublicIds: [],
        });
        await created.save({ session });
        await this.recordInitialStock(created, session, actorId);
        keep.push(created._id);
      }
    }
    await ProductVariantModel.updateMany(
      { productId: id, _id: { $nin: keep } },
      { $set: { status: "inactive" } },
      { session },
    );
  }
  async bulkUpdate(
    productIds: readonly string[],
    update: { status?: ProductStatus; categoryIds?: readonly string[] },
  ) {
    await this.ensureAssignments(update.categoryIds, undefined);
    const ids = productIds.filter(Types.ObjectId.isValid);
    const $set: Record<string, unknown> = {};
    if (update.status) {
      $set.status = update.status;
      if (update.status === "active") $set.publishedAt = new Date();
    }
    if (update.categoryIds)
      $set.categoryIds = update.categoryIds
        .filter(Types.ObjectId.isValid)
        .map((id) => new Types.ObjectId(id));
    const result = await ProductModel.updateMany({ _id: { $in: ids } }, { $set }).exec();
    return result.modifiedCount;
  }
  async attachMedia(id: string, media: Omit<ProductMediaDto, "sortOrder">) {
    const product = await ProductModel.findById(id).select("media").lean().exec();
    if (!product) return null;
    const sortOrder = product.media.length;
    const next: ProductMedia[] = product.media.map((item) => ({
      ...item,
      primary: media.primary ? false : item.primary,
    }));
    next.push({
      ...media,
      format: media.format as ProductMedia["format"],
      sortOrder,
      primary: media.primary || next.length === 0,
    });
    await ProductModel.updateOne({ _id: id }, { $set: { media: next } }).exec();
    return this.findAdminById(id);
  }
  async reorderMedia(id: string, orderedPublicIds: readonly string[], primaryPublicId: string) {
    const product = await ProductModel.findById(id).select("media").lean().exec();
    if (
      !product ||
      orderedPublicIds.length !== product.media.length ||
      new Set(orderedPublicIds).size !== product.media.length ||
      !orderedPublicIds.includes(primaryPublicId)
    )
      return null;
    const byId = new Map(product.media.map((item) => [item.publicId, item]));
    if (orderedPublicIds.some((publicId) => !byId.has(publicId))) return null;
    const media = orderedPublicIds.map((publicId, sortOrder) => ({
      ...byId.get(publicId)!,
      sortOrder,
      primary: publicId === primaryPublicId,
    }));
    await ProductModel.updateOne({ _id: id }, { $set: { media } }).exec();
    return this.findAdminById(id);
  }
  countMediaReferences(publicId: string) {
    return ProductModel.countDocuments({ "media.publicId": publicId }).exec();
  }
  async removeMediaReference(id: string, publicId: string) {
    const result = await ProductModel.updateOne(
      { _id: id, "media.publicId": publicId },
      { $pull: { media: { publicId } } },
    ).exec();
    return result.modifiedCount === 1;
  }
  async exportAll() {
    const products = await ProductModel.aggregate<AggregateProduct>([
      {
        $lookup: {
          from: ProductVariantModel.collection.name,
          localField: "_id",
          foreignField: "productId",
          as: "variants",
        },
      },
      {
        $addFields: {
          minMrpPaise: { $ifNull: [{ $min: "$variants.mrpPaise" }, 0] },
          minSalePricePaise: { $ifNull: [{ $min: "$variants.salePricePaise" }, 0] },
          available: {
            $anyElementTrue: {
              $map: {
                input: "$variants",
                as: "variant",
                in: {
                  $gt: [{ $subtract: ["$$variant.stockOnHand", "$$variant.stockReserved"] }, 0],
                },
              },
            },
          },
        },
      },
      { $sort: { updatedAt: -1 } },
    ]).exec();
    return products.map(adminDto);
  }
  async adjustInventory(input: {
    actorId: string;
    quantityDelta: number;
    reason: string;
    requestId?: string;
    variantId: string;
  }) {
    let output: { productId: string; stockAfter: number; stockBefore: number } | null = null;
    await mongoose.connection.transaction(async (session) => {
      const variant = await ProductVariantModel.findById(input.variantId).session(session).exec();
      if (!variant) throw new Error("Variant not found.");
      const stockBefore = variant.stockOnHand;
      const stockAfter = stockBefore + input.quantityDelta;
      if (stockAfter < 0 || stockAfter < variant.stockReserved)
        throw new Error("Inventory adjustment would make available stock negative.");
      const updated = await ProductVariantModel.updateOne(
        { _id: variant._id, stockOnHand: stockBefore },
        { $set: { stockOnHand: stockAfter } },
        { session },
      );
      if (updated.modifiedCount !== 1)
        throw new Error("Inventory changed concurrently; retry the adjustment.");
      await InventoryMovementModel.create(
        [
          {
            productId: variant.productId,
            variantId: variant._id,
            type: "manual_adjustment",
            quantityDelta: input.quantityDelta,
            stockBefore,
            stockAfter,
            reason: input.reason,
            actorId: input.actorId,
            ...(input.requestId ? { requestId: input.requestId } : {}),
          },
        ],
        { session },
      );
      output = { productId: variant.productId.toString(), stockAfter, stockBefore };
    });
    if (!output) throw new Error("Inventory adjustment failed.");
    return output;
  }
}
