import type { Metadata } from "next";

import { OrderTracking } from "@/components/account/order-tracking";

export const metadata: Metadata = {
  title: "Order tracking",
  robots: { index: false, follow: false },
};

export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <OrderTracking orderId={orderId} />;
}
