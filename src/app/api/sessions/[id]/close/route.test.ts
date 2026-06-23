import { describe, it, expect, beforeEach } from "vitest";
import { POST, __setRepositoryForTests } from "@/app/api/sessions/[id]/close/route";
import { createInMemoryVoteRepository } from "@/lib/vote/repository";
import type { VoteRepository } from "@/lib/vote/repository";

let repo: VoteRepository;
let sessionId: string;
let hostToken: string;
beforeEach(async () => {
  repo = createInMemoryVoteRepository();
  __setRepositoryForTests(repo);
  ({ sessionId, hostToken } = await repo.createSession({ hostName: "Sam", options: [{ name: "A" }, { name: "B" }] }));
});
function ctx(id: string) { return { params: Promise.resolve({ id }) }; }
function post(token?: string) {
  return new Request("http://localhost", {
    method: "POST",
    headers: token ? { "x-host-token": token } : {},
  });
}

describe("POST /api/sessions/[id]/close", () => {
  it("closes the session and returns a winnerId field (200) with correct token", async () => {
    const optionId = (await repo.getSession(sessionId))!.options[0].id;
    await repo.castVote(sessionId, { voterName: "Al", optionId });
    const res = await POST(post(hostToken), ctx(sessionId));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("winnerId");
  });

  it("403s when no x-host-token header is provided", async () => {
    const res = await POST(post(), ctx(sessionId));
    expect(res.status).toBe(403);
  });

  it("403s when the wrong x-host-token is provided", async () => {
    const res = await POST(post("wrong-token"), ctx(sessionId));
    expect(res.status).toBe(403);
  });

  it("404s for an unknown session", async () => {
    const res = await POST(post("any-token"), ctx("no-such-id"));
    expect(res.status).toBe(404);
  });

  it("409s when already closed (with correct token)", async () => {
    await POST(post(hostToken), ctx(sessionId));
    const res = await POST(post(hostToken), ctx(sessionId));
    expect(res.status).toBe(409);
  });
});
