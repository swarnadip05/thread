import { createHash } from "node:crypto";

import mongoose, { Types } from "mongoose";
import type {
  CheckoutAddressDto,
  CheckoutAdminDto,
  CheckoutBootstrapDto,
  CheckoutItemDto,
  CheckoutSessionDto,
  OrderDto,
  ShippingMethodDto,
} from "@thread/types";
import {
  couponWriteSchema,
  shippingMethodWriteSchema,
  type CheckoutAddressInput,
  type CheckoutSessionCreateInput,
  type CheckoutSettingsInput,
  type CouponWriteInput,
  type ShippingMethodWriteInput,
} from "@thread/validation";

import { ProductVariantModel } from "../../catalogue/models/product-variant.model.js";
import { ProductModel } from "../../catalogue/models/product.model.js";
import { InventoryMovementModel } from "../../catalogue/models/inventory-movement.model.js";
import { HttpError } from "../../middleware/error-handler.js";
import { SiteSettingsModel } from "../../models/site-settings.model.js";
import type { CheckoutRepository } from "../checkout.types.js";
import { CheckoutAddressModel, type CheckoutAddress } from "../models/address.model.js";
import { CheckoutSessionModel, type CheckoutSession } from "../models/checkout-session.model.js";
import type {
  AddressSnapshot,
  OrderItemSnapshot,
  ShippingSnapshot,
  TotalsSnapshot,
} from "../models/checkout-shared.js";
import { CouponModel, type Coupon } from "../models/coupon.model.js";
import { OrderModel, OrderSequenceModel, type Order } from "../models/order.model.js";
import { PaymentRecordModel } from "../models/payment.model.js";
import { ShippingMethodModel, type ShippingMethod } from "../models/shipping-method.model.js";
import { StockReservationModel } from "../models/stock-reservation.model.js";
import { ManualShippingProvider } from "../shipping/shipping.provider.js";
import {
  couponDiscountPaise,
  lineSubtotalPaise,
  shippingChargePaise,
  taxForLinePaise,
} from "../pricing.js";

const defaultCheckoutSettings: CheckoutSettingsInput = {
  reservationMinutes: 12,
  guestCheckoutEnabled: false,
  codEnabled: false,
  codMinimumOrderPaise: 0,
  codMaximumOrderPaise: null,
  codPostalPrefixes: [],
  codConfirmationRequired: true,
};

type WithId<T> = T & { _id: Types.ObjectId };

function addressDto(address: WithId<CheckoutAddress>): CheckoutAddressDto {
  return {
    id: address._id.toString(),
    fullName: address.fullName,
    phone: address.phone,
    addressLine1: address.addressLine1,
    ...(address.addressLine2 ? { addressLine2: address.addressLine2 } : {}),
    ...(address.landmark ? { landmark: address.landmark } : {}),
    city: address.city,
    district: address.district,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
    type: address.type,
    isDefault: address.isDefault,
  };
}

function addressSnapshotDto(address: AddressSnapshot): CheckoutAddressDto {
  return {
    id: address.sourceAddressId.toString(),
    fullName: address.fullName,
    phone: address.phone,
    addressLine1: address.addressLine1,
    ...(address.addressLine2 ? { addressLine2: address.addressLine2 } : {}),
    ...(address.landmark ? { landmark: address.landmark } : {}),
    city: address.city,
    district: address.district,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
    type: address.type,
    isDefault: address.isDefault,
  };
}

function shippingDto(shipping: WithId<ShippingMethod>): ShippingMethodDto {
  return {
    id: shipping._id.toString(),
    name: shipping.name,
    description: shipping.description,
    ratePaise: shipping.ratePaise,
    ...(shipping.freeShippingThresholdPaise !== null
      ? { freeShippingThresholdPaise: shipping.freeShippingThresholdPaise }
      : {}),
    ...(shipping.estimatedBusinessDaysMin !== null
      ? { estimatedBusinessDaysMin: shipping.estimatedBusinessDaysMin }
      : {}),
    ...(shipping.estimatedBusinessDaysMax !== null
      ? { estimatedBusinessDaysMax: shipping.estimatedBusinessDaysMax }
      : {}),
    codEligible: shipping.codEligible,
    active: shipping.active,
    sortOrder: shipping.sortOrder,
  };
}

function shippingSnapshotDto(shipping: ShippingSnapshot): ShippingMethodDto {
  return {
    id: shipping.sourceShippingMethodId.toString(),
    name: shipping.name,
    description: shipping.description,
    ratePaise: shipping.ratePaise,
    ...(shipping.freeShippingThresholdPaise !== undefined
      ? { freeShippingThresholdPaise: shipping.freeShippingThresholdPaise }
      : {}),
    ...(shipping.estimatedBusinessDaysMin !== undefined
      ? { estimatedBusinessDaysMin: shipping.estimatedBusinessDaysMin }
      : {}),
    ...(shipping.estimatedBusinessDaysMax !== undefined
      ? { estimatedBusinessDaysMax: shipping.estimatedBusinessDaysMax }
      : {}),
    codEligible: shipping.codEligible,
    active: shipping.active,
    sortOrder: shipping.sortOrder,
  };
}

