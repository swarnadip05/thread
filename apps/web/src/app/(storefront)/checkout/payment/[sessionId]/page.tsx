import type { Metadata } from "next";

import { ProtectedRoute } from "@/auth/protected-route";
import { PaymentStatusPage } from "@/components/checkout/payment-status-page";

export const metadata: Metadata = {
  title: "Payment verification | THREAD",
  robots: { index: false, follow: false },
};

export default async function PaymentVerificationRoute({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return (
    <ProtectedRoute allowedRoles={["customer"]}>
      <PaymentStatusPage checkoutSessionId={sessionId} />
    </ProtectedRoute>
  );
}
