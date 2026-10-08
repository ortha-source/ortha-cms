# Schema builder — design

**Status:** shipped — this document now describes built behaviour; the [dossier](../artifacts/schema-builder.md) is the detailed reference. Decision record: [ADR-0020](../adr/0020-schema-builder-writes-code.md).

A visual editor for content types that **writes code**. In development it edits
the TypeScript DSL under `src/content/`, generates a drizzle-kit migration,
applies it, and waits for the dev watcher to restart the server. In production
the same page is read-only.

## How an apply works

Nothing is written under `src/` until the very end — the dev watcher would
restart the server mid-operation.

1. The admin edits a draft `SchemaDocument` and validates it on every change
   with the same rules the DSL runs (`checkTypes` from `content-domain`).
2. `POST /schema-builder/plan` — the server diffs the draft against the
   document of the **running** registry, classifies every change, renders the
   files into a stage (`.orthacms/stage/`), and runs drizzle-kit into a copy of
   the migrations folder to show the exact SQL.
3. `POST /schema-builder/apply` — under a file lock, after the same checks:
   back up `migrations/` and `src/content/`; generate the removals as one
   migration and everything else as a second (so drizzle-kit never asks about a
   rename); run `applyPluginMigrations` (one transaction); copy the stage into
   `src/content/`; record `schema.applied` through the outbox; answer `202` with
   the operation id and the current `bootId`.
4. Any failure before the copy restores the backup; the database is rolled back
   by the migrator's transaction.
5. The admin polls `GET /schema-builder/document` until `bootId` changes, then
   refreshes every cache derived from the registry and offers to grant a new
   type to workspaces.

## Packages

| Package                           | Role                                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `@orthacms/schema-builder-domain` | Framework-free: the document, diff, change classification, code generation, the manifest renderer     |
| `@orthacms/schema-builder-server` | The plugin: document / plan / apply / operations routes, the stage, drizzle-kit, the lock and the log |
| `@orthacms/schema-builder-admin`  | The `/content-model` page: type rail, field list, field sheet, groups, review and apply               |

`@orthacms/content-domain` gains the schema rules (one rule per file) and the
General-tab ordering table, shared by the DSL, the builder and content-admin.

## What the builder can edit

Exactly what the DSL can express — `ContentTypeOptions`, `*FieldOptions`,
`AdminProps` in `packages/content/server/src/lib/types/`.

- **Type:** `label`, `description`, `path` (pages), `publishable`, `paranoid`,
  `i18n`, `groups`. The flags are fixed after creation except turning trash on.
- **Field, General tab:** label, machine name, `required`, `localized` (i18n
  types only), `lang`; for a relation its target, cardinality, inverse field
  and `onDelete`.
- **Field, Validation tab:** text `minLength`/`maxLength`/`pattern`; richtext
  `minLength`/`maxLength`/`structure`; number `min`/`max`/`integer`; money
  `min`/`max`; select and multiselect `options`; media `multiple` and `accept`.
- **Field, Display tab:** `admin.description`, `placeholder`, `width`, `row`,
  `group`, `widget`, `hidden`. Unknown `admin` keys survive a round trip.

### Tabs are built in; groups are accordions on General

The entry editor's tabs are fixed: General, Relations and Media come from
content-admin, the rest (Access, Activity, History…) from plugins through
`ENTRY_TAB_SLOT`. A schema cannot add one. A type's `groups` are **accordion
blocks inside the General tab**. Relation fields always render on Relations and
media fields on Media, so "group" and "width" are hidden for them.

Above the groups the editor orders fields by control shape — inputs, then
choices, then long text — and keeps declaration order only within a rank.
Inside a group the author's order holds. The builder therefore only allows a
reorder within one rank or one group.

### Not in the DSL yet

Option labels, uniqueness of a scalar field, item counts, date ranges, currency
on money, cross-field checks, conditional visibility, repeatable blocks. Each is
a separate change to the DSL first.

### Default values are a prefill

`defaultValue` (DSL) is what the entry editor's **create form** starts a field
at — the builder offers it on the General tab with that said under the control.
It is not a column `DEFAULT`: an existing entry keeps what it holds, and an
entry created through the API without the field stays without it. It is offered
on `text`, `number`, `money`, `boolean`, `date` (`'today'` or a fixed day),
`datetime` (`'now'` or a fixed minute), `select` and `multiselect` — never on a
relation or media field, whose value is a row id and so data, not code. A
default must be a value the field accepts (`checkDefaultValue`); changing one
is code-only.

## Change classification

| Change                                                                        | Verdict                                                  |
| ----------------------------------------------------------------------------- | -------------------------------------------------------- |
| New type; new optional field; label, order, display options                   | safe                                                     |
| Tightened validation; `required` on a live type; relation `unique`/`onDelete` | needs a data check                                       |
| Field removed; type removed                                                   | destructive — confirmed one by one                       |
| Type granted to a workspace or referenced by another, then removed            | blocked                                                  |
| Rename, retype, `i18n`/`publishable` toggled, trash turned off                | blocked in v1                                            |
| Required field added to a non-publishable type with rows                      | blocked (a default is a prefill, not a column `DEFAULT`) |

## Invariants

1. With `NODE_ENV=production` or editing disabled, plan and apply answer 403
   and touch neither files nor the database.
2. The builder writes only files carrying `@orthacms-generated`, and the
   manifest.
3. Apply is all-or-nothing.
4. `src/` is written once, after a successful migration.
5. One apply at a time; a second gets 409.
6. An apply against a stale fingerprint gets 409.
7. Every destructive change is confirmed by its own id.
8. SQL is always generated by drizzle-kit.
9. Generating code from the registry's document and reloading it reproduces the
   same serialized schema for every reference type.
10. The admin, the builder server and the DSL validate with one rule set.
11. A new type is granted to no workspace implicitly.
12. A drizzle-kit run cannot hang a request.
13. The builder offers no option the DSL lacks, and preserves unknown `admin`
    keys.
14. Every loading state renders a skeleton in the content's own grid, inside
    one named `role="status"`; error and no-access are separate states.

## Delivery

| PR  | Scope                                                                    |
| --- | ------------------------------------------------------------------------ |
| 1   | This document and ADR-0020                                               |
| 2   | Schema rules and the General-tab ordering table move to `content-domain` |
| 3   | Generated content manifest and `content:sync`                            |
| 4   | `schema-builder-domain`: document, diff, fingerprint                     |
| 5   | `schema-builder-domain`: classification, code generation, apply phases   |
| 6   | `schema-builder-server`: the read path                                   |
| 7   | `schema-builder-admin`: the read-only page, skeletons and states         |
| 8   | Server: plan                                                             |
| 9   | Server: apply                                                            |
| 10  | Admin: the editor                                                        |
| 11  | Admin: review, apply and grant                                           |
| 12  | Dossier, root documents, scaffolder                                      |
