import { Router, type Request, type RequestHandler } from "express";
import {
  adminRefundSchema,
  customerAdminQuerySchema,
  customerStatusSchema,
  internalOrderNoteSchema,
  inventoryAdminQuerySchema,
  inventoryImportPreviewSchema,
  operationalBulkStatusSchema,
  operationalOrderQuerySchema,
  operationalOrderStatusUpdateSchema,
  operationsSettingsUpdateSchema,
  orderTrackingUpdateSchema,
  returnDecisionSchema,
  returnInspectionSchema,
  returnLogisticsSchema,
  returnRequestCreateSchema,
  type ZodType,
} from "@thread/validation";

import type { AuthContext } from "../auth/auth.types.js";
import {
  createOriginGuard,
  requireCsrf,
  requireRoles,
  validateBody,
} from "../auth/http/security.middleware.js";
import { HttpError } from "../middleware/error-handler.js";
import type { OperationsService } from "./operations.service.js";

function context(request: Request): AuthContext {
  return {
    ...(request.ip ? { ip: request.ip } : {}),
    requestId: request.requestId,
    ...(request.header("user-agent")
      ? { userAgent: request.header("user-agent")!.slice(0, 512) }
      : {}),
  };
}

function parseQuery<T>(schema: ZodType<T>, request: Request): T {
  const result = schema.safeParse(request.query);
  if (!result.success)
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      result.error.issues[0]?.message ?? "Query parameters are invalid.",
    );
  return result.data;
}

function parameter(request: Request, key: string): string {
  const value = request.params[key];
  if (typeof value !== "string")
    throw new HttpError(400, "INVALID_PATH_PARAMETER", "Path parameter is invalid.");
  return value;
}

function csvCell(value: string | number | boolean): string {
  const text = String(value).replaceAll('"', '""');
  return `"${/^[=+\-@]/.test(text) ? `'${text}` : text}"`;
}

