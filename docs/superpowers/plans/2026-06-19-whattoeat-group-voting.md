# whatToEat — Plan 2: Group Voting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. For any task touching Supabase, ALSO invoke the `supabase:supabase` skill to confirm current `@supabase/supabase-js` v2 API specifics before writing client/query code.

**Goal:** Let colleagues vote on where to eat in real time — create a vote, share a link, everyone upvotes/vetoes from their phone, watch a live tally, and lock in a winner.

**Architecture:** Supabase (Postgres + Realtime) backs the data. All **writes** go through Next.js API routes using a **service-role** Supabase client that enforces business rules; the data layer sits behind a `VoteRepository` interface so routes are unit-tested against a fake repo. Browsers use the **public anon key** ONLY for reads + a Realtime subscription on the `votes`/`sessions` tables (select-only RLS). Winner calculation is a pure, unit-tested function. Scope is the voting core + the Quick-vote entry; the "Vote with team" handoffs from Surprise/Browse are a future Plan 3.

**Tech Stack:** Next.js 16 (App Router, TS), Tailwind v4, `@supabase/supabase-js` v2, Vitest + React Testing Library, Playwright. Supabase project (hosted).

## Global Constraints

- `SUPABASE_SERVICE_ROLE_KEY` is **server-only** — used solely in `src/lib/supabase/server.ts` and API routes, NEVER `NEXT_PUBLIC_*`, never shipped to the client, never logged.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are public (browser read/realtime only).
- **Anonymous users get SELECT only** (enforced by RLS). All INSERT/UPDATE/DELETE happen server-side via the service-role client after business-rule validation. No anon write policies exist.
- Threat model (accepted for v1): vote data is low-sensitivity; access is gated by unguessable session UUIDs; broad anon SELECT is acceptable. A stricter per-session-token model is a documented future option, not built here.
- TypeScript everywhere; no `any` in committed code. Reuse existing patterns: the `{ error }` envelope + status codes from `/api/nearby`, the per-IP `createRateLimiter`, mobile-first `max-w-md` layout, immutable updates, injectable `rng` for randomness.
- One vote per `(session_id, option_id, voter_name)` — enforced by a DB unique constraint AND a friendly server-side 409.
- Commit messages follow `<type>: <desc>`; no attribution trailer.

## Security Model (read before Task 4+)

```
Browser (anon key)                    Server API routes (service-role key)
  • GET initial state  ─────────────►   • POST /api/sessions        (create)
  • Realtime subscribe (votes,           • POST /api/sessions/[id]/votes (cast)
    sessions) — SELECT only              • POST /api/sessions/[id]/close (winner)
  • NEVER writes directly                • GET  /api/sessions/[id]    (read passthrough)
                                         enforce: session open? dup vote? valid option?
RLS: anon = SELECT on sessions/options/votes (using true). No anon write policies.
     service-role bypasses RLS. Session UUID is the bearer secret.
```

## Provisioning Prerequisite (controller + user, via the Supabase skill/MCP)

Tasks 1–2 produce version-controlled code + SQL. Applying them to a live project is a manual step done with the `supabase:supabase` skill / Supabase MCP (it needs the user's Supabase account): create a project, copy `URL` / `anon key` / `service_role key` into `.env.local`, run the migration, and confirm Realtime is enabled on `votes` + `sessions`. The code/tests in this plan do NOT require a live project except the final integration smoke (Task 13).

## File Structure

| File | Responsibility |
|------|----------------|
| `src/lib/supabase/server.ts` | service-role client factory (server-only) |
| `src/lib/supabase/browser.ts` | anon client factory (browser read/realtime) |
| `supabase/migrations/0001_group_voting.sql` | tables, indexes, RLS, realtime publication |
| `src/lib/vote/types.ts` | `VoteSession`, `VoteOption`, `Vote`, tally types |
| `src/lib/vote/winner.ts` | pure `computeWinner` |
| `src/lib/vote/repository.ts` | `VoteRepository` interface + input types |
| `src/lib/vote/supabase-repository.ts` | Supabase-backed `VoteRepository` impl |
| `src/app/api/sessions/route.ts` | `POST` create session |
| `src/app/api/sessions/[id]/route.ts` | `GET` session state |
| `src/app/api/sessions/[id]/votes/route.ts` | `POST` cast vote |
| `src/app/api/sessions/[id]/close/route.ts` | `POST` close + winner |
| `src/hooks/useSessionVotes.ts` | realtime subscription hook |
| `src/components/VoteRoom.tsx` | live vote screen |
| `src/app/vote/page.tsx` | Quick-vote entry (create) |
| `src/app/vote/[id]/page.tsx` | vote room page wiring |

---

### Task 1: Supabase client factories + env

**Files:**
- Create: `src/lib/supabase/server.ts`, `src/lib/supabase/browser.ts`
- Modify: `.env.local.example`
- Test: `src/lib/supabase/clients.test.ts`

**Interfaces:**
- Produces:
  - `function createServiceClient(): SupabaseClient` (reads `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`; throws if missing)
  - `function createBrowserSupabase(): SupabaseClient` (reads `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`; throws if missing)

- [ ] **Step 1: Install supabase-js**

Run: `npm install @supabase/supabase-js`

- [ ] **Step 2: Add env keys to `.env.local.example`**

Append:
```bash
# Supabase — URL + anon key are public; service role key is SERVER-ONLY (never NEXT_PUBLIC_)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

- [ ] **Step 3: Write the failing test** — `src/lib/supabase/clients.test.ts`

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServiceClient } from "@/lib/supabase/server";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const OLD = { ...process.env };
beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
});
afterEach(() => { process.env = { ...OLD }; });

describe("supabase client factories", () => {
  it("createServiceClient builds a client when env is present", () => {
    expect(createServiceClient()).toBeTruthy();
  });
  it("createServiceClient throws when the service key is missing", () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => createServiceClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
  it("createBrowserSupabase throws when the anon key is missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(() => createBrowserSupabase()).toThrow(/ANON/);
  });
});
```

- [ ] **Step 4: Run it to verify failure**

Run: `npx vitest run src/lib/supabase/clients.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 5: Implement the server client** — `src/lib/supabase/server.ts`

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}
```

- [ ] **Step 6: Implement the browser client** — `src/lib/supabase/browser.ts`

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createBrowserSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient(url, key);
}
```

- [ ] **Step 7: Run it to verify pass**

Run: `npx vitest run src/lib/supabase/clients.test.ts`
Expected: PASS — 3 passed.

- [ ] **Step 8: Commit**

```bash
git add src/lib/supabase package.json package-lock.json .env.local.example src/lib/supabase/clients.test.ts
git commit -m "feat: add Supabase service-role and anon client factories"
```

---

### Task 2: Database schema + RLS migration

**Files:**
- Create: `supabase/migrations/0001_group_voting.sql`

**Interfaces:**
- Produces the DB contract every later task relies on: tables `sessions`, `session_options`, `votes` with the columns named below.

**Note:** This SQL is applied to the live project during the Provisioning Prerequisite (Supabase skill/MCP). There is no unit test; verification is the Task 13 integration smoke. The reviewer checks the SQL for correctness (RLS select-only for anon, no anon write policies, cascade deletes, the unique constraint, realtime publication).

- [ ] **Step 1: Write the migration** — `supabase/migrations/0001_group_voting.sql`

```sql
-- whatToEat group voting schema
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  host_name text not null,
  status text not null default 'open' check (status in ('open','closed')),
  winner_option_id uuid,
  expires_at timestamptz not null default (now() + interval '1 day'),
  user_id uuid -- nullable: accounts-ready hook, unused in this plan
);

