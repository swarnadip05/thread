import type { AdminDashboardDto, AdminDashboardMetricDto } from "@thread/types";
import type { AdminDashboardQuery } from "@thread/validation";

import type { DashboardRange, AdminDashboardRepository } from "./dashboard.repository.js";

function atStartOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function atEndOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function dashboardRange(
  query: AdminDashboardQuery,
  now = new Date(),
): {
  range: AdminDashboardDto["range"];
  dates: DashboardRange;
  previous: DashboardRange;
} {
  const today = atStartOfDay(now);
  let from: Date;
  let to: Date;
  if (query.preset === "today") {
    from = today;
    to = atEndOfDay(now);
  } else if (query.preset === "last_7_days") {
    from = new Date(today);
    from.setDate(from.getDate() - 6);
    to = atEndOfDay(now);
  } else if (query.preset === "custom") {
    from = atStartOfDay(new Date(query.from!));
    to = atEndOfDay(new Date(query.to!));
  } else {
    from = new Date(today);
    from.setDate(from.getDate() - 29);
    to = atEndOfDay(now);
  }
  const duration = to.getTime() - from.getTime() + 1;
  const previous = { from: new Date(from.getTime() - duration), to: new Date(from.getTime() - 1) };
  return {
    range: { from: from.toISOString(), to: to.toISOString(), preset: query.preset },
    dates: { from, to },
    previous,
  };
}

function metric(value: number, previousValue: number): AdminDashboardMetricDto {
  if (previousValue === 0) return { value };
  return {
    value,
    changePercent: Math.round(((value - previousValue) / previousValue) * 1000) / 10,
  };
}

export class AdminDashboardService {
  constructor(private readonly repository: AdminDashboardRepository) {}

  async get(query: AdminDashboardQuery): Promise<AdminDashboardDto> {
    const { range, dates, previous } = dashboardRange(query);
    const [
      current,
      prior,
      pendingOrders,
      lowStockVariants,
      recentOrders,
      topProducts,
      sales,
      paymentStatusBreakdown,
      returnRequests,
      newCustomers,
    ] = await Promise.all([
      this.repository.paidTotals(dates),
      this.repository.paidTotals(previous),
      this.repository.pendingOrders(),
      this.repository.lowStockVariants(),
      this.repository.recentOrders(dates),
      this.repository.topProducts(dates),
      this.repository.sales(dates),
      this.repository.paymentStatuses(dates),
      this.repository.returnRequests(dates),
      this.repository.newCustomers(dates),
    ]);
    return {
      range,
      revenue: metric(current.revenuePaise, prior.revenuePaise),
      paidOrders: metric(current.paidOrders, prior.paidOrders),
      averageOrderValue: metric(
        current.paidOrders ? Math.round(current.revenuePaise / current.paidOrders) : 0,
        prior.paidOrders ? Math.round(prior.revenuePaise / prior.paidOrders) : 0,
      ),
      pendingOrders,
      lowStockVariants,
      recentOrders,
      topProducts,
      sales,
      paymentStatusBreakdown,
      returnRequests,
      newCustomers,
      generatedAt: new Date().toISOString(),
    };
  }
}
