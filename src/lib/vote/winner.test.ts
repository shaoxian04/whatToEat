import { describe, it, expect } from "vitest";
import { computeWinner, tallyVotes } from "@/lib/vote/winner";
import type { VoteOption, Vote } from "@/lib/vote/types";

function opt(id: string): VoteOption {
  return { id, sessionId: "s", placeId: null, name: id, snapshot: null };
}
function vote(optionId: string, voterName: string, type: "up" | "veto" = "up"): Vote {
  return { id: `${optionId}-${voterName}`, sessionId: "s", optionId, voterName, type, createdAt: "" };
}

describe("tallyVotes", () => {
  it("counts up and veto per option", () => {
    const t = tallyVotes([opt("a"), opt("b")], [vote("a", "x"), vote("a", "y"), vote("b", "z", "veto")]);
    expect(t).toEqual({ a: { up: 2, veto: 0 }, b: { up: 0, veto: 1 } });
  });
});

describe("computeWinner", () => {
  it("returns null when there are no options", () => {
    expect(computeWinner([], [])).toBeNull();
  });
  it("picks the option with the most upvotes", () => {
    expect(computeWinner([opt("a"), opt("b")], [vote("a", "x"), vote("a", "y"), vote("b", "z")])).toBe("a");
  });
  it("eliminates any option with a veto", () => {
    // a has 2 up but 1 veto -> eliminated; b wins with 1 up
    const votes = [vote("a", "x"), vote("a", "y"), vote("a", "z", "veto"), vote("b", "w")];
    expect(computeWinner([opt("a"), opt("b")], votes)).toBe("b");
  });
  it("returns null when every option is vetoed", () => {
    expect(computeWinner([opt("a")], [vote("a", "x", "veto")])).toBeNull();
  });
  it("breaks ties deterministically via rng among leaders", () => {
    const votes = [vote("a", "x"), vote("b", "y")]; // tie at 1 up each
    expect(computeWinner([opt("a"), opt("b")], votes, () => 0)).toBe("a");
    expect(computeWinner([opt("a"), opt("b")], votes, () => 0.99)).toBe("b");
  });
});
