import { describe, expect, it } from "vitest";

import { buildWhatsAppOrderUrl } from "./whatsapp-order";

describe("buildWhatsAppOrderUrl", () => {
  it("builds an encoded order message from the selected variant", () => {
    const product = {
      id: "product-1",
      title: "Oversized Tee",
      slug: "oversized-tee",
    } as Parameters<typeof buildWhatsAppOrderUrl>[0]["product"];
    const variant = {
      sku: "TEE-OLIVE-M",
      colour: "Olive",
      size: "M",
      salePricePaise: 129900,
    } as Parameters<typeof buildWhatsAppOrderUrl>[0]["variant"];
    const url = buildWhatsAppOrderUrl({
      phone: "+91 98765 43210",
      product,
      productUrl: "http://localhost:3000/shop/oversized-tee",
      quantity: 2,
      variant,
    });
    expect(url).toContain("https://wa.me/919876543210?text=");
    expect(decodeURIComponent(url!)).toContain("SKU: TEE-OLIVE-M");
    expect(decodeURIComponent(url!)).toContain("Quantity: 2");
  });

  it("rejects an unusable business number", () => {
    expect(buildWhatsAppOrderUrl({ phone: "123", product: {} as never, productUrl: "", quantity: 1, variant: {} as never })).toBeNull();
  });
});
