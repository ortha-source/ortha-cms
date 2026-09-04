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

## What you may run

**On the unit axis, run your own package's jest** — `nx test @orthacms/<pkg>`.
It takes seconds, needs no database, no ports and no docker, so there is nothing
to contend over, and without it the mutation proof below is impossible. That
proof is the whole point; the no-running rule was written for the e2e harnesses,
where a start-up costs minutes and is paid once for the batch.

It earns its keep immediately: on alarms it caught three tests that were wrong as
written, one of which could not fail — `expect(second).toBe(first)` on a
coalescing test, where `sweep()` is async and every caller gets its own wrapper
promise.

**Do not run** `nx e2e` (either app), a server, or docker. Those run once for the
whole phase, after every package is written.

**Always run `npx tsc` and lint** on what you write — neither needs a port or a
database, and without them the phase ends with specs that do not compile. If you
changed cross-project imports, run `npx nx sync`.

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

**Never run `git stash`, `git checkout <branch>`, or anything else that moves the
whole tree.** Six or seven agents share this checkout, and every one of them has
uncommitted work in it. A repo-wide stash takes all of it hostage: if the pop
conflicts, or the agent is killed between the two, a day of other people's work
is in a dangling stash nobody knows to look for. It has already happened twice in
this sweep — once leaving the tree empty mid-phase, once round-tripping only by
luck. Scope every git command to your own paths.

**Namespace every scratch file.** The mutation proof means saving a production
file, breaking it, and restoring it — and seven agents do that at once. Two of
them picked `/tmp/ca.bak` in the same batch, and the second restore put an
unrelated file over `createAdmin/index.tsx`; it was caught only because a
`git status` happened to run. Put scratch under a path carrying your package
name, and prefer `git checkout -- <file>` to a hand-rolled backup: git already
holds the original, and it cannot be clobbered by a neighbour.

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

## Record the half-pinned rows you pass on the way

While you are in this package's citations, look for compound invariants where a
citation covers one clause and nothing covers the other. Triage found these and
wrote them into the citation's `why` — "only the HTTP half is pinned", "the `via`
merge clause is not pinned by any test" — where no grep will ever see them, so
the row reads green with half a rule unguarded.

For each, add to `docs/coverage/judgments/{PKG}.json`:

```json
"{PKG}:I-10": { "state": "partial", "missing": "which clause no test reaches, and why it matters" }
```

`partial` rides alongside the citation rather than replacing it, so the row stays
covered and the gap becomes visible. Close the clause instead if it is cheap —
`partial` is for what you are leaving, not a place to file work you would rather
skip.

You are already reading these citations; a separate pass over 26 packages to do
the same reading costs the same work twice.

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
