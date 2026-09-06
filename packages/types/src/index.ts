export * from "./generated-client-assets.js";

export type HealthStatus = "live" | "ready" | "not-ready";

export interface HealthResponse {
  readonly status: HealthStatus;
  readonly service: string;
  readonly timestamp: string;
  readonly requestId: string;
}

export interface ApiErrorBody {
  readonly code: string;
  readonly message: string;
  readonly requestId: string;
}

export interface ApiErrorResponse {
  readonly success: false;
  readonly error: ApiErrorBody;
}

export interface ApiSuccessResponse<T> {
  readonly success: true;
  readonly data: T;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export const userRoles = [
  "super_admin",
  "admin",
  "catalog_manager",
  "order_manager",
  "support_agent",
  "customer",
] as const;

export type UserRole = (typeof userRoles)[number];

export interface AuthUserDto {
  readonly id: string;
  readonly name: string;
  readonly email?: string;
  readonly phone?: string;
  readonly roles: readonly UserRole[];
  readonly emailVerified: boolean;
  readonly phoneVerified: boolean;
  readonly mustChangePassword: boolean;
}

export interface AuthSessionDto {
  readonly accessToken: string;
  readonly expiresInSeconds: number;
  readonly csrfToken: string;
  readonly user: AuthUserDto;
}

export type ProductAudience = "men" | "women" | "unisex" | "accessories";
export type ProductStatus = "draft" | "active" | "inactive" | "archived";

export interface ProductMediaDto {
  readonly publicId: string;
  readonly secureUrl: string;
  readonly width: number;
  readonly height: number;
  readonly format: "jpg" | "jpeg" | "png" | "webp" | "avif";
  readonly mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/avif";
  readonly bytes: number;
  readonly alt: string;
  readonly sortOrder: number;
  readonly primary: boolean;
}

export interface ProductVariantDto {
  readonly id: string;
  readonly sku: string;
  readonly colour: string;
  readonly colourHex?: string;
  readonly size: string;
  readonly mrpPaise: number;
  readonly salePricePaise: number;
  readonly availableStock: number;
  readonly status: "active" | "inactive";
}

export interface ProductSummaryDto {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly shortDescription: string;
  readonly audience: ProductAudience;
  readonly brand: string;
  readonly fit?: string;
  readonly material?: string;
  readonly primaryImage?: ProductMediaDto;
  readonly secondaryImage?: ProductMediaDto;
  readonly colours: readonly {
    readonly name: string;
    readonly hex?: string;
  }[];
  readonly minMrpPaise: number;
  readonly minSalePricePaise: number;
  readonly ratingAverage: number;
  readonly ratingCount: number;
  readonly available: boolean;
  readonly publishedAt: string;
}

export interface ProductPageDto {
  readonly items: readonly ProductSummaryDto[];
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly pages: number;
}

export interface ProductFacetValueDto {
  readonly value: string;
  readonly label: string;
  readonly count: number;
}

export interface ProductFacetsDto {
  readonly audiences: readonly ProductFacetValueDto[];
  readonly categories: readonly ProductFacetValueDto[];
  readonly collections: readonly ProductFacetValueDto[];
  readonly sizes: readonly ProductFacetValueDto[];
  readonly colours: readonly ProductFacetValueDto[];
  readonly fits: readonly ProductFacetValueDto[];
  readonly materials: readonly ProductFacetValueDto[];
  readonly ratings: readonly ProductFacetValueDto[];
  readonly availability: readonly ProductFacetValueDto[];
  readonly discounts: readonly ProductFacetValueDto[];
  readonly price: { readonly minPaise: number; readonly maxPaise: number };
}

export interface ProductSearchSuggestionsDto {
  readonly products: readonly Pick<
    ProductSummaryDto,
    "id" | "title" | "slug" | "minSalePricePaise" | "primaryImage"
  >[];
  readonly categories: readonly {
    readonly name: string;
    readonly slug: string;
  }[];
}

export interface ProductDetailDto extends ProductSummaryDto {
  readonly seo?: {
    readonly title?: string;
    readonly description?: string;
    readonly noIndex: boolean;
  };
  readonly descriptionHtml: string;
  readonly care: readonly string[];
  readonly tags: readonly string[];
  readonly categoryIds: readonly string[];
  readonly collectionIds: readonly string[];
  readonly media: readonly ProductMediaDto[];
  readonly variants: readonly ProductVariantDto[];
}

export interface AdminProductDto extends ProductDetailDto {
  readonly status: ProductStatus;
  readonly featured?: boolean;
  readonly newArrival?: boolean;
  readonly seo?: {
    readonly title?: string;
    readonly description?: string;
    readonly noIndex: boolean;
  };
  readonly variants: readonly AdminProductVariantDto[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AdminProductVariantDto extends ProductVariantDto {
  readonly stockOnHand?: number;
  readonly stockReserved?: number;
  readonly reorderLevel?: number;
  readonly weightGrams?: number;
  readonly taxRateBps?: number | null;
  readonly hsn?: string | null;
  readonly attributes?: Readonly<Record<string, string>>;
  readonly dimensionsMm?: {
    readonly length: number;
    readonly width: number;
    readonly height: number;
  };
}

export type ReviewModerationStatus = "pending" | "approved" | "rejected";

export interface ReviewMediaDto {
  readonly publicId: string;
  readonly secureUrl: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
}

export interface ProductReviewDto {
  readonly id: string;
  readonly userName: string;
  readonly rating: number;
  readonly title: string;
  readonly body: string;
  readonly media: readonly ReviewMediaDto[];
  readonly verifiedPurchase: boolean;
  readonly moderationStatus: ReviewModerationStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProductReviewPageDto {
  readonly items: readonly ProductReviewDto[];
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly pages: number;
  readonly ratingCounts: Readonly<Record<1 | 2 | 3 | 4 | 5, number>>;
}

export interface ProductPurchaseConfigDto {
  readonly maxQuantity: number;
}

export type DeliveryCheckStatus = "serviceable" | "not_serviceable" | "confirmation_required";

export interface DeliveryCheckDto {
  readonly postalCode: string;
  readonly status: DeliveryCheckStatus;
  readonly message: string;
}

export const orderStatuses = [
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
] as const;
export type OrderStatus = (typeof orderStatuses)[number];
export type CheckoutPaymentMethod = "payment_placeholder" | "cod";

export interface CheckoutAddressDto {
  readonly id: string;
  readonly fullName: string;
  readonly phone: string;
  readonly addressLine1: string;
  readonly addressLine2?: string;
  readonly landmark?: string;
  readonly city: string;
  readonly district: string;
  readonly state: string;
  readonly postalCode: string;
  readonly country: string;
  readonly type: "home" | "work" | "other";
  readonly isDefault: boolean;
}

export interface ShippingMethodDto {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly ratePaise: number;
  readonly freeShippingThresholdPaise?: number;
  readonly estimatedBusinessDaysMin?: number;
  readonly estimatedBusinessDaysMax?: number;
  readonly codEligible: boolean;
  readonly active: boolean;
  readonly sortOrder: number;
}

export interface CheckoutItemDto {
  readonly productId: string;
  readonly variantId: string;
  readonly sku: string;
  readonly title: string;
  readonly slug: string;
  readonly colour: string;
  readonly size: string;
  readonly quantity: number;
  readonly mrpPaise: number;
  readonly unitPricePaise: number;
  readonly lineSubtotalPaise: number;
  readonly taxRateBps?: number;
  readonly taxPaise: number;
  readonly imageUrl?: string;
  readonly imageAlt?: string;
  readonly priceChanged: boolean;
}

export interface CheckoutTotalsDto {
  readonly subtotalPaise: number;
  readonly discountPaise: number;
  readonly shippingPaise: number;
  readonly taxPaise: number;
  readonly totalPaise: number;
}

export interface CheckoutSessionDto {
  readonly id: string;
  readonly status: "active" | "expired" | "cancelled" | "payment_failed" | "converted";
  readonly expiresAt: string;
  readonly address: CheckoutAddressDto;
  readonly shippingMethod: ShippingMethodDto;
  readonly items: readonly CheckoutItemDto[];
  readonly totals: CheckoutTotalsDto;
  readonly couponCode?: string;
  readonly paymentMethod: CheckoutPaymentMethod;
  readonly policyAcceptedAt: string;
  readonly orderId?: string;
  readonly orderNumber?: string;
  readonly reused: boolean;
}

export interface CheckoutBootstrapDto {
  readonly addresses: readonly CheckoutAddressDto[];
  readonly shippingMethods: readonly ShippingMethodDto[];
  readonly reservationMinutes: number;
  readonly guestCheckoutEnabled: boolean;
  readonly codEnabled: boolean;
  readonly codConfirmationRequired: boolean;
}

export interface OrderDto {
  readonly id: string;
  readonly orderNumber: string;
  readonly status: OrderStatus;
  readonly items: readonly CheckoutItemDto[];
  readonly totals: CheckoutTotalsDto;
  readonly address: CheckoutAddressDto;
  readonly shippingMethod: ShippingMethodDto;
  readonly paymentMethod: CheckoutPaymentMethod;
  readonly trackingNumber?: string;
  readonly trackingUrl?: string;
  readonly createdAt: string;
}

export interface CouponAdminDto {
  readonly id: string;
  readonly code: string;
  readonly description: string;
  readonly discountType: "fixed" | "percentage";
  readonly valuePaise?: number;
  readonly valueBps?: number;
  readonly minimumSubtotalPaise: number;
  readonly maximumDiscountPaise?: number;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly usageLimit?: number;
  readonly redeemedCount: number;
  readonly perUserLimit: number;
  readonly categoryIds: readonly string[];
  readonly productIds: readonly string[];
  readonly active: boolean;
}

export type ReturnRequestStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "pickup_scheduled"
  | "in_transit"
  | "received"
  | "inspection_approved"
  | "inspection_rejected"
  | "refund_pending"
  | "refunded"
  | "replacement_created"
  | "closed";

export interface AdminOrderSummaryDto {
  readonly id: string;
  readonly orderNumber: string;
  readonly customerName: string;
  readonly customerEmail?: string;
  readonly customerPhone?: string;
  readonly status: OrderStatus;
  readonly paymentStatus: PaymentStatus | "unavailable";
  readonly fulfilmentStatus: "unfulfilled" | "in_progress" | "fulfilled" | "cancelled";
  readonly totalPaise: number;
  readonly itemCount: number;
  readonly createdAt: string;
}

export interface AdminOrderDetailDto extends AdminOrderSummaryDto {
  readonly items: readonly CheckoutItemDto[];
  readonly totals: CheckoutTotalsDto;
  readonly address: CheckoutAddressDto;
  readonly shippingMethod: ShippingMethodDto;
  readonly payment: {
    readonly provider: PaymentProviderKind | "cod" | "unavailable";
    readonly providerOrderId?: string;
    readonly providerPaymentId?: string;
    readonly amountPaise: number;
    readonly amountRefundedPaise: number;
    readonly status: PaymentStatus | "unavailable";
  };
  readonly trackingCarrier?: string;
  readonly trackingNumber?: string;
  readonly trackingUrl?: string;
  readonly deliveredAt?: string;
  readonly timeline: readonly {
    readonly status: OrderStatus;
    readonly at: string;
    readonly actorId?: string;
    readonly note?: string;
  }[];
  readonly internalNotes: readonly {
    readonly id: string;
    readonly body: string;
    readonly actorId: string;
    readonly createdAt: string;
  }[];
  readonly auditHistory: readonly {
    readonly id: string;
    readonly action: string;
    readonly actorId?: string;
    readonly timestamp: string;
  }[];
}

export interface ReturnRequestDto {
  readonly id: string;
  readonly requestNumber: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly userId: string;
  readonly requestType: "return" | "exchange";
  readonly reason: string;
  readonly itemVariantIds: readonly string[];
  readonly imageUrls: readonly string[];
  readonly status: ReturnRequestStatus;
  readonly decisionReason?: string;
  readonly pickupCarrier?: string;
  readonly pickupTrackingNumber?: string;
  readonly pickupTrackingUrl?: string;
  readonly inspectionNotes?: string;
  readonly refundId?: string;
  readonly replacementOrderId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface InventoryAdminRowDto {
  readonly variantId: string;
  readonly productId: string;
  readonly productTitle: string;
  readonly sku: string;
  readonly colour: string;
  readonly size: string;
  readonly stockOnHand: number;
  readonly stockReserved: number;
  readonly availableStock: number;
  readonly reorderLevel: number;
  readonly lowStock: boolean;
  readonly status: string;
}

export interface InventoryMovementDto {
  readonly id: string;
  readonly variantId: string;
  readonly sku: string;
  readonly type: "manual_adjustment" | "order_confirmed" | "return_restock";
  readonly quantityDelta: number;
  readonly stockBefore: number;
  readonly stockAfter: number;
  readonly reason: string;
  readonly actorId?: string;
  readonly orderId?: string;
  readonly createdAt: string;
}

export interface AdminCustomerDto {
  readonly id: string;
  readonly name: string;
  readonly email?: string;
  readonly phone?: string;
  readonly status: "active" | "suspended" | "disabled";
  readonly emailVerifiedAt?: string;
  readonly phoneVerifiedAt?: string;
  readonly lastLoginAt?: string;
  readonly createdAt: string;
  readonly orderCount: number;
  readonly lifetimeValuePaise: number;
}

export interface OperationsSettingsDto {
  readonly business: PublicSiteSettingsDto;
  readonly returnWindowDays: number;
  readonly requireInspectionBeforeRestock: boolean;
  readonly onlinePaymentsEnabled: boolean;
  readonly maintenanceMode: boolean;
  readonly seo: {
    readonly defaultTitle: string;
    readonly defaultDescription: string;
  };
  readonly policyPages: readonly ContentPageDto[];
}

export interface CheckoutSettingsDto {
  readonly reservationMinutes: number;
  readonly guestCheckoutEnabled: boolean;
  readonly codEnabled: boolean;
  readonly codMinimumOrderPaise: number;
  readonly codMaximumOrderPaise: number | null;
  readonly codPostalPrefixes: readonly string[];
  readonly codConfirmationRequired: boolean;
}

export interface CheckoutAdminDto {
  readonly shippingMethods: readonly ShippingMethodDto[];
  readonly coupons: readonly CouponAdminDto[];
  readonly settings: CheckoutSettingsDto;
}

export type PaymentProviderKind = "razorpay" | "mock";
export type PaymentStatus =
  "awaiting_method" | "authorized" | "pending_verification" | "captured" | "failed" | "refunded";

export interface PaymentCheckoutDto {
  readonly provider: PaymentProviderKind;
  readonly keyId?: string;
  readonly providerOrderId: string;
  readonly internalOrderId: string;
  readonly orderNumber: string;
  readonly amountPaise: number;
  readonly currency: "INR";
  readonly brandName: string;
  readonly description: string;
  readonly customer: {
    readonly name: string;
    readonly email?: string;
    readonly phone?: string;
  };
  readonly expiresAt: string;
}

export interface PaymentReceiptDto {
  readonly internalOrderId: string;
  readonly orderNumber: string;
  readonly status: OrderStatus;
  readonly amountPaise: number;
  readonly currency: "INR";
  readonly provider: PaymentProviderKind;
  readonly providerPaymentId?: string;
  readonly capturedAt?: string;
  readonly createdAt: string;
}

export interface PaymentStatusDto {
  readonly checkoutSessionId: string;
  readonly paymentId: string;
  readonly status: PaymentStatus;
  readonly message: string;
  readonly retryable: boolean;
  readonly receipt?: PaymentReceiptDto;
}

export interface RefundDto {
  readonly id: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly amountPaise: number;
  readonly currency: "INR";
  readonly status: "pending" | "processed" | "failed";
  readonly providerRefundId: string;
  readonly createdAt: string;
}

export type RealtimeRoom =
  `user:${string}` | `order:${string}` | "role:admin" | "role:order_manager";

export interface RealtimeEventMeta {
  readonly eventId: string;
  readonly occurredAt: string;
}

export interface OrderCreatedEvent extends RealtimeEventMeta {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly status: OrderStatus;
}

export interface OrderStatusUpdatedEvent extends RealtimeEventMeta {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly previousStatus: OrderStatus;
  readonly status: OrderStatus;
  readonly trackingAvailable: boolean;
}

export interface PaymentUpdatedEvent extends RealtimeEventMeta {
  readonly orderId: string;
  readonly status: PaymentStatus;
}

export interface InventoryUpdatedEvent extends RealtimeEventMeta {
  readonly productId: string;
  readonly variantId: string;
  readonly sku: string;
  readonly availableStock: number;
  readonly lowStock: boolean;
}

export interface NotificationDto {
  readonly id: string;
  readonly type: "order" | "payment" | "inventory" | "system";
  readonly title: string;
  readonly message: string;
  readonly href?: string;
  readonly orderId?: string;
  readonly readAt?: string;
  readonly createdAt: string;
}

export interface NotificationCreatedEvent extends RealtimeEventMeta {
  readonly notification: NotificationDto;
}

export interface AdminDashboardUpdatedEvent extends RealtimeEventMeta {
  readonly reason: "new_order" | "order_status" | "low_stock" | "payment";
  readonly entityId: string;
}

export interface AdminDashboardDateRangeDto {
  readonly from: string;
  readonly to: string;
  readonly preset: "today" | "last_7_days" | "last_30_days" | "custom";
}

export interface AdminDashboardMetricDto {
  readonly value: number;
  readonly changePercent?: number;
}

export interface AdminDashboardOrderDto {
  readonly id: string;
  readonly orderNumber: string;
  readonly status: OrderStatus;
  readonly paymentStatus: PaymentStatus | "unavailable";
  readonly totalPaise: number;
  readonly itemCount: number;
  readonly createdAt: string;
}

export interface AdminDashboardTopProductDto {
  readonly productId: string;
  readonly title: string;
  readonly unitsSold: number;
  readonly revenuePaise: number;
}

export interface AdminDashboardSalesPointDto {
  readonly date: string;
  readonly revenuePaise: number;
  readonly paidOrders: number;
}

export interface AdminDashboardBreakdownDto {
  readonly status: string;
  readonly count: number;
}

export interface AdminDashboardLowStockDto {
  readonly variantId: string;
  readonly productId: string;
  readonly sku: string;
  readonly productTitle: string;
  readonly availableStock: number;
  readonly reorderLevel: number;
}

export interface AdminDashboardDto {
  readonly range: AdminDashboardDateRangeDto;
  readonly revenue: AdminDashboardMetricDto;
  readonly paidOrders: AdminDashboardMetricDto;
  readonly averageOrderValue: AdminDashboardMetricDto;
  readonly conversion?: AdminDashboardMetricDto;
  readonly pendingOrders: number;
  readonly lowStockVariants: readonly AdminDashboardLowStockDto[];
  readonly recentOrders: readonly AdminDashboardOrderDto[];
  readonly topProducts: readonly AdminDashboardTopProductDto[];
  readonly sales: readonly AdminDashboardSalesPointDto[];
  readonly paymentStatusBreakdown: readonly AdminDashboardBreakdownDto[];
  readonly returnRequests: number;
  readonly newCustomers: number;
  readonly generatedAt: string;
}

export interface NotificationPageDto {
  readonly items: readonly NotificationDto[];
  readonly unreadCount: number;
  readonly nextCursor?: string;
}

export interface OrderTrackingDto {
  readonly id: string;
  readonly orderNumber: string;
  readonly status: OrderStatus;
  readonly trackingNumber?: string;
  readonly trackingUrl?: string;
  readonly timeline: readonly {
    readonly status: OrderStatus;
    readonly at: string;
    readonly current: boolean;
    readonly completed: boolean;
  }[];
  readonly updatedAt: string;
}

export interface ServerToClientEvents {
  "order.created": (event: OrderCreatedEvent) => void;
  "order.status.updated": (event: OrderStatusUpdatedEvent) => void;
  "payment.updated": (event: PaymentUpdatedEvent) => void;
  "inventory.updated": (event: InventoryUpdatedEvent) => void;
  "notification.created": (event: NotificationCreatedEvent) => void;
  "admin.dashboard.updated": (event: AdminDashboardUpdatedEvent) => void;
}

export interface ClientToServerEvents {
  "room.join": (
    room: RealtimeRoom,
    acknowledge: (result: { readonly ok: boolean; readonly error?: string }) => void,
  ) => void;
}

export const commerceJobNames = [
  "reservation.release",
  "email.order-confirmation",
  "email.order-status",
  "email.password",
  "email.verification",
  "email.newsletter-confirmation",
  "inventory.low-stock",
  "invoice.generate",
] as const;
export type CommerceJobName = (typeof commerceJobNames)[number];

export const homepageSectionTypes = [
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
] as const;

export type HomepageSectionType = (typeof homepageSectionTypes)[number];

export interface HomepageImageDto {
  readonly source: "local" | "cloudinary";
  readonly src: string;
  readonly publicId?: string;
  readonly width: number;
  readonly height: number;
  readonly format?: "jpg" | "jpeg" | "png" | "webp" | "avif";
  readonly mimeType?: "image/jpeg" | "image/png" | "image/webp" | "image/avif";
  readonly bytes?: number;
  readonly alt: string;
}

export interface HomepageLinkDto {
  readonly label: string;
  readonly href: string;
}

export interface HomepageItemDto {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly body?: string;
  readonly href?: string;
  readonly image?: HomepageImageDto;
  readonly icon?: "card" | "headphones" | "truck" | "refresh" | "instagram";
}

export interface HomepageSectionDto {
  readonly id: string;
  readonly type: HomepageSectionType;
  readonly enabled: boolean;
  readonly sortOrder: number;
  readonly startsAt?: string;
  readonly endsAt?: string;
  readonly eyebrow?: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly body?: string;
  readonly primaryCta?: HomepageLinkDto;
  readonly secondaryCta?: HomepageLinkDto;
  readonly desktopImage?: HomepageImageDto;
  readonly mobileImage?: HomepageImageDto;
  readonly collectionSlugs: readonly string[];
  readonly items: readonly HomepageItemDto[];
  readonly needsClientReview: boolean;
}

export interface PublicHomepageDto {
  readonly version: number;
  readonly sections: readonly HomepageSectionDto[];
  readonly updatedAt: string;
}

export interface AdminHomepageDto {
  readonly draft: PublicHomepageDto;
  readonly published: PublicHomepageDto;
}

export interface HomepageCollectionOptionDto {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly active: boolean;
}

export type NavigationAudience = "men" | "women" | "unisex" | "accessories";

export interface NavigationLinkDto {
  readonly id: string;
  readonly label: string;
  readonly href: string;
}

export interface MegaMenuGroupDto {
  readonly id: string;
  readonly heading: string;
  readonly links: readonly NavigationLinkDto[];
}

export interface NavigationItemDto {
  readonly id: string;
  readonly label: string;
  readonly audience: NavigationAudience;
  readonly sortOrder: number;
  readonly groups: readonly MegaMenuGroupDto[];
  readonly promotionalTile?: {
    readonly alt: string;
    readonly href: string;
    readonly imageUrl: string;
    readonly label: string;
  };
}

export interface PublicNavigationDto {
  readonly items: readonly NavigationItemDto[];
  readonly version: number;
}

export interface FooterGroupDto {
  readonly id: string;
  readonly title: string;
  readonly links: readonly NavigationLinkDto[];
}

export interface PublicSiteSettingsDto {
  readonly brandName: string;
  readonly legalName: string;
  readonly addressLine1: string;
  readonly locality: string;
  readonly district: string;
  readonly city: string;
  readonly postalCode: string;
  readonly state: string;
  readonly country: string;
  readonly phone: string;
  readonly whatsappNumber: string;
  readonly email: string;
  readonly gstin: string;
  readonly foundedYear: number;
  readonly announcement: { readonly enabled: boolean; readonly text: string };
  readonly footerGroups: readonly FooterGroupDto[];
  readonly socialLinks: readonly NavigationLinkDto[];
}

export interface ContentSectionDto {
  readonly id: string;
  readonly heading?: string;
  readonly paragraphs: readonly string[];
  readonly items: readonly string[];
}

export interface ContentPageDto {
  readonly slug: string;
  readonly title: string;
  readonly eyebrow?: string;
  readonly summary: string;
  readonly sections: readonly ContentSectionDto[];
  readonly updatedAt: string;
}
