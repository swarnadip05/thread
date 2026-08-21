import { AuthTokenModel } from "../../models/auth-token.model.js";

export type AuthTokenKind = "email_verification" | "password_reset" | "phone_otp";
export interface ConsumedAuthToken {
  readonly target: string;
  readonly userId: string;
}
export interface AuthTokenRepository {
  issue(input: {
    expiresAt: Date;
    kind: AuthTokenKind;
    target: string;
    tokenHash: string;
    userId: string;
  }): Promise<void>;
  consume(kind: AuthTokenKind, tokenHash: string): Promise<ConsumedAuthToken | null>;
  revokeAllForUser(userId: string): Promise<void>;
}

export class MongooseAuthTokenRepository implements AuthTokenRepository {
  async issue(input: {
    expiresAt: Date;
    kind: AuthTokenKind;
    target: string;
    tokenHash: string;
    userId: string;
  }): Promise<void> {
    await AuthTokenModel.updateMany(
      { userId: input.userId, kind: input.kind, consumedAt: { $exists: false } },
      { $set: { consumedAt: new Date() } },
    ).exec();
    await AuthTokenModel.create(input);
  }
  async consume(kind: AuthTokenKind, tokenHash: string): Promise<ConsumedAuthToken | null> {
    const token = await AuthTokenModel.findOneAndUpdate(
      { kind, tokenHash, consumedAt: { $exists: false }, expiresAt: { $gt: new Date() } },
      { $set: { consumedAt: new Date() } },
      { new: false },
    )
      .select("+tokenHash")
      .exec();
    return token ? { target: token.target, userId: token.userId.toString() } : null;
  }
  async revokeAllForUser(userId: string): Promise<void> {
    await AuthTokenModel.updateMany(
      { userId, consumedAt: { $exists: false } },
      { $set: { consumedAt: new Date() } },
    ).exec();
  }
}
