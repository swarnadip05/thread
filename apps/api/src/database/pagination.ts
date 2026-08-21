import type mongoose from "mongoose";
import type { Model, ProjectionType, SortOrder } from "mongoose";

export interface PaginationInput {
  readonly limit?: number;
  readonly page?: number;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly pagination: {
    readonly limit: number;
    readonly page: number;
    readonly pages: number;
    readonly total: number;
  };
}

function normalizePagination(input: PaginationInput) {
  const page = Math.max(1, Math.trunc(input.page ?? 1));
  const limit = Math.min(100, Math.max(1, Math.trunc(input.limit ?? 20)));
  return { limit, page, skip: (page - 1) * limit };
}

/** Returns plain read-only objects and always caps page size to prevent unbounded reads. */
export async function paginateLean<T>(
  model: Model<T>,
  filter: mongoose.QueryFilter<T>,
  input: PaginationInput,
  options: {
    readonly projection?: ProjectionType<T>;
    readonly sort?: Record<string, SortOrder>;
  } = {},
): Promise<PaginatedResult<T>> {
  const { limit, page, skip } = normalizePagination(input);
  const [items, total] = await Promise.all([
    model
      .find(filter, options.projection)
      .sort(options.sort ?? { _id: 1 })
      .skip(skip)
      .limit(limit)
      .lean<T[]>()
      .exec(),
    model.countDocuments(filter).exec(),
  ]);
  return { items, pagination: { limit, page, pages: Math.ceil(total / limit), total } };
}
