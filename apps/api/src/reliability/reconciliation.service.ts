import type { Logger } from "pino";

import { CheckoutSessionModel } from "../checkout/models/checkout-session.model.js";
import { StockReservationModel } from "../checkout/models/stock-reservation.model.js";
import { ProductVariantModel } from "../catalogue/models/product-variant.model.js";
import { AuthSessionModel } from "../models/auth-session.model.js";
import type { CheckoutService } from "../checkout/checkout.service.js";
import type { PaymentService } from "../payments/payment.service.js";
import type { AlertingHook } from "./alerting.js";

export class ReliabilityReconciliationService {
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly checkout: CheckoutService,
    private readonly payments: PaymentService,
    private readonly alerts: AlertingHook,
    private readonly logger: Logger,
    private readonly piiRetentionDays: number,
  ) {}

  start(): void {
    if (this.timer) return;
    void this.run();
    this.timer = setInterval(() => void this.run(), 5 * 60_000);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async run(): Promise<void> {
    try {
      const [reservations, payments, inventoryMismatches] = await Promise.all([
        this.releaseExpiredReservations(),
        this.payments.reconcilePending(100),
        this.checkInventoryConsistency(),
      ]);
      await this.applyRetention();
      this.logger.info(
        {
          job: "reliability.reconciliation",
          reservationsReleased: reservations,
          paymentsChecked: payments.checked,
          paymentFailures: payments.failed,
          inventoryMismatches,
        },
        "Reliability reconciliation completed",
      );
      if (payments.failed)
        await this.alerts.notify({
          code: "PAYMENT_RECONCILIATION_FAILED",
          message: "One or more pending payments could not be reconciled.",
          severity: "critical",
          count: payments.failed,
        });
      if (inventoryMismatches)
        await this.alerts.notify({
          code: "INVENTORY_RESERVATION_MISMATCH",
          message: "Reserved inventory does not match active reservation records.",
          severity: "critical",
          count: inventoryMismatches,
        });
    } catch (error) {
      this.logger.error(
        { err: error, job: "reliability.reconciliation" },
        "Reliability reconciliation failed",
      );
      await this.alerts.notify({
        code: "RECONCILIATION_JOB_FAILED",
        message: "The reliability reconciliation job failed.",
        severity: "critical",
      });
    }
  }

  private async releaseExpiredReservations(): Promise<number> {
    const sessions = await CheckoutSessionModel.find({
      status: "active",
      expiresAt: { $lte: new Date() },
    })
      .select("_id")
      .sort({ expiresAt: 1 })
      .limit(200)
      .lean();
    for (const session of sessions) await this.checkout.expire(session._id.toString());
    return sessions.length;
  }

  private async checkInventoryConsistency(): Promise<number> {
    const expected = await StockReservationModel.aggregate<{ _id: unknown; reserved: number }>([
      { $match: { status: "active" } },
      { $group: { _id: "$variantId", reserved: { $sum: "$quantity" } } },
    ]);
    const expectedByVariant = new Map(expected.map((item) => [String(item._id), item.reserved]));
    const variants = await ProductVariantModel.find({ stockReserved: { $gt: 0 } })
      .select("_id stockReserved")
      .lean();
    const ids = new Set([
      ...expectedByVariant.keys(),
      ...variants.map((item) => item._id.toString()),
    ]);
    const actualByVariant = new Map(
      variants.map((item) => [item._id.toString(), item.stockReserved]),
    );
    return [...ids].filter(
      (id) => (expectedByVariant.get(id) ?? 0) !== (actualByVariant.get(id) ?? 0),
    ).length;
  }

  private async applyRetention(): Promise<void> {
    const cutoff = new Date(Date.now() - this.piiRetentionDays * 86_400_000);
    await AuthSessionModel.deleteMany({ revokedAt: { $lte: cutoff } });
  }
}