function itemDto(item: OrderItemSnapshot): CheckoutItemDto {
  return {
    productId: item.productId.toString(),
    variantId: item.variantId.toString(),
    sku: item.sku,
    title: item.title,
    slug: item.slug,
    colour: item.colour,
    size: item.size,
    quantity: item.quantity,
    mrpPaise: item.mrpPaise,
    unitPricePaise: item.unitPricePaise,
    lineSubtotalPaise: item.lineSubtotalPaise,
    ...(item.taxRateBps !== undefined ? { taxRateBps: item.taxRateBps } : {}),
    taxPaise: item.taxPaise,
    ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
    ...(item.imageAlt ? { imageAlt: item.imageAlt } : {}),
    priceChanged: item.priceChanged,
  };
}

function sessionDto(
  checkout: WithId<CheckoutSession>,
  reused: boolean,
  orderNumber?: string,
): CheckoutSessionDto {
  return {
    id: checkout._id.toString(),
    status: checkout.status,
    expiresAt: checkout.expiresAt.toISOString(),
    address: addressSnapshotDto(checkout.address),
    shippingMethod: shippingSnapshotDto(checkout.shippingMethod),
    items: checkout.items.map(itemDto),
    totals: checkout.totals,
    ...(checkout.couponCode ? { couponCode: checkout.couponCode } : {}),
    paymentMethod: checkout.paymentMethod,
    policyAcceptedAt: checkout.policyAcceptedAt.toISOString(),
    ...(checkout.orderId ? { orderId: checkout.orderId.toString() } : {}),
    ...(orderNumber ? { orderNumber } : {}),
    reused,
  };
}

export function orderDto(order: WithId<Order>): OrderDto {
  return {
    id: order._id.toString(),
    orderNumber: order.orderNumber,
    status: order.status,
    items: order.items.map(itemDto),
    totals: order.totals,
    address: addressSnapshotDto(order.address),
    shippingMethod: shippingSnapshotDto(order.shippingMethod),
    paymentMethod: order.paymentMethod,
    ...(order.trackingNumber ? { trackingNumber: order.trackingNumber } : {}),
    ...(order.trackingUrl ? { trackingUrl: order.trackingUrl } : {}),
    createdAt: order.createdAt.toISOString(),
  };
}

function couponAppliesToProducts(
  coupon: Coupon,
  products: readonly { _id: Types.ObjectId; categoryIds: readonly Types.ObjectId[] }[],
): boolean {
  if (coupon.productIds.length === 0 && coupon.categoryIds.length === 0) return true;
  const productIds = new Set(coupon.productIds.map(String));
  const categoryIds = new Set(coupon.categoryIds.map(String));
  // Until line-level coupon allocation is introduced, scoped coupons require every cart item
  // to be eligible so the server never discounts an unrelated product.
  return products.every(
    (product) =>
      productIds.has(product._id.toString()) ||
      product.categoryIds.some((categoryId) => categoryIds.has(categoryId.toString())),
  );
}

function totalsEqual(left: TotalsSnapshot, right: TotalsSnapshot): boolean {
  return (
    left.subtotalPaise === right.subtotalPaise &&
    left.discountPaise === right.discountPaise &&
    left.shippingPaise === right.shippingPaise &&
    left.taxPaise === right.taxPaise &&
    left.totalPaise === right.totalPaise
  );
}

function couponDto(coupon: WithId<Coupon>) {
  return {
    id: coupon._id.toString(),
    code: coupon.code,
    description: coupon.description,
    discountType: coupon.discountType,
    ...(coupon.valuePaise !== null ? { valuePaise: coupon.valuePaise } : {}),
    ...(coupon.valueBps !== null ? { valueBps: coupon.valueBps } : {}),
    minimumSubtotalPaise: coupon.minimumSubtotalPaise,
    ...(coupon.maximumDiscountPaise !== null
      ? { maximumDiscountPaise: coupon.maximumDiscountPaise }
      : {}),
    startsAt: coupon.startsAt.toISOString(),
    endsAt: coupon.endsAt.toISOString(),
    ...(coupon.usageLimit !== null ? { usageLimit: coupon.usageLimit } : {}),
    redeemedCount: coupon.redeemedCount,
    perUserLimit: coupon.perUserLimit,
    categoryIds: coupon.categoryIds.map(String),
    productIds: coupon.productIds.map(String),
    active: coupon.active,
  };
}

export class MongooseCheckoutRepository implements CheckoutRepository {
  private readonly shippingProvider = new ManualShippingProvider();

  constructor(private readonly maxCartQuantity = 10) {}
  async bootstrap(userId: string): Promise<CheckoutBootstrapDto> {
    const [addresses, shippingMethods, settingsRecord] = await Promise.all([
      CheckoutAddressModel.find({ userId }).sort({ isDefault: -1, updatedAt: -1 }).lean(),
      ShippingMethodModel.find({ active: true }).sort({ sortOrder: 1, name: 1 }).lean(),
      SiteSettingsModel.findOne({ key: "default" }).select({ checkout: 1 }).lean(),
    ]);
    const settings = settingsRecord?.checkout ?? defaultCheckoutSettings;
    return {
      addresses: addresses.map(addressDto),
      shippingMethods: shippingMethods.map(shippingDto),
      reservationMinutes: settings.reservationMinutes,
      guestCheckoutEnabled: settings.guestCheckoutEnabled,
      codEnabled: settings.codEnabled,
      codConfirmationRequired: settings.codConfirmationRequired,
    };
  }

