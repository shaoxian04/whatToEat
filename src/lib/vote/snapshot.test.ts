import { describe, it, expect } from "vitest";
import { toSnapshot, parseSnapshot } from "@/lib/vote/snapshot";
import type { Restaurant } from "@/lib/decision/types";

const r: Restaurant = {
  placeId: "p1", name: "Sushi Spot", rating: 4.6, priceLevel: 2,
  lat: 1.3, lng: 103.8, openNow: true, types: ["restaurant"], photoRef: "ref1",
};

describe("toSnapshot", () => {
  it("keeps render fields and drops types", () => {
    const s = toSnapshot(r);
    expect(s).toEqual({
      placeId: "p1", name: "Sushi Spot", rating: 4.6, userRatingCount: null, priceLevel: 2,
      lat: 1.3, lng: 103.8, openNow: true, photoRef: "ref1",
    });
    expect("types" in s).toBe(false);
  });
});

describe("parseSnapshot", () => {
  it("accepts a well-formed snapshot", () => {
    expect(parseSnapshot(toSnapshot(r))?.name).toBe("Sushi Spot");
  });
  it("rejects non-objects and null", () => {
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot("nope")).toBeNull();
    expect(parseSnapshot(42)).toBeNull();
  });
  it("rejects when placeId or name is missing", () => {
    expect(parseSnapshot({ name: "x" })).toBeNull();
    expect(parseSnapshot({ placeId: "x" })).toBeNull();
  });
  it("coerces missing nullable fields to null/0", () => {
    const s = parseSnapshot({ placeId: "p", name: "n" });
    expect(s).toEqual({ placeId: "p", name: "n", rating: null, userRatingCount: null, priceLevel: null, lat: 0, lng: 0, openNow: null, photoRef: null });
  });
});

it("carries userRatingCount through a snapshot round-trip", () => {
  const r: Restaurant = {
    placeId: "p", name: "P", rating: 4.5, userRatingCount: 1234, priceLevel: 2,
    lat: 1, lng: 2, openNow: true, types: ["restaurant"], photoRef: null,
  };
  const snap = toSnapshot(r);
  expect(snap.userRatingCount).toBe(1234);
  expect(parseSnapshot(snap)?.userRatingCount).toBe(1234);
});

it("defaults missing userRatingCount to null on parse", () => {
  const parsed = parseSnapshot({
    placeId: "p", name: "P", rating: null, priceLevel: null, lat: 0, lng: 0, openNow: null, photoRef: null,
  });
  expect(parsed?.userRatingCount).toBeNull();
});
