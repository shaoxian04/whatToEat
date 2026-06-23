# Remove Veto from Group Voting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make group voting upvote-only — remove the 🚫 Veto button and all veto logic, so the winner is simply the option with the most upvotes.

**Architecture:** One cohesive change. `Vote.type` and the `veto` half of `Tally` are removed, which ripples through the pure winner logic, the repository + Supabase mapping, the realtime hook, the votes API, and the vote-room UI. Because the type removal is cross-cutting, it is a single task so every commit stays compiling (`tsc`) and green. No DB migration — the `votes.type` column stays `NOT NULL` and is hardcoded to `'up'`.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Vitest + @testing-library/react · Playwright.

## Global Constraints

- **No DB migration.** `votes.type` stays; the Supabase insert hardcodes it to `'up'` (the existing `check (type in ('up','veto'))` permits `'up'`).
- **Voting model:** upvote-only; a voter may upvote multiple options (the existing `(session_id, option_id, voter_name)` unique constraint still blocks double-upvoting the *same* option).
- **Winner:** most upvotes; ties broken at random among leaders; `null` only when there are no options.
- **Preserve** the `👍 Up` button's `aria-label="Upvote {name}"` and the `data-testid="up-${id}"` tally, host-only close, realtime, share-invite, and the Browse→vote handoff. Remove only veto-specific code/strings.
- **Host-only close is already implemented — do not change it.**
- `Tally` becomes `{ [optionId]: { up: number } }` (drop the `veto` field; keep the `{ up }` object so existing `tally[o.id]?.up` reads are untouched).
- Conventional Commits, no attribution trailers; pristine test output.
- Test commands: full suite `npm test`; type-check `npx tsc --noEmit`; build `npm run build`; single file `npx vitest run <path>`.

---

### Task 1: Remove veto end-to-end

**Files:**
- Modify: `src/lib/vote/types.ts` (remove `Vote.type`; `Tally` drops `veto`)
- Modify: `src/lib/vote/winner.ts` (upvote-only tally + winner)
- Modify: `src/lib/vote/winner.test.ts` (rewrite for upvote-only)
- Modify: `src/lib/vote/repository.ts` (`CastVoteInput` drops `type`; in-memory `castVote`)
- Modify: `src/lib/vote/repository.contract.test.ts` (drop `type` from `castVote` calls)
- Modify: `src/lib/vote/supabase-repository.ts` (`mapVote` drops `type`; `castVote` inserts `type:'up'`)
- Modify: `src/hooks/useSessionVotes.ts` (`mapVoteRow` drops `type`)
- Modify: `src/app/api/sessions/[id]/votes/route.ts` (request needs only `voterName`+`optionId`)
- Modify: `src/app/api/sessions/[id]/votes/route.test.ts` (rewrite — no `type`)
- Modify: `src/app/api/sessions/[id]/close/route.test.ts` (drop `type` from a `castVote` call)
- Modify: `src/components/VoteRoom.tsx` (remove veto button + veto tally; `onCast(optionId)`)
- Modify: `src/components/VoteRoom.test.tsx` (no veto button; `onCast("o1")`; drop `type` from fixtures)
- Modify: `src/app/vote/[id]/page.tsx` (`onCast(optionId)` posts `{voterName, optionId}`)

**Interfaces (after this task):**
- `interface Vote { id; sessionId; optionId; voterName; createdAt }` — **no `type`**
- `interface Tally { [optionId: string]: { up: number } }`
- `interface CastVoteInput { optionId: string; voterName: string }`
- `tallyVotes(options, votes): Tally` · `computeWinner(options, votes, rng?): string | null`
- `VoteRoom` prop `onCast: (optionId: string) => Promise<void>`

- [ ] **Step 1: Rewrite the winner test (RED)**

