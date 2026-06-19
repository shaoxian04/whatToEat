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
    const votes: Vote[] = [{ id: "v1", sessionId: "s1", optionId: "o1", voterName: "Al", type: "up", createdAt: "" }];
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
    expect(onCast).toHaveBeenCalledWith("o1", "up");
  });

  it("shows the winner and hides vote buttons when closed", () => {
    const closed: VoteSession = { ...session, status: "closed", winnerOptionId: "o2" };
    render(<VoteRoom sessionId="s1" initialSession={closed} options={options} initialVotes={[]}
      voterName="Bo" onCast={vi.fn()} onClose={vi.fn()} subscribe={stubSubscribe} canClose={true} />);
    expect(screen.getByText(/winner/i)).toHaveTextContent("Pizza");
    expect(screen.queryByRole("button", { name: /upvote sushi/i })).not.toBeInTheDocument();
  });

  it("does not render the close button when canClose is false", () => {
    render(<VoteRoom sessionId="s1" initialSession={session} options={options} initialVotes={[]}
      voterName="Bo" onCast={vi.fn()} onClose={vi.fn()} subscribe={stubSubscribe} canClose={false} />);
    expect(screen.queryByRole("button", { name: /close voting/i })).toBeNull();
  });
});
