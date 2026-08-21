import type {
  OperationalOrderQuery,
  OperationalOrderStatusUpdateInput,
  OperationsSettingsUpdateInput,
  ReturnRequestCreateInput,
} from "@thread/validation";

import type { AuthContext } from "../auth/auth.types.js";
import type { AuditRepository } from "../auth/repositories/audit.repository.js";
import { canTransitionOrder, isSafeBulkTransition } from "../checkout/order-state-machine.js";
import { orderDto } from "../checkout/repositories/mongoose-checkout.repository.js";
import { HttpError } from "../middleware/error-handler.js";
import type { NotificationService } from "../notifications/notification.service.js";
import { PdfInvoiceProvider } from "../notifications/providers/invoice.provider.js";
import type { PaymentService } from "../payments/payment.service.js";
import type { OperationsRepository } from "./operations.repository.js";
import { PackingSlipProvider } from "./packing-slip.provider.js";
import { isWithinReturnWindow } from "./return-policy.js";

export class OperationsService {
  private readonly invoiceProvider = new PdfInvoiceProvider();
  private readonly packingSlipProvider = new PackingSlipProvider();

  constructor(
    private readonly repository: OperationsRepository,
    private readonly audits: AuditRepository,
    private readonly payments: PaymentService,
    private readonly notifications: NotificationService,
  ) {}

  listOrders(query: OperationalOrderQuery) {
    return this.repository.listOrders(query);
  }

  async orderDetail(orderId: string, actorId: string, context: AuthContext) {
    const order = await this.repository.orderDetail(orderId);
    if (!order) throw new HttpError(404, "ORDER_NOT_FOUND", "Order was not found.");
    await this.audit("order.pii_viewed", actorId, "order", orderId, context);
    return order;
  }

  async updateStatus(
    orderId: string,
    actorId: string,
    input: OperationalOrderStatusUpdateInput,
    context: AuthContext,
  ) {
    const current = await this.repository.orderRecord(orderId);
    if (!current) throw new HttpError(404, "ORDER_NOT_FOUND", "Order was not found.");
    if (!canTransitionOrder(current.status, input.status))
      throw new HttpError(
        409,
        "INVALID_ORDER_TRANSITION",
        `Order cannot move from ${current.status} to ${input.status}.`,
      );
    const updated = await this.repository.transitionOrder(
      orderId,
      current.status,
      input.status,
      actorId,
      input.reason,
    );
    if (!updated)
      throw new HttpError(409, "ORDER_STATUS_CONFLICT", "Order changed. Reload and retry.");
    await Promise.all([
      this.notifications.orderStatusUpdated(
        orderDto(updated),
        updated.userId.toString(),
        current.status,
        updated.updatedAt.toISOString(),
      ),
      this.audit("order.status_updated", actorId, "order", orderId, context, {
        before: current.status,
        after: input.status,
      }),
    ]);
    return this.repository.orderDetail(orderId);
  }

  async bulkStatus(
    actorId: string,
    orderIds: readonly string[],
    status: "processing" | "packed",
    reason: string,
    context: AuthContext,
  ) {
    const results: Array<{ id: string; updated: boolean; error?: string }> = [];
    for (const id of orderIds) {
      const current = await this.repository.orderRecord(id);
      if (!current || !isSafeBulkTransition(current.status, status)) {
        results.push({ id, updated: false, error: "Unsafe or unavailable transition." });
        continue;
      }
      await this.updateStatus(id, actorId, { status, reason }, context);
      results.push({ id, updated: true });
    }
    return results;
  }

  async updateTracking(
    orderId: string,
    actorId: string,
    input: { carrier: string; trackingNumber: string; trackingUrl?: string },
    context: AuthContext,
  ) {
    if (!(await this.repository.updateTracking(orderId, input)))
      throw new HttpError(404, "ORDER_NOT_FOUND", "Order was not found.");
    await this.audit("order.tracking_updated", actorId, "order", orderId, context, {
      carrier: input.carrier,
    });
    return this.repository.orderDetail(orderId);
  }