create table if not exists session_options (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  place_id text,            -- nullable: free-text Quick-vote options have none
  name text not null,
  snapshot jsonb
);

create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  option_id uuid not null references session_options(id) on delete cascade,
  voter_name text not null,
  type text not null check (type in ('up','veto')),
  created_at timestamptz not null default now(),
  unique (session_id, option_id, voter_name)
);

create index if not exists idx_options_session on session_options(session_id);
create index if not exists idx_votes_session on votes(session_id);

-- Row Level Security: anonymous users may READ only. No anon write policies exist,
-- so INSERT/UPDATE/DELETE are denied for anon. The service-role key bypasses RLS.
alter table sessions enable row level security;
alter table session_options enable row level security;
alter table votes enable row level security;

create policy "anon read sessions"  on sessions        for select to anon using (true);
create policy "anon read options"   on session_options for select to anon using (true);
create policy "anon read votes"     on votes           for select to anon using (true);

-- Realtime: browsers subscribe to vote inserts and session status changes.
alter publication supabase_realtime add table votes;
alter publication supabase_realtime add table sessions;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0001_group_voting.sql
git commit -m "feat: add group-voting schema with select-only anon RLS"
```

---

### Task 3: Vote domain types + winner logic

**Files:**
- Create: `src/lib/vote/types.ts`, `src/lib/vote/winner.ts`
- Test: `src/lib/vote/winner.test.ts`

**Interfaces:**
- Produces:
  - `interface VoteOption { id: string; sessionId: string; placeId: string | null; name: string; snapshot: unknown }`
  - `interface Vote { id: string; sessionId: string; optionId: string; voterName: string; type: "up" | "veto"; createdAt: string }`
  - `interface VoteSession { id: string; hostName: string; status: "open" | "closed"; winnerOptionId: string | null; expiresAt: string }`
  - `interface Tally { [optionId: string]: { up: number; veto: number } }`
  - `function tallyVotes(options: VoteOption[], votes: Vote[]): Tally`
  - `function computeWinner(options: VoteOption[], votes: Vote[], rng?: () => number): string | null`

- [ ] **Step 1: Write the failing test** — `src/lib/vote/winner.test.ts`

```ts
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
```

- [ ] **Step 2: Run it to verify failure**

Run: `npx vitest run src/lib/vote/winner.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the types** — `src/lib/vote/types.ts`

```ts
export interface VoteOption {
  id: string;
  sessionId: string;
  placeId: string | null;
  name: string;
  snapshot: unknown;
}

export interface Vote {
  id: string;
  sessionId: string;
  optionId: string;
  voterName: string;
  type: "up" | "veto";
  createdAt: string;
}

export interface VoteSession {
  id: string;
  hostName: string;
  status: "open" | "closed";
  winnerOptionId: string | null;
  expiresAt: string;
}

export interface Tally {
  [optionId: string]: { up: number; veto: number };
}
```

- [ ] **Step 4: Implement winner logic** — `src/lib/vote/winner.ts`

```ts
import type { VoteOption, Vote, Tally } from "@/lib/vote/types";

export function tallyVotes(options: VoteOption[], votes: Vote[]): Tally {
  const tally: Tally = {};
  for (const o of options) tally[o.id] = { up: 0, veto: 0 };
  for (const v of votes) {
    if (!tally[v.optionId]) continue;
    if (v.type === "up") tally[v.optionId].up += 1;
    else tally[v.optionId].veto += 1;
  }
  return tally;
}

export function computeWinner(
  options: VoteOption[],
  votes: Vote[],
  rng: () => number = Math.random,
): string | null {
  const tally = tallyVotes(options, votes);
  const eligible = options.filter((o) => tally[o.id].veto === 0);
  if (eligible.length === 0) return null;
  const max = Math.max(...eligible.map((o) => tally[o.id].up));
  const leaders = eligible.filter((o) => tally[o.id].up === max);
  return leaders[Math.floor(rng() * leaders.length)].id;
}
```

- [ ] **Step 5: Run it to verify pass**

Run: `npx vitest run src/lib/vote/winner.test.ts`
Expected: PASS — 6 passed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/vote/types.ts src/lib/vote/winner.ts src/lib/vote/winner.test.ts
git commit -m "feat: add vote types and pure winner computation"
```

---

### Task 4: VoteRepository interface + Supabase implementation

**Files:**
- Create: `src/lib/vote/repository.ts`, `src/lib/vote/supabase-repository.ts`
- Test: `src/lib/vote/repository.contract.test.ts` (tests the interface shape against an in-memory fake — proves the contract the routes depend on)

**Interfaces:**
- Consumes: `VoteSession`, `VoteOption`, `Vote` from `@/lib/vote/types`; `SupabaseClient`.
- Produces:
  - `interface CreateSessionInput { hostName: string; options: { name: string; placeId?: string | null; snapshot?: unknown }[] }`
  - `interface CastVoteInput { optionId: string; voterName: string; type: "up" | "veto" }`
  - `interface SessionState { session: VoteSession; options: VoteOption[]; votes: Vote[] }`
  - `interface VoteRepository {
      createSession(input: CreateSessionInput): Promise<{ sessionId: string }>;
      getSession(sessionId: string): Promise<SessionState | null>;
      castVote(sessionId: string, input: CastVoteInput): Promise<{ ok: true } | { ok: false; reason: "duplicate" | "closed" | "not_found" | "bad_option" }>;
      closeSession(sessionId: string): Promise<{ winnerId: string | null } | { error: "not_found" | "already_closed" }>;
    }`
  - `function createSupabaseVoteRepository(client: SupabaseClient): VoteRepository`
  - `function createInMemoryVoteRepository(): VoteRepository` (test/double helper, exported for route tests + the contract test)

- [ ] **Step 1: Write the failing contract test** — `src/lib/vote/repository.contract.test.ts`

```ts
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
```

- [ ] **Step 2: Run it to verify failure**

Run: `npx vitest run src/lib/vote/repository.contract.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the interface + an in-memory repo** — `src/lib/vote/repository.ts`

