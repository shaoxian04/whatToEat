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
});
