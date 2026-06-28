import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DecideView } from "@/components/DecideView";
import type { Restaurant } from "@/lib/decision/types";

function r(id: string): Restaurant {
  return { placeId: id, name: id, rating: 4, priceLevel: 2, lat: 0, lng: 0, openNow: true, types: [], photoRef: null };
}

describe("DecideView", () => {
  it("loads restaurants and shows one pick after granting location", async () => {
    const loader = vi.fn().mockResolvedValue([r("Alpha"), r("Beta")]);
    render(<DecideView loadRestaurants={loader} autoStartCoords={{ lat: 1, lng: 2 }} rng={() => 0} />);

    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(loader).toHaveBeenCalledWith({ lat: 1, lng: 2 });
  });

  it("shows an empty state when no restaurants are found", async () => {
    const loader = vi.fn().mockResolvedValue([]);
    render(<DecideView loadRestaurants={loader} autoStartCoords={{ lat: 1, lng: 2 }} rng={() => 0} />);
    expect(await screen.findByText(/no restaurants/i)).toBeInTheDocument();
  });

  it("re-rolls to a different pick on 'Pick again'", async () => {
    const loader = vi.fn().mockResolvedValue([r("Alpha"), r("Beta")]);
    // first render rng=0 -> "Alpha"; after pick-again, previous "Alpha" excluded -> "Beta"
    render(<DecideView loadRestaurants={loader} autoStartCoords={{ lat: 1, lng: 2 }} rng={() => 0} />);
    await screen.findByText("Alpha");
    await userEvent.click(screen.getByRole("button", { name: /pick again/i }));
    expect(await screen.findByText("Beta")).toBeInTheDocument();
  });

  it("favors the highest-scored restaurant when rng=0", async () => {
    const origin = { lat: 1.3, lng: 103.8 };
    const pool = [
      { placeId: "shiny", name: "shiny", rating: 4.9, userRatingCount: 4, priceLevel: null, lat: 1.3, lng: 103.8, openNow: null, types: [], photoRef: null },
      { placeId: "credible", name: "credible", rating: 4.5, userRatingCount: 4000, priceLevel: null, lat: 1.3, lng: 103.8, openNow: null, types: [], photoRef: null },
      { placeId: "dive", name: "dive", rating: 2.5, userRatingCount: 300, priceLevel: null, lat: 1.3, lng: 103.8, openNow: null, types: [], photoRef: null },
    ];
    render(<DecideView autoStartCoords={origin} loadRestaurants={async () => pool} rng={() => 0} />);
    expect(await screen.findByRole("heading", { level: 2 })).toHaveTextContent("credible");
  });
});
