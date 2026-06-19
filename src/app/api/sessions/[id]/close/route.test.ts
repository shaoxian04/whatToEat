import { describe, it, expect, beforeEach } from "vitest";
import { POST, __setRepositoryForTests } from "@/app/api/sessions/[id]/close/route";
import { createInMemoryVoteRepository } from "@/lib/vote/repository";
import type { VoteRepository } from "@/lib/vote/repository";

let repo: VoteRepository;
let sessionId: string;
beforeEach(async () => {
  repo = createInMemoryVoteRepository();
  __setRepositoryForTests(repo);
  ({ sessionId } = await repo.createSession({ hostName: "Sam", options: [{ name: "A" }, { name: "B" }] }));
});
function ctx(id: string) { return { params: Promise.resolve({ id }) }; }
function post() { return new Request("http://localhost", { method: "POST" }); }

describe("POST /api/sessions/[id]/close", () => {
  it("closes the session and returns a winnerId field (200)", async () => {
    const optionId = (await repo.getSession(sessionId))!.options[0].id;
    await repo.castVote(sessionId, { voterName: "Al", optionId, type: "up" });
    const res = await POST(post(), ctx(sessionId));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("winnerId");
  });
  it("404s for an unknown session", async () => {
    const res = await POST(post(), ctx("nope"));
    expect(res.status).toBe(404);
  });
  it("409s when already closed", async () => {
    await POST(post(), ctx(sessionId));
    const res = await POST(post(), ctx(sessionId));
    expect(res.status).toBe(409);
  });
});
