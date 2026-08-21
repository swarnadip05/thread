import { createHash } from "node:crypto";

import type { OrderDto, OrderStatus, PaymentStatus } from "@thread/types";
import type { OrderStatusUpdateInput } from "@thread/validation";

import type { AuditRepository } from "../auth/repositories/audit.repository.js";
import type { AuthContext } from "../auth/auth.types.js";
import type { EmailProvider } from "../auth/providers/email.provider.js";
import { orderDto } from "../checkout/repositories/mongoose-checkout.repository.js";
import { HttpError } from "../middleware/error-handler.js";
import type { RealtimeGateway } from "../realtime/realtime.gateway.js";
import type { CommerceJobQueue } from "./jobs/commerce-job.queue.js";
import type { MongooseNotificationRepository } from "./notification.repository.js";

export class QueuedAuthEmailProvider implements EmailProvider {
  constructor(private readonly jobs: CommerceJobQueue) {}

  sendPasswordReset(input: { email: string; name: string; token: string }): Promise<void> {
    return this.jobs.enqueue({
      name: "email.password",
      key: `email.password:${createHash("sha256").update(input.token).digest("hex")}`,
      payload: input,
    });
  }

  sendVerification(input: { email: string; name: string; token: string }): Promise<void> {
    return this.jobs.enqueue({
      name: "email.verification",
      key: `email.verification:${createHash("sha256").update(input.token).digest("hex")}`,
      payload: input,
    });
  }
}

export class NotificationService {
  constructor(
    private readonly repository: MongooseNotificationRepository,
    private readonly jobs: CommerceJobQueue,
    private readonly realtime: RealtimeGateway,
    private readonly audits: AuditRepository,
  ) {}

  list(userId: string, cursor?: string) {
    return this.repository.list(userId, cursor);
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await this.repository.markRead(userId, notificationId);
    if (!notification)
      throw new HttpError(404, "NOTIFICATION_NOT_FOUND", "Notification was not found.");
    return notification;
  }

  orders(userId: string) {
    return this.repository.listOrders(userId);
  }

  adminOrders() {
    return this.repository.listAdminOrders();
  }

  async tracking(userId: string, orderId: string) {
    const tracking = await this.repository.tracking(userId, orderId);
    if (!tracking) throw new HttpError(404, "ORDER_NOT_FOUND", "Order was not found.");
    return tracking;
  }

  async invoice(userId: string, orderId: string): Promise<Buffer> {
    const invoice = await this.repository.invoice(userId, orderId);
    if (!invoice)
      throw new HttpError(404, "INVOICE_NOT_READY", "The invoice is not available yet.");
    return invoice;
  }

  async updateOrderStatus(
    orderId: string,
    actorId: string,
    input: OrderStatusUpdateInput,
    context: AuthContext,
  ) {
    const { before, order } = await this.repository.updateOrderStatus(orderId, actorId, input);
    await this.orderStatusUpdated(
      orderDto(order),
      order.userId.toString(),
      before,
      order.updatedAt.toISOString(),
    );
    await this.audits.record({
      action: "order.status_updated",
      actorId,
      context,
      entity: "order",
      entityId: orderId,
      metadata: { before, status: input.status },
    });
    return this.repository.tracking(order.userId.toString(), orderId);
  }

  async orderCreated(order: OrderDto, userId: string): Promise<void> {
    const created = await this.repository.create({
      userId,
      type: "order",
      title: "Order confirmed",
      message: `${order.orderNumber} has been confirmed.`,
      dedupeKey: `order.created:${order.id}`,
      href: `/account/orders/${order.id}`,
      orderId: order.id,
    });
    if (created.created) {
      this.realtime.emitNotification(userId, { notification: created.notification });
      this.realtime.emitOrderCreated(userId, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
      });
      this.realtime.emitAdmin({ reason: "new_order", entityId: order.id });
    }
    await Promise.all([
      this.jobs.enqueue({
        name: "email.order-confirmation",
        key: `email.order-confirmation:${order.id}`,
        payload: { orderId: order.id },
      }),
      this.jobs.enqueue({
        name: "invoice.generate",
        key: `invoice.generate:${order.id}`,
        payload: { orderId: order.id },
      }),
      ...order.items.map((item) =>
        this.jobs.enqueue({
          name: "inventory.low-stock" as const,
          key: `inventory.low-stock:${order.id}:${item.variantId}`,
          payload: { variantId: item.variantId },
        }),
      ),
    ]);
  }

  async orderStatusUpdated(
    order: OrderDto,
    userId: string,
    previousStatus: OrderStatus,
    version: string,
  ): Promise<void> {
    const created = await this.repository.create({
      userId,
      type: "order",
      title: "Order status updated",
      message: `${order.orderNumber} is now ${order.status.replaceAll("_", " ")}.`,
      dedupeKey: `order.status:${order.id}:${version}`,
      href: `/account/orders/${order.id}`,
      orderId: order.id,
    });
    if (created.created)
      this.realtime.emitNotification(userId, { notification: created.notification });
    this.realtime.emitOrderStatus(userId, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      previousStatus,
      status: order.status,
      trackingAvailable: Boolean(order.trackingNumber || order.trackingUrl),
    });
    this.realtime.emitAdmin({ reason: "order_status", entityId: order.id });
    await this.jobs.enqueue({
      name: "email.order-status",
      key: `email.order-status:${order.id}:${version}`,
      payload: { orderId: order.id },
    });
  }

  paymentUpdated(orderId: string, userId: string, status: PaymentStatus): void {
    this.realtime.emitPayment(userId, { orderId, status });
    this.realtime.emitAdmin({ reason: "payment", entityId: orderId });
  }

  subscribeNewsletter(email: string): Promise<void> {
    return this.jobs.enqueue({
      name: "email.newsletter-confirmation",
      key: `email.newsletter-confirmation:${email.toLowerCase()}`,
      payload: { email },
    });
  }
}
