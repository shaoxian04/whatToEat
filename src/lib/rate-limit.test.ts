import { describe, it, expect } from "vitest";
import { createRateLimiter } from "@/lib/rate-limit";

describe("createRateLimiter", () => {
  it("allows up to max requests then blocks within the window", () => {
    const allow = createRateLimiter(2, 1000);
    expect(allow("ip1", 0)).toBe(true);
    expect(allow("ip1", 100)).toBe(true);
    expect(allow("ip1", 200)).toBe(false);
  });

  it("resets after the window passes", () => {
    const allow = createRateLimiter(1, 1000);
    expect(allow("ip1", 0)).toBe(true);
    expect(allow("ip1", 500)).toBe(false);
    expect(allow("ip1", 1500)).toBe(true);
  });

  it("tracks keys independently", () => {
    const allow = createRateLimiter(1, 1000);
    expect(allow("ip1", 0)).toBe(true);
    expect(allow("ip2", 0)).toBe(true);
  });
});
