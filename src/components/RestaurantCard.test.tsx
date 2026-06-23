import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("renders no select button by default", () => {
    render(<RestaurantCard restaurant={base} />);
    expect(screen.queryByRole("button", { name: /to vote/i })).toBeNull();
    expect(screen.getByRole("link", { name: /directions/i })).toBeInTheDocument();
  });

  it("toggles selection when selectable", async () => {
    const onToggle = vi.fn();
    render(<RestaurantCard restaurant={base} selectable selected={false} onToggle={onToggle} />);
    const btn = screen.getByRole("button", { name: /add sushi spot to vote/i });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("shows the added state when selected", () => {
    render(<RestaurantCard restaurant={base} selectable selected onToggle={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /remove sushi spot from vote/i });
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });
});
