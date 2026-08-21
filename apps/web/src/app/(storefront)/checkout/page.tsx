import type { Metadata } from "next";

import { ProtectedRoute } from "@/auth/protected-route";
import { CheckoutPage } from "@/components/checkout/checkout-page";
import { loadPublicSettings } from "@/services/site-settings";

export const metadata: Metadata = {
  title: "Checkout | THREAD",
  description: "Confirm delivery details and reserve THREAD products.",
  robots: { index: false, follow: false },
};

export default async function CheckoutRoute() {
  const settings = await loadPublicSettings();

  return (
    <ProtectedRoute allowedRoles={["customer"]}>
      <CheckoutPage gstin={settings.gstin} />
    </ProtectedRoute>
  );
}
