---
name: feature-implementation-with-unit-tests
description: Workflow command scaffold for feature-implementation-with-unit-tests in whatToEat.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /feature-implementation-with-unit-tests

Use this workflow when working on **feature-implementation-with-unit-tests** in `whatToEat`.

## Goal

Implements a new feature or module along with its corresponding unit tests.

## Common Files

- `src/lib/decision/*.ts`
- `src/lib/decision/*.test.ts`
- `src/lib/places/*.ts`
- `src/lib/places/*.test.ts`
- `src/lib/api/*.ts`
- `src/lib/api/*.test.ts`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create or update implementation file(s) for the new feature/module/component.
- Create or update corresponding unit test file(s) alongside the implementation.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.