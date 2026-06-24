---
name: api-endpoint-creation-with-tests
description: Workflow command scaffold for api-endpoint-creation-with-tests in whatToEat.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /api-endpoint-creation-with-tests

Use this workflow when working on **api-endpoint-creation-with-tests** in `whatToEat`.

## Goal

Adds a new API endpoint along with its implementation and test coverage.

## Common Files

- `src/app/api/*/route.ts`
- `src/app/api/*/route.test.ts`
- `src/lib/*.ts`
- `src/lib/*.test.ts`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create new API route implementation file under api/.
- Create corresponding test file for the API route.
- If needed, create or update supporting utility files and their tests.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.