import {
  SiteSettingsModel,
  type NavigationItem,
  type SiteSettingsRecord,
} from "../../models/site-settings.model.js";

export type { NavigationItem };

export interface SiteSettingsRepository {
  get(): Promise<SiteSettingsRecord | null>;
  updateNavigation(
    items: SiteSettingsRecord["navigation"]["items"],
  ): Promise<SiteSettingsRecord | null>;
  updateAnnouncement(
    announcement: SiteSettingsRecord["announcement"],
  ): Promise<SiteSettingsRecord | null>;
  updateFooterGroups(
    groups: SiteSettingsRecord["footerGroups"],
  ): Promise<SiteSettingsRecord | null>;
  updateSocialLinks(links: SiteSettingsRecord["socialLinks"]): Promise<SiteSettingsRecord | null>;
}

export class MongooseSiteSettingsRepository implements SiteSettingsRepository {
  async get(): Promise<SiteSettingsRecord | null> {
    const document = await SiteSettingsModel.findOne({ key: "default" }).exec();
    return document?.toObject() ?? null;
  }
  async updateNavigation(
    items: SiteSettingsRecord["navigation"]["items"],
  ): Promise<SiteSettingsRecord | null> {
    const document = await SiteSettingsModel.findOneAndUpdate(
      { key: "default" },
      { $set: { "navigation.items": items }, $inc: { "navigation.version": 1 } },
      { new: true, runValidators: true },
    ).exec();
    return document?.toObject() ?? null;
  }
  async updateAnnouncement(
    announcement: SiteSettingsRecord["announcement"],
  ): Promise<SiteSettingsRecord | null> {
    const document = await SiteSettingsModel.findOneAndUpdate(
      { key: "default" },
      { $set: { announcement } },
      { new: true, runValidators: true },
    ).exec();
    return document?.toObject() ?? null;
  }
  async updateFooterGroups(
    groups: SiteSettingsRecord["footerGroups"],
  ): Promise<SiteSettingsRecord | null> {
    const document = await SiteSettingsModel.findOneAndUpdate(
      { key: "default" },
      { $set: { footerGroups: groups } },
      { new: true, runValidators: true },
    ).exec();
    return document?.toObject() ?? null;
  }
  async updateSocialLinks(
    links: SiteSettingsRecord["socialLinks"],
  ): Promise<SiteSettingsRecord | null> {
    const document = await SiteSettingsModel.findOneAndUpdate(
      { key: "default" },
      { $set: { socialLinks: links } },
      { new: true, runValidators: true },
    ).exec();
    return document?.toObject() ?? null;
  }
}
