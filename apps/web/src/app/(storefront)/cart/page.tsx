import type { Metadata } from "next";
import { CartPageContent } from "@/components/cart/cart-page-content";

export const metadata: Metadata = {
  title: "Shopping Bag | THREAD",
  description: "View your selected streetwear items and proceed to buy.",
};

export default function CartPage() {
  return <CartPageContent />;
}
