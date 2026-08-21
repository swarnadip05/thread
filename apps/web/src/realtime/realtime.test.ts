import { describe, expect, it } from "vitest";

import { fallbackPollingInterval } from "./polling";

describe("realtime fallback", () => {
  it("polls more frequently while disconnected and keeps a connected safety poll", () => {
    expect(fallbackPollingInterval(false)).toBe(15_000);
    expect(fallbackPollingInterval(true)).toBe(60_000);
  });
});
