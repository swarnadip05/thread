import { z } from "zod";
export type { ZodType } from "zod";

export const requestIdSchema = z.string().trim().min(1).max(128);

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128)
  .regex(/[a-z]/, "Add a lowercase letter.")
  .regex(/[A-Z]/, "Add an uppercase letter.")
  .regex(/[0-9]/, "Add a number.");

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
export const emailOnlySchema = z.object({ email: emailSchema });
export const tokenSchema = z.object({ token: z.string().min(32).max(512) });
export const resetPasswordSchema = tokenSchema.extend({ password: passwordSchema });
export const phoneOtpRequestSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/),
});
export const phoneOtpVerifySchema = phoneOtpRequestSchema.extend({
  code: z.string().regex(/^\d{6}$/),
});
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

const optionalCsvList = z.preprocess(
  (value) =>
    typeof value === "string"
      ? value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : value,
  z.array(z.string().min(1)).optional(),
);

export const catalogueQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(24),
    category: optionalCsvList,
    collection: optionalCsvList,
    audience: optionalCsvList.pipe(
      z.array(z.enum(["men", "women", "unisex", "accessories"])).optional(),
    ),
    minPrice: z.coerce.number().int().min(0).optional(),
    maxPrice: z.coerce.number().int().min(0).optional(),
    size: optionalCsvList,
    colour: optionalCsvList,
    fit: optionalCsvList,
    material: optionalCsvList,
    rating: z.coerce.number().min(0).max(5).optional(),
    discount: z.coerce.number().int().min(0).max(100).optional(),
    availability: z.enum(["in_stock", "all"]).default("all"),
    search: z.string().trim().max(120).optional(),
    sort: z
      .enum(["relevance", "newest", "price_low_high", "price_high_low", "discount", "rating"])
      .default("relevance"),
  })
  .refine(
    (value) =>
      value.minPrice === undefined ||
      value.maxPrice === undefined ||
      value.minPrice <= value.maxPrice,
    { message: "Minimum price cannot exceed maximum price.", path: ["minPrice"] },
  );

export const adminDashboardQuerySchema = z
  .object({
    from: z.string().trim().max(32).optional(),
    to: z.string().trim().max(32).optional(),
    preset: z.enum(["today", "last_7_days", "last_30_days", "custom"]).default("last_30_days"),
  })
  .superRefine((value, context) => {
    if (value.preset !== "custom") return;
    if (!value.from || !value.to) {
      context.addIssue({ code: "custom", message: "Custom ranges require a start and end date." });
      return;
    }
    const from = Date.parse(value.from);
    const to = Date.parse(value.to);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from > to)
      context.addIssue({ code: "custom", message: "Dashboard dates are invalid." });
  });

export const productSuggestionQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
});

export const searchAnalyticsSchema = z.object({
  query: z.string().trim().min(1).max(120),
  resultCount: z.number().int().min(0).max(1_000_000),
});

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Expected a valid identifier.");
const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(160);
const variantInputSchema = z
  .object({
    id: objectIdSchema.optional(),
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9._-]{2,63}$/),
    colour: z.string().trim().min(1).max(80),
    colourHex: z
      .string()
      .regex(/^#[0-9A-F]{6}$/i)
      .optional(),
    size: z.string().trim().min(1).max(32),
    attributes: z.record(z.string().max(80), z.string().max(120)).default({}),
    mrpPaise: z.number().int().min(0),
    salePricePaise: z.number().int().min(0),
    taxRateBps: z.number().int().min(0).max(10_000).nullable().default(null),
    hsn: z.string().trim().max(16).nullable().default(null),
    weightGrams: z.number().int().min(1).max(100_000),
    dimensionsMm: z
      .object({
        length: z.number().int().min(1),
        width: z.number().int().min(1),
        height: z.number().int().min(1),
      })
      .optional(),
    status: z.enum(["active", "inactive"]).default("active"),
  })
  .refine((value) => value.salePricePaise <= value.mrpPaise, {
    message: "Sale price cannot exceed MRP.",
    path: ["salePricePaise"],
  });

