import { AuditLogModel } from "../../models/audit-log.model.js";
import type { AuthContext } from "../auth.types.js";

export interface AuditRepository {
  record(input: {
    action: string;
    actorId?: string;
    context: AuthContext;
    entity?: string;
    entityId?: string;
    metadata?: Record<string, string | number | boolean>;
  }): Promise<void>;
}

export class MongooseAuditRepository implements AuditRepository {
  async record(input: {
    action: string;
    actorId?: string;
    context: AuthContext;
    entity?: string;
    entityId?: string;
    metadata?: Record<string, string | number | boolean>;
  }): Promise<void> {
    await AuditLogModel.create({
      ...(input.actorId ? { actorId: input.actorId } : {}),
      action: input.action,
      entity: input.entity ?? "auth",
      ...(input.entityId ? { entityId: input.entityId } : {}),
      metadata: input.metadata ?? {},
      ...(input.context.ip ? { ip: input.context.ip } : {}),
      ...(input.context.requestId ? { requestId: input.context.requestId } : {}),
      timestamp: new Date(),
    });
  }
}
