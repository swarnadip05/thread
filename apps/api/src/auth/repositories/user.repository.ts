import mongoose, { Types } from "mongoose";
import type { UserRole } from "@thread/types";

import { UserModel, type UserDocument } from "../../models/user.model.js";
import type { AuthUserRecord } from "../auth.types.js";
import { CheckoutAddressModel } from "../../checkout/models/address.model.js";

export interface CreateUserInput {
  readonly email?: string;
  readonly name: string;
  readonly passwordHash?: string;
  readonly phone?: string;
  readonly roles?: readonly UserRole[];
  readonly mustChangePassword?: boolean;
}
export interface UserRepository {
  create(input: CreateUserInput): Promise<AuthUserRecord>;
  findByEmail(email: string, includePassword?: boolean): Promise<AuthUserRecord | null>;
  findById(id: string, includePassword?: boolean): Promise<AuthUserRecord | null>;
  findByPhone(phone: string): Promise<AuthUserRecord | null>;
  findByProvider(provider: "google", providerUserId: string): Promise<AuthUserRecord | null>;
  recordFailedLogin(id: string, attempts: number, backoffUntil?: Date): Promise<void>;
  recordSuccessfulLogin(id: string): Promise<void>;
  markEmailVerified(id: string): Promise<void>;
  markPhoneVerified(id: string): Promise<void>;
  setPassword(id: string, passwordHash: string, mustChangePassword?: boolean): Promise<void>;
  linkGoogle(id: string, providerUserId: string): Promise<void>;
  hasSuperAdmin(): Promise<boolean>;
  anonymize(id: string): Promise<void>;
}

function toRecord(document: UserDocument): AuthUserRecord {
  return {
    id: document.id,
    name: document.name,
    ...(document.email ? { email: document.email } : {}),
    ...(document.phone ? { phone: document.phone } : {}),
    ...(document.passwordHash ? { passwordHash: document.passwordHash } : {}),
    roles: document.roles as UserRole[],
    status: document.status,
    ...(document.emailVerifiedAt ? { emailVerifiedAt: document.emailVerifiedAt } : {}),
    ...(document.phoneVerifiedAt ? { phoneVerifiedAt: document.phoneVerifiedAt } : {}),
    mustChangePassword: document.mustChangePassword,
    failedAttempts: document.loginSecurity?.failedAttempts ?? 0,
    ...(document.loginSecurity?.backoffUntil
      ? { backoffUntil: document.loginSecurity.backoffUntil }
      : {}),
    totpEnabled: document.totp?.enabled ?? false,
  };
}

export class MongooseUserRepository implements UserRepository {
  async create(input: CreateUserInput): Promise<AuthUserRecord> {
    const providers = [
      input.passwordHash ? { provider: "password" as const } : null,
      input.phone ? { provider: "phone" as const } : null,
    ].filter((item) => item !== null);
    const document = await UserModel.create({
      ...input,
      authProviders: providers,
      roles: [...(input.roles ?? ["customer"])],
    });
    return toRecord(document);
  }
  async findByEmail(email: string, includePassword = false): Promise<AuthUserRecord | null> {
    const query = UserModel.findOne({ email: email.toLowerCase() });
    if (includePassword) query.select("+passwordHash");
    const document = await query.exec();
    return document ? toRecord(document) : null;
  }
  async findById(id: string, includePassword = false): Promise<AuthUserRecord | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const query = UserModel.findById(id);
    if (includePassword) query.select("+passwordHash");
    const document = await query.exec();
    return document ? toRecord(document) : null;
  }
  async findByPhone(phone: string): Promise<AuthUserRecord | null> {
    const document = await UserModel.findOne({ phone }).exec();
    return document ? toRecord(document) : null;
  }
  async findByProvider(provider: "google", providerUserId: string): Promise<AuthUserRecord | null> {
    const document = await UserModel.findOne({
      authProviders: { $elemMatch: { provider, providerUserId } },
    }).exec();
    return document ? toRecord(document) : null;
  }
  async recordFailedLogin(id: string, attempts: number, backoffUntil?: Date): Promise<void> {
    await UserModel.updateOne(
      { _id: id },
      {
        $set: {
          "loginSecurity.failedAttempts": attempts,
          "loginSecurity.lastFailedAt": new Date(),
          "loginSecurity.backoffUntil": backoffUntil ?? null,
        },
      },
    ).exec();
  }
  async recordSuccessfulLogin(id: string): Promise<void> {
    await UserModel.updateOne(
      { _id: id },
      {
        $set: { lastLoginAt: new Date(), "loginSecurity.failedAttempts": 0 },
        $unset: { "loginSecurity.backoffUntil": 1, "loginSecurity.lastFailedAt": 1 },
      },
    ).exec();
  }
  async markEmailVerified(id: string): Promise<void> {
    await UserModel.updateOne({ _id: id }, { $set: { emailVerifiedAt: new Date() } }).exec();
  }
  async markPhoneVerified(id: string): Promise<void> {
    await UserModel.updateOne({ _id: id }, { $set: { phoneVerifiedAt: new Date() } }).exec();
  }
  async setPassword(id: string, passwordHash: string, mustChangePassword = false): Promise<void> {
    await UserModel.updateOne(
      { _id: id },
      {
        $set: { passwordHash, mustChangePassword },
        $addToSet: { authProviders: { provider: "password", linkedAt: new Date() } },
      },
    ).exec();
  }
  async linkGoogle(id: string, providerUserId: string): Promise<void> {
    await UserModel.updateOne(
      { _id: id },
      {
        $addToSet: { authProviders: { provider: "google", providerUserId, linkedAt: new Date() } },
      },
    ).exec();
  }
  async hasSuperAdmin(): Promise<boolean> {
    return (await UserModel.exists({ roles: "super_admin" })) !== null;
  }
  async anonymize(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) return;
    await mongoose.connection.transaction(async (session) => {
      await CheckoutAddressModel.deleteMany({ userId: id }, { session });
      await UserModel.updateOne(
        { _id: id },
        {
          $set: {
            name: "Deleted customer",
            status: "disabled",
            roles: ["customer"],
            authProviders: [],
            anonymizedAt: new Date(),
            mustChangePassword: false,
            loginSecurity: { failedAttempts: 0 },
            totp: { enabled: false },
          },
          $unset: {
            email: 1,
            phone: 1,
            passwordHash: 1,
            emailVerifiedAt: 1,
            phoneVerifiedAt: 1,
            lastLoginAt: 1,
          },
        },
        { session, runValidators: true },
      );
    });
  }
}
