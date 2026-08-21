import type { ClientSession } from "mongoose";
import { storefrontMedia } from "@thread/types";

import { CategoryModel } from "../models/category.model.js";
import { ContentPageModel } from "../models/content-page.model.js";
import { SeedMigrationModel } from "../models/seed-migration.model.js";
import { SiteSettingsModel } from "../models/site-settings.model.js";
import {
  HomepageContentModel,
  type HomepageSectionRecord,
} from "../models/homepage-content.model.js";
import {
  initialBusinessSettings,
  initialContentPages,
  initialFooterGroups,
  initialNavigation,
} from "./initial-content.js";
import { initialHomepageSections } from "./initial-homepage.js";

interface SeedMigration {
  version: string;
  description: string;
  up(session: ClientSession): Promise<void>;
}

function attachClientHomepageMedia(
  sections: readonly HomepageSectionRecord[],
): HomepageSectionRecord[] {
  return sections.map((section) => {
    if (section.id === "hero") {
      return {
        ...section,
        desktopImage: section.desktopImage ?? storefrontMedia.heroDesktop,
        mobileImage: section.mobileImage ?? storefrontMedia.heroMobile,
      };
    }
    if (section.id === "audience-cards") {
      return {
        ...section,
        items: section.items.map((item) => {
          if (item.id === "men")
            return { ...item, image: item.image ?? storefrontMedia.menAudience };
          if (item.id === "women")
            return { ...item, image: item.image ?? storefrontMedia.womenAudience };
          return item;
        }),
      };
    }
    if (section.id === "categories") {
      return {
        ...section,
        items: section.items.map((item) => {
          if (item.id === "t-shirts")
            return { ...item, image: item.image ?? storefrontMedia.tshirtsCategory };
          if (item.id === "oversized")
            return { ...item, image: item.image ?? storefrontMedia.oversizedCategory };
          if (item.id === "classic" || item.id === "regular")
            return {
              ...item,
              id: "regular",
              title: "Regular Fit",
              href: "/category/t-shirts?fit=Regular",
              image: item.image ?? storefrontMedia.regularCategory,
            };
          return item;
        }),
      };
    }
    if (section.id === "editorial") {
      return {
        ...section,
        desktopImage: section.desktopImage ?? storefrontMedia.editorial,
      };
    }
    return section;
  });
}

const populatedHomepageSectionIds = new Set([
  "new-arrivals",
  "best-sellers",
  "collections",
  "social",
]);

function populateEmptyHomepageSections(
  sections: readonly HomepageSectionRecord[],
): HomepageSectionRecord[] {
  return sections.map((section) => {
    if (!populatedHomepageSectionIds.has(section.id)) return section;
    const initial = initialHomepageSections.find((candidate) => candidate.id === section.id);
    if (!initial) return section;
    const isLegacySocialPlaceholder =
      section.id === "social" &&
      section.items.length === 1 &&
      section.items[0]?.id === "instagram" &&
      !section.items[0].href;
    if (section.items.length > 0 && !isLegacySocialPlaceholder) return section;
    return {
      ...section,
      ...(initial.subtitle ? { subtitle: initial.subtitle } : {}),
      items: initial.items,
      needsClientReview: initial.needsClientReview,
    };
  });
}

