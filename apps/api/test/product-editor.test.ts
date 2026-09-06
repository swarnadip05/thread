import { describe, expect, it } from "vitest";
import { productWriteSchema, productPatchSchema, variantMatrixSchema } from "@thread/validation";

const variant = {
  sku: "TEST-TEE-M",
  colour: "Black",
  size: "M",
  mrpPaise: 100000,
  salePricePaise: 80000,
  initialStock: 5,
  reorderLevel: 2,
  weightGrams: 250,
};
const product = {
  title: "Test product",
  slug: "test-product",
  shortDescription: "Test copy",
  descriptionHtml: "<p>Test copy</p>",
  audience: "unisex",
  brand: "THREAD",
  variants: [variant],
};
describe("product editor API contract", () => {
  it("accepts the full editor data without permitting fabricated ratings or sales", () => {
    const value = productWriteSchema.parse({
      ...product,
      material: "Cotton",
      care: ["Cold wash"],
      featured: true,
      newArrival: true,
      rating: { average: 5, count: 999 },
      bestSeller: true,
      seo: { title: "Search title", description: "Search description" },
    });
    expect(value.variants[0]).toMatchObject({ initialStock: 5, reorderLevel: 2 });
    expect(value).toMatchObject({ newArrival: true, featured: true });
    expect(value).not.toHaveProperty("rating");
    expect(value).not.toHaveProperty("bestSeller");
  });
  it("allows atomic edits of copy and variants", () => {
    expect(productPatchSchema.parse({ title: "Updated", variants: [variant] })).toHaveProperty(
      "variants",
    );
  });
  it("prevents existing inventory from being overwritten and invalid prices or stock", () => {
    for (const patch of [
      { id: "64b000000000000000000001" },
      { initialStock: -1 },
      { initialStock: 0.5 },
      { reorderLevel: -2 },
      { salePricePaise: 100001 },
    ]) {
      expect(variantMatrixSchema.safeParse({ variants: [{ ...variant, ...patch }] }).success).toBe(
        false,
      );
    }
  });
});
