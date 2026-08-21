import type { UserRole } from "@thread/types";
import {
  Archive,
  Boxes,
  FolderTree,
  Home,
  Image,
  LayoutDashboard,
  Megaphone,
  Package,
  ReceiptText,
  RotateCcw,
  Settings,
  ShoppingBag,
  Star,
  Tags,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavigationItem {
  readonly href: string;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly roles: readonly UserRole[];
}

const managementRoles = ["super_admin", "admin", "catalog_manager"] as const;
const operationsRoles = ["super_admin", "admin", "order_manager"] as const;
const supportRoles = ["super_admin", "admin", "order_manager", "support_agent"] as const;

export const adminNavigation: readonly AdminNavigationItem[] = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard", roles: operationsRoles },
  { href: "/admin/products", icon: Package, label: "Products", roles: managementRoles },
  { href: "/admin/categories", icon: FolderTree, label: "Categories", roles: managementRoles },
  { href: "/admin/collections", icon: Archive, label: "Collections", roles: managementRoles },
  { href: "/admin/inventory", icon: Boxes, label: "Inventory", roles: managementRoles },
  { href: "/admin/orders", icon: ShoppingBag, label: "Orders", roles: supportRoles },
  { href: "/admin/returns", icon: RotateCcw, label: "Returns", roles: supportRoles },
  { href: "/admin/customers", icon: Users, label: "Customers", roles: supportRoles },
  {
    href: "/admin/reviews",
    icon: Star,
    label: "Reviews",
    roles: ["super_admin", "admin", "catalog_manager", "support_agent"],
  },
  { href: "/admin/coupons", icon: Tags, label: "Coupons", roles: managementRoles },
  { href: "/admin/homepage", icon: Home, label: "Homepage", roles: managementRoles },
  { href: "/admin/navigation", icon: Megaphone, label: "Navigation", roles: managementRoles },
  { href: "/admin/media", icon: Image, label: "Media", roles: managementRoles },
  { href: "/admin/settings", icon: Settings, label: "Settings", roles: ["super_admin", "admin"] },
  {
    href: "/admin/audit-logs",
    icon: ReceiptText,
    label: "Audit Logs",
    roles: ["super_admin", "admin"],
  },
  { href: "/admin/checkout", icon: WalletCards, label: "Checkout", roles: operationsRoles },
];

export function isAdminNavigationAllowed(
  item: AdminNavigationItem,
  roles: readonly UserRole[],
): boolean {
  return roles.some((role) => item.roles.includes(role));
}

export function adminLabelForPath(pathname: string): string {
  return adminNavigation.find((item) => item.href === pathname)?.label ?? "Workspace";
}
