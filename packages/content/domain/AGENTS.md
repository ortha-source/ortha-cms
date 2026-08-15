# @ortha-cms/content-domain

The content **shared kernel** — pure TypeScript rules that both runtimes apply
identically. Per [ADR-0003](../../../docs/adr/0003-tactical-ddd-inside-plugins.md)
(decision #7) this is the **single sanctioned FE↔BE code share**: only `content`
has rules both `content-server` and `content-admin` must enforce the same way,
so only `content` gets a kernel.

## The one hard rule

**Pure TypeScript — no React, no NestJS, no Drizzle, no `class-validator`, no
node-only APIs beyond plain JS.** The package has **zero dependencies**. It
imports nothing from `content-server`, so `content-server` (and later
`content-admin`) may depend on it without a cycle. Keep it that way: anything
needing a framework belongs in the consuming package.

## What lives here

- **Entry-status state machine** (`lib/status/entry-status.ts`) — `ENTRY_STATUS`
  (`draft`/`published`, mirroring the server's column enum), the legal
  transitions, and `canTransition` / `assertTransition` (+
  `EntryStatusTransitionError`). `draft → published` is publish; `published →
draft` is unpublish. There is **no** separate `unpublished`/`archived` status
  — unpublish is the reverse transition, and archival is the paranoid
  soft-delete tombstone, not a status.
- **Field-value validation** (`lib/validation/validate-entry-values.ts`) — the
  pure rules (`validateFieldValue`, `validateEntryValues`) extracted from the
  server's original `EntryValidationService`, operating on a serialized
  `EntryFieldSpec` map (`lib/fields/`).

    Four rules here are **not** what a naive reading of JavaScript gives you, and
    each has a test that pins it:
    - **Own keys only.** Both the unknown-key check and the value read use
      `Object.hasOwn`, never `key in fields` / `values[name]`. `in` would accept
      `toString`/`constructor`/`__proto__` as known-but-unvalidated keys, and a
      bare read would hand a field named `toString` the inherited function as if
      it were a supplied value.
    - **`minLength`/`maxLength` count graphemes**, via `countCharacters`
      (`Intl.Segmenter`, a platform global — still zero dependencies; code
      points where it is absent). `String.length` counts UTF-16 code units, so
      one emoji would cost 2 and a family emoji 11.
    - **`date` is checked against the calendar**, not just the `YYYY-MM-DD`
      shape, and an `Invalid Date` fails `datetime`.
    - **`pattern` is untrusted** (`lib/validation/safe-pattern.ts`): an
      uncompilable source and one at risk of catastrophic backtracking are both
      refused up front and fail the field, because a synchronous `RegExp.test`
      cannot be interrupted.

- **The publish gate** (`lib/validation/publish-gate.ts`) — `canPublish`, the
  predicate derived from the same validator ("are the values complete + valid to
  publish"). Covers the **values bag** only; a required link-managed relation is
  enforced by the server's persistence (its links aren't in the bag).

## How it's consumed

- **`content-server`** — `EntryValidationService` delegates its `validate(...)`
  to `validateEntryValues(type.fields, values, { rejectUnknownKeys: true,
typeName })`; the entries `Entry` domain model uses `assertTransition` +
  `EntryStatus` for its publish lifecycle. `AnyFieldSpec` is structurally
  assignable to `EntryFieldSpec`, so no adapter is needed.
- **`content-admin`** — its `presentation/entryValidation` runs
  `validateFieldValue` as the sole rule set and localizes the kernel's stable
  English issue reason (`ContentField` is likewise assignable to
  `EntryFieldSpec`); `usePublishEntryFlow` uses `canPublish`. **Adding or
  renaming an issue message here means adding its case to that localizer** —
  an unmapped reason falls back to raw English in the UI.

## Commands

- `npx nx typecheck @ortha-cms/content-domain`
- `npx nx lint @ortha-cms/content-domain`
- `npx nx test @ortha-cms/content-domain` — DB-free unit tests for the state
  machine, the validator, and the publish gate.
