import { notFound } from "next/navigation";
import { DesignSystemShowcase } from "./showcase";

export const metadata = { title: "Design system" };

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignSystemShowcase />;
}
