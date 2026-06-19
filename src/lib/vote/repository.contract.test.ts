import { describe, it, expect } from "vitest";
import { createInMemoryVoteRepository } from "@/lib/vote/repository";

describe("VoteRepository contract (in-memory)", () => {
  it("creates a session with options and reads it back", async () => {
    const repo = createInMemoryVoteRepository();
    const { sessionId } = await repo.createSession({
      hostName: "Sam",
      options: [{ name: "Sushi" }, { name: "Pizza" }],
    });
    const state = await repo.getSession(sessionId);
    expect(state?.session.status).toBe("open");
    expect(state?.options.map((o) => o.name).sort()).toEqual(["Pizza", "Sushi"]);
    expect(state?.votes).toEqual([]);
  });

  it("casts a vote and rejects a duplicate from the same voter+option", async () => {
    const repo = createInMemoryVoteRepository();
    const { sessionId } = await repo.createSession({ hostName: "Sam", options: [{ name: "Sushi" }] });
    const optId = (await repo.getSession(sessionId))!.options[0].id;
    expect(await repo.castVote(sessionId, { optionId: optId, voterName: "Al", type: "up" })).toEqual({ ok: true });
    expect(await repo.castVote(sessionId, { optionId: optId, voterName: "Al", type: "up" })).toEqual({ ok: false, reason: "duplicate" });
  });

  it("closes a session, sets a winner, and rejects votes afterward", async () => {
    const repo = createInMemoryVoteRepository();
    const { sessionId } = await repo.createSession({ hostName: "Sam", options: [{ name: "Sushi" }, { name: "Pizza" }] });
    const opts = (await repo.getSession(sessionId))!.options;
    const sushi = opts.find((o) => o.name === "Sushi")!.id;
    await repo.castVote(sessionId, { optionId: sushi, voterName: "Al", type: "up" });
    const closed = await repo.closeSession(sessionId);
    expect(closed).toEqual({ winnerId: sushi });
    expect(await repo.castVote(sessionId, { optionId: sushi, voterName: "Bo", type: "up" })).toEqual({ ok: false, reason: "closed" });
  });
});
