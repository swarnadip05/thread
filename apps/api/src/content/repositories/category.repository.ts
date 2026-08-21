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
  async list(): Promise<readonly CategoryData[]> {
    return (await CategoryModel.find().sort({ audience: 1, sortOrder: 1, name: 1 }).exec()).map(
      toData,
    );
  }
  async create(input: CategoryWrite): Promise<CategoryData> {
    return toData(await CategoryModel.create(toPersistence(input)));
  }
  async update(id: string, input: Partial<CategoryWrite>): Promise<CategoryData | null> {
    if (!Types.ObjectId.isValid(id)) return null;
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
