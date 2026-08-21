import type { Metadata } from "next";

import { OrderList } from "@/components/account/order-list";

export const metadata: Metadata = {
  title: "Orders",
  robots: { index: false, follow: false },
};

export default function OrdersPage() {
  return (
    <section>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Your account</p>
      <h1 className="mb-8 mt-2 text-3xl font-semibold">Orders</h1>
      <OrderList />
    </section>
  );
}