```ts
import type { VoteSession, VoteOption, Vote } from "@/lib/vote/types";
import { computeWinner } from "@/lib/vote/winner";

export interface CreateSessionInput {
  hostName: string;
  options: { name: string; placeId?: string | null; snapshot?: unknown }[];
}
export interface CastVoteInput {
  optionId: string;
  voterName: string;
  type: "up" | "veto";
}
export interface SessionState {
  session: VoteSession;
  options: VoteOption[];
  votes: Vote[];
}
export type CastVoteResult =
  | { ok: true }
  | { ok: false; reason: "duplicate" | "closed" | "not_found" | "bad_option" };
export type CloseResult =
  | { winnerId: string | null }
  | { error: "not_found" | "already_closed" };

export interface VoteRepository {
  createSession(input: CreateSessionInput): Promise<{ sessionId: string }>;
  getSession(sessionId: string): Promise<SessionState | null>;
  castVote(sessionId: string, input: CastVoteInput): Promise<CastVoteResult>;
  closeSession(sessionId: string): Promise<CloseResult>;
}

// Deterministic id generator for the in-memory double (tests only — never used in prod).
function makeIdFactory() {
  let n = 0;
  return () => `id-${++n}`;
}

export function createInMemoryVoteRepository(): VoteRepository {
  const nextId = makeIdFactory();
  const sessions = new Map<string, VoteSession>();
  const options = new Map<string, VoteOption[]>();
  const votes = new Map<string, Vote[]>();

  return {
    async createSession(input) {
      const sessionId = nextId();
      sessions.set(sessionId, {
        id: sessionId, hostName: input.hostName, status: "open",
        winnerOptionId: null, expiresAt: "",
      });
      options.set(sessionId, input.options.map((o) => ({
        id: nextId(), sessionId, placeId: o.placeId ?? null, name: o.name, snapshot: o.snapshot ?? null,
      })));
      votes.set(sessionId, []);
      return { sessionId };
    },
    async getSession(sessionId) {
      const session = sessions.get(sessionId);
      if (!session) return null;
      return { session, options: options.get(sessionId) ?? [], votes: votes.get(sessionId) ?? [] };
    },
    async castVote(sessionId, input) {
      const session = sessions.get(sessionId);
      if (!session) return { ok: false, reason: "not_found" };
      if (session.status === "closed") return { ok: false, reason: "closed" };
      const opts = options.get(sessionId) ?? [];
      if (!opts.some((o) => o.id === input.optionId)) return { ok: false, reason: "bad_option" };
      const existing = votes.get(sessionId) ?? [];
      if (existing.some((v) => v.optionId === input.optionId && v.voterName === input.voterName)) {
        return { ok: false, reason: "duplicate" };
      }
      existing.push({
        id: nextId(), sessionId, optionId: input.optionId,
        voterName: input.voterName, type: input.type, createdAt: "",
      });
      votes.set(sessionId, existing);
      return { ok: true };
    },
    async closeSession(sessionId) {
      const session = sessions.get(sessionId);
      if (!session) return { error: "not_found" };
      if (session.status === "closed") return { error: "already_closed" };
      const winnerId = computeWinner(options.get(sessionId) ?? [], votes.get(sessionId) ?? []);
      sessions.set(sessionId, { ...session, status: "closed", winnerOptionId: winnerId });
      return { winnerId };
    },
  };
}
```

- [ ] **Step 4: Run it to verify pass**

Run: `npx vitest run src/lib/vote/repository.contract.test.ts`
Expected: PASS — 3 passed.

- [ ] **Step 5: Implement the Supabase-backed repo** — `src/lib/vote/supabase-repository.ts`

> Verified against the live project in Task 13 (the in-memory repo is the unit-test double the routes use). Confirm `@supabase/supabase-js` v2 query syntax with the `supabase:supabase` skill before writing.

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  VoteRepository, CreateSessionInput, CastVoteInput, SessionState, CastVoteResult, CloseResult,
} from "@/lib/vote/repository";
import type { VoteSession, VoteOption, Vote } from "@/lib/vote/types";
import { computeWinner } from "@/lib/vote/winner";

function mapSession(r: Record<string, unknown>): VoteSession {
  return {
    id: r.id as string, hostName: r.host_name as string,
    status: r.status as "open" | "closed",
    winnerOptionId: (r.winner_option_id as string | null) ?? null,
    expiresAt: r.expires_at as string,
  };
}
function mapOption(r: Record<string, unknown>): VoteOption {
  return {
    id: r.id as string, sessionId: r.session_id as string,
    placeId: (r.place_id as string | null) ?? null, name: r.name as string, snapshot: r.snapshot ?? null,
  };
}
function mapVote(r: Record<string, unknown>): Vote {
  return {
    id: r.id as string, sessionId: r.session_id as string, optionId: r.option_id as string,
    voterName: r.voter_name as string, type: r.type as "up" | "veto", createdAt: r.created_at as string,
  };
}

