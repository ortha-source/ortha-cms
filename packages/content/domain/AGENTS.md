# @orthacms/content-domain

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
- **The rich-text document** (`lib/richtext/`) — a `richtext` value is a
  **structured document** (the ProseMirror/TipTap node tree the admin editor
  produces), not an opaque HTML string, which is what makes its heading order,
  table headers, link text and language markers checkable
  (WCAG 1.3.1 / 2.4.6 / 3.1.2 — see
  [ORT-84](https://linear.app/ortha-source/issue/ORT-84)). Five modules:
    - `rich-text-node.ts` — the vocabulary (`RICH_TEXT_NODE`, `RICH_TEXT_MARK`),
      the types, the guards (`isRichTextDocument`) and the walk. The vocabulary
      is **open**: it names what the kernel reasons about, not what a document
      may contain, so an editor extension (a callout, a column layout) rides
      through untouched.
    - `rich-text-document.ts` — the readings: `richTextPlainText` (what a
      length rule counts — the body's **text**, markup excluded),
      `isEmptyRichText`, `asRichTextDocument`.
    - `html-to-document.ts` — a **legacy HTML string** read as a document, so
      every rule below reaches bodies written before this change. Deliberately
      lossy and **analysis-only**: a legacy value is stored as the string it is,
      never as this output.
    - `document-to-html.ts` — `richTextToHtml`, the serializer (escapes text,
      emits a fixed vocabulary, keeps every `lang`).
    - `rich-text-structure.ts` — `inspectRichText`, the structural rules. An
      **error** (a skipped heading level, a header-less table, an empty link, a
      malformed `lang`) fails validation; a **warning** ("click here") is
      surfaced by the editor and never blocks a save. A field opts out with
      `validation: { structure: 'off' }`.
    - `language-tag.ts` — `isWellFormedLanguageTag`, BCP-47 **well-formedness**
      (a registry check would need the IANA data set).

- **Field-value validation** (`lib/validation/validate-entry-values.ts`) — the
  pure rules (`validateFieldValue`, `validateEntryValues`) extracted from the
  server's original `EntryValidationService`, operating on a serialized
  `EntryFieldSpec` map (`lib/fields/`).

    Seven rules here are **not** what a naive reading of JavaScript gives you, and
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
    - **`richtext` is a document, and its length rules count text.** A value may
      be a document **or** a legacy HTML string; both are read as a document, so
      a `maxLength` no longer spends the author's budget on `<strong>` and the
      structural rules apply to content written before them. Emptiness is the
      document's, not the JSON's — `{ doc: [paragraph] }` is what an emptied
      editor leaves behind and has to trip `required`.
    - **A field may declare its own `lang`** (`EntryFieldSpec.lang`), checked for
      BCP-47 well-formedness whether or not there is a value — the field-level
      half of language of parts; a passage inside a body carries its own.
    - **`waiveRequired` excuses `is required` and nothing else.** The server
      passes the required relations whose target type the entry's workspace was
      not granted (`content:I-50`); a value supplied for one is still checked.

- **The publish gate** (`lib/validation/publish-gate.ts`) — `canPublish`, the
  predicate derived from the same validator ("are the values complete + valid to
  publish"). Covers the **values bag** only; a required link-managed relation is
  enforced by the server's persistence (its links aren't in the bag).

- **The schema rules** (`lib/schema-rules/`) — what a content type must satisfy
  to be declared at all, as pure functions over a plain `RuleType` (relation
  targets are names, not thunks). **One rule per file**, composed in
  registries ([ADR-0020](../../../docs/adr/0020-schema-builder-writes-code.md)):
    - `TYPE_RULES` → `FIELD_RULES` (field by field) → `LAYOUT_RULES` →
      `GROUP_RULES`, run by `checkType` in exactly the order `collection()` /
      `single()` always ran them. The DSL throws the **first** issue's message,
      and those messages are the boot errors `define.spec.ts` pins — **do not
      reword one without updating that spec**.
    - `OPTION_RULES` (`checkFieldOptions`) — `lang`, `pattern`, media `accept`,
      `defaultValue` (`lib/fields/default-value.ts`: which types take one, the
      relative `'today'` / `'now'`, and `defaultValueProblem`, which runs the
      default through `validateFieldValue`).
      The DSL's field builders throw on these before a type exists; a schema
      held as data (the schema builder's document) runs them here. `pattern`
      goes through `compilePattern`, so "accepted here" means "applied at
      validation".
    - `SET_RULES` (`checkTypeSet`) — unique names and resolvable relations, the
      checks `ContentTypeRegistry` runs at boot.
    - `checkTypes` runs all of it — what the builder shows while an author
      types. A new rule is a new file plus one line in its registry.
- **The General tab order** (`lib/layout/general-tab-order.ts`) — the rank of
  each field type above every group on the entry form's General tab (inputs,
  then choices, then large fields; declaration order within a rank).
  content-admin draws the form with it and the schema builder shows where a
  field will land with it.

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
  `EntryFieldSections` orders the General tab with `orderGeneralTab`.
- **The DSL** (`content-server/src/lib/collection`) — `assertType` runs
  `checkType` over `toRuleType(declaration)`; `ContentTypeRegistry` runs
  `checkTypeSet`; `table-builder` names columns with `snakeCase`. The adapter
  resolves relation targets through a **getter**, because `collection()` runs
  while sibling modules are still being imported.

## Commands

- `npx nx typecheck @orthacms/content-domain`
- `npx nx lint @orthacms/content-domain`
- `npx nx test @orthacms/content-domain` — DB-free unit tests for the state
  machine, the validator, and the publish gate.