  async adminConfiguration(): Promise<CheckoutAdminDto> {
    const [shippingMethods, coupons, settingsRecord] = await Promise.all([
      ShippingMethodModel.find().sort({ sortOrder: 1, name: 1 }).lean(),
      CouponModel.find().sort({ createdAt: -1 }).lean(),
      SiteSettingsModel.findOne({ key: "default" }).select({ checkout: 1 }).lean(),
    ]);
    return {
      shippingMethods: shippingMethods.map(shippingDto),
      coupons: coupons.map(couponDto),
      settings: settingsRecord?.checkout ?? defaultCheckoutSettings,
    };
  }

  async createAddress(userId: string, input: CheckoutAddressInput): Promise<CheckoutAddressDto> {
    const session = await mongoose.startSession();
    try {
      let created: WithId<CheckoutAddress>;
      await session.withTransaction(async () => {
        if (input.isDefault)
          await CheckoutAddressModel.updateMany(
            { userId, isDefault: true },
            { $set: { isDefault: false } },
            { session },
          );
        const document = new CheckoutAddressModel({
          userId: new Types.ObjectId(userId),
          fullName: input.fullName,
          phone: input.phone,
          addressLine1: input.addressLine1,
          ...(input.addressLine2 ? { addressLine2: input.addressLine2 } : {}),
          ...(input.landmark ? { landmark: input.landmark } : {}),
          city: input.city,
          district: input.district,
          state: input.state,
          postalCode: input.postalCode,
          country: input.country,
          type: input.type,
          isDefault: input.isDefault,
        });
        await document.save({ session });
        created = document.toObject();
      });
      return addressDto(created!);
    } finally {
      await session.endSession();
    }
  }

