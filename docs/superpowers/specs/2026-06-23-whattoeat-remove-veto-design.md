# whatToEat — Remove Veto from Group Voting Design Spec

**Date:** 2026-06-23
**Status:** Approved (plain-language design confirmed by user)
**Author:** shaoxian04 + Claude

## Problem

Group voting currently gives each option two actions — **👍 Up** and **🚫 Veto** —
and a single veto *eliminates* an option from winning. The user wants a simpler model:
upvote-only.

A second request — "only the host can close the vote, others can only vote" — is
**already implemented** and needs no change (see Non-Goals).

## Goal

Each option in the vote room offers only a **👍 Up** button. A voter may upvote any
number of options. When the host closes the vote, the option with the **most upvotes
wins** (ties broken randomly). No elimination.

## Non-Goals (no work needed / out of scope)

- **Host-only close** — already enforced. Only the creator holds the `host_token`
  (`localStorage whattoeat:host:${id}`), so only they see "Close voting"; the
  `/api/sessions/[id]/close` route rejects anyone without a valid token (403). No change.
- **Single-choice voting** — explicitly NOT chosen; voters may upvote multiple options.
- **DB migration** — the `votes.type` column stays; no schema change (see below).
- **Changing/removing an upvote** — not in scope; the existing
  `(session_id, option_id, voter_name)` unique constraint still prevents double-upvoting
  the same option.

## Behavior

- Vote room: each option shows a **👍 Up** button and its upvote count only. The
  veto button and veto count are removed.
- A person can upvote multiple options (one upvote per option).
- Close: **winner = option with the most upvotes**; ties broken at random among the
  leaders (unchanged tie-break). Because nothing is eliminated, a winner always exists
  (given ≥2 options) — the former "No winner (all vetoed)" outcome disappears.

## Changes (frontend + pure logic + API; **no DB migration**)

- **`src/lib/vote/types.ts`** — remove `Vote.type`; `Tally` becomes
  `{ [optionId]: number }` (upvote count per option).
- **`src/lib/vote/winner.ts`** — `tallyVotes(options, votes)` returns a per-option
  upvote count; `computeWinner` picks the max count, random tie-break among leaders;
  returns `null` only if `options` is empty.
- **`src/lib/vote/repository.ts`** — `CastVoteInput` drops `type` (now
  `{ optionId, voterName }`). The in-memory repository stores a vote with no type.
- **`src/lib/vote/supabase-repository.ts`** — `castVote` inserts the row with the
  still-`NOT NULL` `type` column hardcoded to `'up'`; `mapVote` stops reading `type`.
- **`src/app/api/sessions/[id]/votes/route.ts`** — request body requires only
  `voterName` + `optionId`; the `type` field and its validation are removed.
- **`src/components/VoteRoom.tsx`** — remove the `🚫 Veto` button and the veto tally
  span; `onCast(optionId)` (no `type`); keep the `👍 Up` button, the
  `data-testid="up-${id}"` tally, and `aria-label="Upvote {name}"`.
- **`src/app/vote/[id]/page.tsx`** — `onCast(optionId)` posts `{ voterName, optionId }`.

### Why no DB migration

The `votes.type` column is `not null check (type in ('up','veto'))`. New votes are
always `'up'`, which the existing CHECK permits, so the live database needs no change.
The constraint harmlessly continues to allow the now-unused `'veto'`; tightening it is a
deferred, separate cleanup, not part of this change.

## Error Handling

Unchanged from today: invalid/missing `voterName` or `optionId` → 400; voting on a
closed or unknown session → 409/404; duplicate upvote of the same option → 409; close
without a valid host token → 403.

## Testing (TDD)

- **Unit** — `winner.test.ts`: drop veto/elimination cases; add "most upvotes wins",
  "tie broken among leaders", and "multiple options upvoted by one voter". `VoteRoom`:
  no veto button rendered; `onCast` called with `(optionId)`; up-tally shown.
  `votes/route.test.ts`: accepts `{ voterName, optionId }`, rejects missing fields;
  no `type` required. `repository.contract.test.ts`: `castVote` without `type`.
- **Preserved** — existing up-vote assertions (`data-testid="up-..."`,
  `aria-label="Upvote ..."`), host-only close tests, realtime tally, and the
  Browse→vote E2E remain green; only veto-specific tests/fixtures are removed.

## Out of Scope / Future

- Tightening the `votes.type` CHECK (or dropping the column) via a later migration.
- Allowing a voter to retract an upvote.
- Single-choice (one-vote-per-person) voting.
