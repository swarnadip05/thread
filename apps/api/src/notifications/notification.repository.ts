import { Types } from "mongoose";
import type {
  NotificationDto,
  NotificationPageDto,
  OrderStatus,
  OrderTrackingDto,
} from "@thread/types";
import type { OrderStatusUpdateInput } from "@thread/validation";

import { canTransitionOrder } from "../checkout/order-state-machine.js";
import { OrderModel, type Order } from "../checkout/models/order.model.js";
import { HttpError } from "../middleware/error-handler.js";
import { InvoiceModel } from "./models/invoice.model.js";
import { NotificationModel, type NotificationRecord } from "./models/notification.model.js";

type NotificationWithId = NotificationRecord & { _id: Types.ObjectId };
type OrderWithId = Order & { _id: Types.ObjectId };

function notificationDto(notification: NotificationWithId): NotificationDto {
  return {
    id: notification._id.toString(),
    type: notification.type,
    title: notification.title,
    message: notification.message,
    ...(notification.href ? { href: notification.href } : {}),
    ...(notification.orderId ? { orderId: notification.orderId.toString() } : {}),
    ...(notification.readAt ? { readAt: notification.readAt.toISOString() } : {}),
    createdAt: notification.createdAt.toISOString(),
  };
}

const visibleTimelineStatuses: readonly OrderStatus[] = [
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
];

function trackingDto(order: OrderWithId): OrderTrackingDto {
  const reachedStatuses = new Map(order.statusHistory.map((entry) => [entry.status, entry.at]));
  const currentIndex = visibleTimelineStatuses.indexOf(order.status);
  return {
    id: order._id.toString(),
    orderNumber: order.orderNumber,
    status: order.status,
    ...(order.trackingNumber ? { trackingNumber: order.trackingNumber } : {}),
    ...(order.trackingUrl ? { trackingUrl: order.trackingUrl } : {}),
    timeline: visibleTimelineStatuses.map((status, index) => ({
      status,
      at: (reachedStatuses.get(status) ?? order.createdAt).toISOString(),
      current: status === order.status,
      completed:
        reachedStatuses.has(status) ||
        (currentIndex >= 0 && index <= currentIndex) ||
        order.status === "delivered",
    })),
    updatedAt: order.updatedAt.toISOString(),
  };
}

export class MongooseNotificationRepository {
  async create(input: {
    userId: string;
    type: NotificationRecord["type"];
    title: string;
    message: string;
    dedupeKey: string;
    href?: string;
    orderId?: string;
  }): Promise<{ notification: NotificationDto; created: boolean }> {
    const existing = await NotificationModel.findOne({
      userId: input.userId,
      dedupeKey: input.dedupeKey,
    }).lean();
    if (existing) return { notification: notificationDto(existing), created: false };
    try {
      const created = await NotificationModel.create(input);
      return { notification: notificationDto(created.toObject()), created: true };
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11_000) {
        const duplicate = await NotificationModel.findOne({
          userId: input.userId,
          dedupeKey: input.dedupeKey,
        }).lean();
        if (duplicate) return { notification: notificationDto(duplicate), created: false };
      }
      throw error;
    }
  }

  async list(userId: string, cursor?: string, limit = 20): Promise<NotificationPageDto> {
    const cursorFilter =
      cursor && Types.ObjectId.isValid(cursor) ? { _id: { $lt: new Types.ObjectId(cursor) } } : {};
    const [items, unreadCount] = await Promise.all([
      NotificationModel.find({ userId, ...cursorFilter })
        .sort({ _id: -1 })
        .limit(limit + 1)
        .lean(),
      NotificationModel.countDocuments({ userId, readAt: { $exists: false } }),
    ]);
    const hasMore = items.length > limit;
    const page = items.slice(0, limit);
    return {
      items: page.map(notificationDto),
      unreadCount,
      ...(hasMore && page.length ? { nextCursor: page.at(-1)!._id.toString() } : {}),
    };
  }

  async markRead(userId: string, notificationId: string): Promise<NotificationDto | null> {
    if (!Types.ObjectId.isValid(notificationId)) return null;
    const notification = await NotificationModel.findOneAndUpdate(
      { _id: notificationId, userId },
      { $set: { readAt: new Date() } },
      { new: true },
    ).lean();
    return notification ? notificationDto(notification) : null;
  }

  async listOrders(userId: string): Promise<readonly OrderTrackingDto[]> {
    const orders = await OrderModel.find({ userId }).sort({ createdAt: -1 }).limit(50).lean();
    return orders.map(trackingDto);
  }

  async listAdminOrders(): Promise<readonly OrderTrackingDto[]> {
    const orders = await OrderModel.find().sort({ updatedAt: -1 }).limit(100).lean();
    return orders.map(trackingDto);
  }

  async tracking(userId: string, orderId: string): Promise<OrderTrackingDto | null> {
    if (!Types.ObjectId.isValid(orderId)) return null;
    const order = await OrderModel.findOne({ _id: orderId, userId }).lean();
    return order ? trackingDto(order) : null;
  }

  async updateOrderStatus(
    orderId: string,
    actorId: string,
    input: OrderStatusUpdateInput,
  ): Promise<{ before: OrderStatus; order: OrderWithId }> {
    if (!Types.ObjectId.isValid(orderId))
      throw new HttpError(404, "ORDER_NOT_FOUND", "Order was not found.");
    const existing = await OrderModel.findById(orderId).lean();
    if (!existing) throw new HttpError(404, "ORDER_NOT_FOUND", "Order was not found.");
    if (!canTransitionOrder(existing.status, input.status))
      throw new HttpError(
        409,
        "INVALID_ORDER_TRANSITION",
        `Order cannot move from ${existing.status} to ${input.status}.`,
      );
    const updated = await OrderModel.findOneAndUpdate(
      { _id: orderId, status: existing.status },
      {
        $set: {
          status: input.status,
          ...(input.trackingNumber ? { trackingNumber: input.trackingNumber } : {}),
          ...(input.trackingUrl ? { trackingUrl: input.trackingUrl } : {}),
          ...(input.status === "delivered" ? { deliveredAt: new Date() } : {}),
        },
        $push: {
          statusHistory: {
            status: input.status,
            at: new Date(),
            actorId,
            ...(input.note ? { note: input.note } : {}),
          },
        },
      },
      { new: true, runValidators: true },
    ).lean();
    if (!updated)
      throw new HttpError(409, "ORDER_STATUS_CONFLICT", "Order status changed. Reload and retry.");
    return { before: existing.status, order: updated };
  }

  async orderForEvents(orderId: string): Promise<OrderWithId | null> {
    if (!Types.ObjectId.isValid(orderId)) return null;
    return OrderModel.findById(orderId).lean();
  }

  async invoice(userId: string, orderId: string): Promise<Buffer | null> {
    if (!Types.ObjectId.isValid(orderId)) return null;
    const ownsOrder = await OrderModel.exists({ _id: orderId, userId });
    if (!ownsOrder) return null;
    const invoice = await InvoiceModel.findOne({ orderId }).select("+content").lean();
    return invoice?.content ?? null;
  }
}