export function createSupabaseVoteRepository(client: SupabaseClient): VoteRepository {
  return {
    async createSession(input: CreateSessionInput) {
      const { data: session, error } = await client
        .from("sessions").insert({ host_name: input.hostName }).select().single();
      if (error || !session) throw new Error("create session failed");
      const rows = input.options.map((o) => ({
        session_id: session.id, name: o.name, place_id: o.placeId ?? null, snapshot: o.snapshot ?? null,
      }));
      const { error: optErr } = await client.from("session_options").insert(rows);
      if (optErr) throw new Error("create options failed");
      return { sessionId: session.id as string };
    },
    async getSession(sessionId: string): Promise<SessionState | null> {
      const { data: s } = await client.from("sessions").select().eq("id", sessionId).maybeSingle();
      if (!s) return null;
      const { data: opts } = await client.from("session_options").select().eq("session_id", sessionId);
      const { data: vts } = await client.from("votes").select().eq("session_id", sessionId);
      return {
        session: mapSession(s),
        options: (opts ?? []).map(mapOption),
        votes: (vts ?? []).map(mapVote),
      };
    },
    async castVote(sessionId: string, input: CastVoteInput): Promise<CastVoteResult> {
      const { data: s } = await client.from("sessions").select("status").eq("id", sessionId).maybeSingle();
      if (!s) return { ok: false, reason: "not_found" };
      if (s.status === "closed") return { ok: false, reason: "closed" };
      const { data: opt } = await client.from("session_options")
        .select("id").eq("id", input.optionId).eq("session_id", sessionId).maybeSingle();
      if (!opt) return { ok: false, reason: "bad_option" };
      const { error } = await client.from("votes").insert({
        session_id: sessionId, option_id: input.optionId, voter_name: input.voterName, type: input.type,
      });
      if (error) {
        // 23505 = unique_violation -> duplicate vote
        if ((error as { code?: string }).code === "23505") return { ok: false, reason: "duplicate" };
        throw new Error("cast vote failed");
      }
      return { ok: true };
    },
    async closeSession(sessionId: string): Promise<CloseResult> {
      const state = await this.getSession(sessionId);
      if (!state) return { error: "not_found" };
      if (state.session.status === "closed") return { error: "already_closed" };
      const winnerId = computeWinner(state.options, state.votes);
      const { error } = await client.from("sessions")
        .update({ status: "closed", winner_option_id: winnerId }).eq("id", sessionId);
      if (error) throw new Error("close failed");
      return { winnerId };
    },
  };
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/vote/repository.ts src/lib/vote/supabase-repository.ts src/lib/vote/repository.contract.test.ts
git commit -m "feat: add VoteRepository interface with in-memory and Supabase impls"
```

---

### Task 5: POST /api/sessions (create)

**Files:**
- Create: `src/app/api/sessions/route.ts`
- Test: `src/app/api/sessions/route.test.ts`

**Interfaces:**
- Consumes: `VoteRepository`, `createInMemoryVoteRepository` (tests), `createServiceClient` + `createSupabaseVoteRepository` (prod), `createRateLimiter`.
- Produces: `POST /api/sessions` accepting `{ hostName, options: [{name, placeId?, snapshot?}] }` → `201 { sessionId }`; validation errors → `400 { error }`; rate-limited per IP.
- The route reads its repository via a module-level `getRepository()` that returns a Supabase-backed repo in prod; tests pass a fake by setting `__setRepositoryForTests`.

- [ ] **Step 1: Write the failing test** — `src/app/api/sessions/route.test.ts`

```ts
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
```

- [ ] **Step 2: Run it to verify failure**

Run: `npx vitest run src/app/api/sessions/route.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the route** — `src/app/api/sessions/route.ts`

```ts
import { NextResponse } from "next/server";
import { createRateLimiter } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";
import { createSupabaseVoteRepository } from "@/lib/vote/supabase-repository";
import type { VoteRepository } from "@/lib/vote/repository";

const allow = createRateLimiter(20, 60_000);

let testRepo: VoteRepository | null = null;
export function __setRepositoryForTests(repo: VoteRepository | null) { testRepo = repo; }
function getRepository(): VoteRepository {
  if (testRepo) return testRepo;
  return createSupabaseVoteRepository(createServiceClient());
}

function clientIp(req: Request): string {
  return req.headers.get("x-real-ip")?.trim()
    || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "no-ip";
}

export async function POST(req: Request): Promise<Response> {
  if (!allow(clientIp(req))) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }
  let body: { hostName?: unknown; options?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const hostName = typeof body.hostName === "string" ? body.hostName.trim() : "";
  if (!hostName) return NextResponse.json({ error: "hostName is required." }, { status: 400 });

  if (!Array.isArray(body.options) || body.options.length < 2) {
    return NextResponse.json({ error: "At least 2 options are required." }, { status: 400 });
  }
  const options: { name: string; placeId?: string | null; snapshot?: unknown }[] = [];
  for (const raw of body.options) {
    const name = typeof (raw as { name?: unknown })?.name === "string"
      ? (raw as { name: string }).name.trim() : "";
    if (!name) return NextResponse.json({ error: "Every option needs a name." }, { status: 400 });
    const placeId = (raw as { placeId?: unknown }).placeId;
    const snapshot = (raw as { snapshot?: unknown }).snapshot;
    options.push({ name, placeId: typeof placeId === "string" ? placeId : null, snapshot: snapshot ?? null });
  }

  try {
    const { sessionId } = await getRepository().createSession({ hostName, options });
    return NextResponse.json({ sessionId }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not create the vote. Please try again." }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run it to verify pass**

Run: `npx vitest run src/app/api/sessions/route.test.ts`
Expected: PASS — 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/sessions/route.ts src/app/api/sessions/route.test.ts
git commit -m "feat: add POST /api/sessions create-vote route"
```

---

### Task 6: GET /api/sessions/[id]

**Files:**
- Create: `src/app/api/sessions/[id]/route.ts`
- Test: `src/app/api/sessions/[id]/route.test.ts`

**Interfaces:**
- Consumes: same `getRepository`/`__setRepositoryForTests` pattern as Task 5 (each route file owns its own module-level repo getter + test setter).
- Produces: `GET /api/sessions/[id]` → `200 SessionState` or `404 { error }`. App-Router signature: `GET(req: Request, ctx: { params: Promise<{ id: string }> })`.

- [ ] **Step 1: Write the failing test** — `src/app/api/sessions/[id]/route.test.ts`

```ts
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
```

- [ ] **Step 2: Run it to verify failure**

Run: `npx vitest run "src/app/api/sessions/[id]/route.test.ts"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the route** — `src/app/api/sessions/[id]/route.ts`

```ts
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createSupabaseVoteRepository } from "@/lib/vote/supabase-repository";
import type { VoteRepository } from "@/lib/vote/repository";

