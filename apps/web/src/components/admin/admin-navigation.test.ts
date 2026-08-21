import { describe, expect, it } from "vitest";

import { adminNavigation, isAdminNavigationAllowed } from "./admin-navigation";

describe("admin navigation RBAC", () => {
  it("hides management workspaces from support agents", () => {
    const products = adminNavigation.find((item) => item.href === "/admin/products");
    const orders = adminNavigation.find((item) => item.href === "/admin/orders");
    expect(products).toBeDefined();
    expect(orders).toBeDefined();
    expect(isAdminNavigationAllowed(products!, ["support_agent"])).toBe(false);
    expect(isAdminNavigationAllowed(orders!, ["support_agent"])).toBe(true);
  });
});
