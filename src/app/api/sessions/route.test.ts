import { describe, it, expect, beforeEach } from "vitest";
import { POST, __setRepositoryForTests } from "@/app/api/sessions/route";
import { createInMemoryVoteRepository } from "@/lib/vote/repository";

function req(body: unknown, ip = "1.2.3.4"): Request {
  return new Request("http://localhost/api/sessions", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

beforeEach(() => { __setRepositoryForTests(createInMemoryVoteRepository()); });

describe("POST /api/sessions", () => {
  it("creates a session and returns 201 with a sessionId", async () => {
    const res = await POST(req({ hostName: "Sam", options: [{ name: "Sushi" }, { name: "Pizza" }] }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(typeof json.sessionId).toBe("string");
  });
  it("rejects an empty host name", async () => {
    const res = await POST(req({ hostName: "", options: [{ name: "Sushi" }] }, "2.2.2.2"));
    expect(res.status).toBe(400);
  });
  it("rejects fewer than 2 options", async () => {
    const res = await POST(req({ hostName: "Sam", options: [{ name: "Sushi" }] }, "3.3.3.3"));
    expect(res.status).toBe(400);
  });
  it("rejects an option with a blank name", async () => {
    const res = await POST(req({ hostName: "Sam", options: [{ name: "Sushi" }, { name: "  " }] }, "4.4.4.4"));
    expect(res.status).toBe(400);
  });
});