export const productWriteSchema = z.object({
  title: z.string().trim().min(2).max(180),
  slug: slugSchema,
  shortDescription: z.string().trim().min(1).max(320),
  descriptionHtml: z.string().max(50_000),
  categoryIds: z.array(objectIdSchema).max(30).default([]),
  collectionIds: z.array(objectIdSchema).max(30).default([]),
  audience: z.enum(["men", "women", "unisex", "accessories"]),
  brand: z.string().trim().min(1).max(100),
  tags: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
  fit: z.string().trim().max(80).optional(),
  material: z.string().trim().max(240).nullable().default(null),
  care: z.array(z.string().trim().min(1).max(240)).max(20).default([]),
  featured: z.boolean().default(false),
  status: z.enum(["draft", "active", "inactive", "archived"]).default("draft"),
  seo: z
    .object({
      title: z.string().trim().max(70).optional(),
      description: z.string().trim().max(180).optional(),
      noIndex: z.boolean().default(false),
    })
    .default({ noIndex: false }),
  variants: z.array(variantInputSchema).min(1).max(500),
});

export const productPatchSchema = productWriteSchema.partial().omit({ variants: true });
export const variantMatrixSchema = z.object({
  variants: z.array(variantInputSchema).min(1).max(500),
});
export const inventoryAdjustmentSchema = z.object({
  quantityDelta: z
    .number()
    .int()
    .refine((value) => value !== 0),
  reason: z.string().trim().min(5).max(500),
});
export const bulkProductUpdateSchema = z
  .object({
    productIds: z.array(objectIdSchema).min(1).max(500),
    status: z.enum(["draft", "active", "inactive", "archived"]).optional(),
    categoryIds: z.array(objectIdSchema).max(30).optional(),
  })
  .refine(
    (value) => value.status !== undefined || value.categoryIds !== undefined,
    "Provide at least one bulk update.",
  );
export const mediaAttachSchema = z
  .object({
    publicId: z.string().trim().min(1).max(255),
    secureUrl: z.string().url().startsWith("https://"),
    width: z.number().int().min(300).max(12_000),
    height: z.number().int().min(300).max(12_000),
    format: z.enum(["jpg", "jpeg", "png", "webp", "avif"]),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/avif"]),
    bytes: z.number().int().min(1).max(15_000_000),
    alt: z.string().trim().min(1).max(240),
    primary: z.boolean().default(false),
  })
  .refine(
    (value) =>
      value.mimeType ===
      (
        {
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          png: "image/png",
          webp: "image/webp",
          avif: "image/avif",
        } as const
      )[value.format],
    { message: "MIME type does not match the uploaded image format.", path: ["mimeType"] },
  );
export const mediaReorderSchema = z.object({
  orderedPublicIds: z.array(z.string().min(1)).min(1),
  primaryPublicId: z.string().min(1),
});
export const mediaDeleteSchema = z.object({ publicId: z.string().trim().min(1).max(255) });
export const csvImportPreviewSchema = z.object({ csv: z.string().min(1).max(5_000_000) });

export type CatalogueQuery = z.infer<typeof catalogueQuerySchema>;
export type AdminDashboardQuery = z.infer<typeof adminDashboardQuerySchema>;
export type ProductWriteInput = z.infer<typeof productWriteSchema>;
export type ProductPatchInput = z.infer<typeof productPatchSchema>;
export type VariantInput = z.infer<typeof variantInputSchema>;

export const reviewListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  rating: z.coerce.number().int().min(1).max(5).optional(),
});
const reviewMediaSchema = z.object({
  publicId: z.string().trim().min(1).max(255),
  secureUrl: z.string().url().startsWith("https://"),
  width: z.number().int().min(1).max(12_000),
  height: z.number().int().min(1).max(12_000),
  alt: z.string().trim().min(1).max(240),
});
export const reviewCreateSchema = z.object({
  orderId: objectIdSchema,
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(10).max(5_000),
  media: z.array(reviewMediaSchema).max(5).default([]),
});
export const reviewUpdateSchema = reviewCreateSchema.omit({ orderId: true });
export const reviewModerationSchema = z
  .object({
    status: z.enum(["approved", "rejected"]),
    reason: z.string().trim().min(5).max(500).optional(),
  })
  .refine((value) => value.status !== "rejected" || Boolean(value.reason), {
    message: "Rejected reviews require a moderation reason.",
    path: ["reason"],
  });
