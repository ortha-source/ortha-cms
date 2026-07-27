# @ortha-cms/content-domain

The content **shared kernel** — pure TypeScript rules that both runtimes apply
identically. Per [ADR-0003](../../../docs/adr/0003-tactical-ddd-inside-plugins.md)
(decision #7) this is the **single sanctioned FE↔BE code share**: only `content`
has rules both `content-server` and `content-admin` must enforce the same way,
so only `content` gets a kernel.

## The one hard rule

**Pure TypeScript — no React, no NestJS, no Drizzle, no `class-validator`, no
node-only APIs beyond plain JS.** It imports nothing from `content-server`, so
`content-server` (and `content-admin`) may depend on it without a cycle. Keep it
that way: anything needing a framework belongs in the consuming package.

Its **one** dependency is `@ortha-cms/wysiwyg-core`, itself a zero-dependency
pure-TS kernel, for `htmlTextLength`. A `wysiwyg` field's `minLength`/`maxLength`
are measured on the **text**, not the markup — counting the markup would make a
limit depend on how the text happened to be formatted — and that measurement has
to be the *same* one the editor and the server's canonicalization use. A
hand-rolled tag-stripper here would be a second definition of "how long is this
document", i.e. exactly the drift this package exists to prevent.

## What lives here

- **Entry-status state machine** (`lib/status/entry-status.ts`) — `ENTRY_STATUS`
  (`draft`/`published`, mirroring the server's column enum), the legal
  transitions, and `canTransition` / `assertTransition` (+
  `EntryStatusTransitionError`). `draft → published` is publish; `published →
  draft` is unpublish. There is **no** separate `unpublished`/`archived` status
  — unpublish is the reverse transition, and archival is the paranoid
  soft-delete tombstone, not a status.
- **Field-value validation** (`lib/validation/validate-entry-values.ts`) — the
  pure rules (`validateFieldValue`, `validateEntryValues`) extracted verbatim
  from the server's original `EntryValidationService`, operating on a serialized
  `EntryFieldSpec` map (`lib/fields/`). Messages and edge cases are identical, so
  the server's delegation is a behavior-preserving refactor. The `wysiwyg` case
  is the one addition: its length rules run over `htmlTextLength(value)`.
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
- **`content-admin`** (a later wave) — will replace its hand-mirrored
  `validateEntryValues` with `validateFieldValue` and use `canPublish` for its
  Publish-gate UI (`ContentField` is likewise assignable to `EntryFieldSpec`).

## Commands

- `npx nx typecheck @ortha-cms/content-domain`
- `npx nx lint @ortha-cms/content-domain`
- `npx nx test @ortha-cms/content-domain` — DB-free unit tests for the state
  machine, the validator, and the publish gate.
