import { Router, type RequestHandler } from "express";
import { Types } from "mongoose";
import { collectionWriteSchema } from "@thread/validation";
import { requireRoles, validateBody } from "../auth/http/security.middleware.js";
import type { AuditRepository } from "../auth/repositories/audit.repository.js";
import { CollectionModel } from "../catalogue/models/collection.model.js";
import { ProductModel } from "../catalogue/models/product.model.js";
import { HttpError } from "../middleware/error-handler.js";

export function createCollectionsRouter(
  authenticate: RequestHandler,
  audits: AuditRepository,
): Router {
  const router = Router();
  router.use(
    "/admin/collections",
    authenticate,
    requireRoles("super_admin", "admin", "catalog_manager"),
  );
  router.get("/admin/collections", async (_request, response) => {
    const rows = await CollectionModel.find().sort({ name: 1 }).lean();
    response.json({ success: true, data: rows.map((row) => ({ ...row, id: String(row._id) })) });
  });
  router.post(
    "/admin/collections",
    validateBody(collectionWriteSchema),
    async (request, response) => {
      const row = await CollectionModel.create(request.body);
      await audits.record({
        action: "content.collection_created",
        actorId: request.auth!.userId,
        entity: "collection",
        entityId: row.id,
        context: { requestId: request.requestId },
      });
      response.status(201).json({ success: true, data: { ...row.toObject(), id: row.id } });
    },
  );
  router.patch(
    "/admin/collections/:id",
    validateBody(collectionWriteSchema.partial()),
    async (request, response) => {
      const id = String(request.params.id);
      const row = Types.ObjectId.isValid(id)
        ? await CollectionModel.findByIdAndUpdate(
            id,
            { $set: request.body },
            { new: true, runValidators: true },
          )
        : null;
      if (!row) throw new HttpError(404, "COLLECTION_NOT_FOUND", "Collection not found.");
      await audits.record({
        action: "content.collection_updated",
        actorId: request.auth!.userId,
        entity: "collection",
        entityId: id,
        context: { requestId: request.requestId },
      });
      response.json({ success: true, data: { ...row.toObject(), id } });
    },
  );
  router.delete("/admin/collections/:id", async (request, response) => {
    const id = String(request.params.id);
    if (!Types.ObjectId.isValid(id))
      throw new HttpError(404, "COLLECTION_NOT_FOUND", "Collection not found.");
    if (await ProductModel.exists({ collectionIds: id }))
      throw new HttpError(
        409,
        "COLLECTION_IN_USE",
        "Remove product assignments first, or deactivate this collection.",
      );
    if (!(await CollectionModel.findByIdAndDelete(id)))
      throw new HttpError(404, "COLLECTION_NOT_FOUND", "Collection not found.");
    await audits.record({
      action: "content.collection_removed",
      actorId: request.auth!.userId,
      entity: "collection",
      entityId: id,
      context: { requestId: request.requestId },
    });
    response.status(204).send();
  });
  return router;
}
