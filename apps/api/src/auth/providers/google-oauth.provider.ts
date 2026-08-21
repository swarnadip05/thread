import { createHash } from "node:crypto";

import { createRemoteJWKSet, jwtVerify } from "jose";

export interface GoogleOAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}
export interface GoogleProfile {
  readonly email: string;
  readonly name: string;
  readonly providerUserId: string;
}

export class GoogleOAuthProvider {
  private readonly jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
  constructor(private readonly config: GoogleOAuthConfig) {}

  authorizationUrl(state: string, verifier: string): string {
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    return url.toString();
  }

  async exchange(code: string, verifier: string): Promise<GoogleProfile> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
    });
    if (!response.ok) throw new Error("Google token exchange failed.");
    const result: unknown = await response.json();
    if (
      !result ||
      typeof result !== "object" ||
      !("id_token" in result) ||
      typeof result.id_token !== "string"
    )
      throw new Error("Google did not return an identity token.");
    const { payload } = await jwtVerify(result.id_token, this.jwks, {
      audience: this.config.clientId,
      issuer: ["https://accounts.google.com", "accounts.google.com"],
    });
    if (
      payload.email_verified !== true ||
      typeof payload.email !== "string" ||
      typeof payload.sub !== "string"
    )
      throw new Error("Google account email is not verified.");
    return {
      email: payload.email.toLowerCase(),
      name: typeof payload.name === "string" ? payload.name : payload.email.split("@")[0]!,
      providerUserId: payload.sub,
    };
  }
}
