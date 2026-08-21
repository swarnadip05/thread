import type { RequestHandler } from "express";
import pino from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";
import type {
  AdminDashboardBreakdownDto,
  AdminDashboardLowStockDto,
  AdminDashboardOrderDto,
  AdminDashboardSalesPointDto,
  AdminDashboardTopProductDto,
  UserRole,
} from "@thread/types";

import type { AuditRepository } from "../src/auth/repositories/audit.repository.js";
import { createApp } from "../src/app.js";
import { createAdminDashboardRouter } from "../src/admin/dashboard.router.js";
import type {
  AdminDashboardRepository,
  DashboardRange,
} from "../src/admin/dashboard.repository.js";
import { AdminDashboardService } from "../src/admin/dashboard.service.js";

class MemoryDashboardRepository implements AdminDashboardRepository {
  async paidTotals(_range: DashboardRange) {
    return { revenuePaise: 42_000, paidOrders: 3 };
  }
  async pendingOrders() {
    return 2;
  }
  async lowStockVariants(): Promise<readonly AdminDashboardLowStockDto[]> {
    return [
      {
        variantId: "variant-a",
        productId: "product-a",
        sku: "THREAD-01",
        productTitle: "Core Tee",
        availableStock: 1,
        reorderLevel: 4,
      },
    ];
  }
  async recentOrders(): Promise<readonly AdminDashboardOrderDto[]> {
    return [
      {
        id: "order-a",
        orderNumber: "THR-2026-000001",
        status: "confirmed",
        paymentStatus: "captured",
        totalPaise: 14_000,
        itemCount: 1,
        createdAt: "2026-07-01T00:00:00.000Z",
      },
    ];
  }
  async topProducts(): Promise<readonly AdminDashboardTopProductDto[]> {
    return [{ productId: "product-a", title: "Core Tee", unitsSold: 3, revenuePaise: 42_000 }];
  }
  async sales(): Promise<readonly AdminDashboardSalesPointDto[]> {
    return [{ date: "2026-07-01", revenuePaise: 42_000, paidOrders: 3 }];
  }
  async paymentStatuses(): Promise<readonly AdminDashboardBreakdownDto[]> {
    return [{ status: "captured", count: 3 }];
  }
  async returnRequests() {
    return 1;
  }
  async newCustomers() {
    return 2;
  }
}

class MemoryAuditRepository implements AuditRepository {
  readonly actions: string[] = [];
  async record(input: Parameters<AuditRepository["record"]>[0]): Promise<void> {
    this.actions.push(input.action);
  }
}

function appFor(roles: readonly UserRole[], audits = new MemoryAuditRepository()) {
  const authenticate: RequestHandler = (request, _response, next) => {
    request.auth = { userId: "admin-user", roles, sessionFamilyId: "family" };
    next();
  };
  const router = createAdminDashboardRouter(
    new AdminDashboardService(new MemoryDashboardRepository()),
    audits,
    authenticate,
  );
  return {
    app: createApp({
      adminDashboardRouter: router,
      isReady: () => true,
      logger: pino({ enabled: false }),
      webOrigin: "http://localhost:3000",
    }),
    audits,
  };
}

describe("admin dashboard", () => {
  it("returns server-calculated metrics without customer address data", async () => {
    const { app } = appFor(["admin"]);
    const response = await request(app)
      .get("/api/v1/admin/dashboard?preset=last_7_days")
      .expect(200);
    expect(response.body.data).toMatchObject({
      revenue: { value: 42_000 },
      paidOrders: { value: 3 },
      averageOrderValue: { value: 14_000 },
      pendingOrders: 2,
    });
    expect(JSON.stringify(response.body.data)).not.toContain("addressLine1");
  });

  it("blocks dashboard data for a customer role", async () => {
    const { app } = appFor(["customer"]);
    const response = await request(app).get("/api/v1/admin/dashboard").expect(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("exports non-sensitive operational fields and audits the download", async () => {
    const { app, audits } = appFor(["order_manager"]);
    const response = await request(app)
      .get("/api/v1/admin/dashboard/export?preset=today")
      .expect(200);
    expect(response.text).toContain("THR-2026-000001");
    expect(response.text).not.toContain("addressLine1");
    expect(audits.actions).toContain("admin.dashboard_exported");
  });
});
