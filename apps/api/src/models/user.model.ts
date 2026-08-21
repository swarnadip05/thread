import {
  model,
  models,
  Schema,
  type HydratedDocument,
  type Model,
} from "../database/mongoose-runtime.js";
import { userRoles, type UserRole } from "@thread/types";

interface AuthProviderLink {
  linkedAt: Date;
  provider: "password" | "google" | "phone";
  providerUserId?: string;
}
export interface User {
  name: string;
  email?: string;
  phone?: string;
  passwordHash?: string;
  authProviders: AuthProviderLink[];
  roles: UserRole[];
  status: "active" | "suspended" | "disabled";
  emailVerifiedAt?: Date;
  phoneVerifiedAt?: Date;
  lastLoginAt?: Date;
  mustChangePassword: boolean;
  loginSecurity: { failedAttempts: number; backoffUntil?: Date; lastFailedAt?: Date };
  totp: { enabled: boolean; secretCiphertext?: string; verifiedAt?: Date };
  createdAt: Date;
  updatedAt: Date;
  anonymizedAt?: Date;
}

const authProviderSchema = new Schema<AuthProviderLink>(
  {
    provider: { type: String, enum: ["password", "google", "phone"], required: true },
    providerUserId: { type: String, trim: true },
    linkedAt: { type: Date, default: Date.now, required: true },
  },
  { _id: false, strict: "throw" },
);

const userSchema = new Schema<User>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 20 },
    passwordHash: { type: String, select: false },
    authProviders: { type: [authProviderSchema], default: [] },
    roles: { type: [String], enum: userRoles, default: ["customer"], required: true },
    status: {
      type: String,
      enum: ["active", "suspended", "disabled"],
      default: "active",
      required: true,
    },
    emailVerifiedAt: Date,
    phoneVerifiedAt: Date,
    lastLoginAt: Date,
    mustChangePassword: { type: Boolean, default: false, required: true },
    loginSecurity: {
      failedAttempts: { type: Number, default: 0, min: 0, required: true },
      backoffUntil: Date,
      lastFailedAt: Date,
    },
    totp: {
      enabled: { type: Boolean, default: false, required: true },
      secretCiphertext: { type: String, select: false },
      verifiedAt: Date,
    },
    anonymizedAt: Date,
  },
  {
    strict: "throw",
    timestamps: true,
    toJSON: {
      transform: (_document, returned) => {
        delete returned.passwordHash;
        if (returned.totp && typeof returned.totp === "object")
          delete returned.totp.secretCiphertext;
        return returned;
      },
    },
  },
);

userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: "string" } },
    name: "user_email_unique",
  },
);
userSchema.index(
  { phone: 1 },
  {
    unique: true,
    partialFilterExpression: { phone: { $type: "string" } },
    name: "user_phone_unique",
  },
);
userSchema.index(
  { "authProviders.provider": 1, "authProviders.providerUserId": 1 },
  {
    partialFilterExpression: { "authProviders.providerUserId": { $type: "string" } },
    name: "user_provider_lookup",
  },
);
userSchema.index({ roles: 1, status: 1 }, { name: "user_role_status" });

export type UserDocument = HydratedDocument<User>;
export const UserModel: Model<User> = models.User ?? model<User>("User", userSchema);
