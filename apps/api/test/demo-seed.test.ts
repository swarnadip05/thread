import { describe, expect, it } from "vitest";

import {
  demoSeedProductImageCount,
  demoSeedProductSlugs,
  isValidDemoSeedConfirmation,
} from "../src/seeds/demo-catalogue.js";

describe("safe demo seed guardrails", () => {
  it("requires an exact opt-in confirmation", () => {
    expect(isValidDemoSeedConfirmation(undefined)).toBe(false);
    expect(isValidDemoSeedConfirmation("yes")).toBe(false);
    expect(isValidDemoSeedConfirmation("SEED_THREAD_DEMO")).toBe(true);
  });

  it("labels every product as demo and contains no competitor or character names", () => {
    const joined = demoSeedProductSlugs.join(" ");
    expect(demoSeedProductSlugs.every((slug) => slug.startsWith("demo-"))).toBe(true);
    expect(joined).not.toMatch(/bewakoof|marvel|dc|minion|playstation|spider|batman/i);
  });

  it("maps every approved four-view client product gallery", () => {
    expect(demoSeedProductSlugs).toHaveLength(73);
    expect(demoSeedProductImageCount).toBe(292);
    expect(demoSeedProductSlugs).not.toContain("demo-thread-men-oversized-style-14");
    expect(demoSeedProductSlugs).not.toContain("demo-thread-men-oversized-style-20");
  });
});