export const deliveryCheckSchema = z.object({
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter a valid 6-digit Indian postcode."),
});

export type ReviewListQuery = z.infer<typeof reviewListQuerySchema>;
export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;
export type ReviewUpdateInput = z.infer<typeof reviewUpdateSchema>;

export const checkoutAddressSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{7,14}$/),
  addressLine1: z.string().trim().min(3).max(200),
  addressLine2: z.string().trim().max(200).optional(),
  landmark: z.string().trim().max(160).optional(),
  city: z.string().trim().min(2).max(100),
  district: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  postalCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9 -]{3,12}$/),
  country: z.string().trim().min(2).max(100).default("India"),
  type: z.enum(["home", "work", "other"]).default("home"),
  isDefault: z.boolean().default(false),
});
export const checkoutSessionCreateSchema = z.object({
  addressId: objectIdSchema,
  shippingMethodId: objectIdSchema,
  couponCode: z.string().trim().toUpperCase().max(40).optional(),
  paymentMethod: z.enum(["payment_placeholder", "cod"]).default("payment_placeholder"),
  codConfirmationAccepted: z.boolean().default(false),
  policyAccepted: z.literal(true, {
    message: "Shipping, returns and cancellation policies must be acknowledged.",
  }),
  lines: z
    .array(
      z.object({
        variantId: objectIdSchema,
        quantity: z.number().int().min(1).max(50),
        observedUnitPricePaise: z.number().int().min(0).optional(),
      }),
    )
    .min(1)
    .max(50)
    .superRefine((lines, context) => {
      const ids = lines.map((line) => line.variantId);
      if (new Set(ids).size !== ids.length)
        context.addIssue({ code: "custom", message: "Cart contains duplicate variants." });
    }),
});
const shippingMethodBaseSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(2).max(240),
  ratePaise: z.number().int().min(0),
  freeShippingThresholdPaise: z.number().int().min(0).nullable().default(null),
  estimatedBusinessDaysMin: z.number().int().min(1).max(90).nullable().default(null),
  estimatedBusinessDaysMax: z.number().int().min(1).max(90).nullable().default(null),
  countries: z.array(z.string().trim().min(2).max(100)).min(1).max(30),
  postalPrefixes: z.array(z.string().trim().min(1).max(12)).max(500).default([]),
  codEligible: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});
