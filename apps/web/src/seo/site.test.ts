import { describe, expect, it } from "vitest";

import { resolveSiteUrl } from "./site";

describe("resolveSiteUrl", () => {
  it("uses the configured production origin", () => {
    expect(resolveSiteUrl("https://thread-store.vercel.app/", "production")).toBe(
      "https://thread-store.vercel.app",
    );
  });

  it("never emits localhost in production", () => {
    expect(resolveSiteUrl("http://localhost:3000", "production")).toBe(
      "https://threadfashion.shop",
    );
    expect(resolveSiteUrl("http://127.0.0.1:3000", "production")).toBe(
      "https://threadfashion.shop",
    );
  });

  it("keeps localhost available for development", () => {
    expect(resolveSiteUrl("http://localhost:3000", "development")).toBe(
      "http://localhost:3000",
    );
  });
});
