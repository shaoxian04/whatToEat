import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VoteRoom } from "@/components/VoteRoom";
import type { VoteSession, VoteOption, Vote } from "@/lib/vote/types";

const session: VoteSession = { id: "s1", hostName: "Sam", status: "open", winnerOptionId: null, expiresAt: "" };
const options: VoteOption[] = [
  { id: "o1", sessionId: "s1", placeId: null, name: "Sushi", snapshot: null },
  { id: "o2", sessionId: "s1", placeId: null, name: "Pizza", snapshot: null },
];
// stub the realtime hook to just echo the initial state
const stubSubscribe = (_id: string, initial: { votes: Vote[]; status: "open" | "closed"; winnerOptionId: string | null }) => initial;

describe("VoteRoom", () => {
  it("renders options with their up tallies", () => {
    const votes: Vote[] = [{ id: "v1", sessionId: "s1", optionId: "o1", voterName: "Al", createdAt: "" }];
    render(<VoteRoom sessionId="s1" initialSession={session} options={options} initialVotes={votes}
      voterName="Bo" onCast={vi.fn()} onClose={vi.fn()} subscribe={stubSubscribe} canClose={true} />);
    expect(screen.getByText("Sushi")).toBeInTheDocument();
    expect(screen.getByText("Pizza")).toBeInTheDocument();
    expect(screen.getByTestId("up-o1")).toHaveTextContent("1");
  });

  it("calls onCast when an upvote button is clicked", async () => {
    const onCast = vi.fn().mockResolvedValue(undefined);
    render(<VoteRoom sessionId="s1" initialSession={session} options={options} initialVotes={[]}
      voterName="Bo" onCast={onCast} onClose={vi.fn()} subscribe={stubSubscribe} canClose={true} />);
    await userEvent.click(screen.getByRole("button", { name: /upvote sushi/i }));
    expect(onCast).toHaveBeenCalledWith("o1");
  });

  it("no longer renders a veto button", () => {
    render(<VoteRoom sessionId="s1" initialSession={session} options={options} initialVotes={[]}
      voterName="Bo" onCast={vi.fn()} onClose={vi.fn()} subscribe={stubSubscribe} canClose={true} />);
    expect(screen.queryByRole("button", { name: /veto/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /upvote sushi/i })).toBeInTheDocument();
  });

  it("shows the winner and hides vote buttons when closed", () => {
    const closed: VoteSession = { ...session, status: "closed", winnerOptionId: "o2" };
    render(<VoteRoom sessionId="s1" initialSession={closed} options={options} initialVotes={[]}
      voterName="Bo" onCast={vi.fn()} onClose={vi.fn()} subscribe={stubSubscribe} canClose={true} />);
    expect(screen.getByText(/winner/i)).toHaveTextContent("Pizza");
    expect(screen.queryByRole("button", { name: /upvote sushi/i })).not.toBeInTheDocument();
  });

  it("renders the close button when open and canClose is true", () => {
    render(<VoteRoom sessionId="s1" initialSession={session} options={options} initialVotes={[]}
      voterName="Bo" onCast={vi.fn()} onClose={vi.fn()} subscribe={stubSubscribe} canClose={true} />);
    expect(screen.getByRole("button", { name: /close voting/i })).toBeInTheDocument();
  });

  it("does not render the close button when canClose is false", () => {
    render(<VoteRoom sessionId="s1" initialSession={session} options={options} initialVotes={[]}
      voterName="Bo" onCast={vi.fn()} onClose={vi.fn()} subscribe={stubSubscribe} canClose={false} />);
    expect(screen.queryByRole("button", { name: /close voting/i })).toBeNull();
  });

  it("renders restaurant details for options that carry a snapshot", () => {
    const richOptions: VoteOption[] = [
      { id: "o1", sessionId: "s1", placeId: "a", name: "Sushi",
        snapshot: { placeId: "a", name: "Sushi", rating: 4.6, priceLevel: 2, lat: 0, lng: 0, openNow: true, photoRef: null } },
      { id: "o2", sessionId: "s1", placeId: null, name: "Pizza", snapshot: null },
    ];
    render(<VoteRoom sessionId="s1" initialSession={session} options={richOptions} initialVotes={[]}
      voterName="Bo" onCast={vi.fn()} onClose={vi.fn()} subscribe={stubSubscribe} canClose={true} />);
    expect(screen.getByText("★ 4.6")).toBeInTheDocument();
    // Directions link only appears for the option that has a snapshot.
    expect(screen.getAllByRole("link", { name: /directions/i })).toHaveLength(1);
  });

  it("shows the review count when the snapshot carries userRatingCount", () => {
    const richOptions: VoteOption[] = [
      { id: "o1", sessionId: "s1", placeId: "a", name: "Sushi",
        snapshot: { placeId: "a", name: "Sushi", rating: 4.6, userRatingCount: 1234, priceLevel: 2, lat: 0, lng: 0, openNow: true, photoRef: null } },
    ];
    render(<VoteRoom sessionId="s1" initialSession={session} options={richOptions} initialVotes={[]}
      voterName="Bo" onCast={vi.fn()} onClose={vi.fn()} subscribe={stubSubscribe} canClose={true} />);
    expect(screen.getByText("★ 4.6 (1,234)")).toBeInTheDocument();
  });

  it("falls back to name-only for options without a snapshot", () => {
    render(<VoteRoom sessionId="s1" initialSession={session} options={options} initialVotes={[]}
      voterName="Bo" onCast={vi.fn()} onClose={vi.fn()} subscribe={stubSubscribe} canClose={true} />);
    expect(screen.queryByRole("link", { name: /directions/i })).toBeNull();
    expect(screen.getByText("Sushi")).toBeInTheDocument();
  });
});
