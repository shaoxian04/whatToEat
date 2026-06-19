import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RestaurantCard } from "@/components/RestaurantCard";
import type { Restaurant } from "@/lib/decision/types";

const base: Restaurant = {
  placeId: "p1", name: "Sushi Spot", rating: 4.6, priceLevel: 2,
  lat: 1.3, lng: 103.8, openNow: true, types: ["restaurant"], photoRef: null,
};

describe("RestaurantCard", () => {
  it("shows name, rating, price level and open status", () => {
    render(<RestaurantCard restaurant={base} />);
    expect(screen.getByText("Sushi Spot")).toBeInTheDocument();
    expect(screen.getByText(/4.6/)).toBeInTheDocument();
    expect(screen.getByText("$$")).toBeInTheDocument();
    expect(screen.getByText(/open now/i)).toBeInTheDocument();
  });

  it("renders a directions link to Google Maps using the place id", () => {
    render(<RestaurantCard restaurant={base} />);
    const link = screen.getByRole("link", { name: /directions/i });
    expect(link).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=Sushi%20Spot&query_place_id=p1",
    );
  });

  it("hides rating/price gracefully when null", () => {
    render(<RestaurantCard restaurant={{ ...base, rating: null, priceLevel: null }} />);
    expect(screen.getByText(/no rating/i)).toBeInTheDocument();
  });
});
