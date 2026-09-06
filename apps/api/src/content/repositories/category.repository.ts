import { ProductModel } from "../../catalogue/models/product.model.js";
import { HttpError } from "../../middleware/error-handler.js";
import { Types, type UpdateQuery } from "mongoose";

import {
  CategoryModel,
  type Category,
  type CategoryDocument,
} from "../../models/category.model.js";

export interface CategoryData {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly audience: "men" | "women" | "unisex" | "accessories";
  readonly parentId: string | null;
  readonly menuGroup?: string;
  readonly active: boolean;
  readonly sortOrder: number;
}
export interface CategoryWrite {
  name: string;
  slug: string;
  audience: CategoryData["audience"];
  parentId?: string | null;
  menuGroup?: string;
  active: boolean;
  sortOrder: number;
}
export interface CategoryRepository {
  list(): Promise<readonly CategoryData[]>;
  create(input: CategoryWrite): Promise<CategoryData>;
  update(id: string, input: Partial<CategoryWrite>): Promise<CategoryData | null>;
  remove(id: string): Promise<boolean>;
}

function toData(document: CategoryDocument): CategoryData {
  return {
    id: document.id,
    name: document.name,
    slug: document.slug,
    audience: document.audience,
    parentId: document.parentId?.toString() ?? null,
    ...(document.menuGroup ? { menuGroup: document.menuGroup } : {}),
    active: document.active,
    sortOrder: document.sortOrder,
  };
}

export class MongooseCategoryRepository implements CategoryRepository {
  private async ensureParent(
    id: string | undefined,
    parentId: string | null | undefined,
  ): Promise<void> {
    const visited = new Set(id ? [id] : []);
    let current = parentId;
    while (current) {
      if (visited.has(current))
        throw new HttpError(400, "CATEGORY_CYCLE", "A category cannot be its own ancestor.");
      visited.add(current);
      const parent = await CategoryModel.findById(current).select("parentId").lean();
      if (!parent) throw new HttpError(400, "INVALID_PARENT", "Parent category not found.");
      current = parent.parentId?.toString();
    }
  }
  async list(): Promise<readonly CategoryData[]> {
    return (await CategoryModel.find().sort({ audience: 1, sortOrder: 1, name: 1 }).exec()).map(
      toData,
    );
  }
  async create(input: CategoryWrite): Promise<CategoryData> {
    await this.ensureParent(undefined, input.parentId);
    return toData(await CategoryModel.create(toPersistence(input)));
  }
  async update(id: string, input: Partial<CategoryWrite>): Promise<CategoryData | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    await this.ensureParent(id, input.parentId);
    const document = await CategoryModel.findByIdAndUpdate(
      id,
      { $set: toPersistence(input) },
      { new: true, runValidators: true },
    ).exec();
    return document ? toData(document) : null;
  }
  async remove(id: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) return false;
    const objectId = new Types.ObjectId(id);
    if (await CategoryModel.exists({ parentId: objectId }))
      throw new Error("CATEGORY_HAS_CHILDREN");
    if (await ProductModel.exists({ categoryIds: objectId }))
      throw new HttpError(
        409,
        "CATEGORY_IN_USE",
        "Remove product assignments first, or deactivate this category.",
      );
    const result = await CategoryModel.deleteOne({ _id: objectId }).exec();
    return result.deletedCount === 1;
  }
}

function toPersistence(input: Partial<CategoryWrite>): UpdateQuery<Category> {
  const update: UpdateQuery<Category> = {};
  if (input.name !== undefined) update.name = input.name;
  if (input.slug !== undefined) update.slug = input.slug;
  if (input.audience !== undefined) update.audience = input.audience;
  if (input.parentId !== undefined)
    update.parentId = input.parentId ? new Types.ObjectId(input.parentId) : null;
  if (input.menuGroup !== undefined) update.menuGroup = input.menuGroup;
  if (input.active !== undefined) update.active = input.active;
  if (input.sortOrder !== undefined) update.sortOrder = input.sortOrder;
  return update;
}