let testRepo: VoteRepository | null = null;
export function __setRepositoryForTests(repo: VoteRepository | null) { testRepo = repo; }
function getRepository(): VoteRepository {
  if (testRepo) return testRepo;
  return createSupabaseVoteRepository(createServiceClient());
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  try {
    const state = await getRepository().getSession(id);
    if (!state) return NextResponse.json({ error: "This lunch vote was not found." }, { status: 404 });
    return NextResponse.json(state);
  } catch {
    return NextResponse.json({ error: "Could not load the vote." }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run it to verify pass**

Run: `npx vitest run "src/app/api/sessions/[id]/route.test.ts"`
Expected: PASS — 2 passed.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/sessions/[id]/route.ts" "src/app/api/sessions/[id]/route.test.ts"
git commit -m "feat: add GET /api/sessions/[id] state route"
```

---

### Task 7: POST /api/sessions/[id]/votes (cast vote)

**Files:**
- Create: `src/app/api/sessions/[id]/votes/route.ts`
- Test: `src/app/api/sessions/[id]/votes/route.test.ts`

**Interfaces:**
- Produces: `POST /api/sessions/[id]/votes` accepting `{ voterName, optionId, type }` → `200 { ok: true }`; `409` for `duplicate`/`closed`; `404` for `not_found`; `400` for `bad_option` or invalid body.

- [ ] **Step 1: Write the failing test** — `src/app/api/sessions/[id]/votes/route.test.ts`

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
  it("records a valid vote (200)", async () => {
    const res = await POST(body({ voterName: "Al", optionId, type: "up" }), ctx(sessionId));
    expect(res.status).toBe(200);
  });
  it("rejects a duplicate vote with 409", async () => {
    await POST(body({ voterName: "Al", optionId, type: "up" }), ctx(sessionId));
    const res = await POST(body({ voterName: "Al", optionId, type: "up" }), ctx(sessionId));
    expect(res.status).toBe(409);
  });
  it("rejects an invalid type with 400", async () => {
    const res = await POST(body({ voterName: "Al", optionId, type: "maybe" }), ctx(sessionId));
    expect(res.status).toBe(400);
  });
  it("404s for an unknown session", async () => {
    const res = await POST(body({ voterName: "Al", optionId, type: "up" }), ctx("nope"));
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `npx vitest run "src/app/api/sessions/[id]/votes/route.test.ts"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the route** — `src/app/api/sessions/[id]/votes/route.ts`

```ts
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createSupabaseVoteRepository } from "@/lib/vote/supabase-repository";
import type { VoteRepository } from "@/lib/vote/repository";

let testRepo: VoteRepository | null = null;
export function __setRepositoryForTests(repo: VoteRepository | null) { testRepo = repo; }
function getRepository(): VoteRepository {
  if (testRepo) return testRepo;
  return createSupabaseVoteRepository(createServiceClient());
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  let body: { voterName?: unknown; optionId?: unknown; type?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const voterName = typeof body.voterName === "string" ? body.voterName.trim() : "";
  const optionId = typeof body.optionId === "string" ? body.optionId : "";
  const type = body.type;
  if (!voterName || !optionId || (type !== "up" && type !== "veto")) {
    return NextResponse.json({ error: "voterName, optionId and a valid type are required." }, { status: 400 });
  }

  try {
    const result = await getRepository().castVote(id, { voterName, optionId, type });
    if (result.ok) return NextResponse.json({ ok: true });
    const status = result.reason === "not_found" ? 404
      : result.reason === "bad_option" ? 400
      : 409; // duplicate | closed
    return NextResponse.json({ error: result.reason }, { status });
  } catch {
    return NextResponse.json({ error: "Could not record your vote." }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run it to verify pass**

Run: `npx vitest run "src/app/api/sessions/[id]/votes/route.test.ts"`
Expected: PASS — 4 passed.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/sessions/[id]/votes/route.ts" "src/app/api/sessions/[id]/votes/route.test.ts"
git commit -m "feat: add POST cast-vote route"
```

---

### Task 8: POST /api/sessions/[id]/close (close + winner)

**Files:**
- Create: `src/app/api/sessions/[id]/close/route.ts`
- Test: `src/app/api/sessions/[id]/close/route.test.ts`

**Interfaces:**
- Produces: `POST /api/sessions/[id]/close` → `200 { winnerId: string | null }`; `404` not found; `409` already closed.

- [ ] **Step 1: Write the failing test** — `src/app/api/sessions/[id]/close/route.test.ts`

```ts
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
```

- [ ] **Step 2: Run it to verify failure**

Run: `npx vitest run "src/app/api/sessions/[id]/close/route.test.ts"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the route** — `src/app/api/sessions/[id]/close/route.ts`

```ts
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createSupabaseVoteRepository } from "@/lib/vote/supabase-repository";
import type { VoteRepository } from "@/lib/vote/repository";

let testRepo: VoteRepository | null = null;
export function __setRepositoryForTests(repo: VoteRepository | null) { testRepo = repo; }
function getRepository(): VoteRepository {
  if (testRepo) return testRepo;
  return createSupabaseVoteRepository(createServiceClient());
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  try {
    const result = await getRepository().closeSession(id);
    if ("error" in result) {
      const status = result.error === "not_found" ? 404 : 409;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ winnerId: result.winnerId });
  } catch {
    return NextResponse.json({ error: "Could not close the vote." }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run it to verify pass**

Run: `npx vitest run "src/app/api/sessions/[id]/close/route.test.ts"`
Expected: PASS — 3 passed.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/sessions/[id]/close/route.ts" "src/app/api/sessions/[id]/close/route.test.ts"
git commit -m "feat: add POST close-vote route with winner"
```

---

### Task 9: useSessionVotes realtime hook

**Files:**
- Create: `src/hooks/useSessionVotes.ts`
- Test: `src/hooks/useSessionVotes.test.ts`

**Interfaces:**
- Consumes: `Vote`, `VoteSession` types; a Supabase client (injectable for tests).
- Produces: `function useSessionVotes(sessionId: string, initial: { votes: Vote[]; status: "open" | "closed"; winnerOptionId: string | null }, makeClient?: () => SupabaseClient): { votes: Vote[]; status: "open" | "closed"; winnerOptionId: string | null }` — seeds from `initial`, subscribes to vote INSERTs and session UPDATEs, returns live state. `makeClient` defaults to `createBrowserSupabase`.

- [ ] **Step 1: Write the failing test** — `src/hooks/useSessionVotes.test.ts`

```ts
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSessionVotes } from "@/hooks/useSessionVotes";
import type { Vote } from "@/lib/vote/types";

// Fake Supabase channel that captures handlers and lets the test emit events.
function makeFakeClient() {
  const handlers: Record<string, (payload: { new: unknown }) => void> = {};
  const channel = {
    on(_evt: string, filter: { table: string }, cb: (p: { new: unknown }) => void) {
      handlers[filter.table] = cb; return channel;
    },
    subscribe() { return channel; },
  };
  const client = { channel: () => channel, removeChannel: vi.fn() };
  return { client, emit: (table: string, row: unknown) => handlers[table]?.({ new: row }) };
}

const initial = { votes: [] as Vote[], status: "open" as const, winnerOptionId: null };

describe("useSessionVotes", () => {
  it("appends votes pushed over realtime", () => {
    const { client, emit } = makeFakeClient();
    const { result } = renderHook(() =>
      useSessionVotes("s1", initial, () => client as never));
    act(() => emit("votes", { id: "v1", session_id: "s1", option_id: "o1", voter_name: "Al", type: "up", created_at: "" }));
    expect(result.current.votes).toHaveLength(1);
    expect(result.current.votes[0].voterName).toBe("Al");
  });

  it("updates status + winner when the session row changes", () => {
    const { client, emit } = makeFakeClient();
    const { result } = renderHook(() =>
      useSessionVotes("s1", initial, () => client as never));
    act(() => emit("sessions", { id: "s1", status: "closed", winner_option_id: "o2" }));
    expect(result.current.status).toBe("closed");
    expect(result.current.winnerOptionId).toBe("o2");
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `npx vitest run src/hooks/useSessionVotes.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook** — `src/hooks/useSessionVotes.ts`

```ts
"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Vote } from "@/lib/vote/types";
import { createBrowserSupabase } from "@/lib/supabase/browser";

interface State {
  votes: Vote[];
  status: "open" | "closed";
  winnerOptionId: string | null;
}

function mapVoteRow(r: Record<string, unknown>): Vote {
  return {
    id: r.id as string, sessionId: r.session_id as string, optionId: r.option_id as string,
    voterName: r.voter_name as string, type: r.type as "up" | "veto", createdAt: (r.created_at as string) ?? "",
  };
}

export function useSessionVotes(
  sessionId: string,
  initial: State,
  makeClient: () => SupabaseClient = createBrowserSupabase,
): State {
  const [state, setState] = useState<State>(initial);

  useEffect(() => {
    const client = makeClient();
    const channel = client
      .channel(`session-${sessionId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "votes", filter: `session_id=eq.${sessionId}` },
        (payload: { new: Record<string, unknown> }) => {
          const v = mapVoteRow(payload.new);
          setState((s) => (s.votes.some((x) => x.id === v.id) ? s : { ...s, votes: [...s.votes, v] }));
        })
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
        (payload: { new: Record<string, unknown> }) => {
          setState((s) => ({
            ...s,
            status: (payload.new.status as "open" | "closed") ?? s.status,
            winnerOptionId: (payload.new.winner_option_id as string | null) ?? s.winnerOptionId,
          }));
        })
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [sessionId, makeClient]);

  return state;
}
```

- [ ] **Step 4: Run it to verify pass**

Run: `npx vitest run src/hooks/useSessionVotes.test.ts`
Expected: PASS — 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSessionVotes.ts src/hooks/useSessionVotes.test.ts
git commit -m "feat: add useSessionVotes realtime hook"
```

---

### Task 10: VoteRoom component

**Files:**
- Create: `src/components/VoteRoom.tsx`
- Test: `src/components/VoteRoom.test.tsx`

**Interfaces:**
- Consumes: `VoteSession`, `VoteOption`, `Vote`, `tallyVotes`, `useSessionVotes`.
- Produces: `function VoteRoom(props: { sessionId: string; initialSession: VoteSession; options: VoteOption[]; initialVotes: Vote[]; voterName: string; onCast: (optionId: string, type: "up"|"veto") => Promise<void>; onClose: () => Promise<void>; subscribe?: typeof useSessionVotes }): JSX.Element` — renders each option with live up/veto counts, up/veto buttons (disabled when closed), a "Close voting" button, and the winner when closed. `subscribe` is injectable for tests (defaults to `useSessionVotes`).

- [ ] **Step 1: Write the failing test** — `src/components/VoteRoom.test.tsx`

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VoteRoom } from "@/components/VoteRoom";
import type { VoteSession, VoteOption, Vote } from "@/lib/vote/types";

const session: VoteSession = { id: "s1", hostName: "Sam", status: "open", winnerOptionId: null, expiresAt: "" };
const options: VoteOption[] = [
  { id: "o1", sessionId: "s1", placeId: null, name: "Sushi", snapshot: null },
  { id: "o2", sessionId: "s1", placeId: null, name: "Pizza", snapshot: null },
];
// stub the realtime hook to just echo the initial state
const stubSubscribe = (_id: string, initial: { votes: Vote[]; status: "open" | "closed"; winnerOptionId: string | null }) => initial;

describe("VoteRoom", () => {
  it("renders options with their up tallies", () => {
    const votes: Vote[] = [{ id: "v1", sessionId: "s1", optionId: "o1", voterName: "Al", type: "up", createdAt: "" }];
    render(<VoteRoom sessionId="s1" initialSession={session} options={options} initialVotes={votes}
      voterName="Bo" onCast={vi.fn()} onClose={vi.fn()} subscribe={stubSubscribe} />);
    expect(screen.getByText("Sushi")).toBeInTheDocument();
    expect(screen.getByText("Pizza")).toBeInTheDocument();
    expect(screen.getByTestId("up-o1")).toHaveTextContent("1");
  });

  it("calls onCast when an upvote button is clicked", async () => {
    const onCast = vi.fn().mockResolvedValue(undefined);
    render(<VoteRoom sessionId="s1" initialSession={session} options={options} initialVotes={[]}
      voterName="Bo" onCast={onCast} onClose={vi.fn()} subscribe={stubSubscribe} />);
    await userEvent.click(screen.getByRole("button", { name: /upvote sushi/i }));
    expect(onCast).toHaveBeenCalledWith("o1", "up");
  });

  it("shows the winner and hides vote buttons when closed", () => {
    const closed: VoteSession = { ...session, status: "closed", winnerOptionId: "o2" };
    render(<VoteRoom sessionId="s1" initialSession={closed} options={options} initialVotes={[]}
      voterName="Bo" onCast={vi.fn()} onClose={vi.fn()} subscribe={stubSubscribe} />);
    expect(screen.getByText(/winner/i)).toHaveTextContent("Pizza");
    expect(screen.queryByRole("button", { name: /upvote sushi/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `npx vitest run src/components/VoteRoom.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component** — `src/components/VoteRoom.tsx`

```tsx
"use client";

import type { VoteSession, VoteOption, Vote } from "@/lib/vote/types";
import { tallyVotes } from "@/lib/vote/winner";
import { useSessionVotes } from "@/hooks/useSessionVotes";

interface Props {
  sessionId: string;
  initialSession: VoteSession;
  options: VoteOption[];
  initialVotes: Vote[];
  voterName: string;
  onCast: (optionId: string, type: "up" | "veto") => Promise<void>;
  onClose: () => Promise<void>;
  subscribe?: typeof useSessionVotes;
}

export function VoteRoom({
  sessionId, initialSession, options, initialVotes, voterName, onCast, onClose,
  subscribe = useSessionVotes,
}: Props) {
  const live = subscribe(sessionId, {
    votes: initialVotes,
    status: initialSession.status,
    winnerOptionId: initialSession.winnerOptionId,
  });
  const tally = tallyVotes(options, live.votes);
  const closed = live.status === "closed";
  const winner = options.find((o) => o.id === live.winnerOptionId);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-xl font-bold">{initialSession.hostName}&apos;s lunch vote</h1>
      <p className="text-sm text-gray-500">Voting as {voterName}</p>

      {closed && (
        <p className="rounded-xl bg-green-50 p-3 font-semibold text-green-700">
          🏆 Winner: {winner ? winner.name : "No winner (all vetoed)"}
        </p>
      )}

      {options.map((o) => (
        <div key={o.id} className="flex items-center justify-between rounded-2xl border p-4">
          <span className="font-medium">{o.name}</span>
          <span className="flex items-center gap-3 text-sm">
            <span data-testid={`up-${o.id}`}>👍 {tally[o.id]?.up ?? 0}</span>
            <span data-testid={`veto-${o.id}`}>🚫 {tally[o.id]?.veto ?? 0}</span>
            {!closed && (
              <>
                <button onClick={() => onCast(o.id, "up")}
                  className="rounded bg-green-600 px-2 py-1 text-white" aria-label={`Upvote ${o.name}`}>
                  Up
                </button>
                <button onClick={() => onCast(o.id, "veto")}
                  className="rounded bg-red-600 px-2 py-1 text-white" aria-label={`Veto ${o.name}`}>
                  Veto
                </button>
              </>
            )}
          </span>
        </div>
      ))}

      {!closed && (
        <button onClick={onClose} className="rounded-xl bg-gray-900 px-4 py-2 font-medium text-white">
          Close voting &amp; pick winner
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify pass**

Run: `npx vitest run src/components/VoteRoom.test.tsx`
Expected: PASS — 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/VoteRoom.tsx src/components/VoteRoom.test.tsx
git commit -m "feat: add VoteRoom live voting component"
```

---

### Task 11: Quick-vote entry + vote room pages

**Files:**
- Create: `src/components/QuickVoteForm.tsx`, `src/app/vote/page.tsx`, `src/app/vote/[id]/page.tsx`
- Test: `src/components/QuickVoteForm.test.tsx`

**Interfaces:**
- Consumes: the `POST /api/sessions` + `GET /api/sessions/[id]` + vote/close routes; `VoteRoom`.
- Produces:
  - `QuickVoteForm({ onCreate }: { onCreate: (hostName: string, options: string[]) => Promise<void> }): JSX.Element` — host name + dynamic list of option inputs (min 2) + a submit button; calls `onCreate` with trimmed non-empty options.
  - `/vote` page wires `QuickVoteForm` to `POST /api/sessions` then `router.push('/vote/<id>')`.
  - `/vote/[id]` page fetches `GET /api/sessions/[id]` server-side, prompts for a voter name (client), and renders `VoteRoom` wired to the cast/close routes.

- [ ] **Step 1: Write the failing test** — `src/components/QuickVoteForm.test.tsx`

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuickVoteForm } from "@/components/QuickVoteForm";

describe("QuickVoteForm", () => {
  it("submits trimmed host name and non-empty options", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<QuickVoteForm onCreate={onCreate} />);
    await userEvent.type(screen.getByLabelText(/your name/i), "Sam");
    const optionInputs = screen.getAllByLabelText(/option/i);
    await userEvent.type(optionInputs[0], "Sushi");
    await userEvent.type(optionInputs[1], "Pizza");
    await userEvent.click(screen.getByRole("button", { name: /start vote/i }));
    expect(onCreate).toHaveBeenCalledWith("Sam", ["Sushi", "Pizza"]);
  });

  it("does not submit with fewer than 2 filled options", async () => {
    const onCreate = vi.fn();
    render(<QuickVoteForm onCreate={onCreate} />);
    await userEvent.type(screen.getByLabelText(/your name/i), "Sam");
    await userEvent.type(screen.getAllByLabelText(/option/i)[0], "Sushi");
    await userEvent.click(screen.getByRole("button", { name: /start vote/i }));
    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByText(/at least 2 options/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `npx vitest run src/components/QuickVoteForm.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the form** — `src/components/QuickVoteForm.tsx`

```tsx
"use client";

import { useState } from "react";

interface Props {
  onCreate: (hostName: string, options: string[]) => Promise<void>;
}

export function QuickVoteForm({ onCreate }: Props) {
  const [hostName, setHostName] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [error, setError] = useState<string | null>(null);

  const setOption = (i: number, val: string) =>
    setOptions((prev) => prev.map((o, idx) => (idx === i ? val : o)));

  const submit = async () => {
    const filled = options.map((o) => o.trim()).filter(Boolean);
    if (!hostName.trim()) { setError("Please enter your name."); return; }
    if (filled.length < 2) { setError("Add at least 2 options."); return; }
    setError(null);
    await onCreate(hostName.trim(), filled);
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-3 p-6">
      <h1 className="text-2xl font-bold">Quick group vote</h1>
      <label className="text-sm">Your name
        <input className="mt-1 w-full rounded border px-3 py-2" value={hostName}
          onChange={(e) => setHostName(e.target.value)} />
      </label>
      {options.map((o, i) => (
        <label key={i} className="text-sm">{`Option ${i + 1}`}
          <input className="mt-1 w-full rounded border px-3 py-2" value={o}
            onChange={(e) => setOption(i, e.target.value)} />
        </label>
      ))}
      <button type="button" onClick={() => setOptions((p) => [...p, ""])}
        className="self-start text-sm text-blue-600">+ Add option</button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="button" onClick={submit}
        className="rounded-xl bg-gray-900 px-4 py-2 font-medium text-white">Start vote</button>
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify pass**

Run: `npx vitest run src/components/QuickVoteForm.test.tsx`
Expected: PASS — 2 passed.

- [ ] **Step 5: Implement the `/vote` entry page** — `src/app/vote/page.tsx`

```tsx
"use client";

import { useRouter } from "next/navigation";
import { QuickVoteForm } from "@/components/QuickVoteForm";

export default function VoteEntryPage() {
  const router = useRouter();
  const onCreate = async (hostName: string, options: string[]) => {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostName, options: options.map((name) => ({ name })) }),
    });
    if (!res.ok) return;
    const { sessionId } = await res.json();
    router.push(`/vote/${sessionId}`);
  };
  return <QuickVoteForm onCreate={onCreate} />;
}
```

- [ ] **Step 6: Implement the `/vote/[id]` room page** — `src/app/vote/[id]/page.tsx`

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { VoteRoom } from "@/components/VoteRoom";
import type { SessionState } from "@/lib/vote/repository";

export default function VoteRoomPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;
  const [state, setState] = useState<SessionState | null>(null);
  const [voterName, setVoterName] = useState("");
  const [joined, setJoined] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setState)
      .catch(() => setNotFound(true));
  }, [sessionId]);

  const onCast = useCallback(async (optionId: string, type: "up" | "veto") => {
    await fetch(`/api/sessions/${sessionId}/votes`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voterName, optionId, type }),
    });
  }, [sessionId, voterName]);

  const onClose = useCallback(async () => {
    await fetch(`/api/sessions/${sessionId}/close`, { method: "POST" });
  }, [sessionId]);

  if (notFound) return <p className="p-6">This lunch vote has ended or was not found.</p>;
  if (!state) return <p className="p-6">Loading the vote…</p>;

  if (!joined) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-3 p-6">
        <h1 className="text-xl font-bold">Join {state.session.hostName}&apos;s lunch vote</h1>
        <label className="text-sm">Your name
          <input className="mt-1 w-full rounded border px-3 py-2" value={voterName}
            onChange={(e) => setVoterName(e.target.value)} />
        </label>
        <button onClick={() => voterName.trim() && setJoined(true)}
          className="rounded-xl bg-gray-900 px-4 py-2 font-medium text-white">Join</button>
      </div>
    );
  }

  return (
    <VoteRoom
      sessionId={sessionId}
      initialSession={state.session}
      options={state.options}
      initialVotes={state.votes}
      voterName={voterName.trim()}
      onCast={onCast}
      onClose={onClose}
    />
  );
}
```

- [ ] **Step 7: Verify build compiles**

Run: `npm run build`
Expected: build succeeds; `/vote` and `/vote/[id]` routes listed.

- [ ] **Step 8: Commit**

```bash
git add src/components/QuickVoteForm.tsx src/components/QuickVoteForm.test.tsx src/app/vote
git commit -m "feat: add Quick-vote entry and vote room pages"
```

---

### Task 12: E2E — create a vote and cast a ballot

**Files:**
- Create: `e2e/vote.spec.ts`

**Interfaces:**
- Consumes: the running app; mocks `/api/sessions*` so no live Supabase is needed in CI.

- [ ] **Step 1: Write the E2E spec** — `e2e/vote.spec.ts`

```ts
import { test, expect } from "@playwright/test";

const SESSION = {
  session: { id: "sess-1", hostName: "Sam", status: "open", winnerOptionId: null, expiresAt: "" },
  options: [
    { id: "o1", sessionId: "sess-1", placeId: null, name: "Sushi", snapshot: null },
    { id: "o2", sessionId: "sess-1", placeId: null, name: "Pizza", snapshot: null },
  ],
  votes: [],
};

test("create a quick vote, join, and cast a ballot", async ({ page }) => {
  await page.route("**/api/sessions", (route) =>
    route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ sessionId: "sess-1" }) }));
  await page.route("**/api/sessions/sess-1", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SESSION) }));
  await page.route("**/api/sessions/sess-1/votes", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }));

  await page.goto("/vote");
  await page.getByLabel(/your name/i).fill("Sam");
  const opts = page.getByLabel(/option/i);
  await opts.nth(0).fill("Sushi");
  await opts.nth(1).fill("Pizza");
  await page.getByRole("button", { name: /start vote/i }).click();

  // Now on /vote/sess-1 — join then vote
  await expect(page.getByText(/lunch vote/i)).toBeVisible();
  await page.getByLabel(/your name/i).fill("Sam");
  await page.getByRole("button", { name: /join/i }).click();

  await expect(page.getByText("Sushi")).toBeVisible();
  await page.getByRole("button", { name: /upvote sushi/i }).click();
  // No assertion error means the cast POST was intercepted and the UI stayed responsive.
  await expect(page.getByRole("button", { name: /close voting/i })).toBeVisible();
});
```

- [ ] **Step 2: Run the E2E test**

Run: `npm run e2e`
Expected: PASS — both specs (`surprise.spec.ts`, `vote.spec.ts`) pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/vote.spec.ts
git commit -m "test: add E2E for quick-vote create and cast flow"
```