export function createOperationsRouter(
  service: OperationsService,
  authenticate: RequestHandler,
  webOrigin: string,
): Router {
  const router = Router();
  const mutation = [createOriginGuard(webOrigin), requireCsrf] as const;
  const readers = requireRoles("super_admin", "admin", "order_manager", "support_agent");
  const operators = requireRoles("super_admin", "admin", "order_manager");
  const managers = requireRoles("super_admin", "admin", "catalog_manager");

  router.use("/admin/operations", authenticate);
  router.get("/admin/operations/orders", readers, async (request, response) =>
    response.json({
      success: true,
      data: await service.listOrders(parseQuery(operationalOrderQuerySchema, request)),
    }),
  );
  router.get("/admin/operations/orders/:id", readers, async (request, response) =>
    response.json({
      success: true,
      data: await service.orderDetail(
        parameter(request, "id"),
        request.auth!.userId,
        context(request),
      ),
    }),
  );
  router.patch(
    "/admin/operations/orders/:id/status",
    operators,
    ...mutation,
    validateBody(operationalOrderStatusUpdateSchema),
    async (request, response) =>
      response.json({
        success: true,
        data: await service.updateStatus(
          parameter(request, "id"),
          request.auth!.userId,
          request.body,
          context(request),
        ),
      }),
  );
  router.post(
    "/admin/operations/orders/bulk-status",
    operators,
    ...mutation,
    validateBody(operationalBulkStatusSchema),
    async (request, response) =>
      response.json({
        success: true,
        data: await service.bulkStatus(
          request.auth!.userId,
          request.body.orderIds,
          request.body.status,
          request.body.reason,
          context(request),
        ),
      }),
  );
  router.patch(
    "/admin/operations/orders/:id/tracking",
    operators,
    ...mutation,
    validateBody(orderTrackingUpdateSchema),
    async (request, response) =>
      response.json({
        success: true,
        data: await service.updateTracking(
          parameter(request, "id"),
          request.auth!.userId,
          request.body,
          context(request),
        ),
      }),
  );
  router.post(
    "/admin/operations/orders/:id/notes",
    readers,
    ...mutation,
    validateBody(internalOrderNoteSchema),
    async (request, response) =>
      response.status(201).json({
        success: true,
        data: await service.addNote(
          parameter(request, "id"),
          request.auth!.userId,
          request.body.body,
          context(request),
        ),
      }),
  );
  for (const kind of ["invoice", "packing-slip"] as const)
    router.get(`/admin/operations/orders/:id/${kind}`, readers, async (request, response) => {
      const document = await service.document(
        parameter(request, "id"),
        kind,
        request.auth!.userId,
        context(request),
      );
      response
        .set({
          "cache-control": "private, no-store",
          "content-disposition": `attachment; filename="thread-${kind}.pdf"`,
          "content-type": "application/pdf",
        })
        .send(document);
    });
  router.post(
    "/admin/operations/orders/:id/refund",
    operators,
    ...mutation,
    validateBody(adminRefundSchema),
    async (request, response) =>
      response.json({
        success: true,
        data: await service.refund(
          request.auth!.userId,
          parameter(request, "id"),
          request.body.reason,
          context(request),
        ),
      }),
  );
  router.post(
    "/admin/operations/orders/:id/cancel",
    operators,
    ...mutation,
    validateBody(adminRefundSchema),
    async (request, response) =>
      response.json({
        success: true,
        data: await service.updateStatus(
          parameter(request, "id"),
          request.auth!.userId,
          { status: "cancelled", reason: request.body.reason },
          context(request),
        ),
      }),
  );

  router.post(
    "/returns",
    authenticate,
    ...mutation,
    validateBody(returnRequestCreateSchema),
    async (request, response) =>
      response.status(201).json({
        success: true,
        data: await service.createReturn(request.auth!.userId, request.body, context(request)),
      }),
  );
  router.get("/returns", authenticate, async (request, response) =>
    response.json({
      success: true,
      data: await service.listCustomerReturns(request.auth!.userId),
    }),
  );
  router.get("/admin/operations/returns", readers, async (_request, response) =>
    response.json({ success: true, data: await service.listAdminReturns() }),
  );
  router.patch(
    "/admin/operations/returns/:id/decision",
    operators,
    ...mutation,
    validateBody(returnDecisionSchema),
    async (request, response) =>
      response.json({
        success: true,
        data: await service.decideReturn(
          parameter(request, "id"),
          request.auth!.userId,
          request.body.decision,
          request.body.reason,
          context(request),
        ),
      }),
  );
  router.patch(
    "/admin/operations/returns/:id/logistics",
    operators,
    ...mutation,
    validateBody(returnLogisticsSchema),
    async (request, response) =>
      response.json({
        success: true,
        data: await service.updateReturnLogistics(
          parameter(request, "id"),
          request.auth!.userId,
          request.body,
          context(request),
        ),
      }),
  );
  router.patch(
    "/admin/operations/returns/:id/inspection",
    operators,
    ...mutation,
    validateBody(returnInspectionSchema),
    async (request, response) =>
      response.json({
        success: true,
        data: await service.inspectReturn(
          parameter(request, "id"),
          request.auth!.userId,
          request.body.approved,
          request.body.notes,
          context(request),
        ),
      }),
  );
  router.post(
    "/admin/operations/returns/:id/restock",
    operators,
    ...mutation,
    async (request, response) =>
      response.json({
        success: true,
        data: await service.restockReturn(
          parameter(request, "id"),
          request.auth!.userId,
          context(request),
        ),
      }),
  );
  router.post(
    "/admin/operations/returns/:id/refund",
    operators,
    ...mutation,
    validateBody(adminRefundSchema),
    async (request, response) =>
      response.json({
        success: true,
        data: await service.refundReturn(
          parameter(request, "id"),
          request.auth!.userId,
          request.body.reason,
          context(request),
        ),
      }),
  );

  router.get("/admin/operations/inventory", managers, async (request, response) =>
    response.json({
      success: true,
      data: await service.listInventory(parseQuery(inventoryAdminQuerySchema, request)),
    }),
  );
  router.get("/admin/operations/inventory/movements", managers, async (request, response) =>
    response.json({
      success: true,
      data: await service.inventoryMovements(
        typeof request.query.variantId === "string" ? request.query.variantId : undefined,
      ),
    }),
  );
  router.get("/admin/operations/inventory/export", managers, async (request, response) => {
    const query = parseQuery(inventoryAdminQuerySchema, request);
    const firstPage = await service.listInventory({
      ...query,
      page: 1,
      limit: 100,
    });
    const remainingPages = await Promise.all(
      Array.from({ length: Math.max(0, firstPage.pages - 1) }, (_, index) =>
        service.listInventory({ ...query, page: index + 2, limit: 100 }),
      ),
    );
    const items = [...firstPage.items, ...remainingPages.flatMap((page) => page.items)];
    const rows: ReadonlyArray<ReadonlyArray<string | number | boolean>> = [
      [
        "SKU",
        "Product",
        "Colour",
        "Size",
        "Stock on hand",
        "Reserved",
        "Available",
        "Reorder level",
        "Low stock",
      ],
      ...items.map((item) => [
        item.sku,
        item.productTitle,
        item.colour,
        item.size,
        item.stockOnHand,
        item.stockReserved,
        item.availableStock,
        item.reorderLevel,
        item.lowStock,
      ]),
    ];
    response
      .set({
        "cache-control": "private, no-store",
        "content-disposition": 'attachment; filename="thread-inventory.csv"',
        "content-type": "text/csv; charset=utf-8",
      })
      .send(rows.map((row) => row.map(csvCell).join(",")).join("\n"));
  });
  router.post(
    "/admin/operations/inventory/import-preview",
    managers,
    ...mutation,
    validateBody(inventoryImportPreviewSchema),
    async (request, response) =>
      response.json({
        success: true,
        data: await service.previewInventory(request.body.rows),
      }),
  );

  router.get("/admin/operations/customers", readers, async (request, response) =>
    response.json({
      success: true,
      data: await service.listCustomers(parseQuery(customerAdminQuerySchema, request)),
    }),
  );
  router.get("/admin/operations/customers/:id", readers, async (request, response) =>
    response.json({
      success: true,
      data: await service.customerDetail(
        parameter(request, "id"),
        request.auth!.userId,
        context(request),
      ),
    }),
  );
  router.patch(
    "/admin/operations/customers/:id/status",
    requireRoles("super_admin", "admin"),
    ...mutation,
    validateBody(customerStatusSchema),
    async (request, response) =>
      response.json({
        success: true,
        data: await service.updateCustomerStatus(
          parameter(request, "id"),
          request.auth!.userId,
          request.body.status,
          request.body.reason,
          context(request),
        ),
      }),
  );

  router.get(
    "/admin/operations/settings",
    requireRoles("super_admin", "admin"),
    async (_request, response) => response.json({ success: true, data: await service.settings() }),
  );
  router.patch(
    "/admin/operations/settings",
    requireRoles("super_admin", "admin"),
    ...mutation,
    validateBody(operationsSettingsUpdateSchema),
    async (request, response) =>
      response.json({
        success: true,
        data: await service.updateSettings(request.auth!.userId, request.body, context(request)),
      }),
  );
  return router;
}
