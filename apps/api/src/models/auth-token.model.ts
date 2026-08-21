import {
  model,
  models,
  Schema,
  type InferSchemaType,
  type Model,
} from "../database/mongoose-runtime.js";

const authTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    kind: {
      type: String,
      enum: ["email_verification", "password_reset", "phone_otp"],
      required: true,
      immutable: true,
    },
    tokenHash: { type: String, required: true, immutable: true, select: false },
    target: { type: String, required: true, trim: true, immutable: true },
    expiresAt: { type: Date, required: true },
    consumedAt: Date,
    attempts: { type: Number, default: 0, min: 0, required: true },
  },
  { strict: "throw", timestamps: true },
);

authTokenSchema.index(
  { tokenHash: 1, kind: 1 },
  { unique: true, name: "auth_token_hash_kind_unique" },
);
authTokenSchema.index({ userId: 1, kind: 1, consumedAt: 1 }, { name: "auth_token_user_kind" });
authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "auth_token_ttl" });

export type AuthToken = InferSchemaType<typeof authTokenSchema>;
export const AuthTokenModel: Model<AuthToken> =
  models.AuthToken ?? model<AuthToken>("AuthToken", authTokenSchema);
