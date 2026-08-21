import {
  model,
  models,
  Schema,
  type InferSchemaType,
  type Model,
} from "../database/mongoose-runtime.js";

const authSessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    familyId: { type: String, required: true, immutable: true },
    tokenHash: { type: String, required: true, immutable: true, select: false },
    replacedByTokenHash: { type: String, select: false },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    revokedReason: { type: String, trim: true, maxlength: 120 },
    lastUsedAt: Date,
    ip: { type: String, trim: true, maxlength: 64 },
    userAgent: { type: String, trim: true, maxlength: 512 },
  },
  { strict: "throw", timestamps: true },
);

authSessionSchema.index({ tokenHash: 1 }, { unique: true, name: "auth_session_token_unique" });
authSessionSchema.index({ familyId: 1, revokedAt: 1 }, { name: "auth_session_family" });
authSessionSchema.index({ userId: 1, revokedAt: 1 }, { name: "auth_session_user" });
authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "auth_session_ttl" });

export type AuthSession = InferSchemaType<typeof authSessionSchema>;
export const AuthSessionModel: Model<AuthSession> =
  models.AuthSession ?? model<AuthSession>("AuthSession", authSessionSchema);