export const shippingMethodWriteSchema = shippingMethodBaseSchema.refine(
  (value) =>
    value.estimatedBusinessDaysMin === null ||
    value.estimatedBusinessDaysMax === null ||
    value.estimatedBusinessDaysMin <= value.estimatedBusinessDaysMax,
  { message: "Minimum delivery days cannot exceed maximum delivery days." },
);
const couponBaseSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{3,40}$/),
  description: z.string().trim().max(240).default(""),
  discountType: z.enum(["fixed", "percentage"]),
  valuePaise: z.number().int().min(1).nullable().default(null),
  valueBps: z.number().int().min(1).max(10_000).nullable().default(null),
  minimumSubtotalPaise: z.number().int().min(0).default(0),
  maximumDiscountPaise: z.number().int().min(1).nullable().default(null),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  usageLimit: z.number().int().min(1).nullable().default(null),
  perUserLimit: z.number().int().min(1).default(1),
  categoryIds: z.array(objectIdSchema).max(100).default([]),
  productIds: z.array(objectIdSchema).max(500).default([]),
  active: z.boolean().default(true),
});
export const couponWriteSchema = couponBaseSchema.superRefine((value, context) => {
  if (value.startsAt >= value.endsAt)
    context.addIssue({ code: "custom", message: "Coupon end must be after its start." });
  if (value.discountType === "fixed" && value.valuePaise === null)
    context.addIssue({ code: "custom", message: "Fixed coupons require valuePaise." });
  if (value.discountType === "percentage" && value.valueBps === null)
    context.addIssue({ code: "custom", message: "Percentage coupons require valueBps." });
});
export const checkoutSettingsSchema = z.object({
  reservationMinutes: z.number().int().min(5).max(60),
  guestCheckoutEnabled: z.boolean(),
  codEnabled: z.boolean(),
  codMinimumOrderPaise: z.number().int().min(0),
  codMaximumOrderPaise: z.number().int().min(0).nullable(),
  codPostalPrefixes: z.array(z.string().trim().min(1).max(12)).max(500),
  codConfirmationRequired: z.boolean(),
});
export const shippingMethodPatchSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().min(2).max(240).optional(),
  ratePaise: z.number().int().min(0).optional(),
  freeShippingThresholdPaise: z.number().int().min(0).nullable().optional(),
  estimatedBusinessDaysMin: z.number().int().min(1).max(90).nullable().optional(),
  estimatedBusinessDaysMax: z.number().int().min(1).max(90).nullable().optional(),
  countries: z.array(z.string().trim().min(2).max(100)).min(1).max(30).optional(),
  postalPrefixes: z.array(z.string().trim().min(1).max(12)).max(500).optional(),
  codEligible: z.boolean().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});
export const couponPatchSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{3,40}$/)
    .optional(),
  description: z.string().trim().max(240).optional(),
  discountType: z.enum(["fixed", "percentage"]).optional(),
  valuePaise: z.number().int().min(1).nullable().optional(),
  valueBps: z.number().int().min(1).max(10_000).nullable().optional(),
  minimumSubtotalPaise: z.number().int().min(0).optional(),
  maximumDiscountPaise: z.number().int().min(1).nullable().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  usageLimit: z.number().int().min(1).nullable().optional(),
  perUserLimit: z.number().int().min(1).optional(),
  categoryIds: z.array(objectIdSchema).max(100).optional(),
  productIds: z.array(objectIdSchema).max(500).optional(),
  active: z.boolean().optional(),
});
export const paymentCallbackSchema = z.object({
  providerPaymentId: z
    .string()
    .trim()
    .regex(/^pay_[A-Za-z0-9]+$/)
    .max(100),
  providerOrderId: z
    .string()
    .trim()
    .regex(/^order_[A-Za-z0-9_-]+$/)
    .max(100),
  signature: z
    .string()
    .trim()
    .regex(/^[a-fA-F0-9]{64}$/),
});
export const adminRefundSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});
export const orderStatusUpdateSchema = z
  .object({
    status: z.enum([
      "confirmed",
      "processing",
      "packed",
      "shipped",
      "out_for_delivery",
      "delivered",
      "cancelled",
      "return_requested",
      "returned",
    ]),
    trackingNumber: z.string().trim().min(3).max(100).optional(),
    trackingUrl: z.string().trim().url().max(500).optional(),
    note: z.string().trim().min(3).max(500).optional(),
  })
  .superRefine((value, context) => {
    if (value.trackingUrl && !value.trackingUrl.startsWith("https://"))
      context.addIssue({
        code: "custom",
        message: "Tracking links must use HTTPS.",
        path: ["trackingUrl"],
      });
  });

export type CheckoutAddressInput = z.infer<typeof checkoutAddressSchema>;
export type CheckoutSessionCreateInput = z.infer<typeof checkoutSessionCreateSchema>;
export type ShippingMethodWriteInput = z.infer<typeof shippingMethodWriteSchema>;
export type CouponWriteInput = z.infer<typeof couponWriteSchema>;
export type CheckoutSettingsInput = z.infer<typeof checkoutSettingsSchema>;
export type PaymentCallbackInput = z.infer<typeof paymentCallbackSchema>;
export type AdminRefundInput = z.infer<typeof adminRefundSchema>;
export type OrderStatusUpdateInput = z.infer<typeof orderStatusUpdateSchema>;

const homepageInternalHrefSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(
    (value) =>
      value.startsWith("/") &&
      !value.startsWith("//") &&
      !value.includes("\\") &&
      ![...value].some((character) => (character.codePointAt(0) ?? 0) < 32),
    "Use a safe internal path beginning with /.",
  );
const homepageImageSchema = z
  .object({
    source: z.enum(["local", "cloudinary"]),
    src: z.string().trim().url().or(z.string().trim().startsWith("/assets/approved/")),
    publicId: z.string().trim().min(1).max(255).optional(),
    width: z.number().int().min(300).max(12_000),
    height: z.number().int().min(300).max(12_000),
    format: z.enum(["jpg", "jpeg", "png", "webp", "avif"]).optional(),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/avif"]).optional(),
    bytes: z.number().int().min(1).max(15_000_000).optional(),
    alt: z.string().trim().min(1).max(240),
  })
  .superRefine((value, context) => {
    if (value.source === "local" && !value.src.startsWith("/assets/approved/"))
      context.addIssue({
        code: "custom",
        message: "Local homepage assets must come from /assets/approved/.",
        path: ["src"],
      });
    if (
      value.source === "cloudinary" &&
      (!value.src.startsWith("https://res.cloudinary.com/") ||
        !value.publicId ||
        !value.format ||
        !value.mimeType ||
        !value.bytes)
    )
      context.addIssue({
        code: "custom",
        message: "Cloudinary image metadata is incomplete.",
        path: ["src"],
      });
  });
const homepageLinkSchema = z.object({
  label: z.string().trim().min(1).max(80),
  href: homepageInternalHrefSchema,
});
const homepageItemSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80),
  title: z.string().trim().min(1).max(120),
  subtitle: z.string().trim().max(240).optional(),
  body: z.string().trim().max(600).optional(),
  href: z.union([homepageInternalHrefSchema, z.string().url().startsWith("https://")]).optional(),
  image: homepageImageSchema.optional(),
  icon: z.enum(["card", "headphones", "truck", "refresh", "instagram"]).optional(),
});
export const homepageSectionSchema = z
  .object({
    id: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(80),
    type: z.enum([
      "announcement",
      "hero",
      "audience_cards",
      "new_arrivals",
      "best_sellers",
      "categories",
      "collections",
      "offer",
      "editorial",
      "brand_values",
      "trust_features",
      "newsletter",
      "social",
    ]),
    enabled: z.boolean(),
    sortOrder: z.number().int().min(0).max(10_000),
    startsAt: z.string().datetime({ offset: true }).optional(),
    endsAt: z.string().datetime({ offset: true }).optional(),
    eyebrow: z.string().trim().max(80).optional(),
    title: z.string().trim().min(1).max(160),
    subtitle: z.string().trim().max(320).optional(),
    body: z.string().trim().max(1_200).optional(),
    primaryCta: homepageLinkSchema.optional(),
    secondaryCta: homepageLinkSchema.optional(),
    desktopImage: homepageImageSchema.optional(),
    mobileImage: homepageImageSchema.optional(),
    collectionSlugs: z
      .array(
        z
          .string()
          .trim()
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      )
      .max(12)
      .default([]),
    items: z.array(homepageItemSchema).max(20).default([]),
    needsClientReview: z.boolean().default(false),
  })
  .refine(
    (value) =>
      !value.startsAt || !value.endsAt || new Date(value.startsAt) < new Date(value.endsAt),
    { message: "Campaign end must be after its start.", path: ["endsAt"] },
  );
export const homepageDraftUpdateSchema = z.object({
  sections: z
    .array(homepageSectionSchema)
    .length(13)
    .superRefine((sections, context) => {
      if (new Set(sections.map((section) => section.id)).size !== sections.length)
        context.addIssue({ code: "custom", message: "Homepage section IDs must be unique." });
      if (new Set(sections.map((section) => section.type)).size !== sections.length)
        context.addIssue({
          code: "custom",
          message: "Each homepage section type is required once.",
        });
    }),
});
export const newsletterSubscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  consent: z.literal(true),
});
export type HomepageDraftUpdateInput = z.infer<typeof homepageDraftUpdateSchema>;

const internalHrefSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) => value.startsWith("/") || value.startsWith("https://"),
    "Use an internal path or HTTPS URL.",
  );
const navigationLinkSchema = z.object({
  id: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(80),
  href: internalHrefSchema,
});
const megaMenuGroupSchema = z.object({
  id: z.string().trim().min(1).max(80),
  heading: z.string().trim().min(1).max(80),
  links: z.array(navigationLinkSchema).max(20),
});

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  audience: z.enum(["men", "women", "unisex", "accessories"]),
  parentId: z
    .string()
    .trim()
    .regex(/^[a-f\d]{24}$/i)
    .nullable()
    .optional(),
  menuGroup: z.string().trim().max(80).optional(),
  active: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});
export const categoryUpdateSchema = categoryCreateSchema.partial();

export const navigationUpdateSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80),
        label: z.string().trim().min(1).max(40),
        audience: z.enum(["men", "women", "unisex", "accessories"]),
        active: z.boolean(),
        sortOrder: z.number().int().min(0).max(1000),
        groups: z.array(megaMenuGroupSchema).min(1).max(8),
        promotionalTile: z
          .object({
            label: z.string().trim().min(1).max(80),
            imageUrl: z.string().trim().startsWith("/assets/approved/"),
            alt: z.string().trim().min(1).max(160),
            href: internalHrefSchema,
          })
          .optional(),
      }),
    )
    .max(12),
});
export const announcementUpdateSchema = z.object({
  enabled: z.boolean(),
  text: z.string().trim().min(1).max(240),
});
export const footerLinksUpdateSchema = z.object({
  groups: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80),
        title: z.string().trim().min(1).max(80),
        links: z.array(navigationLinkSchema).max(20),
      }),
    )
    .max(8),
});
export const socialLinksUpdateSchema = z.object({
  links: z
    .array(navigationLinkSchema.extend({ href: z.string().url().startsWith("https://") }))
    .max(12),
});
export const contentPageUpdateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  eyebrow: z.string().trim().max(80).optional(),
  summary: z.string().trim().min(1).max(500),
  sections: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80),
        heading: z.string().trim().max(120).optional(),
        paragraphs: z.array(z.string().trim().min(1).max(2000)).max(12),
        items: z.array(z.string().trim().min(1).max(500)).max(30),
      }),
    )
    .min(1)
    .max(20),
  active: z.boolean(),
  needsClientReview: z.boolean(),
  reviewNotes: z.array(z.string().trim().min(1).max(300)).max(30),
});
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
export type NavigationUpdateInput = z.infer<typeof navigationUpdateSchema>;
export type AnnouncementUpdateInput = z.infer<typeof announcementUpdateSchema>;
export type FooterLinksUpdateInput = z.infer<typeof footerLinksUpdateSchema>;
export type SocialLinksUpdateInput = z.infer<typeof socialLinksUpdateSchema>;
export type ContentPageUpdateInput = z.infer<typeof contentPageUpdateSchema>;