  async createSession(input: {
    userId: string;
    idempotencyKeyHash: string;
    checkout: CheckoutSessionCreateInput;
  }): Promise<CheckoutSessionDto> {
    if (input.checkout.lines.some((line) => line.quantity > this.maxCartQuantity))
      throw new HttpError(
        400,
        "QUANTITY_LIMIT_EXCEEDED",
        `A cart line cannot exceed ${this.maxCartQuantity} units.`,
      );
    const existing = await CheckoutSessionModel.findOne({
      userId: input.userId,
      idempotencyKeyHash: input.idempotencyKeyHash,
    })
      .select("+idempotencyKeyHash")
      .lean();
    if (existing) {
      const order = existing.orderId
        ? await OrderModel.findById(existing.orderId).select({ orderNumber: 1 }).lean()
        : null;
      return sessionDto(existing, true, order?.orderNumber);
    }

    const dbSession = await mongoose.startSession();
    try {
      let output: CheckoutSessionDto | null = null;
      await dbSession.withTransaction(async () => {
        const repeated = await CheckoutSessionModel.findOne({
          userId: input.userId,
          idempotencyKeyHash: input.idempotencyKeyHash,
        })
          .select("+idempotencyKeyHash")
          .session(dbSession)
          .lean();
        if (repeated) {
          output = sessionDto(repeated, true);
          return;
        }
        const [address, shipping, settingsRecord] = await Promise.all([
          CheckoutAddressModel.findOne({
            _id: input.checkout.addressId,
            userId: input.userId,
          })
            .session(dbSession)
            .lean(),
          ShippingMethodModel.findOne({
            _id: input.checkout.shippingMethodId,
            active: true,
          })
            .session(dbSession)
            .lean(),
          SiteSettingsModel.findOne({ key: "default" })
            .select({ checkout: 1 })
            .session(dbSession)
            .lean(),
        ]);
        if (!address) throw new HttpError(404, "ADDRESS_NOT_FOUND", "Address not found.");
        if (!shipping)
          throw new HttpError(
            400,
            "SHIPPING_METHOD_UNAVAILABLE",
            "Shipping method is unavailable.",
          );
        if (!this.shippingProvider.supports(address, shipping))
          throw new HttpError(
            400,
            "SHIPPING_METHOD_UNAVAILABLE",
            "Shipping method is unavailable for this address.",
          );
        const settings = settingsRecord?.checkout ?? defaultCheckoutSettings;
        const expiresAt = new Date(Date.now() + settings.reservationMinutes * 60_000);
        const variantIds = input.checkout.lines.map((line) => new Types.ObjectId(line.variantId));
        const variants = await ProductVariantModel.find({
          _id: { $in: variantIds },
          status: "active",
        })
          .session(dbSession)
          .lean();
        if (variants.length !== variantIds.length)
          throw new HttpError(409, "CART_CHANGED", "One or more cart variants are unavailable.");
        const products = await ProductModel.find({
          _id: { $in: variants.map((variant) => variant.productId) },
          status: "active",
          publishedAt: { $lte: new Date() },
        })
          .session(dbSession)
          .lean();
        const productById = new Map(products.map((product) => [product._id.toString(), product]));
        const variantById = new Map(variants.map((variant) => [variant._id.toString(), variant]));
        const items: OrderItemSnapshot[] = input.checkout.lines.map((line) => {
          const variant = variantById.get(line.variantId);
          if (!variant) throw new HttpError(409, "CART_CHANGED", "A cart variant is unavailable.");
          const product = productById.get(variant.productId.toString());
          if (!product) throw new HttpError(409, "CART_CHANGED", "A cart product is unavailable.");
          const lineSubtotal = lineSubtotalPaise(variant.salePricePaise, line.quantity);
          const taxPaise = taxForLinePaise(lineSubtotal, variant.taxRateBps);
          const primary =
            product.media.find((media) => media.primary) ??
            [...product.media].sort((left, right) => left.sortOrder - right.sortOrder)[0];
          return {
            productId: variant.productId,
            variantId: variant._id,
            sku: variant.sku,
            title: product.title,
            slug: product.slug,
            colour: variant.colour,
            size: variant.size,
            quantity: line.quantity,
            mrpPaise: variant.mrpPaise,
            unitPricePaise: variant.salePricePaise,
            lineSubtotalPaise: lineSubtotal,
            ...(variant.taxRateBps !== null ? { taxRateBps: variant.taxRateBps } : {}),
            taxPaise,
            ...(primary ? { imageUrl: primary.secureUrl, imageAlt: primary.alt } : {}),
            priceChanged:
              line.observedUnitPricePaise !== undefined &&
              line.observedUnitPricePaise !== variant.salePricePaise,
          };
        });
        const subtotalPaise = items.reduce((sum, item) => sum + item.lineSubtotalPaise, 0);
        const taxPaise = items.reduce((sum, item) => sum + item.taxPaise, 0);
        let coupon: WithId<Coupon> | null = null;
        let discountPaise = 0;
        if (input.checkout.couponCode) {
          coupon = await CouponModel.findOne({
            code: input.checkout.couponCode,
            active: true,
            startsAt: { $lte: new Date() },
            endsAt: { $gt: new Date() },
          })
            .session(dbSession)
            .lean();
          if (
            !coupon ||
            subtotalPaise < coupon.minimumSubtotalPaise ||
            !couponAppliesToProducts(coupon, products) ||
            (coupon.usageLimit !== null && coupon.redeemedCount >= coupon.usageLimit)
          )
            throw new HttpError(400, "INVALID_COUPON", "Coupon is invalid or unavailable.");
          const priorUsage = await OrderModel.countDocuments({
            userId: input.userId,
            couponId: coupon._id,
            status: { $nin: ["cancelled", "payment_failed"] },
          }).session(dbSession);
          if (priorUsage >= coupon.perUserLimit)
            throw new HttpError(400, "INVALID_COUPON", "Coupon is invalid or unavailable.");
          discountPaise = couponDiscountPaise(coupon, subtotalPaise);
        }
        const discountedSubtotal = subtotalPaise - discountPaise;
        const shippingPaise = shippingChargePaise(
          shipping.ratePaise,
          shipping.freeShippingThresholdPaise,
          discountedSubtotal,
        );
        const totalPaise = discountedSubtotal + shippingPaise + taxPaise;
        if (input.checkout.paymentMethod === "cod") {
          const prefixAllowed =
            settings.codPostalPrefixes.length === 0 ||
            settings.codPostalPrefixes.some((prefix) => address.postalCode.startsWith(prefix));
          const valueAllowed =
            totalPaise >= settings.codMinimumOrderPaise &&
            (settings.codMaximumOrderPaise === null || totalPaise <= settings.codMaximumOrderPaise);
          if (!settings.codEnabled || !shipping.codEligible || !prefixAllowed || !valueAllowed)
            throw new HttpError(400, "COD_UNAVAILABLE", "Cash on delivery is unavailable.");
          if (settings.codConfirmationRequired && !input.checkout.codConfirmationAccepted)
            throw new HttpError(
              400,
              "COD_CONFIRMATION_REQUIRED",
              "Cash on delivery confirmation is required.",
            );
        }
        const totals: TotalsSnapshot = {
          subtotalPaise,
          discountPaise,
          shippingPaise,
          taxPaise,
          totalPaise,
        };
        const addressSnapshot: AddressSnapshot = {
          sourceAddressId: address._id,
          fullName: address.fullName,
          phone: address.phone,
          addressLine1: address.addressLine1,
          ...(address.addressLine2 ? { addressLine2: address.addressLine2 } : {}),
          ...(address.landmark ? { landmark: address.landmark } : {}),
          city: address.city,
          district: address.district,
          state: address.state,
          postalCode: address.postalCode,
          country: address.country,
          type: address.type,
          isDefault: address.isDefault,
        };
        const shippingSnapshot: ShippingSnapshot = {
          sourceShippingMethodId: shipping._id,
          name: shipping.name,
          description: shipping.description,
          ratePaise: shipping.ratePaise,
          ...(shipping.freeShippingThresholdPaise !== null
            ? { freeShippingThresholdPaise: shipping.freeShippingThresholdPaise }
            : {}),
          ...(shipping.estimatedBusinessDaysMin !== null
            ? { estimatedBusinessDaysMin: shipping.estimatedBusinessDaysMin }
            : {}),
          ...(shipping.estimatedBusinessDaysMax !== null
            ? { estimatedBusinessDaysMax: shipping.estimatedBusinessDaysMax }
            : {}),
          codEligible: shipping.codEligible,
          active: shipping.active,
          sortOrder: shipping.sortOrder,
        };
        const documents = await CheckoutSessionModel.create(
          [
            {
              userId: new Types.ObjectId(input.userId),
              idempotencyKeyHash: input.idempotencyKeyHash,
              status: "active",
              expiresAt,
              address: addressSnapshot,
              shippingMethod: shippingSnapshot,
              items,
              totals,
              ...(coupon ? { couponId: coupon._id, couponCode: coupon.code } : {}),
              paymentMethod: input.checkout.paymentMethod,
              policyAcceptedAt: new Date(),
              ...(input.checkout.paymentMethod === "cod" && input.checkout.codConfirmationAccepted
                ? { codConfirmationAcceptedAt: new Date() }
                : {}),
            },
          ],
          { session: dbSession },
        );
        const checkout = documents[0]!;
        for (const line of input.checkout.lines) {
          const variant = variantById.get(line.variantId)!;
          const reserved = await ProductVariantModel.updateOne(
            {
              _id: variant._id,
              status: "active",
              $expr: {
                $gte: [{ $subtract: ["$stockOnHand", "$stockReserved"] }, line.quantity],
              },
            },
            { $inc: { stockReserved: line.quantity } },
            { session: dbSession },
          );
          if (reserved.modifiedCount !== 1)
            throw new HttpError(
              409,
              "INSUFFICIENT_STOCK",
              `${variant.sku} no longer has enough stock.`,
            );
          await StockReservationModel.create(
            [
              {
                checkoutSessionId: checkout._id,
                userId: new Types.ObjectId(input.userId),
                productId: variant.productId,
                variantId: variant._id,
                quantity: line.quantity,
                status: "active",
                expiresAt,
              },
            ],
            { session: dbSession },
          );
        }
        output = sessionDto(checkout.toObject(), false);
      });
      if (!output)
        throw new HttpError(500, "CHECKOUT_CREATE_FAILED", "Checkout could not be created.");
      return output;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11_000) {
        const repeated = await CheckoutSessionModel.findOne({
          userId: input.userId,
          idempotencyKeyHash: input.idempotencyKeyHash,
        })
          .select("+idempotencyKeyHash")
          .lean();
        if (repeated) return sessionDto(repeated, true);
      }
      throw error;
    } finally {
      await dbSession.endSession();
    }
  }

  async findSession(userId: string, sessionId: string): Promise<CheckoutSessionDto | null> {
    if (!Types.ObjectId.isValid(sessionId)) return null;
    const checkout = await CheckoutSessionModel.findOne({ _id: sessionId, userId }).lean();
    if (!checkout) return null;
    const order = checkout.orderId
      ? await OrderModel.findById(checkout.orderId).select({ orderNumber: 1 }).lean()
      : null;
    return sessionDto(checkout, false, order?.orderNumber);
  }

  async validateSessionPayable(userId: string, sessionId: string): Promise<CheckoutSessionDto> {
    if (!Types.ObjectId.isValid(sessionId))
      throw new HttpError(404, "CHECKOUT_NOT_FOUND", "Checkout not found.");
    const checkout = await CheckoutSessionModel.findOne({
      _id: sessionId,
      userId,
      status: "active",
    }).lean();
    if (!checkout) throw new HttpError(409, "CHECKOUT_NOT_ACTIVE", "Checkout is no longer active.");
    if (checkout.expiresAt <= new Date())
      throw new HttpError(409, "CHECKOUT_EXPIRED", "Checkout reservation has expired.");
    if (checkout.paymentMethod !== "payment_placeholder")
      throw new HttpError(
        400,
        "PAYMENT_METHOD_MISMATCH",
        "Checkout is not configured for online payment.",
      );

    const [variants, products, shipping, coupon] = await Promise.all([
      ProductVariantModel.find({
        _id: { $in: checkout.items.map((item) => item.variantId) },
        status: "active",
      }).lean(),
      ProductModel.find({
        _id: { $in: checkout.items.map((item) => item.productId) },
        status: "active",
        publishedAt: { $lte: new Date() },
      })
        .select({ _id: 1, categoryIds: 1 })
        .lean(),
      ShippingMethodModel.findOne({
        _id: checkout.shippingMethod.sourceShippingMethodId,
        active: true,
      }).lean(),
      checkout.couponId
        ? CouponModel.findOne({
            _id: checkout.couponId,
            active: true,
            startsAt: { $lte: new Date() },
            endsAt: { $gt: new Date() },
          }).lean()
        : Promise.resolve(null),
    ]);
    if (
      variants.length !== checkout.items.length ||
      products.length !== new Set(checkout.items.map((item) => item.productId.toString())).size ||
      !shipping ||
      (shipping && !this.shippingProvider.supports(checkout.address, shipping)) ||
      (checkout.couponId && !coupon) ||
      (coupon && !couponAppliesToProducts(coupon, products))
    )
      throw new HttpError(
        409,
        "CHECKOUT_AMOUNT_CHANGED",
        "Cart availability or pricing changed. Rebuild checkout before paying.",
      );
    const variantById = new Map(variants.map((variant) => [variant._id.toString(), variant]));
    const currentItems = checkout.items.map((item) => {
      const variant = variantById.get(item.variantId.toString());
      if (!variant) throw new HttpError(409, "CHECKOUT_AMOUNT_CHANGED", "A cart variant changed.");
      const lineSubtotal = lineSubtotalPaise(variant.salePricePaise, item.quantity);
      const taxPaise = taxForLinePaise(lineSubtotal, variant.taxRateBps);
      if (
        item.unitPricePaise !== variant.salePricePaise ||
        item.mrpPaise !== variant.mrpPaise ||
        (item.taxRateBps ?? null) !== variant.taxRateBps
      )
        throw new HttpError(
          409,
          "CHECKOUT_AMOUNT_CHANGED",
          "A product price changed. Rebuild checkout before paying.",
        );
      return { lineSubtotalPaise: lineSubtotal, taxPaise };
    });
    const subtotalPaise = currentItems.reduce((sum, item) => sum + item.lineSubtotalPaise, 0);
    const taxPaise = currentItems.reduce((sum, item) => sum + item.taxPaise, 0);
    if (
      coupon &&
      (subtotalPaise < coupon.minimumSubtotalPaise ||
        (coupon.usageLimit !== null && coupon.redeemedCount >= coupon.usageLimit))
    )
      throw new HttpError(
        409,
        "CHECKOUT_AMOUNT_CHANGED",
        "The coupon is no longer available. Rebuild checkout before paying.",
      );
    const discountPaise = coupon ? couponDiscountPaise(coupon, subtotalPaise) : 0;
    const discountedSubtotal = subtotalPaise - discountPaise;
    const shippingPaise = shippingChargePaise(
      shipping.ratePaise,
      shipping.freeShippingThresholdPaise,
      discountedSubtotal,
    );
    const totals: TotalsSnapshot = {
      subtotalPaise,
      discountPaise,
      shippingPaise,
      taxPaise,
      totalPaise: discountedSubtotal + shippingPaise + taxPaise,
    };
    if (!totalsEqual(checkout.totals, totals))
      throw new HttpError(
        409,
        "CHECKOUT_AMOUNT_CHANGED",
        "The final payable amount changed. Rebuild checkout before paying.",
      );
    return sessionDto(checkout, false);
  }

  async preparePendingOrder(userId: string, sessionId: string): Promise<OrderDto> {
    if (!Types.ObjectId.isValid(sessionId))
      throw new HttpError(404, "CHECKOUT_NOT_FOUND", "Checkout not found.");
    const dbSession = await mongoose.startSession();
    try {
      let output: OrderDto | null = null;
      await dbSession.withTransaction(async () => {
        const existing = await OrderModel.findOne({ checkoutSessionId: sessionId })
          .session(dbSession)
          .lean();
        if (existing) {
          output = orderDto(existing);
          return;
        }
        const checkout = await CheckoutSessionModel.findOne({
          _id: sessionId,
          userId,
          status: "active",
          expiresAt: { $gt: new Date() },
          paymentMethod: "payment_placeholder",
        })
          .session(dbSession)
          .exec();
        if (!checkout)
          throw new HttpError(409, "CHECKOUT_NOT_ACTIVE", "Checkout is no longer payable.");
        const year = new Date().getUTCFullYear();
        const sequence = await OrderSequenceModel.findOneAndUpdate(
          { key: `order:${year}` },
          { $inc: { value: 1 } },
          { upsert: true, new: true, session: dbSession },
        );
        const orderNumber = `THR-${year}-${String(sequence.value).padStart(6, "0")}`;
        const orders = await OrderModel.create(
          [
            {
              orderNumber,
              userId: checkout.userId,
              checkoutSessionId: checkout._id,
              status: "pending_payment",
              address: checkout.address,
              shippingMethod: checkout.shippingMethod,
              items: checkout.items,
              totals: checkout.totals,
              ...(checkout.couponId
                ? { couponId: checkout.couponId, couponCode: checkout.couponCode }
                : {}),
              paymentMethod: checkout.paymentMethod,
              statusHistory: [{ status: "pending_payment", at: new Date() }],
            },
          ],
          { session: dbSession },
        );
        checkout.orderId = orders[0]!._id;
        await checkout.save({ session: dbSession });
        output = orderDto(orders[0]!.toObject());
      });
      if (!output)
        throw new HttpError(500, "ORDER_PREPARE_FAILED", "Payment order could not be prepared.");
      return output;
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11_000) {
        const existing = await OrderModel.findOne({ checkoutSessionId: sessionId }).lean();
        if (existing) return orderDto(existing);
      }
      throw error;
    } finally {
      await dbSession.endSession();
    }
  }

  async findOrderById(orderId: string): Promise<OrderDto | null> {
    if (!Types.ObjectId.isValid(orderId)) return null;
    const order = await OrderModel.findById(orderId).lean();
    return order ? orderDto(order) : null;
  }

  async releaseSession(
    sessionId: string,
    reason: "expired" | "cancelled" | "payment_failed",
    userId?: string,
  ): Promise<CheckoutSessionDto | null> {
    if (!Types.ObjectId.isValid(sessionId)) return null;
    const dbSession = await mongoose.startSession();
    try {
      let output: CheckoutSessionDto | null = null;
      await dbSession.withTransaction(async () => {
        const checkout = await CheckoutSessionModel.findOne({
          _id: sessionId,
          ...(userId ? { userId } : {}),
        })
          .session(dbSession)
          .exec();
        if (!checkout) return;
        if (checkout.status !== "active") {
          output = sessionDto(checkout.toObject(), false);
          return;
        }
        const reservations = await StockReservationModel.find({
          checkoutSessionId: checkout._id,
          status: "active",
        })
          .session(dbSession)
          .lean();
        for (const reservation of reservations) {
          const released = await ProductVariantModel.updateOne(
            { _id: reservation.variantId, stockReserved: { $gte: reservation.quantity } },
            { $inc: { stockReserved: -reservation.quantity } },
            { session: dbSession },
          );
          if (released.modifiedCount !== 1)
            throw new HttpError(
              409,
              "RESERVATION_INVALID",
              "Reserved stock could not be released safely.",
            );
        }
        await StockReservationModel.updateMany(
          { checkoutSessionId: checkout._id, status: "active" },
          {
            $set: {
              status: "released",
              releasedAt: new Date(),
              releaseReason: reason,
            },
          },
          { session: dbSession },
        );
        checkout.status =
          reason === "expired"
            ? "expired"
            : reason === "payment_failed"
              ? "payment_failed"
              : "cancelled";
        await checkout.save({ session: dbSession });
        const orderStatus = reason === "payment_failed" ? "payment_failed" : "cancelled";
        await OrderModel.updateOne(
          { checkoutSessionId: checkout._id, status: "pending_payment" },
          {
            $set: { status: orderStatus },
            $push: { statusHistory: { status: orderStatus, at: new Date() } },
          },
          { session: dbSession },
        );
        await PaymentRecordModel.updateOne(
          {
            checkoutSessionId: checkout._id,
            status: { $nin: ["captured", "refunded", "failed"] },
          },
          {
            $set: {
              status: "failed",
              failureCode: reason === "expired" ? "reservation_expired" : `checkout_${reason}`,
            },
          },
          { session: dbSession },
        );
        output = sessionDto(checkout.toObject(), false);
      });
      return output;
    } finally {
      await dbSession.endSession();
    }
  }

  async confirmSession(input: {
    sessionId: string;
    confirmationIdempotencyKeyHash: string;
    provider: "razorpay" | "mock" | "cod";
    providerOrderId?: string;
    providerPaymentId?: string;
  }): Promise<OrderDto> {
    const existing = await OrderModel.findOne({ checkoutSessionId: input.sessionId }).lean();
    if (existing && existing.status !== "pending_payment") return orderDto(existing);
    const dbSession = await mongoose.startSession();
    try {
      let output: OrderDto | null = null;
      await dbSession.withTransaction(async () => {
        const checkout = await CheckoutSessionModel.findOne({
          _id: input.sessionId,
          status: "active",
        })
          .session(dbSession)
          .exec();
        if (!checkout)
          throw new HttpError(409, "CHECKOUT_NOT_ACTIVE", "Checkout is no longer active.");
        if (checkout.expiresAt <= new Date())
          throw new HttpError(409, "CHECKOUT_EXPIRED", "Checkout reservation has expired.");
        const pendingOrder = await OrderModel.findOne({ checkoutSessionId: checkout._id })
          .session(dbSession)
          .exec();
        if (pendingOrder && pendingOrder.status !== "pending_payment") {
          output = orderDto(pendingOrder.toObject());
          return;
        }
        if (checkout.couponId) {
          const couponUpdated = await CouponModel.updateOne(
            {
              _id: checkout.couponId,
              $or: [{ usageLimit: null }, { $expr: { $lt: ["$redeemedCount", "$usageLimit"] } }],
            },
            { $inc: { redeemedCount: 1 } },
            { session: dbSession },
          );
          if (couponUpdated.modifiedCount !== 1)
            throw new HttpError(409, "COUPON_EXHAUSTED", "Coupon is no longer available.");
        }
        let orderNumber: string;
        let orderId: Types.ObjectId;
        if (pendingOrder) {
          orderNumber = pendingOrder.orderNumber;
          orderId = pendingOrder._id;
        } else {
          const year = new Date().getUTCFullYear();
          const sequence = await OrderSequenceModel.findOneAndUpdate(
            { key: `order:${year}` },
            { $inc: { value: 1 } },
            { upsert: true, new: true, session: dbSession },
          );
          orderNumber = `THR-${year}-${String(sequence.value).padStart(6, "0")}`;
          orderId = new Types.ObjectId();
        }
        const reservations = await StockReservationModel.find({
          checkoutSessionId: checkout._id,
          status: "active",
        })
          .session(dbSession)
          .lean();
        if (reservations.length !== checkout.items.length)
          throw new HttpError(409, "RESERVATION_INVALID", "Stock reservation is incomplete.");
        for (const reservation of reservations) {
          const variant = await ProductVariantModel.findOneAndUpdate(
            {
              _id: reservation.variantId,
              stockOnHand: { $gte: reservation.quantity },
              stockReserved: { $gte: reservation.quantity },
            },
            {
              $inc: {
                stockOnHand: -reservation.quantity,
                stockReserved: -reservation.quantity,
              },
            },
            { new: false, session: dbSession },
          ).lean();
          if (!variant)
            throw new HttpError(409, "RESERVATION_INVALID", "Reserved stock is unavailable.");
          await InventoryMovementModel.create(
            [
              {
                productId: reservation.productId,
                variantId: reservation.variantId,
                type: "order_confirmed",
                quantityDelta: -reservation.quantity,
                stockBefore: variant.stockOnHand,
                stockAfter: variant.stockOnHand - reservation.quantity,
                reason: `Order ${orderNumber} confirmed`,
                orderId,
              },
            ],
            { session: dbSession },
          );
        }
        const status = "confirmed" as const;
        let confirmedOrder: WithId<Order>;
        if (pendingOrder) {
          pendingOrder.status = status;
          pendingOrder.statusHistory.push({ status, at: new Date() });
          await pendingOrder.save({ session: dbSession });
          confirmedOrder = pendingOrder.toObject();
        } else {
          const orders = await OrderModel.create(
            [
              {
                _id: orderId,
                orderNumber,
                userId: checkout.userId,
                checkoutSessionId: checkout._id,
                status,
                address: checkout.address,
                shippingMethod: checkout.shippingMethod,
                items: checkout.items,
                totals: checkout.totals,
                ...(checkout.couponId
                  ? { couponId: checkout.couponId, couponCode: checkout.couponCode }
                  : {}),
                paymentMethod: checkout.paymentMethod,
                statusHistory: [{ status, at: new Date() }],
              },
            ],
            { session: dbSession },
          );
          confirmedOrder = orders[0]!.toObject();
        }
        if (input.provider === "cod") {
          await PaymentRecordModel.create(
            [
              {
                orderId,
                checkoutSessionId: checkout._id,
                userId: checkout.userId,
                provider: "cod",
                amountPaise: checkout.totals.totalPaise,
                currency: "INR",
                status: "awaiting_method",
                idempotencyKeyHash: input.confirmationIdempotencyKeyHash,
              },
            ],
            { session: dbSession },
          );
        } else {
          const paymentUpdated = await PaymentRecordModel.updateOne(
            {
              checkoutSessionId: checkout._id,
              provider: input.provider,
              ...(input.providerOrderId ? { providerOrderId: input.providerOrderId } : {}),
            },
            {
              $set: {
                status: "captured",
                ...(input.providerPaymentId ? { providerPaymentId: input.providerPaymentId } : {}),
                capturedAt: new Date(),
                providerVerifiedAt: new Date(),
                failureCode: null,
              },
            },
            { session: dbSession },
          );
          if (paymentUpdated.modifiedCount !== 1)
            throw new HttpError(
              409,
              "PAYMENT_RECORD_MISMATCH",
              "Verified payment does not match the internal order.",
            );
        }
        await StockReservationModel.updateMany(
          { checkoutSessionId: checkout._id, status: "active" },
          { $set: { status: "committed", committedAt: new Date(), orderId } },
          { session: dbSession },
        );
        checkout.status = "converted";
        checkout.orderId = orderId;
        await checkout.save({ session: dbSession });
        output = orderDto(confirmedOrder);
      });
      if (!output)
        throw new HttpError(500, "ORDER_CONFIRM_FAILED", "Order could not be confirmed.");
      return output;
    } finally {
      await dbSession.endSession();
    }
  }

  async listShippingMethods(includeInactive = false): Promise<readonly ShippingMethodDto[]> {
    const methods = await ShippingMethodModel.find(includeInactive ? {} : { active: true })
      .sort({ sortOrder: 1, name: 1 })
      .lean();
    return methods.map(shippingDto);
  }

  async createShippingMethod(input: ShippingMethodWriteInput): Promise<ShippingMethodDto> {
    const created = await ShippingMethodModel.create(input);
    return shippingDto(created.toObject());
  }

  async updateShippingMethod(
    id: string,
    input: Partial<ShippingMethodWriteInput>,
  ): Promise<ShippingMethodDto | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const current = await ShippingMethodModel.findById(id).lean();
    if (!current) return null;
    const validated = shippingMethodWriteSchema.parse({
      name: current.name,
      description: current.description,
      ratePaise: current.ratePaise,
      freeShippingThresholdPaise: current.freeShippingThresholdPaise,
      estimatedBusinessDaysMin: current.estimatedBusinessDaysMin,
      estimatedBusinessDaysMax: current.estimatedBusinessDaysMax,
      countries: current.countries,
      postalPrefixes: current.postalPrefixes,
      codEligible: current.codEligible,
      active: current.active,
      sortOrder: current.sortOrder,
      ...input,
    });
    const updated = await ShippingMethodModel.findByIdAndUpdate(id, validated, {
      new: true,
      runValidators: true,
    }).lean();
    return updated ? shippingDto(updated) : null;
  }

  async createCoupon(input: CouponWriteInput): Promise<{ id: string; code: string }> {
    const created = await CouponModel.create(input);
    return { id: created.id, code: created.code };
  }

  async updateCoupon(
    id: string,
    input: Partial<CouponWriteInput>,
  ): Promise<{ id: string; code: string } | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const current = await CouponModel.findById(id).lean();
    if (!current) return null;
    const validated = couponWriteSchema.parse({
      code: current.code,
      description: current.description,
      discountType: current.discountType,
      valuePaise: current.valuePaise,
      valueBps: current.valueBps,
      minimumSubtotalPaise: current.minimumSubtotalPaise,
      maximumDiscountPaise: current.maximumDiscountPaise,
      startsAt: current.startsAt,
      endsAt: current.endsAt,
      usageLimit: current.usageLimit,
      perUserLimit: current.perUserLimit,
      categoryIds: current.categoryIds,
      productIds: current.productIds,
      active: current.active,
      ...input,
    });
    const updated = await CouponModel.findByIdAndUpdate(id, validated, {
      new: true,
      runValidators: true,
    }).lean();
    return updated ? { id: updated._id.toString(), code: updated.code } : null;
  }

  async updateSettings(input: CheckoutSettingsInput): Promise<CheckoutSettingsInput> {
    const result = await SiteSettingsModel.updateOne(
      { key: "default" },
      { $set: { checkout: input } },
      { runValidators: true },
    );
    if (result.matchedCount !== 1)
      throw new HttpError(
        409,
        "SITE_SETTINGS_REQUIRED",
        "Seed SiteSettings before configuring checkout.",
      );
    return input;
  }
}

export function hashIdempotencyKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
