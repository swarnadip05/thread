import { jwtVerify, SignJWT } from "jose";

export class HomepagePreviewTokenService {
  private readonly key: Uint8Array;

  constructor(
    secret: string,
    private readonly issuer = "thread-api",
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  issue(version: number): Promise<string> {
    return new SignJWT({ scope: "homepage-preview", version })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject("homepage")
      .setIssuer(this.issuer)
      .setAudience("thread-homepage-preview")
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(this.key);
  }

  async verify(token: string): Promise<number> {
    const { payload } = await jwtVerify(token, this.key, {
      algorithms: ["HS256"],
      issuer: this.issuer,
      audience: "thread-homepage-preview",
    });
    if (
      payload.sub !== "homepage" ||
      payload.scope !== "homepage-preview" ||
      typeof payload.version !== "number"
    )
      throw new Error("Invalid homepage preview token.");
    return payload.version;
  }
}