Replace the entire contents of `src/lib/vote/winner.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the winner test to see it fail**

Run: `npx vitest run src/lib/vote/winner.test.ts`
Expected: FAIL — `tallyVotes` still returns `{ up, veto }`, so the `toEqual({ a: { up: 2 }, b: { up: 1 } })` assertion fails.

- [ ] **Step 3: Update the shared types**

In `src/lib/vote/types.ts`, remove `type` from `Vote` and drop `veto` from `Tally`:

```ts
export interface Vote {
  id: string;
  sessionId: string;
  optionId: string;
  voterName: string;
  createdAt: string;
}
```

```ts
export interface Tally {
  [optionId: string]: { up: number };
}
```

(Leave `VoteOption`, `VoteSession` unchanged.)

- [ ] **Step 4: Make the winner logic upvote-only**

Replace the entire contents of `src/lib/vote/winner.ts`:

```ts
import type { VoteOption, Vote, Tally } from "@/lib/vote/types";

export function tallyVotes(options: VoteOption[], votes: Vote[]): Tally {
  const tally: Tally = {};
  for (const o of options) tally[o.id] = { up: 0 };
  for (const v of votes) {
    if (!tally[v.optionId]) continue;
    tally[v.optionId].up += 1;
  }
  return tally;
}

export function computeWinner(
  options: VoteOption[],
  votes: Vote[],
  rng: () => number = Math.random,
): string | null {
  if (options.length === 0) return null;
  const tally = tallyVotes(options, votes);
  const max = Math.max(...options.map((o) => tally[o.id].up));
  const leaders = options.filter((o) => tally[o.id].up === max);
  return leaders[Math.floor(rng() * leaders.length)].id;
}
```

- [ ] **Step 5: Run the winner test to see it pass**

Run: `npx vitest run src/lib/vote/winner.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Drop `type` from the repository layer**

In `src/lib/vote/repository.ts`, change `CastVoteInput`:

```ts
export interface CastVoteInput {
  optionId: string;
  voterName: string;
}
```

In the same file, in `createInMemoryVoteRepository().castVote`, remove `type` from the pushed vote. The push becomes:

```ts
      existing.push({
        id: nextId(), sessionId, optionId: input.optionId,
        voterName: input.voterName, createdAt: "",
      });
```

- [ ] **Step 7: Drop `type` from the contract test's castVote calls**

In `src/lib/vote/repository.contract.test.ts`, remove `, type: "up"` from the three `castVote` calls so they read:

```ts
    expect(await repo.castVote(sessionId, { optionId: optId, voterName: "Al" })).toEqual({ ok: true });
    expect(await repo.castVote(sessionId, { optionId: optId, voterName: "Al" })).toEqual({ ok: false, reason: "duplicate" });
```

and (in the close test):

```ts
    await repo.castVote(sessionId, { optionId: sushi, voterName: "Al" });
```

and:

```ts
    expect(await repo.castVote(sessionId, { optionId: sushi, voterName: "Bo" })).toEqual({ ok: false, reason: "closed" });
```

- [ ] **Step 8: Update the Supabase repository**

In `src/lib/vote/supabase-repository.ts`, change `mapVote` to drop `type`:

```ts
function mapVote(r: Record<string, unknown>): Vote {
  return {
    id: r.id as string, sessionId: r.session_id as string, optionId: r.option_id as string,
    voterName: r.voter_name as string, createdAt: r.created_at as string,
  };
}
```

and in `castVote`, hardcode the insert's `type` to `"up"`:

```ts
      const { error } = await client.from("votes").insert({
        session_id: sessionId, option_id: input.optionId, voter_name: input.voterName, type: "up",
      });
```

- [ ] **Step 9: Update the realtime hook**

In `src/hooks/useSessionVotes.ts`, change `mapVoteRow` to drop `type`:

```ts
function mapVoteRow(r: Record<string, unknown>): Vote {
  return {
    id: r.id as string, sessionId: r.session_id as string, optionId: r.option_id as string,
    voterName: r.voter_name as string, createdAt: (r.created_at as string) ?? "",
  };
}
```

- [ ] **Step 10: Rewrite the votes-route test (RED for the API change)**

Replace the entire contents of `src/app/api/sessions/[id]/votes/route.test.ts`:

```ts
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
```

- [ ] **Step 11: Run the votes-route test to see it fail**

