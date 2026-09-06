import { createHash, randomBytes } from "node:crypto";

import { jwtVerify, SignJWT } from "jose";
import type { UserRole } from "@thread/types";

import type { AccessTokenClaims } from "../auth.types.js";

export interface AccessTokenService {
  issue(input: AccessTokenClaims): Promise<string>;
  verify(token: string): Promise<AccessTokenClaims>;
}

export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export class JwtAccessTokenService implements AccessTokenService {
  private readonly key: Uint8Array;

  constructor(
    secret: string,
    private readonly issuer: string,
    private readonly audience: string,
    private readonly ttlSeconds: number,
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  issue(input: AccessTokenClaims): Promise<string> {
    return new SignJWT({ roles: [...input.roles], sid: input.sessionFamilyId })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(input.subject)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt()
      .setExpirationTime(`${this.ttlSeconds}s`)
      .sign(this.key);
  }

  async verify(token: string): Promise<AccessTokenClaims> {
    const { payload } = await jwtVerify(token, this.key, {
      algorithms: ["HS256"],
      issuer: this.issuer,
      audience: this.audience,
    });
    if (!payload.sub || typeof payload.sid !== "string" || !Array.isArray(payload.roles))
      throw new Error("Invalid access token claims.");
    return {
      subject: payload.sub,
      sessionFamilyId: payload.sid,
      roles: payload.roles as UserRole[],
    };
  }
}
