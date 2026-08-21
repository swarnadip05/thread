import { model, models, Schema, type Model } from "../../database/mongoose-runtime.js";

export interface Collection {
  name: string;
  slug: string;
  active: boolean;
  startsAt?: Date;
  endsAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const collectionSchema = new Schema<Collection>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    active: { type: Boolean, default: true, required: true },
    startsAt: Date,
    endsAt: Date,
  },
  { strict: "throw", timestamps: true },
);
collectionSchema.index({ slug: 1 }, { unique: true, name: "collection_slug_unique" });
collectionSchema.index(
  { active: 1, startsAt: 1, endsAt: 1 },
  { name: "collection_campaign_window" },
);
export const CollectionModel: Model<Collection> =
  models.Collection ?? model<Collection>("Collection", collectionSchema);