  async addNote(orderId: string, actorId: string, body: string, context: AuthContext) {
    const id = await this.repository.addNote(orderId, actorId, body);
    if (!id) throw new HttpError(404, "ORDER_NOT_FOUND", "Order was not found.");
    await this.audit("order.internal_note_added", actorId, "order", orderId, context);
    return { id };
  }

  async document(
    orderId: string,
    kind: "invoice" | "packing-slip",
    actorId: string,
    context: AuthContext,
  ): Promise<Buffer> {
    const [record, settings] = await Promise.all([
      this.repository.orderRecord(orderId),
      this.repository.settings(),
    ]);
    if (!record) throw new HttpError(404, "ORDER_NOT_FOUND", "Order was not found.");
    if (!settings)
      throw new HttpError(409, "SITE_SETTINGS_REQUIRED", "Site settings are unavailable.");
    const order = orderDto(record);
    await this.audit(`order.${kind}_downloaded`, actorId, "order", orderId, context);
    return kind === "invoice"
      ? this.invoiceProvider.generate(order, settings.business)
      : this.packingSlipProvider.generate(order, settings.business);
  }

  refund(actorId: string, orderId: string, reason: string, context: AuthContext) {
    return this.payments.refundOrder(actorId, orderId, { reason }, context);
  }

  async createReturn(userId: string, input: ReturnRequestCreateInput, context: AuthContext) {
    const [order, settings] = await Promise.all([
      this.repository.orderRecord(input.orderId),
      this.repository.settings(),
    ]);
    if (!order || order.userId.toString() !== userId)
      throw new HttpError(404, "ORDER_NOT_FOUND", "Order was not found.");
    const deliveredAt =
      order.deliveredAt ??
      [...order.statusHistory].reverse().find((entry) => entry.status === "delivered")?.at;
    if (
      order.status !== "delivered" ||
      !deliveredAt ||
      !isWithinReturnWindow(deliveredAt, settings?.returnWindowDays ?? 7)
    )
      throw new HttpError(
        409,
        "RETURN_WINDOW_CLOSED",
        "This order is not eligible for a return request.",
      );
    const purchased = new Set(order.items.map((item) => item.variantId.toString()));
    if (input.itemVariantIds.some((id) => !purchased.has(id)))
      throw new HttpError(400, "RETURN_ITEM_INVALID", "A selected item is not in this order.");
    try {
      const request = await this.repository.createReturn(userId, input);
      if (!request) throw new HttpError(404, "ORDER_NOT_FOUND", "Order was not found.");
      await this.audit("return.requested", userId, "return", request.id, context);
      return request;
    } catch (error) {
      if (error instanceof Error && error.message.includes("duplicate key"))
        throw new HttpError(409, "RETURN_EXISTS", "A return request already exists.");
      throw error;
    }
  }

  listCustomerReturns(userId: string) {
    return this.repository.listReturns(userId);
  }

  listAdminReturns() {
    return this.repository.listReturns();
  }

  async decideReturn(
    id: string,
    actorId: string,
    decision: "approved" | "rejected",
    reason: string,
    context: AuthContext,
  ) {
    const updated = await this.repository.updateReturn(id, ["requested"], {
      status: decision,
      decisionReason: reason,
    });
    if (!updated)
      throw new HttpError(409, "RETURN_TRANSITION_INVALID", "Return can no longer be decided.");
    await this.audit(`return.${decision}`, actorId, "return", id, context);
    return updated;
  }

  async updateReturnLogistics(
    id: string,
    actorId: string,
    input: {
      status: "pickup_scheduled" | "in_transit" | "received";
      carrier: string;
      trackingNumber: string;
      trackingUrl?: string;
    },
    context: AuthContext,
  ) {
    const allowed: Record<typeof input.status, readonly string[]> = {
      pickup_scheduled: ["approved"],
      in_transit: ["pickup_scheduled"],
      received: ["in_transit"],
    };
    const updated = await this.repository.updateReturn(id, allowed[input.status], {
      status: input.status,
      pickupCarrier: input.carrier,
      pickupTrackingNumber: input.trackingNumber,
      ...(input.trackingUrl ? { pickupTrackingUrl: input.trackingUrl } : {}),
    });
    if (!updated)
      throw new HttpError(409, "RETURN_TRANSITION_INVALID", "Return logistics changed.");
    await this.audit("return.logistics_updated", actorId, "return", id, context);
    return updated;
  }

