import {
  model,
  models,
  Schema,
  type HydratedDocument,
  type Model,
  type Types,
} from "../database/mongoose-runtime.js";

export interface Category {
  name: string;
  slug: string;
  audience: "men" | "women" | "unisex" | "accessories";
  parentId?: Types.ObjectId | null;
  image?: { url: string; alt: string };
  menuGroup?: string;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<Category>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 120 },
    audience: { type: String, enum: ["men", "women", "unisex", "accessories"], required: true },
    parentId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    image: { url: { type: String, trim: true }, alt: { type: String, trim: true, maxlength: 160 } },
    menuGroup: { type: String, trim: true, maxlength: 80 },
    active: { type: Boolean, default: false, required: true },
    sortOrder: { type: Number, default: 0, min: 0, required: true },
  },
  { strict: "throw", timestamps: true },
);

categorySchema.index({ slug: 1 }, { unique: true, name: "category_slug_unique" });
categorySchema.index(
  { active: 1, audience: 1, sortOrder: 1 },
  { name: "category_public_navigation" },
);
categorySchema.index({ parentId: 1, sortOrder: 1 }, { name: "category_parent_sort" });

export type CategoryDocument = HydratedDocument<Category>;
export const CategoryModel: Model<Category> =
  models.Category ?? model<Category>("Category", categorySchema);
