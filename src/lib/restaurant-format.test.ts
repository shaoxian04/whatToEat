import { describe, it, expect } from "vitest";
import { priceLabel, mapsUrl } from "@/lib/restaurant-format";

describe("priceLabel", () => {
  it("renders $ repeated by level", () => {
    expect(priceLabel(2)).toBe("$$");
  });
  it("renders empty string for null or 0", () => {
    expect(priceLabel(null)).toBe("");
    expect(priceLabel(0)).toBe("");
  });
});

describe("mapsUrl", () => {
  it("encodes the name and appends the place id", () => {
    expect(mapsUrl("Sushi Spot", "p1")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Sushi%20Spot&query_place_id=p1",
    );
  });
});