Run: `npx vitest run "src/app/api/sessions/[id]/votes/route.test.ts"`
Expected: FAIL — the route still requires `type`, so `{ voterName: "Al", optionId }` (no `type`) returns 400 and the "records a valid upvote (200)" test fails.

- [ ] **Step 12: Update the votes route**

In `src/app/api/sessions/[id]/votes/route.ts`, replace the body block (the `let body...` through the `castVote` call) with:

```ts
  const { id } = await ctx.params;
  let body: { voterName?: unknown; optionId?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const voterName = typeof body.voterName === "string" ? body.voterName.trim() : "";
  const optionId = typeof body.optionId === "string" ? body.optionId : "";

  if (!voterName || !optionId) {
    return NextResponse.json({ error: "voterName and optionId are required." }, { status: 400 });
  }
  if (voterName.length > 80) {
    return NextResponse.json({ error: "voterName is too long." }, { status: 400 });
  }

  try {
    const result = await getRepository().castVote(id, { voterName, optionId });
    if (result.ok) return NextResponse.json({ ok: true });
    const status = result.reason === "not_found" ? 404
      : result.reason === "bad_option" ? 400
      : 409; // duplicate | closed
    return NextResponse.json({ error: result.reason }, { status });
  } catch {
    return NextResponse.json({ error: "Could not record your vote." }, { status: 500 });
  }
```

- [ ] **Step 13: Run the votes-route test to see it pass**

Run: `npx vitest run "src/app/api/sessions/[id]/votes/route.test.ts"`
Expected: PASS (5 tests).

- [ ] **Step 14: Drop `type` from the close-route test's castVote**

In `src/app/api/sessions/[id]/close/route.test.ts`, change the one `castVote` call (in the "closes the session…" test) to drop `type`:

```ts
    await repo.castVote(sessionId, { voterName: "Al", optionId });
```

- [ ] **Step 15: Update the VoteRoom test (RED for the UI change)**

In `src/components/VoteRoom.test.tsx`:

(a) In the `options` fixture and any `votes` arrays, remove the `type: "up"` / `type: "veto"` fields (the `Vote` type no longer has `type`). For example the votes array in the up-tally test becomes:

```ts
    const votes: Vote[] = [{ id: "v1", sessionId: "s1", optionId: "o1", voterName: "Al", createdAt: "" }];
```

(b) Change the upvote-click assertion to the single-arg signature:

```ts
    await userEvent.click(screen.getByRole("button", { name: /upvote sushi/i }));
    expect(onCast).toHaveBeenCalledWith("o1");
```

(c) Add a test asserting the veto button is gone (place it after the upvote-click test):

```ts
  it("no longer renders a veto button", () => {
    render(<VoteRoom sessionId="s1" initialSession={session} options={options} initialVotes={[]}
      voterName="Bo" onCast={vi.fn()} onClose={vi.fn()} subscribe={stubSubscribe} canClose={true} />);
    expect(screen.queryByRole("button", { name: /veto/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /upvote sushi/i })).toBeInTheDocument();
  });
```

- [ ] **Step 16: Run the VoteRoom test to see it fail**

Run: `npx vitest run src/components/VoteRoom.test.tsx`
Expected: FAIL — the veto button still renders (so the new test fails) and `onCast` is still called with `("o1", "up")` (so the updated assertion fails).

- [ ] **Step 17: Remove veto from VoteRoom**

In `src/components/VoteRoom.tsx`:

(a) Change the `onCast` prop type (the `interface Props`):

```ts
  onCast: (optionId: string) => Promise<void>;
```

(b) Change the closed-winner banner text (drop the veto wording):

```tsx
      {closed && (
        <p className="tile bg-herb/15 p-4 font-display text-lg font-bold text-herb-ink">
          🏆 Winner: {winner ? winner.name : "No winner yet"}
        </p>
      )}
```

(c) Remove the veto tally span — the tally row becomes:

```tsx
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-display text-lg font-bold">{o.name}</span>
              <span className="flex shrink-0 items-center gap-2 font-mono text-sm font-semibold">
                <span data-testid={`up-${o.id}`}>👍 {tally[o.id]?.up ?? 0}</span>
              </span>
            </div>
```

