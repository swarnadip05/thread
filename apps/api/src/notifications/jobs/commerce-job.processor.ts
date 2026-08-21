import { createHash } from "node:crypto";

import { Types } from "mongoose";
import type { Logger } from "pino";

import { ProductVariantModel } from "../../catalogue/models/product-variant.model.js";
import { OrderModel } from "../../checkout/models/order.model.js";
import { orderDto } from "../../checkout/repositories/mongoose-checkout.repository.js";
import { UserModel } from "../../models/user.model.js";
import { SiteSettingsModel } from "../../models/site-settings.model.js";
import type { RealtimeGateway } from "../../realtime/realtime.gateway.js";
import type { MongooseNotificationRepository } from "../notification.repository.js";
import { InvoiceModel } from "../models/invoice.model.js";
import { JobExecutionModel } from "../models/job-execution.model.js";
import type { CommerceJob } from "./commerce-job.queue.js";
import type { InvoiceProvider } from "../providers/invoice.provider.js";
import type { TransactionalEmailProvider } from "../providers/transactional-email.provider.js";
import type { PublicSiteSettingsDto } from "@thread/types";

function failureCode(error: unknown): string {
  if (error instanceof Error && error.name) return error.name.slice(0, 120);
  return "JOB_FAILED";
}

export class CommerceJobProcessor {
  constructor(
    private readonly email: TransactionalEmailProvider,
    private readonly invoices: InvoiceProvider,
    private readonly notifications: MongooseNotificationRepository,
    private readonly realtime: RealtimeGateway,
    private readonly logger: Logger,
  ) {}

  async process(job: Exclude<CommerceJob, { name: "reservation.release" }>): Promise<void> {
    if (!(await this.acquire(job))) return;
    try {
      switch (job.name) {
        case "email.password":
          await this.email.send({
            to: job.payload.email,
            subject: "Reset your THREAD password",
            text: `Hello ${job.payload.name}, use this one-time reset token: ${job.payload.token}. If you did not request this, ignore this email.`,
          });
          break;
        case "email.verification":
          await this.email.send({
            to: job.payload.email,
            subject: "Verify your THREAD email",
            text: `Hello ${job.payload.name}, use this one-time verification token: ${job.payload.token}.`,
          });
          break;
        case "email.newsletter-confirmation":
          await this.email.send({
            to: job.payload.email,
            subject: "Welcome to the THREAD list",
            text: "Your newsletter subscription is confirmed. You can contact THREAD support to update your preference.",
          });
          break;
        case "email.order-confirmation":
        case "email.order-status":
          await this.sendOrderEmail(job.payload.orderId, job.name);
          break;
        case "inventory.low-stock":
          await this.processLowStock(job.payload.variantId, job.key);
          break;
        case "invoice.generate":
          await this.generateInvoice(job.payload.orderId);
          break;
      }
      await JobExecutionModel.updateOne(
        { key: job.key, status: "processing" },
        { $set: { status: "completed", completedAt: new Date() }, $unset: { failureCode: 1 } },
      );
    } catch (error) {
      await JobExecutionModel.updateOne(
        { key: job.key },
        { $set: { status: "failed", failureCode: failureCode(error) } },
      );
      throw error;
    }
  }

  private async acquire(job: CommerceJob): Promise<boolean> {
    try {
      await JobExecutionModel.create({
        key: job.key,
        jobName: job.name,
        status: "processing",
        attempts: 1,
        lockedAt: new Date(),
      });
      return true;
    } catch (error) {
      if (!(
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11_000
      ))
        throw error;
    }
    const staleBefore = new Date(Date.now() - 10 * 60_000);
    const acquired = await JobExecutionModel.findOneAndUpdate(
      {
        key: job.key,
        status: { $ne: "completed" },
        $or: [{ status: "failed" }, { status: "processing", lockedAt: { $lte: staleBefore } }],
      },
      {
        $set: { status: "processing", lockedAt: new Date() },
        $inc: { attempts: 1 },
        $unset: { failureCode: 1 },
      },
      { new: true },
    ).lean();
    return Boolean(acquired);
  }

