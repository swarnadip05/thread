import type {
  ProductAudience,
  ProductDetailDto,
  ProductFacetsDto,
  ProductMediaDto,
  ProductSearchSuggestionsDto,
  ProductStatus,
  ProductSummaryDto,
} from "@thread/types";
import type {
  CatalogueQuery,
  ProductPatchInput,
  ProductWriteInput,
  VariantInput,
} from "@thread/validation";

export interface PageResult<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly pages: number;
}
export type CatalogueFacets = ProductFacetsDto;
export interface AdminProductListInput {
  readonly page: number;
  readonly limit: number;
  readonly search?: string;
  readonly status?: ProductStatus;
  readonly audience?: ProductAudience;
  readonly categoryId?: string;
  readonly collectionId?: string;
  readonly sku?: string;
}
export interface AdminProductRecord extends ProductDetailDto {
  readonly status: ProductStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}
export interface ProductMutationInput extends Omit<ProductWriteInput, "variants"> {
  readonly descriptionHtml: string;
  readonly variants: readonly VariantInput[];
}
export type ProductPatchMutation = ProductPatchInput;
export interface CatalogueRepository {
  listPublic(query: CatalogueQuery): Promise<PageResult<ProductSummaryDto>>;
  facets(query: CatalogueQuery): Promise<CatalogueFacets>;
  suggestions(search: string): Promise<ProductSearchSuggestionsDto>;
  recordSearchAnalytics(input: {
    queryHash: string;
    queryLength: number;
    resultCount: number;
  }): Promise<void>;
  findPublicBySlug(slug: string): Promise<ProductDetailDto | null>;
  findPublicSlugRedirect(slug: string): Promise<string | null>;
  related(slug: string, limit: number): Promise<readonly ProductSummaryDto[]>;
  listAdmin(input: AdminProductListInput): Promise<PageResult<AdminProductRecord>>;
  findAdminById(id: string): Promise<AdminProductRecord | null>;
  create(input: ProductMutationInput): Promise<AdminProductRecord>;
  update(id: string, input: ProductPatchMutation): Promise<AdminProductRecord | null>;
  setStatus(id: string, status: ProductStatus): Promise<AdminProductRecord | null>;
  replaceVariants(
    id: string,
    variants: readonly VariantInput[],
  ): Promise<AdminProductRecord | null>;
  bulkUpdate(
    productIds: readonly string[],
    update: { status?: ProductStatus; categoryIds?: readonly string[] },
  ): Promise<number>;
  attachMedia(
    id: string,
    media: Omit<ProductMediaDto, "sortOrder">,
  ): Promise<AdminProductRecord | null>;
  reorderMedia(
    id: string,
    orderedPublicIds: readonly string[],
    primaryPublicId: string,
  ): Promise<AdminProductRecord | null>;
  countMediaReferences(publicId: string): Promise<number>;
  removeMediaReference(id: string, publicId: string): Promise<boolean>;
  exportAll(): Promise<readonly AdminProductRecord[]>;
  adjustInventory(input: {
    actorId: string;
    quantityDelta: number;
    reason: string;
    requestId?: string;
    variantId: string;
  }): Promise<{ productId: string; stockAfter: number; stockBefore: number }>;
}

export interface PreviewTokenClaims {
  readonly productId: string;
}
export type { CatalogueQuery, ProductAudience, ProductStatus };
