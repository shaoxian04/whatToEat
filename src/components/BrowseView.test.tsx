import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowseView } from "@/components/BrowseView";
import type { Restaurant } from "@/lib/decision/types";

function r(over: Partial<Restaurant>): Restaurant {
  return { placeId: "x", name: "x", rating: 4, priceLevel: 2, lat: 0, lng: 0, openNow: true, types: ["restaurant"], photoRef: null, ...over };
}

describe("BrowseView", () => {
  const origin = { lat: 0, lng: 0 };

  it("lists all nearby restaurants initially", async () => {
    const loader = vi.fn().mockResolvedValue([r({ placeId: "a", name: "Alpha" }), r({ placeId: "b", name: "Beta" })]);
    render(<BrowseView loadRestaurants={loader} origin={origin} autoStartCoords={origin} />);
    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("filters the list when minimum rating is raised", async () => {
    const loader = vi.fn().mockResolvedValue([
      r({ placeId: "a", name: "Alpha", rating: 4.8 }),
      r({ placeId: "b", name: "Beta", rating: 3.0 }),
    ]);
    render(<BrowseView loadRestaurants={loader} origin={origin} autoStartCoords={origin} />);
    await screen.findByText("Alpha");
    await userEvent.selectOptions(screen.getByLabelText(/minimum rating/i), "4.5");
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();
  });

  it("starts a vote with the selected restaurants", async () => {
    const loader = vi.fn().mockResolvedValue([
      r({ placeId: "a", name: "Alpha" }), r({ placeId: "b", name: "Beta" }),
    ]);
    const onVoteWithTeam = vi.fn();
    render(<BrowseView loadRestaurants={loader} origin={origin} autoStartCoords={origin} onVoteWithTeam={onVoteWithTeam} />);
    await screen.findByText("Alpha");
    await userEvent.click(screen.getByRole("button", { name: /add alpha to vote/i }));
    await userEvent.click(screen.getByRole("button", { name: /add beta to vote/i }));
    await userEvent.click(screen.getByRole("button", { name: /vote with team/i }));
    expect(onVoteWithTeam).toHaveBeenCalledWith([
      expect.objectContaining({ placeId: "a" }),
      expect.objectContaining({ placeId: "b" }),
    ]);
  });

  it("disables the vote bar until two are selected", async () => {
    const loader = vi.fn().mockResolvedValue([
      r({ placeId: "a", name: "Alpha" }), r({ placeId: "b", name: "Beta" }),
    ]);
    render(<BrowseView loadRestaurants={loader} origin={origin} autoStartCoords={origin} onVoteWithTeam={vi.fn()} />);
    await screen.findByText("Alpha");
    await userEvent.click(screen.getByRole("button", { name: /add alpha to vote/i }));
    expect(screen.getByRole("button", { name: /pick 2\+ to vote/i })).toBeDisabled();
  });

  it("shows no select buttons when onVoteWithTeam is absent", async () => {
    const loader = vi.fn().mockResolvedValue([r({ placeId: "a", name: "Alpha" })]);
    render(<BrowseView loadRestaurants={loader} origin={origin} autoStartCoords={origin} />);
    await screen.findByText("Alpha");
    expect(screen.queryByRole("button", { name: /to vote/i })).toBeNull();
  });

  it("seeds a team vote with the top picks in ranked order", async () => {
    const origin = { lat: 1.3, lng: 103.8 };
    const pool = [
      { placeId: "shiny", name: "shiny", rating: 4.9, userRatingCount: 4, priceLevel: null, lat: 1.3, lng: 103.8, openNow: null, types: [], photoRef: null },
      { placeId: "credible", name: "credible", rating: 4.5, userRatingCount: 4000, priceLevel: null, lat: 1.3, lng: 103.8, openNow: null, types: [], photoRef: null },
      { placeId: "dive", name: "dive", rating: 2.5, userRatingCount: 300, priceLevel: null, lat: 1.3, lng: 103.8, openNow: null, types: [], photoRef: null },
    ];
    const onVoteWithTeam = vi.fn();
    render(<BrowseView origin={origin} autoStartCoords={origin} loadRestaurants={async () => pool} onVoteWithTeam={onVoteWithTeam} />);
    await screen.findAllByRole("heading", { level: 2 });
    await userEvent.click(screen.getByRole("button", { name: /top .* picks/i }));
    expect(onVoteWithTeam).toHaveBeenCalledTimes(1);
    const picks = onVoteWithTeam.mock.calls[0][0] as { placeId: string }[];
    expect(picks.map((p) => p.placeId)).toEqual(["credible", "shiny", "dive"]);
  });

  it("orders restaurants best-first by smart score", async () => {
    const origin = { lat: 1.3, lng: 103.8 };
    const pool = [
      { placeId: "shiny", name: "shiny", rating: 4.9, userRatingCount: 4, priceLevel: null, lat: 1.3, lng: 103.8, openNow: null, types: [], photoRef: null },
      { placeId: "credible", name: "credible", rating: 4.5, userRatingCount: 4000, priceLevel: null, lat: 1.3, lng: 103.8, openNow: null, types: [], photoRef: null },
      { placeId: "low", name: "low", rating: 3.0, userRatingCount: 500, priceLevel: null, lat: 1.3, lng: 103.8, openNow: null, types: [], photoRef: null },
    ];
    render(<BrowseView origin={origin} autoStartCoords={origin} loadRestaurants={async () => pool} />);
    const names = (await screen.findAllByRole("heading", { level: 2 })).map((h) => h.textContent);
    expect(names[0]).toBe("credible");
    expect(names.indexOf("credible")).toBeLessThan(names.indexOf("shiny"));
  });
});
