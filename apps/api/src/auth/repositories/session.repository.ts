import { randomUUID } from "node:crypto";

import { AuthSessionModel } from "../../models/auth-session.model.js";
import type { AuthContext } from "../auth.types.js";

export type RotateResult =
  | { readonly status: "invalid" }
  | { readonly status: "reuse"; readonly familyId: string; readonly userId: string }
  | { readonly status: "rotated"; readonly familyId: string; readonly userId: string };

export interface SessionRepository {
  create(input: {
    context: AuthContext;
    expiresAt: Date;
    familyId?: string;
    tokenHash: string;
    userId: string;
  }): Promise<string>;
  rotate(input: {
    context: AuthContext;
    expiresAt: Date;
    newTokenHash: string;
    tokenHash: string;
  }): Promise<RotateResult>;
  revokeCurrent(tokenHash: string, reason: string): Promise<void>;
  revokeFamily(familyId: string, reason: string): Promise<void>;
  revokeAllForUser(userId: string, reason: string): Promise<void>;
}

export class MongooseSessionRepository implements SessionRepository {
  async create(input: {
    context: AuthContext;
    expiresAt: Date;
    familyId?: string;
    tokenHash: string;
    userId: string;
  }): Promise<string> {
    const familyId = input.familyId ?? randomUUID();
    await AuthSessionModel.create({
      userId: input.userId,
      familyId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      ...(input.context.ip ? { ip: input.context.ip } : {}),
      ...(input.context.userAgent ? { userAgent: input.context.userAgent } : {}),
    });
    return familyId;
  }
  async rotate(input: {
    context: AuthContext;
    expiresAt: Date;
    newTokenHash: string;
    tokenHash: string;
  }): Promise<RotateResult> {
    const current = await AuthSessionModel.findOne({ tokenHash: input.tokenHash })
      .select("+tokenHash +replacedByTokenHash")
      .exec();
    if (!current || current.expiresAt <= new Date()) return { status: "invalid" };
    if (current.revokedAt || current.replacedByTokenHash) {
      await this.revokeFamily(current.familyId, "refresh-token-reuse");
      return { status: "reuse", familyId: current.familyId, userId: current.userId.toString() };
    }
    const rotated = await AuthSessionModel.findOneAndUpdate(
      { _id: current._id, revokedAt: { $exists: false } },
      {
        $set: {
          revokedAt: new Date(),
          revokedReason: "rotated",
          replacedByTokenHash: input.newTokenHash,
          lastUsedAt: new Date(),
        },
      },
    ).exec();
    if (!rotated) {
      await this.revokeFamily(current.familyId, "concurrent-refresh-reuse");
      return { status: "reuse", familyId: current.familyId, userId: current.userId.toString() };
    }
    await this.create({
      context: input.context,
      expiresAt: input.expiresAt,
      familyId: current.familyId,
      tokenHash: input.newTokenHash,
      userId: current.userId.toString(),
    });
    return { status: "rotated", familyId: current.familyId, userId: current.userId.toString() };
  }
  async revokeCurrent(tokenHash: string, reason: string): Promise<void> {
    await AuthSessionModel.updateOne(
      { tokenHash, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date(), revokedReason: reason } },
    ).exec();
  }
  async revokeFamily(familyId: string, reason: string): Promise<void> {
    await AuthSessionModel.updateMany(
      { familyId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date(), revokedReason: reason } },
    ).exec();
  }
  async revokeAllForUser(userId: string, reason: string): Promise<void> {
    await AuthSessionModel.updateMany(
      { userId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date(), revokedReason: reason } },
    ).exec();
  }
}
