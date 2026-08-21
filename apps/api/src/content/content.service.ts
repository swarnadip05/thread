import type { ContentPageDto, PublicNavigationDto, PublicSiteSettingsDto } from "@thread/types";
import type {
  AnnouncementUpdateInput,
  CategoryCreateInput,
  CategoryUpdateInput,
  ContentPageUpdateInput,
  FooterLinksUpdateInput,
  NavigationUpdateInput,
  SocialLinksUpdateInput,
} from "@thread/validation";

import { HttpError } from "../middleware/error-handler.js";
import type { AuthContext } from "../auth/auth.types.js";
import type { AuditRepository } from "../auth/repositories/audit.repository.js";
import { NavigationCache } from "./navigation-cache.js";
import type { CategoryData, CategoryRepository } from "./repositories/category.repository.js";
import type { ContentPageRepository } from "./repositories/content-page.repository.js";
import type { SiteSettingsRepository } from "./repositories/site-settings.repository.js";

function toPageDto(page: Awaited<ReturnType<ContentPageRepository["upsert"]>>): ContentPageDto {
  return {
    slug: page.slug,
    title: page.title,
    ...(page.eyebrow ? { eyebrow: page.eyebrow } : {}),
    summary: page.summary,
    sections: page.sections.map((section) => ({
      id: section.id,
      ...(section.heading ? { heading: section.heading } : {}),
      paragraphs: [...section.paragraphs],
      items: [...section.items],
    })),
    updatedAt: page.updatedAt.toISOString(),
  };
}

export class ContentService {
  private readonly navigationCache = new NavigationCache<PublicNavigationDto>(60_000);
  private readonly settingsCache = new NavigationCache<PublicSiteSettingsDto>(60_000);

  constructor(
    private readonly categories: CategoryRepository,
    private readonly settings: SiteSettingsRepository,
    private readonly pages: ContentPageRepository,
    private readonly audits: AuditRepository,
  ) {}

  getPublicNavigation(): Promise<PublicNavigationDto> {
    return this.navigationCache.get(async () => {
      const settings = await this.requireSettings();
      return {
        version: settings.navigation.version,
        items: settings.navigation.items
          .filter((item) => item.active)
          .sort((left, right) => left.sortOrder - right.sortOrder)
          .map((item) => ({
            id: item.id,
            label: item.label,
            audience: item.audience,
            sortOrder: item.sortOrder,
            groups: item.groups.map((group) => ({
              id: group.id,
              heading: group.heading,
              links: group.links.map((link) => ({ ...link })),
            })),
            ...(item.promotionalTile?.imageUrl.startsWith("/assets/approved/")
              ? { promotionalTile: { ...item.promotionalTile } }
              : {}),
          })),
      };
    });
  }

  getPublicSettings(): Promise<PublicSiteSettingsDto> {
    return this.settingsCache.get(async () => {
      const value = await this.requireSettings();
      return {
        ...value.business,
        announcement: { ...value.announcement },
        footerGroups: value.footerGroups.map((group) => ({
          ...group,
          links: group.links.map((link) => ({ ...link })),
        })),
        socialLinks: value.socialLinks.map((link) => ({ ...link })),
      };
    });
  }

  async getPage(slug: string): Promise<ContentPageDto> {
    const page = await this.pages.findActive(slug);
    if (!page) throw new HttpError(404, "CONTENT_PAGE_NOT_FOUND", "This page is not available.");
    return toPageDto(page);
  }

