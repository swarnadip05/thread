import {
  model,
  models,
  Schema,
  type InferSchemaType,
  type Model,
} from "../database/mongoose-runtime.js";

const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true, trim: true, maxlength: 120 },
    entity: { type: String, required: true, trim: true, maxlength: 80 },
    entityId: { type: String, trim: true, maxlength: 120 },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, trim: true, maxlength: 64 },
    requestId: { type: String, trim: true, maxlength: 128 },
    timestamp: { type: Date, default: Date.now, required: true },
  },
  { strict: "throw", timestamps: true },
);

auditLogSchema.index({ actorId: 1, timestamp: -1 }, { name: "audit_actor_time" });
auditLogSchema.index({ entity: 1, entityId: 1, timestamp: -1 }, { name: "audit_entity_time" });
auditLogSchema.index({ requestId: 1 }, { name: "audit_request" });

export type AuditLog = InferSchemaType<typeof auditLogSchema>;
export const AuditLogModel: Model<AuditLog> =
  models.AuditLog ?? model<AuditLog>("AuditLog", auditLogSchema);
