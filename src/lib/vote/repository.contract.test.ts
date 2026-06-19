import { describe, it, expect } from "vitest";
import { createInMemoryVoteRepository } from "@/lib/vote/repository";

describe("VoteRepository contract (in-memory)", () => {
  it("creates a session with options and reads it back", async () => {
    const repo = createInMemoryVoteRepository();
    const { sessionId, hostToken } = await repo.createSession({
      hostName: "Sam",
      options: [{ name: "Sushi" }, { name: "Pizza" }],
    });
    expect(typeof hostToken).toBe("string");
    expect(hostToken.length).toBeGreaterThan(0);
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

  it("closes a session with the correct host token, sets a winner, and rejects votes afterward", async () => {
    const repo = createInMemoryVoteRepository();
    const { sessionId, hostToken } = await repo.createSession({ hostName: "Sam", options: [{ name: "Sushi" }, { name: "Pizza" }] });
    const opts = (await repo.getSession(sessionId))!.options;
    const sushi = opts.find((o) => o.name === "Sushi")!.id;
    await repo.castVote(sessionId, { optionId: sushi, voterName: "Al", type: "up" });
    const closed = await repo.closeSession(sessionId, hostToken);
    expect(closed).toEqual({ winnerId: sushi });
    expect(await repo.castVote(sessionId, { optionId: sushi, voterName: "Bo", type: "up" })).toEqual({ ok: false, reason: "closed" });
  });

  it("rejects closeSession with the wrong host token (forbidden)", async () => {
    const repo = createInMemoryVoteRepository();
    const { sessionId } = await repo.createSession({ hostName: "Sam", options: [{ name: "Sushi" }, { name: "Pizza" }] });
    const result = await repo.closeSession(sessionId, "wrong-token");
    expect(result).toEqual({ error: "forbidden" });
  });

  it("rejects closeSession on an unknown session (not_found)", async () => {
    const repo = createInMemoryVoteRepository();
    const result = await repo.closeSession("no-such-id", "any-token");
    expect(result).toEqual({ error: "not_found" });
  });

  it("rejects re-close with the correct token (already_closed)", async () => {
    const repo = createInMemoryVoteRepository();
    const { sessionId, hostToken } = await repo.createSession({ hostName: "Sam", options: [{ name: "Sushi" }, { name: "Pizza" }] });
    await repo.closeSession(sessionId, hostToken);
    const result = await repo.closeSession(sessionId, hostToken);
    expect(result).toEqual({ error: "already_closed" });
  });
});