---

### Task 13: Live integration smoke + verification + README

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: a provisioned Supabase project (the Provisioning Prerequisite must be done first), with the migration applied and Realtime enabled.

**Note:** This task is the ONLY one requiring the live project. The controller performs the provisioning + smoke using the `supabase:supabase` skill / Supabase MCP. The "tests" here are the full automated suite (mocked) plus a manual realtime smoke.

- [ ] **Step 1: Apply the migration to the live project**

Using the Supabase skill/MCP: run `supabase/migrations/0001_group_voting.sql` against the project; confirm the three tables exist and Realtime is enabled on `votes` + `sessions`.

- [ ] **Step 2: Run the full automated suite**

Run: `npm test`
Expected: PASS — all unit/component suites green (Plan 1's 38 + Plan 2's new tests).

- [ ] **Step 3: Run E2E**

Run: `npm run e2e`
Expected: PASS — surprise + vote specs.

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: success; `/vote`, `/vote/[id]`, `/api/sessions*` routes present.

- [ ] **Step 5: Manual realtime smoke (two browser tabs)**

With `.env.local` filled and `npm run dev` running: open `/vote`, create a vote, copy the `/vote/<id>` link into a second tab, join from both, cast votes, and confirm tallies update live in BOTH tabs without refresh; close voting and confirm the winner appears in both. Record the result in the commit message / PR.

