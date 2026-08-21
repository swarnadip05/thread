import type {
  CheckoutAddressDto,
  CheckoutAdminDto,
  CheckoutBootstrapDto,
  CheckoutSessionDto,
  OrderDto,
  ShippingMethodDto,
} from "@thread/types";
import type {
  CheckoutAddressInput,
  CheckoutSessionCreateInput,
  CheckoutSettingsInput,
  CouponWriteInput,
  ShippingMethodWriteInput,
} from "@thread/validation";

export interface CheckoutRepository {
  bootstrap(userId: string): Promise<CheckoutBootstrapDto>;
  adminConfiguration(): Promise<CheckoutAdminDto>;
  createAddress(userId: string, input: CheckoutAddressInput): Promise<CheckoutAddressDto>;
  createSession(input: {
    userId: string;
    idempotencyKeyHash: string;
    checkout: CheckoutSessionCreateInput;
  }): Promise<CheckoutSessionDto>;
  findSession(userId: string, sessionId: string): Promise<CheckoutSessionDto | null>;
  validateSessionPayable(userId: string, sessionId: string): Promise<CheckoutSessionDto>;
  preparePendingOrder(userId: string, sessionId: string): Promise<OrderDto>;
  findOrderById(orderId: string): Promise<OrderDto | null>;
  releaseSession(
    sessionId: string,
    reason: "expired" | "cancelled" | "payment_failed",
    userId?: string,
  ): Promise<CheckoutSessionDto | null>;
  confirmSession(input: {
    sessionId: string;
    confirmationIdempotencyKeyHash: string;
    provider: "razorpay" | "mock" | "cod";
    providerOrderId?: string;
    providerPaymentId?: string;
  }): Promise<OrderDto>;
  listShippingMethods(includeInactive?: boolean): Promise<readonly ShippingMethodDto[]>;
  createShippingMethod(input: ShippingMethodWriteInput): Promise<ShippingMethodDto>;
  updateShippingMethod(
    id: string,
    input: Partial<ShippingMethodWriteInput>,
  ): Promise<ShippingMethodDto | null>;
  createCoupon(input: CouponWriteInput): Promise<{ id: string; code: string }>;
  updateCoupon(
    id: string,
    input: Partial<CouponWriteInput>,
  ): Promise<{ id: string; code: string } | null>;
  updateSettings(input: CheckoutSettingsInput): Promise<CheckoutSettingsInput>;
}

export interface ReservationExpiryScheduler {
  schedule(sessionId: string, expiresAt: Date): Promise<void>;
}
