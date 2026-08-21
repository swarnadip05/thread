import { model, models, Schema, type Model } from "../database/mongoose-runtime.js";

interface Link {
  id: string;
  label: string;
  href: string;
}
interface MenuGroup {
  id: string;
  heading: string;
  links: Link[];
}
export interface NavigationItem {
  id: string;
  label: string;
  audience: "men" | "women" | "unisex" | "accessories";
  active: boolean;
  sortOrder: number;
  groups: MenuGroup[];
  promotionalTile?: { label: string; imageUrl: string; alt: string; href: string };
}
interface FooterGroup {
  id: string;
  title: string;
  links: Link[];
}

export interface SiteSettingsRecord {
  key: "default";
  business: {
    brandName: string;
    legalName: string;
    addressLine1: string;
    locality: string;
    district: string;
    city: string;
    postalCode: string;
    state: string;
    country: string;
    phone: string;
    whatsappNumber: string;
    email: string;
    gstin: string;
    foundedYear: number;
  };
  announcement: { enabled: boolean; text: string };
  navigation: { version: number; items: NavigationItem[] };
  footerGroups: FooterGroup[];
  socialLinks: Link[];
  checkout?: {
    reservationMinutes: number;
    guestCheckoutEnabled: boolean;
    codEnabled: boolean;
    codMinimumOrderPaise: number;
    codMaximumOrderPaise: number | null;
    codPostalPrefixes: string[];
    codConfirmationRequired: boolean;
  };
  returns?: { windowDays: number; requireInspectionBeforeRestock: boolean };
  payments?: { onlineEnabled: boolean };
  seo?: { defaultTitle: string; defaultDescription: string };
  maintenanceMode: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const linkSchema = new Schema<Link>(
  {
    id: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    href: { type: String, required: true, trim: true },
  },
  { _id: false, strict: "throw" },
);
const groupSchema = new Schema<MenuGroup>(
  {
    id: { type: String, required: true, trim: true },
    heading: { type: String, required: true, trim: true },
    links: { type: [linkSchema], default: [] },
  },
  { _id: false, strict: "throw" },
);
const navigationItemSchema = new Schema<NavigationItem>(
  {
    id: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    audience: { type: String, enum: ["men", "women", "unisex", "accessories"], required: true },
    active: { type: Boolean, default: true, required: true },
    sortOrder: { type: Number, default: 0, min: 0, required: true },
    groups: { type: [groupSchema], default: [] },
    promotionalTile: { label: String, imageUrl: String, alt: String, href: String },
  },
  { _id: false, strict: "throw" },
);
const footerGroupSchema = new Schema<FooterGroup>(
  {
    id: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    links: { type: [linkSchema], default: [] },
  },
  { _id: false, strict: "throw" },
);

const siteSettingsSchema = new Schema<SiteSettingsRecord>(
  {
    key: { type: String, enum: ["default"], default: "default", required: true, immutable: true },
    business: {
      brandName: { type: String, required: true, trim: true },
      legalName: { type: String, required: true, trim: true },
      addressLine1: { type: String, required: true, trim: true },
      locality: { type: String, required: true, trim: true },
      district: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      postalCode: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      country: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      whatsappNumber: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },
      gstin: { type: String, required: true, trim: true },
      foundedYear: { type: Number, required: true, min: 1900 },
    },
    announcement: {
      enabled: { type: Boolean, default: true, required: true },
      text: { type: String, required: true, trim: true, maxlength: 240 },
    },
    navigation: {
      version: { type: Number, default: 1, min: 1, required: true },
      items: { type: [navigationItemSchema], default: [] },
    },
    footerGroups: { type: [footerGroupSchema], default: [] },
    socialLinks: { type: [linkSchema], default: [] },
    checkout: {
      reservationMinutes: { type: Number, required: true, default: 12, min: 5, max: 60 },
      guestCheckoutEnabled: { type: Boolean, required: true, default: false },
      codEnabled: { type: Boolean, required: true, default: false },
      codMinimumOrderPaise: { type: Number, required: true, default: 0, min: 0 },
      codMaximumOrderPaise: { type: Number, default: null, min: 0 },
      codPostalPrefixes: [{ type: String, trim: true, maxlength: 12 }],
      codConfirmationRequired: { type: Boolean, required: true, default: true },
    },
    returns: {
      windowDays: { type: Number, required: true, default: 7, min: 1, max: 90 },
      requireInspectionBeforeRestock: { type: Boolean, required: true, default: true },
    },
    payments: {
      onlineEnabled: { type: Boolean, required: true, default: false },
    },
    seo: {
      defaultTitle: { type: String, required: true, default: "THREAD", trim: true, maxlength: 120 },
      defaultDescription: {
        type: String,
        required: true,
        default: "Discover THREAD fashion.",
        trim: true,
        maxlength: 320,
      },
    },
    maintenanceMode: { type: Boolean, default: false, required: true },
  },
  { strict: "throw", timestamps: true },
);
siteSettingsSchema.index({ key: 1 }, { unique: true, name: "site_settings_singleton" });

export const SiteSettingsModel: Model<SiteSettingsRecord> =
  models.SiteSettings ?? model<SiteSettingsRecord>("SiteSettings", siteSettingsSchema);