  async inspectReturn(
    id: string,
    actorId: string,
    approved: boolean,
    notes: string,
    context: AuthContext,
  ) {
    const updated = await this.repository.updateReturn(id, ["received"], {
      status: approved ? "inspection_approved" : "inspection_rejected",
      inspectionNotes: notes,
    });
    if (!updated)
      throw new HttpError(409, "RETURN_TRANSITION_INVALID", "Return cannot be inspected.");
    await this.audit("return.inspected", actorId, "return", id, context, { approved });
    return updated;
  }

  async restockReturn(id: string, actorId: string, context: AuthContext) {
    if (!(await this.repository.restockReturn(id, actorId, context.requestId)))
      throw new HttpError(
        409,
        "RETURN_NOT_RESTOCKABLE",
        "Only inspected and approved items can be restocked.",
      );
    await this.audit("return.restocked", actorId, "return", id, context);
    return { restocked: true };
  }

  async refundReturn(id: string, actorId: string, reason: string, context: AuthContext) {
    const request = await this.repository.returnRecord(id);
    if (!request || request.status !== "refund_pending")
      throw new HttpError(
        409,
        "RETURN_NOT_REFUNDABLE",
        "The return must be inspected and restocked before refund.",
      );
    const refund = await this.payments.refundOrder(
      actorId,
      request.orderId.toString(),
      { reason },
      context,
    );
    const updated = await this.repository.updateReturn(id, ["refund_pending"], {
      status: refund.status === "processed" ? "refunded" : "refund_pending",
      refundId: refund.id,
    });
    await this.audit("return.refund_requested", actorId, "return", id, context);
    return { request: updated, refund };
  }

  listInventory(query: {
    page: number;
    limit: number;
    search?: string | undefined;
    lowStock?: boolean | undefined;
  }) {
    return this.repository.listInventory(query);
  }
  inventoryMovements(variantId?: string) {
    return this.repository.inventoryMovements(variantId);
  }
  previewInventory(rows: readonly { sku: string; stockOnHand: number; reason: string }[]) {
    return this.repository.previewInventory(rows);
  }
  listCustomers(query: {
    page: number;
    limit: number;
    search?: string | undefined;
    status?: "active" | "suspended" | "disabled" | undefined;
  }) {
    return this.repository.listCustomers(query);
  }

  async customerDetail(id: string, actorId: string, context: AuthContext) {
    const detail = await this.repository.customerDetail(id);
    if (!detail) throw new HttpError(404, "CUSTOMER_NOT_FOUND", "Customer was not found.");
    await this.audit("customer.pii_viewed", actorId, "user", id, context);
    return detail;
  }

  async updateCustomerStatus(
    id: string,
    actorId: string,
    status: "active" | "suspended",
    reason: string,
    context: AuthContext,
  ) {
    if (!(await this.repository.updateCustomerStatus(id, status)))
      throw new HttpError(404, "CUSTOMER_NOT_FOUND", "Customer was not found.");
    await this.audit("customer.status_updated", actorId, "user", id, context, {
      status,
      reason,
    });
    return { id, status };
  }

  async settings() {
    const settings = await this.repository.settings();
    if (!settings)
      throw new HttpError(409, "SITE_SETTINGS_REQUIRED", "Site settings are unavailable.");
    return settings;
  }

  async updateSettings(
    actorId: string,
    input: OperationsSettingsUpdateInput,
    context: AuthContext,
  ) {
    const settings = await this.repository.updateSettings(input);
    if (!settings)
      throw new HttpError(409, "SITE_SETTINGS_REQUIRED", "Site settings are unavailable.");
    await this.audit(
      "site_settings.operational_updated",
      actorId,
      "site_settings",
      "default",
      context,
    );
    return settings;
  }

  private audit(
    action: string,
    actorId: string,
    entity: string,
    entityId: string,
    context: AuthContext,
    metadata?: Record<string, string | number | boolean>,
  ) {
    return this.audits.record({
      action,
      actorId,
      entity,
      entityId,
      context,
      ...(metadata ? { metadata } : {}),
    });
  }
}
