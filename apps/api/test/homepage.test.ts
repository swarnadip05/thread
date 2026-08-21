import type { RequestHandler } from "express";
import pino from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";
import type {
  AdminHomepageDto,
  HomepageCollectionOptionDto,
  HomepageSectionDto,
  UserRole,
} from "@thread/types";
import type { HomepageDraftUpdateInput } from "@thread/validation";

import { createApp } from "../src/app.js";
import type { AuditRepository } from "../src/auth/repositories/audit.repository.js";
import type {
  MediaProvider,
  SignedUpload,
  UploadedMediaMetadata,
} from "../src/catalogue/media/cloudinary.provider.js";
import { HomepagePreviewTokenService } from "../src/homepage/homepage-preview-token.js";
import type { HomepageRepository } from "../src/homepage/homepage.repository.js";
import { createHomepageRouter } from "../src/homepage/homepage.router.js";
import { HomepageService } from "../src/homepage/homepage.service.js";

const userId = "64b000000000000000000001";
const now = "2026-07-26T00:00:00.000Z";
const logger = pino({ enabled: false });

function section(
  id: string,
  type: HomepageSectionDto["type"],
  overrides: Partial<HomepageSectionDto> = {},
): HomepageSectionDto {
  return {
    id,
    type,
    enabled: true,
    sortOrder: 10,
    title: id,
    collectionSlugs: [],
    items: [],
    needsClientReview: false,
    ...overrides,
  };
}

const initial: AdminHomepageDto = {
  draft: {
    version: 1,
    updatedAt: now,
    sections: [
      section("hero", "hero"),
      section("future", "offer", { sortOrder: 20, startsAt: "2099-01-01T00:00:00.000Z" }),
      section("ended", "editorial", { sortOrder: 30, endsAt: "2000-01-01T00:00:00.000Z" }),
    ],
  },
  published: {
    version: 1,
    updatedAt: now,
    sections: [
      section("hero", "hero"),
      section("future", "offer", { sortOrder: 20, startsAt: "2099-01-01T00:00:00.000Z" }),
      section("ended", "editorial", { sortOrder: 30, endsAt: "2000-01-01T00:00:00.000Z" }),
    ],
  },
};

class MemoryHomepage implements HomepageRepository {
  value: AdminHomepageDto = structuredClone(initial);
  collectionMatch = true;
  subscribed: string[] = [];

  async get() {
    return this.value;
  }
  async updateDraft(sections: HomepageDraftUpdateInput["sections"]) {
    this.value = {
      ...this.value,
      draft: {
        version: this.value.draft.version + 1,
        updatedAt: new Date().toISOString(),
        // The service validates this boundary before calling the repository.
        // Zod's inferred optional fields include `undefined`, whereas the public
        // DTO deliberately omits absent properties.
        sections: sections as unknown as readonly HomepageSectionDto[],
      },
    };
    return this.value;
  }
  async publish() {
    this.value = {
      ...this.value,
      published: {
        ...this.value.draft,
        updatedAt: new Date().toISOString(),
      },
    };
    return this.value;
  }
  async collections(): Promise<readonly HomepageCollectionOptionDto[]> {
    return [];
  }
  async collectionsExist() {
    return this.collectionMatch;
  }
  async subscribe(email: string) {
    this.subscribed.push(email);
  }
}

class MemoryAudit implements AuditRepository {
  actions: string[] = [];
  async record(input: { action: string }) {
    this.actions.push(input.action);
  }
}

class MemoryMedia implements MediaProvider {
  createSignedUpload(): SignedUpload {
    return {
      apiKey: "key",
      cloudName: "thread",
      folder: "thread/homepage",
      signature: "signature",
      timestamp: 1,
      signedParameters: {
        allowed_formats: "jpg,jpeg,png,webp,avif",
        folder: "thread/homepage",
        timestamp: 1,
      },
      constraints: {
        allowedFormats: ["jpg", "jpeg", "png", "webp", "avif"],
        maxBytes: 15_000_000,
        minWidth: 300,
        minHeight: 300,
        svgAllowed: false,
      },
      uploadUrl: "https://api.cloudinary.com/v1_1/thread/image/upload",
    };
  }
  async delete() {}
  validateMetadata(metadata: UploadedMediaMetadata) {
    return metadata.publicId.startsWith("thread/homepage/");
  }
}

function setup() {
  const repository = new MemoryHomepage();
  const audit = new MemoryAudit();
  const service = new HomepageService(
    repository,
    audit,
    new MemoryMedia(),
    new HomepagePreviewTokenService("homepage-preview-secret-at-least-32-characters"),
  );
  return { audit, repository, service };
}

describe("homepage service", () => {
  it("serves only enabled sections inside their campaign window", async () => {
    const { service } = setup();
    const homepage = await service.publicHomepage();
    expect(homepage.sections.map((item) => item.id)).toEqual(["hero"]);
  });

  it("shows scheduled draft sections in a signed preview and rejects stale previews", async () => {
    const { repository, service } = setup();
    const preview = await service.previewToken(userId, { requestId: "preview" });
    expect((await service.preview(preview.token)).sections.map((item) => item.id)).toEqual([
      "hero",
      "future",
      "ended",
    ]);
    repository.value = {
      ...repository.value,
      draft: { ...repository.value.draft, version: 2 },
    };
    await expect(service.preview(preview.token)).rejects.toMatchObject({
      code: "STALE_HOMEPAGE_PREVIEW",
    });
  });

  it("validates collection selections and audits draft publishing", async () => {
    const { audit, repository, service } = setup();
    repository.collectionMatch = false;
    const input = { sections: structuredClone(initial.draft.sections) } as HomepageDraftUpdateInput;
    input.sections[0]!.collectionSlugs = ["missing-collection"];
    await expect(service.updateDraft(input, userId, {})).rejects.toMatchObject({
      code: "INVALID_HOMEPAGE_COLLECTION",
    });
    repository.collectionMatch = true;
    await service.updateDraft(input, userId, {});
    await service.publish(userId, {});
    expect(audit.actions).toEqual(
      expect.arrayContaining(["homepage.draft_updated", "homepage.published"]),
    );
  });

  it("stores newsletter consent idempotently through the repository", async () => {
    const { repository, service } = setup();
    await service.subscribe("customer@example.com");
    expect(repository.subscribed).toEqual(["customer@example.com"]);
  });
});

describe("homepage routes", () => {
  const roleAuth: RequestHandler = (incoming, _response, next) => {
    const role = incoming.header("x-test-role") as UserRole | undefined;
    incoming.auth = { userId, roles: role ? [role] : [], sessionFamilyId: "test" };
    next();
  };

  it("protects homepage administration and exposes the scheduled public projection", async () => {
    const { service } = setup();
    const app = createApp({
      homepageRouter: createHomepageRouter(service, roleAuth),
      isReady: () => true,
      logger,
      webOrigin: "http://localhost:3000",
    });
    await request(app).get("/api/v1/public/homepage").expect(200);
    await request(app).get("/api/v1/admin/homepage").set("x-test-role", "customer").expect(403);
    await request(app)
      .post("/api/v1/admin/homepage/media/upload-signature")
      .set("x-test-role", "catalog_manager")
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.folder).toBe("thread/homepage");
        expect(body.data.constraints.svgAllowed).toBe(false);
      });
  });
});
