import { randomBytes } from "node:crypto";

import mongoose, { Types, type QueryFilter } from "mongoose";
import type {
  AdminCustomerDto,
  AdminOrderDetailDto,
  AdminOrderSummaryDto,
  InventoryAdminRowDto,
  InventoryMovementDto,
  OperationsSettingsDto,
  OrderStatus,
  ReturnRequestDto,
} from "@thread/types";
import type {
  OperationalOrderQuery,
  OperationsSettingsUpdateInput,
  ReturnRequestCreateInput,
} from "@thread/validation";

import { InventoryMovementModel } from "../catalogue/models/inventory-movement.model.js";
import { ProductVariantModel } from "../catalogue/models/product-variant.model.js";
import { ProductModel } from "../catalogue/models/product.model.js";
import { OrderModel, type Order } from "../checkout/models/order.model.js";
import { PaymentRecordModel } from "../checkout/models/payment.model.js";
import { orderDto } from "../checkout/repositories/mongoose-checkout.repository.js";
import { AuditLogModel } from "../models/audit-log.model.js";
import { ContentPageModel } from "../models/content-page.model.js";
import { SiteSettingsModel } from "../models/site-settings.model.js";
import { UserModel, type User } from "../models/user.model.js";
import { OrderNoteModel } from "./models/order-note.model.js";
import { ReturnRequestModel, type ReturnRequest } from "./models/return-request.model.js";

type OrderWithId = Order & { _id: Types.ObjectId };
type ReturnWithId = ReturnRequest & { _id: Types.ObjectId };

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fulfilment(status: OrderStatus): AdminOrderSummaryDto["fulfilmentStatus"] {
  if (status === "cancelled" || status === "refunded") return "cancelled";
  if (status === "delivered" || status === "returned") return "fulfilled";
  if (["processing", "packed", "shipped", "out_for_delivery"].includes(status))
    return "in_progress";
  return "unfulfilled";
}