const migrations: readonly SeedMigration[] = [
  {
    version: "2026-07-26-navigation-content-v1",
    description:
      "Seed THREAD settings, dynamic navigation, categories and client-supplied business content",
    async up(session) {
      await SiteSettingsModel.updateOne(
        { key: "default" },
        {
          $setOnInsert: {
            key: "default",
            business: initialBusinessSettings,
            announcement: {
              enabled: true,
              text: "Customer support target: reply within 24 hours, Monday–Friday.",
            },
            navigation: { version: 1, items: initialNavigation },
            footerGroups: initialFooterGroups,
            socialLinks: [],
            returns: { windowDays: 7, requireInspectionBeforeRestock: true },
            payments: { onlineEnabled: false },
            seo: {
              defaultTitle: "THREAD",
              defaultDescription: "Discover THREAD fashion.",
            },
            maintenanceMode: false,
          },
        },
        { upsert: true, session },
      );
      const categories = [
        { name: "Men", slug: "men", audience: "men", active: true, sortOrder: 10 },
        { name: "Women", slug: "women", audience: "women", active: true, sortOrder: 20 },
        {
          name: "Accessories",
          slug: "accessories",
          audience: "accessories",
          active: false,
          sortOrder: 30,
        },
        { name: "T-Shirts", slug: "t-shirts", audience: "unisex", active: true, sortOrder: 40 },
        {
          name: "Oversized T-Shirts",
          slug: "oversized-t-shirts",
          audience: "men",
          active: true,
          sortOrder: 50,
        },
        {
          name: "Classic Fit T-Shirts",
          slug: "classic-fit-t-shirts",
          audience: "unisex",
          active: true,
          sortOrder: 60,
        },
        { name: "Hoodies", slug: "hoodies", audience: "unisex", active: false, sortOrder: 70 },
        {
          name: "Bottomwear",
          slug: "bottomwear",
          audience: "unisex",
          active: false,
          sortOrder: 80,
        },
        {
          name: "Footwear",
          slug: "footwear",
          audience: "accessories",
          active: false,
          sortOrder: 90,
        },
        { name: "Caps", slug: "caps", audience: "accessories", active: false, sortOrder: 100 },
        { name: "Bags", slug: "bags", audience: "accessories", active: false, sortOrder: 110 },
        {
          name: "Mobile Covers",
          slug: "mobile-covers",
          audience: "accessories",
          active: false,
          sortOrder: 120,
        },
      ] as const;
      await Promise.all(
        categories.map((category) =>
          CategoryModel.updateOne(
            { slug: category.slug },
            { $setOnInsert: category },
            { upsert: true, session },
          ),
        ),
      );
      await Promise.all(
        initialContentPages.map(({ slug, ...content }) =>
          ContentPageModel.updateOne(
            { slug },
            { $setOnInsert: { slug, ...content } },
            { upsert: true, session },
          ),
        ),
      );
    },
  },
  {
    version: "2026-07-26-homepage-content-v1",
    description: "Seed editable draft and published THREAD homepage content",
    async up(session) {
      const now = new Date();
      await HomepageContentModel.updateOne(
        { key: "default" },
        {
          $setOnInsert: {
            key: "default",
            draft: { version: 1, sections: initialHomepageSections, updatedAt: now },
            published: { version: 1, sections: initialHomepageSections, updatedAt: now },
          },
        },
        { upsert: true, session },
      );
    },
  },
  {
    version: "2026-07-27-operational-settings-v1",
    description: "Add editable return, payment-display and SEO settings",
    async up(session) {
      await SiteSettingsModel.updateOne(
        { key: "default" },
        {
          $set: {
            returns: { windowDays: 7, requireInspectionBeforeRestock: true },
            payments: { onlineEnabled: false },
            seo: {
              defaultTitle: "THREAD",
              defaultDescription: "Discover THREAD fashion.",
            },
          },
        },
        { session, runValidators: true },
      );
    },
  },
  {
    version: "2026-07-28-approved-client-media-v1",
    description: "Connect approved THREAD client photography to homepage and navigation defaults",
    async up(session) {
      const homepage = await HomepageContentModel.findOne({ key: "default" })
        .session(session)
        .lean();
      if (homepage) {
        await HomepageContentModel.updateOne(
          { key: "default" },
          {
            $set: {
              "draft.sections": attachClientHomepageMedia(homepage.draft.sections),
              "published.sections": attachClientHomepageMedia(homepage.published.sections),
            },
          },
          { runValidators: true, session },
        );
      }

      const settings = await SiteSettingsModel.findOne({ key: "default" }).session(session).lean();
      if (settings) {
        const items = settings.navigation.items.map((item) => {
          if (item.id === "men" && !item.promotionalTile)
            return {
              ...item,
              promotionalTile: {
                label: "Shop men's T-shirts",
                imageUrl: storefrontMedia.menMenu.src,
                alt: storefrontMedia.menMenu.alt,
                href: "/men",
              },
            };
          if (item.id === "women" && !item.promotionalTile)
            return {
              ...item,
              promotionalTile: {
                label: "Shop women's T-shirts",
                imageUrl: storefrontMedia.womenMenu.src,
                alt: storefrontMedia.womenMenu.alt,
                href: "/women",
              },
            };
          return item;
        });
        await SiteSettingsModel.updateOne(
          { key: "default" },
          {
            $set: {
              "navigation.items": items,
              "navigation.version": settings.navigation.version + 1,
            },
          },
          { runValidators: true, session },
        );
      }

      await ContentPageModel.updateOne(
        {
          slug: "size-guide",
          summary:
            "Size measurements and fit mapping require client confirmation before publication.",
        },
        {
          $set: {
            summary:
              "Review the supplied THREAD T-shirt measurement chart; its measurement unit and fit mapping still require client confirmation.",
            sections: [
              {
                id: "pending",
                heading: "Using this chart",
                paragraphs: [
                  "Compare the listed chest, length, sleeve, sleeve opening and shoulder measurements. Contact THREAD support before ordering if you need fit guidance.",
                ],
                items: [],
              },
            ],
          },
        },
        { runValidators: true, session },
      );
    },
  },
  {
    version: "2026-07-28-homepage-section-content-v1",
    description:
      "Populate empty THREAD homepage rails, collection edits and story links with approved media",
    async up(session) {
      const homepage = await HomepageContentModel.findOne({ key: "default" })
        .session(session)
        .lean();
      if (!homepage) return;
      await HomepageContentModel.updateOne(
        { key: "default" },
        {
          $set: {
            "draft.sections": populateEmptyHomepageSections(homepage.draft.sections),
            "published.sections": populateEmptyHomepageSections(homepage.published.sections),
          },
        },
        { runValidators: true, session },
      );
    },
  },
];

export async function runSeedMigrations(): Promise<void> {
  const session = await SeedMigrationModel.startSession();
  try {
    for (const migration of migrations) {
      if (await SeedMigrationModel.exists({ version: migration.version }).session(session))
        continue;
      await session.withTransaction(async () => {
        if (await SeedMigrationModel.exists({ version: migration.version }).session(session))
          return;
        await migration.up(session);
        await SeedMigrationModel.create(
          [
            {
              version: migration.version,
              description: migration.description,
              appliedAt: new Date(),
            },
          ],
          { session },
        );
      });
    }
  } finally {
    await session.endSession();
  }
}
