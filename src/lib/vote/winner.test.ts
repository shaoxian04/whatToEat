import { describe, it, expect } from "vitest";
import { computeWinner, tallyVotes } from "@/lib/vote/winner";
import type { VoteOption, Vote } from "@/lib/vote/types";

function opt(id: string): VoteOption {
  return { id, sessionId: "s", placeId: null, name: id, snapshot: null };
}
function vote(optionId: string, voterName: string): Vote {
  return { id: `${optionId}-${voterName}`, sessionId: "s", optionId, voterName, createdAt: "" };
}

describe("tallyVotes", () => {
  it("counts upvotes per option", () => {
    const t = tallyVotes([opt("a"), opt("b")], [vote("a", "x"), vote("a", "y"), vote("b", "z")]);
    expect(t).toEqual({ a: { up: 2 }, b: { up: 1 } });
  });
});

describe("computeWinner", () => {
  it("returns null when there are no options", () => {
    expect(computeWinner([], [])).toBeNull();
  });
  it("picks the option with the most upvotes", () => {
    expect(computeWinner([opt("a"), opt("b")], [vote("a", "x"), vote("a", "y"), vote("b", "z")])).toBe("a");
  });
  it("lets one voter upvote multiple options", () => {
    // Al upvotes a and b; Bo upvotes a -> a wins with 2
    const votes = [vote("a", "Al"), vote("b", "Al"), vote("a", "Bo")];
    expect(computeWinner([opt("a"), opt("b")], votes)).toBe("a");
  });
  it("breaks ties via rng among leaders", () => {
    const votes = [vote("a", "x"), vote("b", "y")]; // tie at 1 up each
    expect(computeWinner([opt("a"), opt("b")], votes, () => 0)).toBe("a");
    expect(computeWinner([opt("a"), opt("b")], votes, () => 0.99)).toBe("b");
  });
});
