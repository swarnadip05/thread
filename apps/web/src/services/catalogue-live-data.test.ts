import { afterEach, describe, expect, it, vi } from "vitest";

const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
const originalStaticCatalogue = process.env.NEXT_PUBLIC_USE_STATIC_CATALOGUE;

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  if (originalApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
  else process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
  if (originalStaticCatalogue === undefined) delete process.env.NEXT_PUBLIC_USE_STATIC_CATALOGUE;
  else process.env.NEXT_PUBLIC_USE_STATIC_CATALOGUE = originalStaticCatalogue;
});

describe("live catalogue data", () => {
  it("does not substitute the bundled snapshot when the live API is unavailable by default", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:4000";
    process.env.NEXT_PUBLIC_USE_STATIC_CATALOGUE = "false";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("API unavailable")));
    const { loadDiscoveryData, isCatalogueUnavailable, loadProductDetail } =
      await import("./catalogue");

    await expect(loadDiscoveryData(new URLSearchParams({ audience: "men" }))).resolves.toBeNull();
    expect(
      isCatalogueUnavailable(await loadProductDetail("mens-oversized-graphic-tshirt-olive-green")),
    ).toBe(true);
  });

  it("uses the emergency snapshot only when its explicit build flag is enabled", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:4000/api/v1/";
    process.env.NEXT_PUBLIC_USE_STATIC_CATALOGUE = "true";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("API unavailable")));
    const { API_URL } = await import("@/config/api-url");
    const { loadDiscoveryData } = await import("./catalogue");

    expect(API_URL).toBe("http://localhost:4000");
    const data = await loadDiscoveryData(new URLSearchParams({ audience: "men" }));
    expect(data?.page.items.every((product) => product.audience === "men")).toBe(true);
    expect(data?.page.total).toBeGreaterThan(0);
  });
});
