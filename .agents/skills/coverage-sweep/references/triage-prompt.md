# Ф0b prompt template (validated on mcp)

Placeholders: {PKG}, {HINTS}

---
You are doing READ-ONLY invariant-coverage triage for exactly one package: **{PKG}**.

Repo: /Users/pavel.makhanko/Projects/ortha-source/ortha-cms

## Context
Each package dossier in `docs/artifacts/<pkg>.html` ends with an **Invariants**
section — numbered statements (`I-01`…) the dossier itself calls "a draft set of
test assertions". A ledger tracks which are actually pinned by a test. Triage
{PKG}'s invariants against the tests that already exist.

## What you produce
Exactly ONE file: `docs/coverage/judgments/{PKG}.json`

**Do not edit any other file** — not specs, not source. A later serial step
applies your citations; a fan-out of agents editing a shared test tree races on
files two packages both touch.

## Steps
1. `node tools/coverage/ledger.mjs gaps {PKG}` — every invariant with full text.
2. Read `docs/artifacts/{PKG}.html` for context — the Invariants section and the
   Testing checklist that follows it (section numbers differ between dossiers;
   find them by name). Large HTML: extract with python/grep, never dump whole.
3. Find the tests that exist today:
   - unit: `packages/{PKG}/**/*.spec.ts(x)`
   - server-e2e: `apps/server-e2e/src/**`
   - admin-e2e: `apps/admin-e2e/src/**`
   e2e directories are NOT always named after the package — grep for the
   package's routes, tables, services and components, not just its folder.
   {HINTS}
4. Per invariant, exactly one of:
   - **citation** — an existing test genuinely asserts it
   - **not-mechanically-checkable** — no harness can reach it; give a reason
   - **stale** — contradicts current code; give a reason with `file:line`
   - **nothing** — a real gap; omit it, `uncovered` is the default

## The bar for a citation — the whole value of the exercise
A citation means: **if the invariant were violated, that test would fail.**
"Related to", "touches the same endpoint", "lives in the same file" is NOT
enough. When unsure, leave it uncovered. A false citation is worse than a gap:
it silently removes work that will then never get done. Under-claim.

A compound invariant may take one citation per genuinely independent clause. If
only some clauses are pinned, cite those and say in `why` which half is missing.

## Output schema
{
    "package": "{PKG}",
    "citations": [
        {"id": "{PKG}:I-02", "file": "…/x.spec.ts", "anchor": "exact substring of one line, unique in file",
         "why": "one sentence: which assertion pins it"}
    ],
    "judgments": {
        "{PKG}:I-07": {"state": "not-mechanically-checkable", "reason": "…"},
        "{PKG}:I-11": {"state": "stale", "reason": "dossier says X; path:42 does Y"}
    }
}

Only `not-mechanically-checkable` and `stale` are valid states. Every judgment
needs a reason.

## Rules
- Do NOT run tests, servers, docker or `nx`.
- Read-only apart from your one JSON file.
- Verify it parses (`python3 -m json.tool`) and that
  `node tools/coverage/ledger.mjs apply --dry` resolves every anchor you wrote.

## Report back
Counts: cited / not-mechanically-checkable / stale / left-uncovered. The 3 most
notable gaps, one line each. Anything about the dossier that looked wrong.
