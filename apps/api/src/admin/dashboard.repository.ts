import type {
  AdminDashboardBreakdownDto,
  AdminDashboardLowStockDto,
  AdminDashboardOrderDto,
  AdminDashboardSalesPointDto,
  AdminDashboardTopProductDto,
  PaymentStatus,
} from "@thread/types";

import { OrderModel } from "../checkout/models/order.model.js";
import { ProductVariantModel } from "../catalogue/models/product-variant.model.js";
import { UserModel } from "../models/user.model.js";
import { PaymentRecordModel } from "../checkout/models/payment.model.js";

export interface DashboardRange {
  readonly from: Date;
  readonly to: Date;
}

interface PaidTotals {
  readonly revenuePaise: number;
  readonly paidOrders: number;
}

export interface AdminDashboardRepository {
  paidTotals(range: DashboardRange): Promise<PaidTotals>;
  pendingOrders(): Promise<number>;
  lowStockVariants(): Promise<readonly AdminDashboardLowStockDto[]>;
  recentOrders(range: DashboardRange): Promise<readonly AdminDashboardOrderDto[]>;
  topProducts(range: DashboardRange): Promise<readonly AdminDashboardTopProductDto[]>;
  sales(range: DashboardRange): Promise<readonly AdminDashboardSalesPointDto[]>;
  paymentStatuses(range: DashboardRange): Promise<readonly AdminDashboardBreakdownDto[]>;
  returnRequests(range: DashboardRange): Promise<number>;
  newCustomers(range: DashboardRange): Promise<number>;
}

const paidStatuses = ["captured"] as const;

function paidOrderPipeline(range: DashboardRange) {
  return [
    { $match: { createdAt: { $gte: range.from, $lte: range.to } } },
    {
      $lookup: {
        from: "paymentrecords",
        localField: "_id",
        foreignField: "orderId",
        as: "payment",
      },
    },
    { $unwind: "$payment" },
    { $match: { "payment.status": { $in: paidStatuses } } },
  ] as const;
}

function idToString(value: unknown): string {
  return String(value);
}

export class MongooseAdminDashboardRepository implements AdminDashboardRepository {
  async paidTotals(range: DashboardRange): Promise<PaidTotals> {
    const [result] = await OrderModel.aggregate<{
      revenuePaise: number;
      paidOrders: number;
    }>([
      ...paidOrderPipeline(range),
      {
        $group: {
          _id: null,
          revenuePaise: { $sum: "$totals.totalPaise" },
          paidOrders: { $sum: 1 },
        },
      },
    ]);
    return { revenuePaise: result?.revenuePaise ?? 0, paidOrders: result?.paidOrders ?? 0 };
  }

  pendingOrders(): Promise<number> {
    return OrderModel.countDocuments({
      status: { $in: ["pending_payment", "confirmed", "processing", "packed"] },
    });
  }

  async lowStockVariants(): Promise<readonly AdminDashboardLowStockDto[]> {
    const rows = await ProductVariantModel.aggregate<{
      _id: unknown;
      productId: unknown;
      sku: string;
      stockOnHand: number;
      stockReserved: number;
      reorderLevel: number;
      product: { title: string }[];
    }>([
      { $match: { status: "active" } },
      { $addFields: { availableStock: { $subtract: ["$stockOnHand", "$stockReserved"] } } },
      { $match: { $expr: { $lte: ["$availableStock", "$reorderLevel"] } } },
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product",
          pipeline: [{ $match: { status: { $ne: "archived" } } }, { $project: { title: 1 } }],
        },
      },
      { $unwind: "$product" },
      { $sort: { availableStock: 1, updatedAt: 1 } },
      { $limit: 10 },
    ]);
    return rows.map((row) => ({
      variantId: idToString(row._id),
      productId: idToString(row.productId),
      sku: row.sku,
      productTitle: row.product[0]?.title ?? "Untitled product",
      availableStock: row.stockOnHand - row.stockReserved,
      reorderLevel: row.reorderLevel,
    }));
  }

  async recentOrders(range: DashboardRange): Promise<readonly AdminDashboardOrderDto[]> {
    const rows = await OrderModel.aggregate<{
      _id: unknown;
      orderNumber: string;
      status: AdminDashboardOrderDto["status"];
      totals: { totalPaise: number };
      items: unknown[];
      createdAt: Date;
      payment: { status: PaymentStatus }[];
    }>([
      { $match: { createdAt: { $gte: range.from, $lte: range.to } } },
      { $sort: { createdAt: -1 } },
      { $limit: 8 },
      {
        $lookup: {
          from: "paymentrecords",
          localField: "_id",
          foreignField: "orderId",
          as: "payment",
          pipeline: [{ $project: { status: 1 } }, { $sort: { createdAt: -1 } }, { $limit: 1 }],
        },
      },
    ]);
    return rows.map((row) => ({
      id: idToString(row._id),
      orderNumber: row.orderNumber,
      status: row.status,
      paymentStatus: row.payment[0]?.status ?? "unavailable",
      totalPaise: row.totals.totalPaise,
      itemCount: row.items.length,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async topProducts(range: DashboardRange): Promise<readonly AdminDashboardTopProductDto[]> {
    const rows = await OrderModel.aggregate<{
      _id: unknown;
      title: string;
      unitsSold: number;
      revenuePaise: number;
    }>([
      ...paidOrderPipeline(range),
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          title: { $first: "$items.title" },
          unitsSold: { $sum: "$items.quantity" },
          revenuePaise: { $sum: "$items.lineSubtotalPaise" },
        },
      },
      { $sort: { revenuePaise: -1, unitsSold: -1 } },
      { $limit: 5 },
    ]);
    return rows.map((row) => ({
      productId: idToString(row._id),
      title: row.title,
      unitsSold: row.unitsSold,
      revenuePaise: row.revenuePaise,
    }));
  }

  async sales(range: DashboardRange): Promise<readonly AdminDashboardSalesPointDto[]> {
    const rows = await OrderModel.aggregate<{
      _id: string;
      revenuePaise: number;
      paidOrders: number;
    }>([
      ...paidOrderPipeline(range),
      {
        $group: {
          _id: {
            $dateToString: { date: "$createdAt", format: "%Y-%m-%d", timezone: "Asia/Kolkata" },
          },
          revenuePaise: { $sum: "$totals.totalPaise" },
          paidOrders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    return rows.map((row) => ({
      date: row._id,
      revenuePaise: row.revenuePaise,
      paidOrders: row.paidOrders,
    }));
  }

  async paymentStatuses(range: DashboardRange): Promise<readonly AdminDashboardBreakdownDto[]> {
    const rows = await PaymentRecordModel.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: range.from, $lte: range.to } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
    ]);
    return rows.map((row) => ({ status: row._id, count: row.count }));
  }

  returnRequests(range: DashboardRange): Promise<number> {
    return OrderModel.countDocuments({
      status: "return_requested",
      updatedAt: { $gte: range.from, $lte: range.to },
    });
  }

  newCustomers(range: DashboardRange): Promise<number> {
    return UserModel.countDocuments({
      roles: "customer",
      createdAt: { $gte: range.from, $lte: range.to },
    });
  }
}
