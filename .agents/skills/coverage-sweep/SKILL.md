---
name: coverage-sweep
description: Running the invariant coverage sweep — closing the gaps between the 816 numbered invariants in the package dossiers (docs/artifacts/) and the tests that pin them, tracked in the ledger at docs/coverage/. Covers the ledger contract and its four states, the citation bar, batching by harness rather than by package, the two anti-patterns that produce tests which cannot fail, the fan-out mechanics for one agent per package, and the operational traps in running the three harnesses. Use when triaging a package's invariants, closing coverage gaps, or continuing the sweep in a later session.
user-invocable: true
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, Agent
---

# Invariant coverage sweep

Every package dossier in `docs/artifacts/` ends with a numbered list of
**invariants** — statements the dossier itself calls "a draft set of test
assertions". There are 816 across 26 dossiers. The sweep connects each one to a
test that would fail if it broke, and writes the test where none exists.

The ledger lives in `docs/coverage/` and is documented in its own
[README](../../../docs/coverage/README.md). Read that first: it defines the
citation format and the four states. This skill is the procedure around it.

## The one rule everything else serves

> **A citation means the test would fail if the invariant broke.**

Not "tests the same endpoint", not "lives in the same file", not "mentions the
same feature". When unsure, leave the row uncovered.

A false citation is worse than a gap. A gap is visible — the ledger says
`uncovered` and the work is on the list. A false citation silently removes work
that will then never be done, and leaves a reviewer believing a rule is guarded
when it is not.

**Under-claiming is the correct failure mode.** Phase 0 bore this out: package
coverage ranged from 100% to 40% precisely because the triage refused near
misses, and every refusal it wrote down turned out to be a real gap.

## Phase order — batch by harness, never by package

The three harnesses are mutually hostile, so the sweep runs one harness at a
time rather than one package at a time. Package-by-package means tearing the
environment up and down 26 times.

| Phase | Axis | Why here |
| --- | --- | --- |
| 0 | triage | read-only; produces the gap list. **Done** — 569/816 cited |
| 1 | unit | no contention for ports or database, so maximum parallelism, and the cheapest signal |
| 2 | server-e2e | testcontainers, isolated per suite |
| 3 | admin-e2e | needs `:3000` **and** `:4200` free — it mocks `/api` |
| 4 | agent-browser | the live stack, strictly serial |
| 5 | full run | `nx run-many` + `ledger.mjs check --strict` |

Within a phase: agents **write without running**, then the suite runs **once**
for the whole phase, then failures get fixed. One expensive harness start-up
amortised over the whole batch.

Phase 4 exists for one reason worth stating: admin-e2e mocks `/api`, so **not
one of its suites proves the admin and the server agree**. Contract drift is the
only thing the browser pass should hunt; duplicating admin-e2e there is waste.

## The two anti-patterns

Phase 0 found eight tests that cannot fail. They are catalogued in
[`docs/coverage/tests-that-cannot-fail.md`](../../../docs/coverage/tests-that-cannot-fail.md).
Read it before writing a test — an agent told "close this gap" reproduces these
by default, because both shapes are what a conscientious author writes when
aiming at a checklist item rather than at a defect.

**1. A fixture too small to distinguish the two behaviours.** Three audiences
seeded against a page size of ten, so a bulk action over visible rows passes the
"every match, not just the page" test. A graph with no depth-2 neighbour, so a
walker that recursed passes the one-hop test. A childless folder, so the
recursion test never recurses. An image inserted with no `alt`, so "ticking
decorative clears the alt" was already true before the click.

*Guard:* before writing the assertion, describe the broken implementation and
check the fixture would tell them apart. If it would not, fix the fixture — that
is the whole task, and no new test is needed.

**2. The test stands on a copy, not the original.** `TRUST_PROXY` and the
`ValidationPipe` flags are asserted only against `createTestApp`, which
re-implements the bootstrap — delete the line from the real `create-server.ts`
and nothing goes red. `requireDatabaseUrl` has no test; the Nx executor spec that
looks like it covers the check tests the executor's own inline duplicate and
mocks `@orthacms/cli` away. The operator dictionary exists in two copies, each
tested against itself, with nothing comparing them.

