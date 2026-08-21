import { jwtVerify, SignJWT } from "jose";

export class ProductPreviewTokenService {
  private readonly key: Uint8Array;
  constructor(
    secret: string,
    private readonly issuer = "thread-api",
  ) {
    this.key = new TextEncoder().encode(secret);
  }
  issue(productId: string): Promise<string> {
    return new SignJWT({ scope: "product-preview" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(productId)
      .setIssuer(this.issuer)
      .setAudience("thread-product-preview")
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(this.key);
  }
  async verify(token: string): Promise<string> {
    const { payload } = await jwtVerify(token, this.key, {
      algorithms: ["HS256"],
      issuer: this.issuer,
      audience: "thread-product-preview",
    });
    if (!payload.sub || payload.scope !== "product-preview")
      throw new Error("Invalid preview token.");
    return payload.sub;
  }
}