  listCategories(): Promise<readonly CategoryData[]> {
    return this.categories.list();
  }
  async createCategory(
    input: CategoryCreateInput,
    actorId: string,
    context: AuthContext,
  ): Promise<CategoryData> {
    const category = await this.categories.create({
      name: input.name,
      slug: input.slug,
      audience: input.audience,
      active: input.active,
      sortOrder: input.sortOrder,
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      ...(input.menuGroup !== undefined ? { menuGroup: input.menuGroup } : {}),
    });
    await this.audit("content.category_created", actorId, category.id, context);
    this.navigationCache.invalidate();
    return category;
  }
  async updateCategory(
    id: string,
    input: CategoryUpdateInput,
    actorId: string,
    context: AuthContext,
  ): Promise<CategoryData> {
    const category = await this.categories.update(
      id,
      Object.fromEntries(Object.entries(input).filter((entry) => entry[1] !== undefined)),
    );
    if (!category) throw new HttpError(404, "CATEGORY_NOT_FOUND", "Category not found.");
    await this.audit("content.category_updated", actorId, id, context);
    this.navigationCache.invalidate();
    return category;
  }
  async removeCategory(id: string, actorId: string, context: AuthContext): Promise<void> {
    try {
      if (!(await this.categories.remove(id)))
        throw new HttpError(404, "CATEGORY_NOT_FOUND", "Category not found.");
    } catch (error) {
      if (error instanceof Error && error.message === "CATEGORY_HAS_CHILDREN")
        throw new HttpError(409, "CATEGORY_HAS_CHILDREN", "Move or remove child categories first.");
      throw error;
    }
    await this.audit("content.category_removed", actorId, id, context);
    this.navigationCache.invalidate();
  }

  async updateNavigation(
    input: NavigationUpdateInput,
    actorId: string,
    context: AuthContext,
  ): Promise<PublicNavigationDto> {
    await this.settings.updateNavigation(
      input.items.map((item) => ({
        id: item.id,
        label: item.label,
        audience: item.audience,
        active: item.active,
        sortOrder: item.sortOrder,
        groups: item.groups,
        ...(item.promotionalTile ? { promotionalTile: item.promotionalTile } : {}),
      })),
    );
    this.navigationCache.invalidate();
    await this.audit("content.navigation_updated", actorId, "default", context);
    return this.getPublicNavigation();
  }
  async updateAnnouncement(
    input: AnnouncementUpdateInput,
    actorId: string,
    context: AuthContext,
  ): Promise<PublicSiteSettingsDto> {
    await this.settings.updateAnnouncement(input);
    this.settingsCache.invalidate();
    await this.audit("content.announcement_updated", actorId, "default", context);
    return this.getPublicSettings();
  }
  async updateFooter(
    input: FooterLinksUpdateInput,
    actorId: string,
    context: AuthContext,
  ): Promise<PublicSiteSettingsDto> {
    await this.settings.updateFooterGroups(input.groups);
    this.settingsCache.invalidate();
    await this.audit("content.footer_updated", actorId, "default", context);
    return this.getPublicSettings();
  }
  async updateSocial(
    input: SocialLinksUpdateInput,
    actorId: string,
    context: AuthContext,
  ): Promise<PublicSiteSettingsDto> {
    await this.settings.updateSocialLinks(input.links);
    this.settingsCache.invalidate();
    await this.audit("content.social_updated", actorId, "default", context);
    return this.getPublicSettings();
  }
  async listPages() {
    return this.pages.listAll();
  }
  async updatePage(
    slug: string,
    input: ContentPageUpdateInput,
    actorId: string,
    context: AuthContext,
  ): Promise<ContentPageDto> {
    const page = await this.pages.upsert(slug, {
      title: input.title,
      summary: input.summary,
      sections: input.sections.map((section) => ({
        id: section.id,
        paragraphs: section.paragraphs,
        items: section.items,
        ...(section.heading ? { heading: section.heading } : {}),
      })),
      active: input.active,
      needsClientReview: input.needsClientReview,
      reviewNotes: input.reviewNotes,
      ...(input.eyebrow ? { eyebrow: input.eyebrow } : {}),
    });
    await this.audit("content.page_updated", actorId, slug, context);
    return toPageDto(page);
  }
  async getReviewSummary(): Promise<{ needsReview: boolean; pendingCount: number }> {
    const pendingCount = await this.pages.countNeedsReview();
    return { needsReview: pendingCount > 0, pendingCount };
  }

  private async requireSettings() {
    const value = await this.settings.get();
    if (!value)
      throw new HttpError(
        503,
        "SITE_SETTINGS_UNAVAILABLE",
        "Site settings have not been initialized.",
      );
    return value;
  }
  private audit(action: string, actorId: string, entityId: string, context: AuthContext) {
    return this.audits.record({ action, actorId, context, entity: "content", entityId });
  }
}
