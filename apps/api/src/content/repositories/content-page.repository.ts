import { ContentPageModel, type ContentPageRecord } from "../../models/content-page.model.js";

export interface ContentPageRepository {
  findActive(slug: string): Promise<ContentPageRecord | null>;
  listAll(): Promise<readonly ContentPageRecord[]>;
  upsert(
    slug: string,
    input: Omit<ContentPageRecord, "slug" | "createdAt" | "updatedAt">,
  ): Promise<ContentPageRecord>;
  countNeedsReview(): Promise<number>;
}

export class MongooseContentPageRepository implements ContentPageRepository {
  async findActive(slug: string): Promise<ContentPageRecord | null> {
    const document = await ContentPageModel.findOne({ slug, active: true }).exec();
    return document?.toObject() ?? null;
  }
  async listAll(): Promise<readonly ContentPageRecord[]> {
    return (await ContentPageModel.find().sort({ slug: 1 }).exec()).map((document) =>
      document.toObject(),
    );
  }
  async upsert(
    slug: string,
    input: Omit<ContentPageRecord, "slug" | "createdAt" | "updatedAt">,
  ): Promise<ContentPageRecord> {
    const document = await ContentPageModel.findOneAndUpdate(
      { slug },
      { $set: input, $setOnInsert: { slug } },
      { new: true, runValidators: true, upsert: true },
    ).exec();
    return document.toObject();
  }
  countNeedsReview(): Promise<number> {
    return ContentPageModel.countDocuments({ needsClientReview: true }).exec();
  }
}
