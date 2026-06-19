import { describe, it, expect, beforeEach } from "vitest";
import { GET, __setRepositoryForTests } from "@/app/api/sessions/[id]/route";
import { createInMemoryVoteRepository } from "@/lib/vote/repository";
import type { VoteRepository } from "@/lib/vote/repository";

let repo: VoteRepository;
beforeEach(() => { repo = createInMemoryVoteRepository(); __setRepositoryForTests(repo); });

function ctx(id: string) { return { params: Promise.resolve({ id }) }; }

describe("GET /api/sessions/[id]", () => {
  it("returns the session state for a real id", async () => {
    const { sessionId } = await repo.createSession({ hostName: "Sam", options: [{ name: "A" }, { name: "B" }] });
    const res = await GET(new Request("http://localhost"), ctx(sessionId));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.session.hostName).toBe("Sam");
    expect(json.options).toHaveLength(2);
  });
  it("returns 404 for an unknown id", async () => {
    const res = await GET(new Request("http://localhost"), ctx("nope"));
    expect(res.status).toBe(404);
  });
});
