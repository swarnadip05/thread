import pino from "pino";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import type { AuditRepository } from "../src/auth/repositories/audit.repository.js";
import { createApp } from "../src/app.js";
import { createContentRouter } from "../src/content/content.router.js";
import { ContentService } from "../src/content/content.service.js";
import type { CategoryRepository } from "../src/content/repositories/category.repository.js";
import type { ContentPageRepository } from "../src/content/repositories/content-page.repository.js";
import type { SiteSettingsRepository } from "../src/content/repositories/site-settings.repository.js";
import type { ContentPageRecord } from "../src/models/content-page.model.js";
import type { SiteSettingsRecord } from "../src/models/site-settings.model.js";

const now = new Date("2026-07-26T00:00:00.000Z");

function settingsRecord(): SiteSettingsRecord {
  return {
    key: "default",
    business: {
      brandName: "THREAD",
      legalName: "SNAP CART",
      addressLine1: "AB01 ADHARSHAPALLY ROAD",
      locality: "NEW TOWN",
      district: "NORTH 24 PARGANAS",
      city: "KOLKATA",
      postalCode: "700159",
      state: "WEST BENGAL",
      country: "India",
      phone: "+91 9073661067",
      whatsappNumber: "919073661067",
      email: "threadfashion.shop@gmail.com",
      gstin: "19FCSPM9252D1ZZ",
      foundedYear: 2025,
    },
    announcement: { enabled: true, text: "Welcome to THREAD." },
    navigation: {
      version: 1,
      items: [
        {
          id: "inactive",
          label: "Hidden",
          audience: "unisex",
          active: false,
          sortOrder: 0,
          groups: [],
        },
        { id: "women", label: "WOMEN", audience: "women", active: true, sortOrder: 20, groups: [] },
        {
          id: "men",
          label: "MEN",
          audience: "men",
          active: true,
          sortOrder: 10,
          groups: [],
          promotionalTile: {
            label: "Unsafe",
            imageUrl: "/reference/competitor.jpg",
            alt: "Unsafe",
            href: "/",
          },
        },
      ],
    },
    footerGroups: [],
    socialLinks: [],
    maintenanceMode: true,
    createdAt: now,
    updatedAt: now,
  };
}

function pageRecord(overrides: Partial<ContentPageRecord> = {}): ContentPageRecord {
  return {
    slug: "about",
    title: "About THREAD",
    summary: "THREAD is operated by SNAP CART.",
    sections: [],
    active: true,
    needsClientReview: false,
    reviewNotes: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeService() {
  let settings = settingsRecord();
  let page = pageRecord();
  const getSettings = vi.fn(async () => settings);
  const settingsRepository: SiteSettingsRepository = {
    get: getSettings,
    updateNavigation: async (items) => {
      settings = {
        ...settings,
        navigation: { version: settings.navigation.version + 1, items: [...items] },
      };
      return settings;
    },
    updateAnnouncement: async (announcement) => {
      settings = { ...settings, announcement };
      return settings;
    },
    updateFooterGroups: async (footerGroups) => {
      settings = { ...settings, footerGroups: [...footerGroups] };
      return settings;
    },
    updateSocialLinks: async (socialLinks) => {
      settings = { ...settings, socialLinks: [...socialLinks] };
      return settings;
    },
  };
  const pages: ContentPageRepository = {
    findActive: async (slug) => (page.slug === slug && page.active ? page : null),
    listAll: async () => [page],
    upsert: async (slug, input) => {
      page = {
        slug,
        ...input,
        createdAt: page.createdAt,
        updatedAt: new Date("2026-07-27T00:00:00.000Z"),
      };
      return page;
    },
    countNeedsReview: async () => (page.needsClientReview ? 1 : 0),
  };
  const categories: CategoryRepository = {
    list: async () => [],
    create: async (input) => ({ id: "category-id", parentId: null, ...input }),
    update: async () => null,
    remove: async () => false,
  };
  const audits: AuditRepository = { record: async () => undefined };
  return {
    getSettings,
    service: new ContentService(categories, settingsRepository, pages, audits),
  };
}

describe("content service", () => {
  it("returns only active, sorted navigation and rejects unapproved promotional media", async () => {
    const { service } = makeService();
    const navigation = await service.getPublicNavigation();

    expect(navigation.items.map((item) => item.id)).toEqual(["men", "women"]);
    expect(navigation.items[0]).not.toHaveProperty("promotionalTile");
  });

  it("caches public navigation until an admin navigation change invalidates it", async () => {
    const { getSettings, service } = makeService();
    await service.getPublicNavigation();
    await service.getPublicNavigation();
    expect(getSettings).toHaveBeenCalledTimes(1);

    await service.updateNavigation(
      {
        items: [
          {
            id: "accessories",
            label: "ACCESSORIES",
            audience: "accessories",
            active: true,
            sortOrder: 1,
            groups: [],
          },
        ],
      },
      "admin-id",
      { requestId: "request-id" },
    );

    expect(getSettings).toHaveBeenCalledTimes(2);
    expect((await service.getPublicNavigation()).items[0]?.id).toBe("accessories");
  });

  it("exposes only the safe SiteSettings projection", async () => {
    const { service } = makeService();
    const settings = await service.getPublicSettings();

    expect(settings).toMatchObject({ brandName: "THREAD", legalName: "SNAP CART" });
    expect(settings).not.toHaveProperty("maintenanceMode");
    expect(settings).not.toHaveProperty("createdAt");
  });

  it("returns an inactive page after an admin update without publishing it publicly", async () => {
    const { service } = makeService();
    const updated = await service.updatePage(
      "about",
      {
        title: "Draft About",
        summary: "Draft content",
        sections: [],
        active: false,
        needsClientReview: true,
        reviewNotes: ["Client approval required."],
      },
      "admin-id",
      { requestId: "request-id" },
    );

    expect(updated.title).toBe("Draft About");
    await expect(service.getPage("about")).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.getReviewSummary()).resolves.toEqual({
      needsReview: true,
      pendingCount: 1,
    });
  });
});

describe("content routes", () => {
  it("serves cacheable public navigation while protecting admin management", async () => {
    const { service } = makeService();
    const app = createApp({
      contentRouter: createContentRouter(service, (_request, _response, next) => next()),
      isReady: () => true,
      logger: pino({ enabled: false }),
      webOrigin: "http://localhost:3000",
    });

    const publicResponse = await request(app).get("/api/v1/public/navigation").expect(200);
    expect(publicResponse.headers["cache-control"]).toContain("stale-while-revalidate=300");
    expect(publicResponse.body.data.items).toHaveLength(2);

    await request(app).get("/api/v1/admin/categories").expect(403);
  });
});
