# Gap-closing prompt template (phases 1–3)

Placeholders: {PKG}, {AXIS}, {HINTS}

---
You are closing invariant-coverage gaps for one package — **{PKG}** — on one
axis: **{AXIS}** (`unit` | `server-e2e` | `admin-e2e`).

Repo: /Users/pavel.makhanko/Projects/ortha-source/ortha-cms

## Your gap list

`node tools/coverage/ledger.mjs gaps {PKG}` prints every uncovered invariant with
its full text. Work only the ones this axis can reach; leave the rest.

Read the dossier `docs/artifacts/{PKG}.html` for the surrounding argument — the
Invariants section and the Testing checklist that follows it. It is a large HTML
file: extract with python/grep, never dump it whole.

## Do NOT run anything

No tests, no servers, no docker, no `nx test`/`nx e2e`. The whole batch runs once
at the end of the phase, so a suite start-up is paid once rather than per package.

**You may and should run `npx tsc` / lint** on what you write — neither needs a
port or a database, and without them the phase ends with specs that do not
compile. If you changed cross-project imports, run `npx nx sync`.

## Before you write a single assertion

For each gap, write down — for yourself — **the broken implementation**. Then ask
whether your planned fixture would tell it apart from the correct one.

If it would not, you have found the real task: **fix the fixture**. Three
audiences against a page size of ten cannot distinguish "every match" from "this
page". A graph with no depth-2 neighbour cannot distinguish a one-hop walk from a
recursive one. An image inserted with no `alt` cannot show that ticking
"decorative" cleared it.

Read `docs/coverage/tests-that-cannot-fail.md` first. Several entries there are
assigned to this sweep precisely because the fixture, not the assertion, is
wrong. Adding a second test beside a test that cannot fail leaves two.

Second check: **which module does your assertion actually reach?** If the
production path and the test path are two implementations of the same rule —
a harness that re-implements the bootstrap, an executor carrying an inline copy
of a guard — the test guards neither. Reach the real one.

## Prove it can fail — by mutation, not by argument

Once the test is written, **break the production code and watch your test fail.**
Delete the guard, drop the `WHERE` clause, make the branch match nothing. Confirm
the failure is *yours* and not a neighbour's, then revert. `git diff` must be
clean of production changes afterwards.

Two minutes, and it is the only proof that a test bites. Reasoning that it
*should* fail is what produced every entry in `tests-that-cannot-fail.md`.

Third thing to check, after the fixture and the module: **can the observable show
the difference at all?** A media cascade repair asserted through
`GET /api/media/assets`, which answers with the workspace *root* only — so a
correct cascade and an over-deletion returned the same thing. The assertion was
right, the fixture discriminated, and the test still could not fail. If the API
you are reading through cannot express the state you are asserting about, read
the table.

## Claim the invariant

Every test you write names the invariant it pins, package-qualified:

```ts
it('refuses a segment not offered in this workspace [{PKG}:I-11]', async () => {
```

or, above a block or a non-test line:

```ts
// covers: {PKG}:I-12, {PKG}:I-13
```

Then `node tools/coverage/ledger.mjs check` flips the row on its own.

## When the invariant is wrong, not the code

Some gaps are not gaps. If the invariant contradicts what the code does, do
**not** write a test asserting the dossier. Record it instead in
`docs/coverage/judgments/{PKG}.json` under `judgments` as
`{"state": "stale", "reason": "dossier says X; path/file.ts:42 does Y"}` and
leave the code alone. If no harness can reach it, use
`not-mechanically-checkable` with a reason. Both need a reason; neither is a
place to park work you would rather not do.

Treat the dossier as a hypothesis throughout — in the triage phase every stale
claim fed to an agent as context turned out to be genuinely stale.

## If you find a bug

Fix it, and add the test that would have caught it — but put **the fix in its own
commit**, separate from the coverage work. Nothing has been run yet at this stage,
so a bad fix must be revertible without losing the test.

Follow the target package's `AGENTS.md` conventions, and the `server-e2e` /
`admin-e2e` / `accessibility` skills for harness mechanics.

{HINTS}

## Report back

Gaps closed (by id), gaps left and why, fixtures repaired, any bug found and
fixed, and anything in the dossier that turned out to be wrong.