const operationalOrderStatusSchema = z.enum([
  "pending_payment",
  "payment_failed",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "return_requested",
  "returned",
  "refunded",
]);
export const operationalOrderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  search: z.string().trim().max(120).optional(),
  status: operationalOrderStatusSchema.optional(),
  payment: z
    .enum([
      "awaiting_method",
      "authorized",
      "pending_verification",
      "captured",
      "failed",
      "refunded",
    ])
    .optional(),
  fulfilment: z.enum(["unfulfilled", "in_progress", "fulfilled", "cancelled"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export const operationalOrderStatusUpdateSchema = z.object({
  status: operationalOrderStatusSchema,
  reason: z.string().trim().min(5).max(500),
});
export const operationalBulkStatusSchema = z.object({
  orderIds: z.array(objectIdSchema).min(1).max(50),
  status: z.enum(["processing", "packed"]),
  reason: z.string().trim().min(5).max(500),
});
export const orderTrackingUpdateSchema = z
  .object({
    carrier: z.string().trim().min(2).max(100),
    trackingNumber: z.string().trim().min(3).max(100),
    trackingUrl: z.string().trim().url().max(500).optional(),
  })
  .refine((value) => !value.trackingUrl || value.trackingUrl.startsWith("https://"), {
    message: "Tracking links must use HTTPS.",
    path: ["trackingUrl"],
  });
export const internalOrderNoteSchema = z.object({
  body: z.string().trim().min(2).max(2_000),
});
export const returnRequestCreateSchema = z.object({
  orderId: objectIdSchema,
  requestType: z.enum(["return", "exchange"]),
  reason: z.string().trim().min(5).max(1_000),
  itemVariantIds: z.array(objectIdSchema).min(1).max(25),
  imageUrls: z.array(z.string().url().startsWith("https://").max(500)).max(5).default([]),
});
export const returnDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().min(5).max(1_000),
});
export const returnLogisticsSchema = z
  .object({
    status: z.enum(["pickup_scheduled", "in_transit", "received"]),
    carrier: z.string().trim().min(2).max(100),
    trackingNumber: z.string().trim().min(3).max(100),
    trackingUrl: z.string().trim().url().max(500).optional(),
  })
  .refine((value) => !value.trackingUrl || value.trackingUrl.startsWith("https://"), {
    message: "Tracking links must use HTTPS.",
    path: ["trackingUrl"],
  });
export const returnInspectionSchema = z.object({
  approved: z.boolean(),
  notes: z.string().trim().min(5).max(1_000),
});
export const inventoryAdminQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(120).optional(),
  lowStock: z.coerce.boolean().optional(),
});
export const inventoryImportPreviewSchema = z.object({
  rows: z
    .array(
      z.object({
        sku: z.string().trim().min(2).max(100),
        stockOnHand: z.number().int().min(0),
        reason: z.string().trim().min(5).max(500),
      }),
    )
    .min(1)
    .max(2_000),
});
export const customerAdminQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  search: z.string().trim().max(120).optional(),
  status: z.enum(["active", "suspended", "disabled"]).optional(),
});
export const customerStatusSchema = z.object({
  status: z.enum(["active", "suspended"]),
  reason: z.string().trim().min(5).max(500),
});
export const operationsSettingsUpdateSchema = z.object({
  business: z
    .object({
      brandName: z.string().trim().min(1).max(100),
      legalName: z.string().trim().min(1).max(160),
      addressLine1: z.string().trim().min(1).max(200),
      locality: z.string().trim().min(1).max(100),
      district: z.string().trim().min(1).max(100),
      city: z.string().trim().min(1).max(100),
      postalCode: z.string().trim().min(3).max(20),
      state: z.string().trim().min(1).max(100),
      country: z.string().trim().min(1).max(100),
      phone: z.string().trim().min(7).max(30),
      whatsappNumber: z.string().trim().min(7).max(30),
      email: emailSchema,
      gstin: z.string().trim().min(1).max(32),
      foundedYear: z.number().int().min(1900).max(2200),
    })
    .optional(),
  returnWindowDays: z.number().int().min(1).max(90).optional(),
  requireInspectionBeforeRestock: z.boolean().optional(),
  onlinePaymentsEnabled: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
  seo: z
    .object({
      defaultTitle: z.string().trim().min(1).max(120),
      defaultDescription: z.string().trim().min(1).max(320),
    })
    .optional(),
});

export const accountDeletionSchema = z
  .object({
    password: z.string().min(8).max(200),
    confirmation: z.literal("DELETE MY THREAD ACCOUNT"),
  })
  .strict();

export type OperationalOrderQuery = z.infer<typeof operationalOrderQuerySchema>;
export type OperationalOrderStatusUpdateInput = z.infer<typeof operationalOrderStatusUpdateSchema>;
export type ReturnRequestCreateInput = z.infer<typeof returnRequestCreateSchema>;
export type OperationsSettingsUpdateInput = z.infer<typeof operationsSettingsUpdateSchema>;
