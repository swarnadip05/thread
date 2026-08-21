import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { requireRoles } from "../src/auth/http/security.middleware.js";
import { canTransitionOrder, isSafeBulkTransition } from "../src/checkout/order-state-machine.js";
import { isWithinReturnWindow } from "../src/operations/return-policy.js";

describe("operational order state machine", () => {
  it("allows only explicit fulfilment transitions and safe bulk steps", () => {
    expect(canTransitionOrder("confirmed", "processing")).toBe(true);
    expect(canTransitionOrder("confirmed", "delivered")).toBe(false);
    expect(canTransitionOrder("shipped", "cancelled")).toBe(false);
    expect(isSafeBulkTransition("confirmed", "processing")).toBe(true);
    expect(isSafeBulkTransition("packed", "shipped")).toBe(false);
  });
});

describe("return window policy", () => {
  it("includes the configured final day and rejects late requests", () => {
    const delivered = new Date("2026-07-01T10:00:00.000Z");
    expect(isWithinReturnWindow(delivered, 7, new Date("2026-07-08T10:00:00.000Z"))).toBe(true);
    expect(isWithinReturnWindow(delivered, 7, new Date("2026-07-08T10:00:00.001Z"))).toBe(false);
  });
});

describe("operational permissions", () => {
  it("blocks support agents from order-manager mutations", () => {
    const middleware = requireRoles("super_admin", "admin", "order_manager");
    const request = {
      auth: {
        userId: "507f1f77bcf86cd799439011",
        roles: ["support_agent"],
        sessionFamilyId: "family",
      },
    } as unknown as Request;
    const next = vi.fn() as NextFunction;
    middleware(request, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: "FORBIDDEN" }));
  });
});
