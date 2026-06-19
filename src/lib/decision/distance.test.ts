import { describe, it, expect } from "vitest";
import { haversineMeters } from "@/lib/decision/distance";

describe("haversineMeters", () => {
  it("is zero for identical points", () => {
    expect(haversineMeters({ lat: 1, lng: 1 }, { lat: 1, lng: 1 })).toBe(0);
  });

  it("approximates a known short distance (~157m per 0.001 lat near equator)", () => {
    const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 0.001, lng: 0 });
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(120);
  });
});
