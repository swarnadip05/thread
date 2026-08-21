import type { AdminHomepageDto, PublicHomepageDto } from "@thread/types";
import type { HomepageDraftUpdateInput } from "@thread/validation";

import type { AuthContext } from "../auth/auth.types.js";
import type { AuditRepository } from "../auth/repositories/audit.repository.js";
import type { MediaProvider } from "../catalogue/media/cloudinary.provider.js";
import { HttpError } from "../middleware/error-handler.js";
import type { HomepagePreviewTokenService } from "./homepage-preview-token.js";
import type { HomepageRepository } from "./homepage.repository.js";
import type { NotificationService } from "../notifications/notification.service.js";

function activeSections(homepage: PublicHomepageDto, includeScheduled: boolean): PublicHomepageDto {
  const now = Date.now();
  return {
    ...homepage,
    sections: homepage.sections
      .filter(
        (section) =>
          section.enabled &&
          (includeScheduled ||
            ((!section.startsAt || new Date(section.startsAt).getTime() <= now) &&
              (!section.endsAt || new Date(section.endsAt).getTime() > now))),
      )
      .sort((left, right) => left.sortOrder - right.sortOrder),
  };
}

type DraftImage = NonNullable<HomepageDraftUpdateInput["sections"][number]["desktopImage"]>;

function sectionImages(input: HomepageDraftUpdateInput): readonly DraftImage[] {
  return input.sections.flatMap((section) => [
    ...(section.desktopImage ? [section.desktopImage] : []),
    ...(section.mobileImage ? [section.mobileImage] : []),
    ...section.items.flatMap((item) => (item.image ? [item.image] : [])),
  ]);
}

export class HomepageService {
  constructor(
    private readonly repository: HomepageRepository,
    private readonly audits: AuditRepository,
    private readonly media: MediaProvider,
    private readonly previews: HomepagePreviewTokenService,
    private readonly notifications?: Pick<NotificationService, "subscribeNewsletter">,
  ) {}

  async publicHomepage(): Promise<PublicHomepageDto> {
    return activeSections((await this.requireHomepage()).published, false);
  }

  async adminHomepage(): Promise<AdminHomepageDto> {
    return this.requireHomepage();
  }

  async updateDraft(
    input: HomepageDraftUpdateInput,
    actorId: string,
    context: AuthContext,
  ): Promise<AdminHomepageDto> {
    const collectionSlugs = input.sections.flatMap((section) => section.collectionSlugs);
    if (!(await this.repository.collectionsExist(collectionSlugs)))
      throw new HttpError(
        400,
        "INVALID_HOMEPAGE_COLLECTION",
        "One or more selected product collections do not exist.",
      );
    for (const image of sectionImages(input)) {
      if (
        image.source === "cloudinary" &&
        !this.media.validateMetadata(
          {
            format: image.format ?? "",
            mimeType: image.mimeType ?? "",
            publicId: image.publicId ?? "",
            secureUrl: image.src,
          },
          "homepage",
        )
      )
        throw new HttpError(
          400,
          "INVALID_HOMEPAGE_MEDIA",
          "Homepage media does not match the configured upload provider.",
        );
    }
    const homepage = await this.repository.updateDraft(input.sections);
    if (!homepage)
      throw new HttpError(503, "HOMEPAGE_UNAVAILABLE", "Homepage content is not initialized.");
    await this.audit("homepage.draft_updated", actorId, context, {
      version: homepage.draft.version,
    });
    return homepage;
  }

  async publish(actorId: string, context: AuthContext): Promise<AdminHomepageDto> {
    const homepage = await this.repository.publish();
    if (!homepage)
      throw new HttpError(
        409,
        "HOMEPAGE_PUBLISH_CONFLICT",
        "Homepage content changed while publishing. Reload and try again.",
      );
    await this.audit("homepage.published", actorId, context, {
      version: homepage.published.version,
    });
    return homepage;
  }

  async previewToken(actorId: string, context: AuthContext) {
    const homepage = await this.requireHomepage();
    const token = await this.previews.issue(homepage.draft.version);
    await this.audit("homepage.preview_created", actorId, context, {
      version: homepage.draft.version,
    });
    return { token, expiresInSeconds: 600 };
  }

  async preview(token: string): Promise<PublicHomepageDto> {
    let version: number;
    try {
      version = await this.previews.verify(token);
    } catch {
      throw new HttpError(
        401,
        "INVALID_HOMEPAGE_PREVIEW",
        "Homepage preview is invalid or expired.",
      );
    }
    const homepage = await this.requireHomepage();
    if (homepage.draft.version !== version)
      throw new HttpError(
        409,
        "STALE_HOMEPAGE_PREVIEW",
        "Homepage content changed after this preview was created.",
      );
    return activeSections(homepage.draft, true);
  }

  async uploadSignature(actorId: string, context: AuthContext) {
    const signature = this.media.createSignedUpload("homepage");
    await this.audit("homepage.upload_signature_created", actorId, context);
    return signature;
  }

  collectionOptions() {
    return this.repository.collections();
  }

  async subscribe(email: string): Promise<{ subscribed: true }> {
    await this.repository.subscribe(email);
    await this.notifications?.subscribeNewsletter(email);
    return { subscribed: true };
  }

  private async requireHomepage(): Promise<AdminHomepageDto> {
    const homepage = await this.repository.get();
    if (!homepage)
      throw new HttpError(503, "HOMEPAGE_UNAVAILABLE", "Homepage content is not initialized.");
    return homepage;
  }

  private audit(
    action: string,
    actorId: string,
    context: AuthContext,
    metadata?: Record<string, string | number | boolean>,
  ) {
    return this.audits.record({
      action,
      actorId,
      context,
      entity: "homepage",
      entityId: "default",
      ...(metadata ? { metadata } : {}),
    });
  }
}