*Guard:* trace which module the assertion actually reaches. If the production
path and the test path are two implementations of one rule, the test guards
neither.

Both shapes are invisible to a reviewer reading the test name, and invisible to
coverage tooling, which sees the line execute.

## Documentation is a hypothesis, not a fact

Dossiers, `AGENTS.md` and `README.md` describe intent, and intent drifts. In
Phase 0 **every one of three claims** fed to agents as context turned out to be
stale:

- "Only `media` and `api-tokens` implement `WorkspacePurger`" — three more do,
  and a suite asserts the whole cleanup
- "No dead-letter tooling beyond SQL" — `OutboxDispatcher.deadLetters()` exists,
  with a controller and an admin surface
- "`ortha --help` returns `Unknown command`" — fixed, with a regression test

Six dossiers were also found to overstate their own coverage, listing checklist
items that no test implements. **Never cite a test because a document says it
exists.** Open it.

When a *numbered invariant* contradicts the code, that is a `stale` judgment and
the dossier gets fixed. When the surrounding prose is wrong, record it in
`docs/coverage/dossier-corrections.md` — the ledger has no state for it.

## Fan-out mechanics

One agent per package, and **agents never edit spec files**. Each writes exactly
one file, `docs/coverage/judgments/<pkg>.json`, and `ledger.mjs apply` inserts
the citations serially afterwards.

This is not fussiness. Packages share spec files — a credential's story is told
in both identity's suites and api-tokens', query-builder's invariants are pinned
inside the Content Library's records-filter suites, and six of nx's live in
`packages/cli`. Concurrent agents editing that tree lose each other's writes.

Prompt templates:
- [`references/triage-prompt.md`](references/triage-prompt.md) — phase 0, validated across 26 packages
- [`references/close-gap-prompt.md`](references/close-gap-prompt.md) — phases 1–3

Batches of 8 ran comfortably. Give each agent hints about where its tests
actually live — e2e directories are frequently **not** named after the package
(identity's are under `auth/`, wysiwyg's under `content/`) — but phrase them as
leads to verify, per the section above.

## Writing without running

Phases 1–3 accumulate unverified code by design. Two rules keep that safe:

- **typecheck and lint are allowed** and expected. Neither needs a database or a
  port, so there is no contention, and without them the phase ends with a batch
  of specs that do not compile — missing imports, absent fixtures, stale project
  references (`npx nx sync`).
- **a bug fix is a separate commit from the coverage that found it.** In a phase
  where nothing runs, fixes pile up unverified; if the fix and its test share a
  commit, a bad fix cannot be reverted without losing the test.

## Operational traps

Salvaged from the retired `qa-pass-ticket` skill and still true:

- **`admin-e2e` needs no API, and breaks if one is up.** It mocks `/api` with
  `page.route`. With a server on `:3000` the Vite proxy answers whatever the
  mocks miss, `mockSignedIn` stops working, and every page-level spec fails on a
  redirect to sign-in — measured at 14 failed vs 15 passed. Free both ports.
- **`pgrep -f` matches your own shell.** `pkill -f "dist/main.js"` kills the
  command you are running. Kill by port instead.
- **`nx serve server` can deadlock two instances** on the Nx lock and leave
  `dist/main.js` stale. For server work, build once and run the bundle directly.
  `node --watch` cannot recover from a missing entry point.
- **agent-browser recordings truncate on `open`.** Navigate before `record
  start`, drive with `reload`, verify the last frame.
- **Raise `LOGIN_RATE_LIMIT`** for functional runs (10/min otherwise poisons
  later steps with spurious 429s), and restore it after.
- **Mutations pass `OriginGuard`** — send `-H 'Origin: http://localhost:4200'`.

## Definition of done for a phase

- Every gap in the phase's axis is either closed by a test, or judged
  `not-mechanically-checkable` / `stale` **with a reason**.
- `node tools/coverage/ledger.mjs check` shows the phase's rows covered.
- The suite for that axis runs green, once, at the end.
- Fixes are in their own commits, each with the test that would have caught it.
- Dossier prose corrections recorded; stale invariants fixed in the dossier.
