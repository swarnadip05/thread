import type {
  AdminHomepageDto,
  HomepageCollectionOptionDto,
  HomepageImageDto,
  HomepageItemDto,
  HomepageSectionDto,
  PublicHomepageDto,
} from "@thread/types";
import type { HomepageDraftUpdateInput } from "@thread/validation";

import { CollectionModel } from "../catalogue/models/collection.model.js";
import {
  HomepageContentModel,
  type HomepageImageRecord,
  type HomepageItemRecord,
  type HomepageSectionRecord,
  type HomepageVersionRecord,
} from "../models/homepage-content.model.js";
import { NewsletterSubscriptionModel } from "../models/newsletter-subscription.model.js";

function imageDto(image: HomepageImageRecord): HomepageImageDto {
  return {
    source: image.source,
    src: image.src,
    ...(image.publicId ? { publicId: image.publicId } : {}),
    width: image.width,
    height: image.height,
    ...(image.format ? { format: image.format } : {}),
    ...(image.mimeType ? { mimeType: image.mimeType } : {}),
    ...(image.bytes ? { bytes: image.bytes } : {}),
    alt: image.alt,
  };
}

function itemDto(item: HomepageItemRecord): HomepageItemDto {
  return {
    id: item.id,
    title: item.title,
    ...(item.subtitle ? { subtitle: item.subtitle } : {}),
    ...(item.body ? { body: item.body } : {}),
    ...(item.href ? { href: item.href } : {}),
    ...(item.image ? { image: imageDto(item.image) } : {}),
    ...(item.icon ? { icon: item.icon } : {}),
  };
}

function sectionDto(section: HomepageSectionRecord): HomepageSectionDto {
  return {
    id: section.id,
    type: section.type,
    enabled: section.enabled,
    sortOrder: section.sortOrder,
    ...(section.startsAt ? { startsAt: section.startsAt.toISOString() } : {}),
    ...(section.endsAt ? { endsAt: section.endsAt.toISOString() } : {}),
    ...(section.eyebrow ? { eyebrow: section.eyebrow } : {}),
    title: section.title,
    ...(section.subtitle ? { subtitle: section.subtitle } : {}),
    ...(section.body ? { body: section.body } : {}),
    ...(section.primaryCta ? { primaryCta: { ...section.primaryCta } } : {}),
    ...(section.secondaryCta ? { secondaryCta: { ...section.secondaryCta } } : {}),
    ...(section.desktopImage ? { desktopImage: imageDto(section.desktopImage) } : {}),
    ...(section.mobileImage ? { mobileImage: imageDto(section.mobileImage) } : {}),
    collectionSlugs: [...section.collectionSlugs],
    items: section.items.map(itemDto),
    needsClientReview: section.needsClientReview,
  };
}

function versionDto(version: HomepageVersionRecord): PublicHomepageDto {
  return {
    version: version.version,
    sections: version.sections.map(sectionDto),
    updatedAt: version.updatedAt.toISOString(),
  };
}

function imageRecord(
  image: NonNullable<HomepageDraftUpdateInput["sections"][number]["desktopImage"]>,
): HomepageImageRecord {
  return {
    source: image.source,
    src: image.src,
    ...(image.publicId ? { publicId: image.publicId } : {}),
    width: image.width,
    height: image.height,
    ...(image.format ? { format: image.format } : {}),
    ...(image.mimeType ? { mimeType: image.mimeType } : {}),
    ...(image.bytes ? { bytes: image.bytes } : {}),
    alt: image.alt,
  };
}

function itemRecord(
  item: HomepageDraftUpdateInput["sections"][number]["items"][number],
): HomepageItemRecord {
  return {
    id: item.id,
    title: item.title,
    ...(item.subtitle ? { subtitle: item.subtitle } : {}),
    ...(item.body ? { body: item.body } : {}),
    ...(item.href ? { href: item.href } : {}),
    ...(item.image ? { image: imageRecord(item.image) } : {}),
    ...(item.icon ? { icon: item.icon } : {}),
  };
}