- [ ] **Step 6: Update the README** — append a "Group voting (Plan 2)" section

```markdown
## Group voting (Plan 2)

Requires a Supabase project. Set in `.env.local`:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public), and
`SUPABASE_SERVICE_ROLE_KEY` (server-only — never exposed to the browser).

Apply `supabase/migrations/0001_group_voting.sql` and ensure Realtime is enabled
on the `votes` and `sessions` tables. Then open `/vote` to create a vote, share the
`/vote/<id>` link, and watch live results.

Security: all writes go through server API routes using the service-role key;
browsers use the anon key for reads/realtime only (select-only RLS).
```

- [ ] **Step 7: Commit**

```bash
git add README.md
git commit -m "docs: document Supabase setup and group voting"
```

---

## Self-Review

**1. Spec coverage:**
- Group vote sessions / options / votes data model → Tasks 2, 3, 4. ✅
- Quick-vote (type free-text options) → Tasks 5, 11. ✅
- Shareable link → vote together → Task 11 (`/vote/[id]`), Task 9 (realtime). ✅
- Live tally (realtime) → Tasks 9, 10. ✅
- Upvote / veto + winner logic (veto eliminates, ties random) → Tasks 3, 7, 8, 10. ✅
- One vote per person per option → DB unique constraint (Task 2) + repo/route 409 (Tasks 4, 7). ✅
- Snapshot field (stable options) + nullable place_id (free-text) → Task 2 schema, carried in types/repo. ✅
- Accounts-ready (`user_id` nullable) → Task 2 schema. ✅ (no UI — correctly deferred)
- Session expiry (`expires_at`) → Task 2 schema (default now()+1 day). ✅ (cleanup job deferred; documented)
- API key / service-role server-side only → Global Constraints, Tasks 1, 5–8. ✅
- RLS scoped anon access → Task 2. ✅
- **Deferred (correct, per the chosen scope):** "Vote with team" handoffs from Surprise/Browse → future Plan 3.

**2. Placeholder scan:** No TBD/TODO; every code step has complete code. The two non-code tasks (2 migration, 13 smoke) are explicitly manual-application steps with concrete SQL/commands, not placeholders. ✅

**3. Type consistency:** `VoteSession`/`VoteOption`/`Vote`/`Tally` defined once (Task 3) and consumed identically by the repository (Task 4), routes (5–8), hook (9), and components (10–11). `VoteRepository` method names + return shapes (`{ ok }`, `{ winnerId }`, `{ error }`) match across the interface, in-memory double, Supabase impl, and route consumers. The `__setRepositoryForTests` / `getRepository` pattern is repeated identically in each route file (Tasks 5–8) — intentional, since route modules can't share mutable test state cleanly. snake_case DB columns are mapped to camelCase in exactly one place per entity (`mapSession`/`mapOption`/`mapVote` in the Supabase repo + `mapVoteRow` in the hook). ✅

**Known follow-ups (non-blocking, for a later plan):**
- Expiry cleanup (a scheduled job / `pg_cron` to delete expired sessions) — schema supports it; no job built.
- Stricter per-session-token RLS if vote privacy ever matters.
- "Vote with team" handoffs (Plan 3).