function returnDto(record: ReturnWithId, orderNumber: string): ReturnRequestDto {
  return {
    id: record._id.toString(),
    requestNumber: record.requestNumber,
    orderId: record.orderId.toString(),
    orderNumber,
    userId: record.userId.toString(),
    requestType: record.requestType,
    reason: record.reason,
    itemVariantIds: record.itemVariantIds.map(String),
    imageUrls: record.imageUrls,
    status: record.status,
    ...(record.decisionReason ? { decisionReason: record.decisionReason } : {}),
    ...(record.pickupCarrier ? { pickupCarrier: record.pickupCarrier } : {}),
    ...(record.pickupTrackingNumber ? { pickupTrackingNumber: record.pickupTrackingNumber } : {}),
    ...(record.pickupTrackingUrl ? { pickupTrackingUrl: record.pickupTrackingUrl } : {}),
    ...(record.inspectionNotes ? { inspectionNotes: record.inspectionNotes } : {}),
    ...(record.refundId ? { refundId: record.refundId.toString() } : {}),
    ...(record.replacementOrderId
      ? { replacementOrderId: record.replacementOrderId.toString() }
      : {}),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export class OperationsRepository {
  async listOrders(query: OperationalOrderQuery): Promise<{
    items: readonly AdminOrderSummaryDto[];
    page: number;
    total: number;
    pages: number;
  }> {
    const filter: QueryFilter<Order> = {};
    if (query.status) filter.status = query.status;
    if (query.from || query.to)
      filter.createdAt = {
        ...(query.from ? { $gte: query.from } : {}),
        ...(query.to ? { $lte: query.to } : {}),
      };
    if (query.fulfilment) {
      const statuses: Record<string, OrderStatus[]> = {
        unfulfilled: ["pending_payment", "payment_failed", "confirmed"],
        in_progress: ["processing", "packed", "shipped", "out_for_delivery"],
        fulfilled: ["delivered", "returned"],
        cancelled: ["cancelled", "refunded"],
      };
      filter.status = { $in: statuses[query.fulfilment]! };
    }
    if (query.payment) {
      const paymentOrderIds = await PaymentRecordModel.distinct("orderId", {
        status: query.payment,
      });
      filter._id = { $in: paymentOrderIds };
    }
    if (query.search) {
      const safe = new RegExp(escapeRegex(query.search), "i");
      const [users, payments] = await Promise.all([
        UserModel.find({ $or: [{ email: safe }, { phone: safe }] })
          .select({ _id: 1 })
          .limit(100),
        PaymentRecordModel.find({
          $or: [{ providerOrderId: safe }, { providerPaymentId: safe }],
        })
          .select({ orderId: 1 })
          .limit(100),
      ]);
      filter.$or = [
        { orderNumber: safe },
        { userId: { $in: users.map((user) => user._id) } },
        { _id: { $in: payments.map((payment) => payment.orderId) } },
      ];
    }
    const [orders, total] = await Promise.all([
      OrderModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      OrderModel.countDocuments(filter),
    ]);
    const [users, payments] = await Promise.all([
      UserModel.find({ _id: { $in: orders.map((order) => order.userId) } })
        .select({ name: 1, email: 1, phone: 1 })
        .lean(),
      PaymentRecordModel.find({ orderId: { $in: orders.map((order) => order._id) } })
        .select({ orderId: 1, status: 1 })
        .lean(),
    ]);
    const userMap = new Map(users.map((user) => [user._id.toString(), user]));
    const paymentMap = new Map(payments.map((payment) => [payment.orderId.toString(), payment]));
    return {
      items: orders.map((order) => {
        const customer = userMap.get(order.userId.toString());
        const payment = paymentMap.get(order._id.toString());
        return {
          id: order._id.toString(),
          orderNumber: order.orderNumber,
          customerName: customer?.name ?? "Customer",
          ...(customer?.email ? { customerEmail: customer.email } : {}),
          ...(customer?.phone ? { customerPhone: customer.phone } : {}),
          status: order.status,
          paymentStatus: payment?.status ?? "unavailable",
          fulfilmentStatus: fulfilment(order.status),
          totalPaise: order.totals.totalPaise,
          itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
          createdAt: order.createdAt.toISOString(),
        };
      }),
      page: query.page,
      total,
      pages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  async orderDetail(orderId: string): Promise<AdminOrderDetailDto | null> {
    if (!Types.ObjectId.isValid(orderId)) return null;
    const order = await OrderModel.findById(orderId).lean();
    if (!order) return null;
    const [customer, payment, notes, audits] = await Promise.all([
      UserModel.findById(order.userId).select({ name: 1, email: 1, phone: 1 }).lean(),
      PaymentRecordModel.findOne({ orderId }).lean(),
      OrderNoteModel.find({ orderId }).sort({ createdAt: -1 }).lean(),
      AuditLogModel.find({ entity: "order", entityId: orderId })
        .select({ action: 1, actorId: 1, timestamp: 1 })
        .sort({ timestamp: -1 })
        .limit(100)
        .lean(),
    ]);
    const snapshot = orderDto(order);
    return {
      id: order._id.toString(),
      orderNumber: order.orderNumber,
      customerName: customer?.name ?? "Customer",
      ...(customer?.email ? { customerEmail: customer.email } : {}),
      ...(customer?.phone ? { customerPhone: customer.phone } : {}),
      status: order.status,
      paymentStatus: payment?.status ?? "unavailable",
      fulfilmentStatus: fulfilment(order.status),
      totalPaise: order.totals.totalPaise,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      createdAt: order.createdAt.toISOString(),
      items: snapshot.items,
      totals: snapshot.totals,
      address: snapshot.address,
      shippingMethod: snapshot.shippingMethod,
      payment: payment
        ? {
            provider: payment.provider,
            ...(payment.providerOrderId ? { providerOrderId: payment.providerOrderId } : {}),
            ...(payment.providerPaymentId ? { providerPaymentId: payment.providerPaymentId } : {}),
            amountPaise: payment.amountPaise,
            amountRefundedPaise: payment.amountRefundedPaise,
            status: payment.status,
          }
        : {
            provider: "unavailable",
            amountPaise: order.totals.totalPaise,
            amountRefundedPaise: 0,
            status: "unavailable",
          },
      ...(order.trackingCarrier ? { trackingCarrier: order.trackingCarrier } : {}),
      ...(order.trackingNumber ? { trackingNumber: order.trackingNumber } : {}),
      ...(order.trackingUrl ? { trackingUrl: order.trackingUrl } : {}),
      ...(order.deliveredAt ? { deliveredAt: order.deliveredAt.toISOString() } : {}),
      timeline: order.statusHistory.map((entry) => ({
        status: entry.status,
        at: entry.at.toISOString(),
        ...(entry.actorId ? { actorId: entry.actorId.toString() } : {}),
        ...(entry.note ? { note: entry.note } : {}),
      })),
      internalNotes: notes.map((note) => ({
        id: note._id.toString(),
        body: note.body,
        actorId: note.actorId.toString(),
        createdAt: note.createdAt.toISOString(),
      })),
      auditHistory: audits.map((audit) => ({
        id: audit._id.toString(),
        action: audit.action,
        ...(audit.actorId ? { actorId: audit.actorId.toString() } : {}),
        timestamp: audit.timestamp.toISOString(),
      })),
    };
  }

  async orderRecord(orderId: string): Promise<OrderWithId | null> {
    if (!Types.ObjectId.isValid(orderId)) return null;
    return OrderModel.findById(orderId).lean();
  }

  async transitionOrder(
    orderId: string,
    from: OrderStatus,
    to: OrderStatus,
    actorId: string,
    reason: string,
  ): Promise<OrderWithId | null> {
    return OrderModel.findOneAndUpdate(
      { _id: orderId, status: from },
      {
        $set: { status: to, ...(to === "delivered" ? { deliveredAt: new Date() } : {}) },
        $push: { statusHistory: { status: to, at: new Date(), actorId, note: reason } },
      },
      { new: true, runValidators: true },
    ).lean();
  }

  async updateTracking(
    orderId: string,
    input: { carrier: string; trackingNumber: string; trackingUrl?: string },
  ): Promise<boolean> {
    const result = await OrderModel.updateOne(
      { _id: orderId },
      {
        $set: {
          trackingCarrier: input.carrier,
          trackingNumber: input.trackingNumber,
          ...(input.trackingUrl ? { trackingUrl: input.trackingUrl } : {}),
        },
      },
      { runValidators: true },
    );
    return result.matchedCount === 1;
  }

  async addNote(orderId: string, actorId: string, body: string): Promise<string | null> {
    if (!(await OrderModel.exists({ _id: orderId }))) return null;
    return (await OrderNoteModel.create({ orderId, actorId, body })).id;
  }

  async createReturn(
    userId: string,
    input: ReturnRequestCreateInput,
  ): Promise<ReturnRequestDto | null> {
    const order = await OrderModel.findOne({ _id: input.orderId, userId }).lean();
    if (!order) return null;
    const record = await ReturnRequestModel.create({
      requestNumber: `THR-RMA-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`,
      orderId: order._id,
      userId,
      requestType: input.requestType,
      reason: input.reason,
      itemVariantIds: input.itemVariantIds,
      imageUrls: input.imageUrls,
      status: "requested",
    });
    return returnDto(record.toObject(), order.orderNumber);
  }

  async listReturns(userId?: string): Promise<readonly ReturnRequestDto[]> {
    const records = await ReturnRequestModel.find(userId ? { userId } : {})
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    const orders = await OrderModel.find({ _id: { $in: records.map((record) => record.orderId) } })
      .select({ orderNumber: 1 })
      .lean();
    const numbers = new Map(orders.map((order) => [order._id.toString(), order.orderNumber]));
    return records.map((record) =>
      returnDto(record, numbers.get(record.orderId.toString()) ?? "Unavailable"),
    );
  }

  async returnRecord(id: string): Promise<ReturnWithId | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return ReturnRequestModel.findById(id).lean();
  }

  async updateReturn(
    id: string,
    from: readonly string[],
    update: Record<string, string | Types.ObjectId>,
  ): Promise<ReturnRequestDto | null> {
    const record = await ReturnRequestModel.findOneAndUpdate(
      { _id: id, status: { $in: [...from] } } as QueryFilter<ReturnRequest>,
      { $set: update },
      { new: true, runValidators: true },
    ).lean();
    if (!record) return null;
    const order = await OrderModel.findById(record.orderId).select({ orderNumber: 1 }).lean();
    return returnDto(record, order?.orderNumber ?? "Unavailable");
  }

  async restockReturn(id: string, actorId: string, requestId?: string): Promise<boolean> {
    const session = await mongoose.startSession();
    try {
      let changed = false;
      await session.withTransaction(async () => {
        const request = await ReturnRequestModel.findOneAndUpdate(
          { _id: id, status: "inspection_approved" },
          { $set: { status: "refund_pending" } },
          { new: true, session },
        );
        if (!request) return;
        const order = await OrderModel.findById(request.orderId).session(session).lean();
        if (!order) return;
        for (const variantId of request.itemVariantIds) {
          const item = order.items.find((candidate) => candidate.variantId.equals(variantId));
          if (!item) continue;
          const variant = await ProductVariantModel.findOneAndUpdate(
            { _id: variantId },
            { $inc: { stockOnHand: item.quantity } },
            { new: false, session },
          ).lean();
          if (!variant) continue;
          await InventoryMovementModel.create(
            [
              {
                productId: variant.productId,
                variantId,
                type: "return_restock",
                quantityDelta: item.quantity,
                stockBefore: variant.stockOnHand,
                stockAfter: variant.stockOnHand + item.quantity,
                reason: `Approved return ${request.requestNumber}`,
                actorId,
                orderId: order._id,
                ...(requestId ? { requestId } : {}),
              },
            ],
            { session },
          );
        }
        changed = true;
      });
      return changed;
    } finally {
      await session.endSession();
    }
  }

  async listInventory(query: {
    page: number;
    limit: number;
    search?: string | undefined;
    lowStock?: boolean | undefined;
  }): Promise<{
    items: readonly InventoryAdminRowDto[];
    total: number;
    page: number;
    pages: number;
  }> {
    const filter: QueryFilter<{
      sku: string;
      stockOnHand: number;
      stockReserved: number;
      reorderLevel: number;
    }> = {};
    if (query.search) filter.sku = new RegExp(escapeRegex(query.search), "i");
    if (query.lowStock)
      filter.$expr = { $lte: [{ $subtract: ["$stockOnHand", "$stockReserved"] }, "$reorderLevel"] };
    const [variants, total] = await Promise.all([
      ProductVariantModel.find(filter)
        .sort({ updatedAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      ProductVariantModel.countDocuments(filter),
    ]);
    const products = await ProductModel.find({
      _id: { $in: variants.map((variant) => variant.productId) },
    })
      .select({ title: 1 })
      .lean();
    const titles = new Map(products.map((product) => [product._id.toString(), product.title]));
    return {
      items: variants.map((variant) => {
        const availableStock = variant.stockOnHand - variant.stockReserved;
        return {
          variantId: variant._id.toString(),
          productId: variant.productId.toString(),
          productTitle: titles.get(variant.productId.toString()) ?? "Product",
          sku: variant.sku,
          colour: variant.colour,
          size: variant.size,
          stockOnHand: variant.stockOnHand,
          stockReserved: variant.stockReserved,
          availableStock,
          reorderLevel: variant.reorderLevel,
          lowStock: availableStock <= variant.reorderLevel,
          status: variant.status,
        };
      }),
      total,
      page: query.page,
      pages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  async inventoryMovements(variantId?: string): Promise<readonly InventoryMovementDto[]> {
    const movements = await InventoryMovementModel.find(
      variantId && Types.ObjectId.isValid(variantId) ? { variantId } : {},
    )
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    const variants = await ProductVariantModel.find({
      _id: { $in: movements.map((movement) => movement.variantId) },
    })
      .select({ sku: 1 })
      .lean();
    const skus = new Map(variants.map((variant) => [variant._id.toString(), variant.sku]));
    return movements.map((movement) => ({
      id: movement._id.toString(),
      variantId: movement.variantId.toString(),
      sku: skus.get(movement.variantId.toString()) ?? "Unavailable",
      type: movement.type,
      quantityDelta: movement.quantityDelta,
      stockBefore: movement.stockBefore,
      stockAfter: movement.stockAfter,
      reason: movement.reason,
      ...(movement.actorId ? { actorId: movement.actorId.toString() } : {}),
      ...(movement.orderId ? { orderId: movement.orderId.toString() } : {}),
      createdAt: movement.createdAt.toISOString(),
    }));
  }

  async previewInventory(
    rows: readonly { sku: string; stockOnHand: number; reason: string }[],
  ): Promise<
    readonly { sku: string; valid: boolean; current?: number; next: number; error?: string }[]
  > {
    const variants = await ProductVariantModel.find({
      sku: { $in: rows.map((row) => row.sku.toUpperCase()) },
    })
      .select({ sku: 1, stockOnHand: 1, stockReserved: 1 })
      .lean();
    const map = new Map(variants.map((variant) => [variant.sku, variant]));
    return rows.map((row) => {
      const variant = map.get(row.sku.toUpperCase());
      if (!variant)
        return { sku: row.sku, valid: false, next: row.stockOnHand, error: "SKU not found." };
      if (row.stockOnHand < variant.stockReserved)
        return {
          sku: row.sku,
          valid: false,
          current: variant.stockOnHand,
          next: row.stockOnHand,
          error: "Stock cannot be below currently reserved quantity.",
        };
      return { sku: row.sku, valid: true, current: variant.stockOnHand, next: row.stockOnHand };
    });
  }

  async listCustomers(query: {
    page: number;
    limit: number;
    search?: string | undefined;
    status?: "active" | "suspended" | "disabled" | undefined;
  }): Promise<{ items: readonly AdminCustomerDto[]; total: number; page: number; pages: number }> {
    const filter: QueryFilter<User> = { roles: "customer" };
    if (query.status) filter.status = query.status;
    if (query.search) {
      const safe = new RegExp(escapeRegex(query.search), "i");
      filter.$or = [{ name: safe }, { email: safe }, { phone: safe }];
    }
    const [users, total] = await Promise.all([
      UserModel.find(filter)
        .select({
          name: 1,
          email: 1,
          phone: 1,
          status: 1,
          emailVerifiedAt: 1,
          phoneVerifiedAt: 1,
          lastLoginAt: 1,
          createdAt: 1,
        })
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      UserModel.countDocuments(filter),
    ]);
    const aggregates = await OrderModel.aggregate<{
      _id: Types.ObjectId;
      count: number;
      value: number;
    }>([
      {
        $match: {
          userId: { $in: users.map((user) => user._id) },
          status: { $nin: ["cancelled", "payment_failed"] },
        },
      },
      { $group: { _id: "$userId", count: { $sum: 1 }, value: { $sum: "$totals.totalPaise" } } },
    ]);
    const totals = new Map(aggregates.map((item) => [item._id.toString(), item]));
    return {
      items: users.map((user) => ({
        id: user._id.toString(),
        name: user.name,
        ...(user.email ? { email: user.email } : {}),
        ...(user.phone ? { phone: user.phone } : {}),
        status: user.status,
        ...(user.emailVerifiedAt ? { emailVerifiedAt: user.emailVerifiedAt.toISOString() } : {}),
        ...(user.phoneVerifiedAt ? { phoneVerifiedAt: user.phoneVerifiedAt.toISOString() } : {}),
        ...(user.lastLoginAt ? { lastLoginAt: user.lastLoginAt.toISOString() } : {}),
        createdAt: user.createdAt.toISOString(),
        orderCount: totals.get(user._id.toString())?.count ?? 0,
        lifetimeValuePaise: totals.get(user._id.toString())?.value ?? 0,
      })),
      total,
      page: query.page,
      pages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  async customerDetail(
    id: string,
  ): Promise<{ customer: AdminCustomerDto; orders: readonly AdminOrderSummaryDto[] } | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const user = await UserModel.findOne({ _id: id, roles: "customer" })
      .select({
        name: 1,
        email: 1,
        phone: 1,
        status: 1,
        emailVerifiedAt: 1,
        phoneVerifiedAt: 1,
        lastLoginAt: 1,
        createdAt: 1,
      })
      .lean();
    if (!user) return null;
    const [aggregate, orders] = await Promise.all([
      OrderModel.aggregate<{ count: number; value: number }>([
        { $match: { userId: user._id, status: { $nin: ["cancelled", "payment_failed"] } } },
        { $group: { _id: "$userId", count: { $sum: 1 }, value: { $sum: "$totals.totalPaise" } } },
      ]),
      this.listOrders({
        page: 1,
        limit: 100,
        search: user.email ?? user.phone ?? id,
      }),
    ]);
    const customer: AdminCustomerDto = {
      id: user._id.toString(),
      name: user.name,
      ...(user.email ? { email: user.email } : {}),
      ...(user.phone ? { phone: user.phone } : {}),
      status: user.status,
      ...(user.emailVerifiedAt ? { emailVerifiedAt: user.emailVerifiedAt.toISOString() } : {}),
      ...(user.phoneVerifiedAt ? { phoneVerifiedAt: user.phoneVerifiedAt.toISOString() } : {}),
      ...(user.lastLoginAt ? { lastLoginAt: user.lastLoginAt.toISOString() } : {}),
      createdAt: user.createdAt.toISOString(),
      orderCount: aggregate[0]?.count ?? 0,
      lifetimeValuePaise: aggregate[0]?.value ?? 0,
    };
    return { customer, orders: orders.items };
  }

  async updateCustomerStatus(id: string, status: "active" | "suspended"): Promise<boolean> {
    const result = await UserModel.updateOne({ _id: id, roles: "customer" }, { $set: { status } });
    return result.matchedCount === 1;
  }

  async settings(): Promise<OperationsSettingsDto | null> {
    const [settings, pages] = await Promise.all([
      SiteSettingsModel.findOne({ key: "default" }).lean(),
      ContentPageModel.find().sort({ slug: 1 }).lean(),
    ]);
    if (!settings) return null;
    return {
      business: {
        ...settings.business,
        announcement: settings.announcement,
        footerGroups: settings.footerGroups,
        socialLinks: settings.socialLinks,
      },
      returnWindowDays: settings.returns?.windowDays ?? 7,
      requireInspectionBeforeRestock: settings.returns?.requireInspectionBeforeRestock ?? true,
      onlinePaymentsEnabled: settings.payments?.onlineEnabled ?? false,
      maintenanceMode: settings.maintenanceMode,
      seo: settings.seo ?? {
        defaultTitle: settings.business.brandName,
        defaultDescription: "Discover THREAD fashion.",
      },
      policyPages: pages.map((page) => ({
        slug: page.slug,
        title: page.title,
        ...(page.eyebrow ? { eyebrow: page.eyebrow } : {}),
        summary: page.summary,
        sections: page.sections,
        updatedAt: page.updatedAt.toISOString(),
      })),
    };
  }

  async updateSettings(
    input: OperationsSettingsUpdateInput,
  ): Promise<OperationsSettingsDto | null> {
    const set: Record<string, unknown> = {};
    if (input.business) set.business = input.business;
    if (input.returnWindowDays !== undefined) set["returns.windowDays"] = input.returnWindowDays;
    if (input.requireInspectionBeforeRestock !== undefined)
      set["returns.requireInspectionBeforeRestock"] = input.requireInspectionBeforeRestock;
    if (input.onlinePaymentsEnabled !== undefined)
      set["payments.onlineEnabled"] = input.onlinePaymentsEnabled;
    if (input.maintenanceMode !== undefined) set.maintenanceMode = input.maintenanceMode;
    if (input.seo) set.seo = input.seo;
    await SiteSettingsModel.updateOne({ key: "default" }, { $set: set }, { runValidators: true });
    return this.settings();
  }
}
