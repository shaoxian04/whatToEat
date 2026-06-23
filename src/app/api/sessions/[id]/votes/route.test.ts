import { describe, it, expect, beforeEach } from "vitest";
import { POST, __setRepositoryForTests } from "@/app/api/sessions/[id]/votes/route";
import { createInMemoryVoteRepository } from "@/lib/vote/repository";
import type { VoteRepository } from "@/lib/vote/repository";

let repo: VoteRepository;
let sessionId: string;
let optionId: string;
beforeEach(async () => {
  repo = createInMemoryVoteRepository();
  __setRepositoryForTests(repo);
  ({ sessionId } = await repo.createSession({ hostName: "Sam", options: [{ name: "A" }, { name: "B" }] }));
  optionId = (await repo.getSession(sessionId))!.options[0].id;
});
function ctx(id: string) { return { params: Promise.resolve({ id }) }; }
function body(b: unknown) {
  return new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
}

describe("POST /api/sessions/[id]/votes", () => {
  it("records a valid upvote (200)", async () => {
    const res = await POST(body({ voterName: "Al", optionId }), ctx(sessionId));
    expect(res.status).toBe(200);
  });
  it("rejects a duplicate vote with 409", async () => {
    await POST(body({ voterName: "Al", optionId }), ctx(sessionId));
    const res = await POST(body({ voterName: "Al", optionId }), ctx(sessionId));
    expect(res.status).toBe(409);
  });
  it("rejects a missing optionId with 400", async () => {
    const res = await POST(body({ voterName: "Al" }), ctx(sessionId));
    expect(res.status).toBe(400);
  });
  it("404s for an unknown session", async () => {
    const res = await POST(body({ voterName: "Al", optionId }), ctx("nope"));
    expect(res.status).toBe(404);
  });
  it("rejects a voterName longer than 80 characters with 400", async () => {
    const res = await POST(body({ voterName: "a".repeat(81), optionId }), ctx(sessionId));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("voterName is too long.");
  });
});