  private async sendOrderEmail(
    orderId: string,
    jobName: "email.order-confirmation" | "email.order-status",
  ): Promise<void> {
    const order = Types.ObjectId.isValid(orderId)
      ? await OrderModel.findById(orderId).lean()
      : null;
    if (!order) return;
    const user = await UserModel.findById(order.userId).select({ email: 1, name: 1 }).lean();
    if (!user?.email) return;
    const status = order.status.replaceAll("_", " ");
    await this.email.send({
      to: user.email,
      subject:
        jobName === "email.order-confirmation"
          ? `THREAD order ${order.orderNumber} confirmed`
          : `THREAD order ${order.orderNumber}: ${status}`,
      text: `Hello ${user.name}, your order ${order.orderNumber} is ${status}. View your authenticated THREAD account for current tracking details.`,
    });
  }

  private async processLowStock(variantId: string, dedupeKey: string): Promise<void> {
    const variant = Types.ObjectId.isValid(variantId)
      ? await ProductVariantModel.findById(variantId).lean()
      : null;
    if (!variant) return;
    const availableStock = variant.stockOnHand - variant.stockReserved;
    const lowStock = availableStock <= variant.reorderLevel;
    this.realtime.emitInventory({
      productId: variant.productId.toString(),
      variantId: variant._id.toString(),
      sku: variant.sku,
      availableStock,
      lowStock,
    });
    if (!lowStock) return;
    const admins = await UserModel.find({
      roles: { $in: ["super_admin", "admin", "catalog_manager", "order_manager"] },
      status: "active",
    })
      .select({ _id: 1 })
      .lean();
    for (const admin of admins) {
      const created = await this.notifications.create({
        userId: admin._id.toString(),
        type: "inventory",
        title: "Low stock",
        message: `${variant.sku} has ${availableStock} available units.`,
        dedupeKey,
        href: "/admin",
      });
      if (created.created)
        this.realtime.emitNotification(admin._id.toString(), {
          notification: created.notification,
        });
    }
    const settings = await SiteSettingsModel.findOne({ key: "default" })
      .select({ "business.email": 1 })
      .lean();
    if (settings?.business.email)
      await this.email.send({
        to: settings.business.email,
        subject: `THREAD low-stock alert: ${variant.sku}`,
        text: `${variant.sku} has ${availableStock} available units; its configured reorder level is ${variant.reorderLevel}.`,
      });
    this.realtime.emitAdmin({ reason: "low_stock", entityId: variant._id.toString() });
  }

  private async generateInvoice(orderId: string): Promise<void> {
    if (!Types.ObjectId.isValid(orderId) || (await InvoiceModel.exists({ orderId }))) return;
    const [order, settings] = await Promise.all([
      OrderModel.findById(orderId).lean(),
      SiteSettingsModel.findOne({ key: "default" }).lean(),
    ]);
    if (!order || !settings) return;
    const business = settings.business;
    const safeSettings: PublicSiteSettingsDto = {
      brandName: business.brandName,
      legalName: business.legalName,
      addressLine1: business.addressLine1,
      locality: business.locality,
      district: business.district,
      city: business.city,
      postalCode: business.postalCode,
      state: business.state,
      country: business.country,
      phone: business.phone,
      whatsappNumber: business.whatsappNumber,
      email: business.email,
      gstin: business.gstin,
      foundedYear: business.foundedYear,
      announcement: settings.announcement,
      footerGroups: settings.footerGroups,
      socialLinks: settings.socialLinks,
    };
    const content = await this.invoices.generate(orderDto(order), safeSettings);
    if (content.byteLength > 2_000_000) throw new Error("Generated invoice exceeded size limit.");
    await InvoiceModel.updateOne(
      { orderId },
      {
        $setOnInsert: {
          orderId,
          orderNumber: order.orderNumber,
          content,
          sha256: createHash("sha256").update(content).digest("hex"),
          bytes: content.byteLength,
          generatedAt: new Date(),
        },
      },
      { upsert: true, runValidators: true },
    );
    this.logger.info({ orderId, bytes: content.byteLength }, "Invoice generated");
  }
}