(d) Replace the two-button `{!closed && (...)}` block with a single full-width upvote button:

```tsx
            {!closed && (
              <button
                onClick={() => onCast(o.id)}
                aria-label={`Upvote ${o.name}`}
                className="tile-sm tile-press mt-3 w-full bg-herb/15 py-2 text-sm font-bold text-herb-ink"
              >
                👍 Up
              </button>
            )}
```

(Leave the snapshot-detail IIFE between the tally row and the button unchanged.)

- [ ] **Step 18: Update the vote-room page's onCast**

In `src/app/vote/[id]/page.tsx`, change `onCast` to drop `type`:

```tsx
  const onCast = useCallback(
    async (optionId: string) => {
      await fetch(`/api/sessions/${sessionId}/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterName, optionId }),
      });
    },
    [sessionId, voterName],
  );
```

- [ ] **Step 19: Run the VoteRoom test to see it pass**

Run: `npx vitest run src/components/VoteRoom.test.tsx`
Expected: PASS (original tests + the new "no veto button" test).

- [ ] **Step 20: Full suite + type-check + build (all green)**

Run: `npm test`
Expected: all tests pass (count drops slightly vs. before — veto cases removed, one veto-button test added).

Run: `npx tsc --noEmit`
Expected: no output (no type errors — every `Vote.type` / `Tally.veto` / `CastVoteInput.type` reference is gone).

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 21: Commit**

```bash
git add src/lib/vote/types.ts src/lib/vote/winner.ts src/lib/vote/winner.test.ts \
  src/lib/vote/repository.ts src/lib/vote/repository.contract.test.ts \
  src/lib/vote/supabase-repository.ts src/hooks/useSessionVotes.ts \
  "src/app/api/sessions/[id]/votes/route.ts" "src/app/api/sessions/[id]/votes/route.test.ts" \
  "src/app/api/sessions/[id]/close/route.test.ts" \
  src/components/VoteRoom.tsx src/components/VoteRoom.test.tsx "src/app/vote/[id]/page.tsx"
git commit -m "feat: remove veto from group voting; winner is most upvotes"
```

---

## Self-Review

**1. Spec coverage**

| Spec item | Step |
|-----------|------|
| Each option shows only 👍 Up | Step 17(d) |
| Remove veto button + veto tally | Step 17(c),(d) |
| Voter can upvote multiple options | preserved by unique constraint; covered by winner test Step 1 |
| Winner = most upvotes, random tie-break, null only if no options | Step 4 + tests Step 1 |
| `Vote.type` removed; `Tally` drops veto → `{up}` | Step 3 |
| `CastVoteInput` drops `type`; in-memory + Supabase | Steps 6, 8 |
| Supabase insert hardcodes `type:'up'`; no migration | Step 8 |
| Votes API needs only `voterName`+`optionId` | Step 12 |
| Realtime hook drops `type` | Step 9 |
| Page `onCast(optionId)` posts `{voterName, optionId}` | Step 18 |
| Host-only close unchanged | not touched (close route + canClose untouched) |
| Preserve `up-` testid + `Upvote` aria-label | Step 17(c),(d) |

No gaps.

**2. Placeholder scan:** No TBD/TODO/vague steps — every code step shows complete code or an exact old→new edit. ✅

**3. Type consistency:**
- `Vote` (no `type`) used consistently in winner, repository, supabase-repository, useSessionVotes, and all test fixtures (Steps 3,6,7,8,9,14,15). ✅
- `Tally = { [id]: { up: number } }` — produced by `tallyVotes` (Step 4), read by `VoteRoom` via `tally[o.id]?.up` (unchanged, Step 17c). ✅
- `CastVoteInput = { optionId, voterName }` — used by route (Step 12), in-memory + Supabase `castVote` (Steps 6,8), and all `castVote` test calls (Steps 7,14). ✅
- `onCast: (optionId: string) => Promise<void>` — VoteRoom prop (Step 17a), its call sites (Step 17d), the page impl (Step 18), and the test assertion `toHaveBeenCalledWith("o1")` (Step 15b). ✅

No inconsistencies.