function toRecord(section: HomepageDraftUpdateInput["sections"][number]): HomepageSectionRecord {
  return {
    id: section.id,
    type: section.type,
    enabled: section.enabled,
    sortOrder: section.sortOrder,
    ...(section.startsAt ? { startsAt: new Date(section.startsAt) } : {}),
    ...(section.endsAt ? { endsAt: new Date(section.endsAt) } : {}),
    ...(section.eyebrow ? { eyebrow: section.eyebrow } : {}),
    title: section.title,
    ...(section.subtitle ? { subtitle: section.subtitle } : {}),
    ...(section.body ? { body: section.body } : {}),
    ...(section.primaryCta ? { primaryCta: section.primaryCta } : {}),
    ...(section.secondaryCta ? { secondaryCta: section.secondaryCta } : {}),
    ...(section.desktopImage ? { desktopImage: imageRecord(section.desktopImage) } : {}),
    ...(section.mobileImage ? { mobileImage: imageRecord(section.mobileImage) } : {}),
    collectionSlugs: section.collectionSlugs,
    items: section.items.map(itemRecord),
    needsClientReview: section.needsClientReview,
  };
}

export interface HomepageRepository {
  get(): Promise<AdminHomepageDto | null>;
  updateDraft(sections: HomepageDraftUpdateInput["sections"]): Promise<AdminHomepageDto | null>;
  publish(): Promise<AdminHomepageDto | null>;
  collections(): Promise<readonly HomepageCollectionOptionDto[]>;
  collectionsExist(slugs: readonly string[]): Promise<boolean>;
  subscribe(email: string): Promise<void>;
}

export class MongooseHomepageRepository implements HomepageRepository {
  async get(): Promise<AdminHomepageDto | null> {
    const document = await HomepageContentModel.findOne({ key: "default" }).lean().exec();
    return document
      ? { draft: versionDto(document.draft), published: versionDto(document.published) }
      : null;
  }

  async updateDraft(
    sections: HomepageDraftUpdateInput["sections"],
  ): Promise<AdminHomepageDto | null> {
    const document = await HomepageContentModel.findOneAndUpdate(
      { key: "default" },
      {
        $set: {
          "draft.sections": sections.map(toRecord),
          "draft.updatedAt": new Date(),
        },
        $inc: { "draft.version": 1 },
      },
      { new: true, runValidators: true },
    )
      .lean()
      .exec();
    return document
      ? { draft: versionDto(document.draft), published: versionDto(document.published) }
      : null;
  }

  async publish(): Promise<AdminHomepageDto | null> {
    const current = await HomepageContentModel.findOne({ key: "default" }).lean().exec();
    if (!current) return null;
    const document = await HomepageContentModel.findOneAndUpdate(
      { key: "default", "draft.version": current.draft.version },
      {
        $set: {
          published: {
            version: current.draft.version,
            sections: current.draft.sections,
            updatedAt: new Date(),
          },
        },
      },
      { new: true, runValidators: true },
    )
      .lean()
      .exec();
    return document
      ? { draft: versionDto(document.draft), published: versionDto(document.published) }
      : null;
  }

  async collections(): Promise<readonly HomepageCollectionOptionDto[]> {
    const collections = await CollectionModel.find()
      .select("_id name slug active")
      .sort({ active: -1, name: 1 })
      .lean()
      .exec();
    return collections.map((collection) => ({
      id: collection._id.toString(),
      name: collection.name,
      slug: collection.slug,
      active: collection.active,
    }));
  }

  async collectionsExist(slugs: readonly string[]): Promise<boolean> {
    if (!slugs.length) return true;
    const count = await CollectionModel.countDocuments({ slug: { $in: [...new Set(slugs)] } });
    return count === new Set(slugs).size;
  }

  async subscribe(email: string): Promise<void> {
    await NewsletterSubscriptionModel.updateOne(
      { email },
      {
        $set: { consentAt: new Date(), status: "subscribed" },
        $setOnInsert: { email, source: "homepage" },
      },
      { upsert: true, runValidators: true },
    );
  }
}
