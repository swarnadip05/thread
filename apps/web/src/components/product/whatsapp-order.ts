import type { ProductDetailDto, ProductVariantDto } from "@thread/types";

export function buildWhatsAppOrderUrl(input: {
  phone: string;
  product: ProductDetailDto;
  productUrl: string;
  quantity: number;
  variant: ProductVariantDto;
}): string | null {
  const phone = input.phone.replace(/\D/g, "");
  if (phone.length < 8) return null;
  const price = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(input.variant.salePricePaise / 100);
  const message = [
    "Hi THREAD, I would like to order:",
    `Product: ${input.product.title}`,
    `SKU: ${input.variant.sku}`,
    `Colour: ${input.variant.colour}`,
    `Size: ${input.variant.size}`,
    `Quantity: ${input.quantity}`,
    `Price: ${price}`,
    `Product URL: ${input.productUrl}`,
  ].join("\n");
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
