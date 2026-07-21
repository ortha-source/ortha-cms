# @ortha-cms/content-server

The content-modeling **plugin** for the Ortha CMS server. It turns
**code-defined** content types into physical Postgres tables, holds them in a
runtime **registry**, serves that schema to the admin, and validates entry
values against it. It owns **no database connection and no migrations of its
own** — the HOST owns the generated tables and their migrations (see below).

## The DSL (`collection()` / `single()` + `field.*`)

Content types are declared in code, in the host app (collections in
`apps/server/src/collections`, pages/singles in `apps/server/src/pages`):

```typescript
export const post = collection('post', {
    label: 'Blog posts',
    fields: {
        title: field.text({ required: true, minLength: 3 }),
        author: field.relation({ to: () => author, required: true, onDelete: 'restrict' }),
        tags: field.relation({ to: () => tag, many: true })
    }
});
```

- `collection()` (multi-entry) and `single()` (one entry, routed at `path`)
  normalize options, run `assertName` + `assertFields`, build the tables, and
  return a typed `ContentType`.
- `field.*` field builders (`text`/`richtext`/`number`/`money`/`boolean`/`date`/
  `datetime`/`select`/`multiselect`/`json`/`relation`) each return a JSON-serializable
  `FieldSpec` carrying its value type as a phantom generic (for `InferEntry`).
- `relation({ to })` takes a **lazy thunk** so mutually-referencing collection
  files can import each other. `onDelete` defaults to `'cascade'` when
  `required`, else `'set null'`. A **required single relation with
  `onDelete: 'set null'` is rejected** at define time — a NOT NULL FK can't be
  nulled on delete. `unique: true` makes a single relation **one-to-one** — a
  `UNIQUE` constraint on the `<field>_id` FK (nullable-unique, so unrelated rows
  don't collide); combining it with `many: true` is rejected (a join table has
  no column to constrain).

### Two-way relations (`relationInverse`)

`field.relationInverse({ of: () => owner, field: 'x' })` declares the **inverse**
(back-reference) side of a relation whose storage lives on `owner.x`. It emits
**no column or join table** — reads/writes reuse the owning side's FK/join table
(source/target swapped), so editing either side mutates the same links and they
can't drift. The registry validates the pairing at boot (the referenced field
must be a storage-owning relation on `owner` that points back). Because it's
virtual, adding one produces **no migration**. Defaults to to-many. Two files
referencing each other create a TS *inference* cycle — annotate one thunk's
return `: AnyContentType` to break it (see `apps/server/src/collections/tag.ts`).

### Relation cardinalities

The two storage forms cover all four cardinalities. **many-to-one** is a plain
single relation (`field.relation({ to })`); its inverse is **one-to-many**,
which carries no storage of its own — model it as the single relation on the
"many" side (e.g. `comment.article`). **one-to-one** is a single relation with
`unique: true`. **many-to-many** is `many: true` (the generated join table). See
the reference collections in `apps/server/src/collections` (`article` wires up
`author`, `seo_meta`, `tag`, and `comment`).

### Metadata flags (`publishable` / `paranoid` / `i18n`)

Optional booleans on `collection()` / `single()` add platform-owned envelope
columns:

- `publishable: true` → a `status` (`draft`/`published`, `DEFAULT 'draft'`)
  **and** a nullable `published_at` (timestamptz) column — the two halves of the
  publish workflow. A **non-publishable** type has neither: it carries no publish
  state and every row is simply live.
- `paranoid: true` → a nullable `deleted_at` (timestamptz) column (soft delete).
- `i18n: true` → `locale` (text NOT NULL) + `locale_group_id` (uuid NOT NULL,
  `DEFAULT gen_random_uuid()`) columns, plus a `(locale_group_id, locale)`
  unique index (**partial** `WHERE deleted_at IS NULL` on paranoid types) and a
  `(workspace_id, locale[, status])` list index. **Row-per-locale**: each locale
  of an entry is a full row; siblings share a `locale_group_id`. Per-field,
  `field.*({ localized: true })` marks a value as varying per locale (rejected
  at define time on a non-i18n type); an unmarked field is **shared** across the
  group. A **single relation whose target type is also i18n** is per-locale too
  — `isPerLocaleRelation` (exported) derives it, and the schema serializer stamps
  `localized: true` on such a field even without the flag: a shared FK would be a
  cross-locale link, so the i18n sibling-sync and the admin's translation prefill
  skip it and the relation picker offers only same-locale candidates. This
  package owns the storage *shape* only — what a locale *means*
  (allowed slugs, the default, scoping, sync) lives behind the
  `CONTENT_ENTRY_EXTENSION` port (see below), so content-server stays
  locale-agnostic.

`published_at`/`deleted_at` are **nullable with no default** (null = "not yet
published" / "not deleted"; the service layer stamps them). `status`,
`published_at`, `deleted_at`, `locale`, and `locale_group_id` are
**reserved unconditionally** — an author cannot define a field that maps to them
(rejected by `assertFields`), and a client cannot set them (they aren't in
`type.fields`, so `EntryValidationService` rejects them as unknown keys). The
flags are carried on `ContentType` and serialized in the schema summary
(`i18n` on the summary, `localized` per field).

### The entries extension port (`CONTENT_ENTRY_EXTENSION`)

`src/lib/extension/entry-extension.ts` declares a DI port (a `Symbol` + the
`ContentEntryExtension` interface) that a downstream plugin (e.g.
`@ortha-cms/i18n-server`) **binds** to extend the generic entries pipeline —
the same inversion as identity's `CONTENT_CATALOG`, roles swapped: the consumer
of the behavior declares the port here, the provider binds it. `EntriesService`
and `EntryWriterService` inject it with `@Optional()` and call it
**unconditionally**; an implementation MUST no-op for types it doesn't apply to.
Methods: `listScope` (extra list `WHERE`), `filterExtension` (virtual filter
fields resolved via the engine's `extensionFields` + `resolveExtension` seam),
`createColumns` (extra envelope columns on INSERT — may be **async**, e.g. to
validate a group id against the DB), `afterUpdate` (in-tx side-effects after a
save — runs on **both create and update**, e.g. syncing shared fields to locale
siblings; must no-op when nothing applies). The `?locale=` / `?localeFallback=`
query params and the create body
`locale` + `localeGroupId` are declared on the DTOs as **opaque strings** (the
strict `ValidationPipe` rejects undeclared keys) and forwarded to the port
without interpretation — `localeGroupId` on a create is what makes the new row a
**sibling** in an existing translation group (the extension stamps + validates
it), so there is no separate "create translation" route. `create` wraps its
insert in `uniqueGuarded`, so a duplicate `(group, locale)` on an `i18n` type is
a clean **409**. A boot check (`EntryExtensionBootCheck`) fails start-up if an
`i18n: true` type has no extension bound. Only one binding is supported (a
second consumer would need a composite).

## Generated storage (`buildTables`)

One `content_<name>` table per type; one `content_<name>_<field>` join table per
**many-relation** (`source_id`, `target_id`, and a float `position` for the
source's ordering of its links). Every table carries the base envelope: `id`, `workspace_id`
(plain uuid, no FK — the `workspaces` table is identity-owned; entries are
scoped to it in the app layer, see HTTP surface), `created_at`, `updated_at`.
A `publishable` type additionally gets `status` (`draft`/`published`) +
`published_at`; a `paranoid` type gets `deleted_at`. The list index is
`(workspace_id, status)` for publishable types, else `(workspace_id)`.
A required `boolean` gets `DEFAULT false`. Field/column collisions (two fields
snake-casing to the same column, a field clashing with a relation's `<field>_id`,
or a reserved envelope column) are rejected by `assertFields`.

**Required ⇒ NOT NULL only for non-publishable types.** A publishable type has a
draft stage, so its required fields stay **nullable** columns — "required" means
"required *to publish*", enforced by `EntryValidationService` at publish time, not
the DB (else an incomplete draft couldn't be saved). A non-publishable type is
always live, so its required fields are `NOT NULL`. `EntryWriterService` mirrors
this: create/update validate eagerly only for non-publishable types; publish
re-validates the stored row for publishable ones.

A **required link-managed relation** (an owning many-to-many, or the inverse of
one) can't be checked by `EntryValidationService` — its links never travel in the
`values` bag. `EntryWriterService.assertRequiredRelations` enforces it separately
by **counting the entry's links**: at the same gates (eagerly for non-publishable
creates/updates and published-row updates, inside the write transaction so it
sees the just-written rows; and at publish, against the stored links). A required
such relation with zero links is the same `422 is required`. A required single
relation is still an FK in `values`, validated there; an inverse-of-single owns
no writable link from this side, so it isn't enforced.

## The `/define` vs main-barrel split — IMPORTANT

Collection files and the host's drizzle-kit schema entry MUST import from
`@ortha-cms/content-server/define`, **not** the main barrel. drizzle-kit bundles
the schema's whole import graph with plain esbuild, which rejects the NestJS
decorators the main barrel pulls in via its controllers. `/define` re-exports
only the decorator-free DSL (`collection`, `single`, `field`, `joinTableOf`, types).

## Migrations are HOST-owned

This package emits no migrations. The HOST (`apps/server`) re-exports every
generated table from `src/content.ts` (use `joinTableOf(type, field)`
for join tables — it throws if a many-relation was renamed, instead of silently
dropping the table from the diff), runs `db:generate` against its own
`drizzle.config.ts`, and commits the SQL. `ContentPlugin({ types, migrations })`
carries a `migrations` descriptor (`__drizzle_migrations_content`) so the
standard `db:migrate` applies them with every other plugin's.

## HTTP surface (`/api/content-schema`, `/api/content`)

**Every `/content/:typeName…` entry route is workspace-scoped.** Each carries
identity's `WorkspaceGuard` (after `OriginGuard`/`PermissionsGuard`, so a request
rejected for CSRF or lacking permission never incurs the membership DB probe): it reads
the `X-Workspace-Id` header (400 if missing/malformed), 403s a caller who isn't a
member of that workspace, and exposes the id via `@CurrentWorkspace()`. The
entries services thread it through — `create` stamps `workspace_id`, and the
list + every read/write/bulk op filters by it — so an entry never leaks across
workspaces and an id from another workspace reads as a 404. The
`/content-schema` routes are **not** scoped (content types are code-defined and
global).

- `GET /content-schema` — summaries of every type (wizard-compatible).
- `GET /content-schema/:name` — the full field schema (types, validation, admin
  props); 404 if unknown.
- `GET /content/:typeName` — one page of a collection's entries
  (`?search=&filter=&sort=&page=&pageSize=&deleted=` → `{ items, total, page, pageSize }`).
  Resolves `:typeName` via the registry (404 if unknown), then runs the **generic**
  pipeline in `entries/` (`EntriesService`): an ILIKE search over text-like
  columns, the query-builder `?filter=` tree (translated against a `FilterSchema`
  **derived per-request** from the type's fields by `buildEntryFilterSchema`), a
  whitelisted sort with an `id` tiebreaker, and `LIMIT/OFFSET`. `status` is
  searchable/filterable/sortable and returned **only on publishable types**;
  paranoid types exclude soft-deleted rows by default, or list **only** them with
  `?deleted=only` (the trash view). A malformed filter → 400.
  **Relation preview (opt-in).** `?relations=preview&relationFields=a,b` adds a
  `relations` map to each row — per named field, one **capped page** of
  `RelationRef`s (`RELATION_PAGE_SIZE`) plus the true `total`. It is opt-in
  because the relation **picker** reuses this endpoint for candidates and must
  not pay for expansion; the admin sends it only for the records table's
  **visible** relation columns, so a hidden column costs nothing. Unknown names
  in `relationFields` are dropped (only keys on `type.fields` reach a query).
  Resolution is `RelationLinkService.previewForEntries` — **batched across the
  whole page**: one windowed query per relation *field*
  (`row_number()` for the cap, `count(*)` for the total, partitioned by the
  owning id) plus a batched `refsFor` for titles, covering owning single, owning
  many, and inverse alike. It is deliberately **not** built on the per-entry
  `readAll` (that would be an N+1 over rows); `relation-preview.spec.ts` pins
  the query count flat as the page grows. `values` is untouched — an owning
  single relation still carries its raw FK there, which is what a save submits.
- **Entry writes** (`EntryWriterService`, generic over the type like the reader;
  `entry-row.ts` holds the shared row↔record mappers). All validate via
  `EntryValidationService` — a failure is **422** with `{ message, issues:
  [{ field, message }] }`. Each resolves `:typeName` (404), guards state-changing
  requests with `OriginGuard` (CSRF), and is permission-gated:
    - `POST /content/:typeName` — create a draft (`content:create`). The insert
      runs in a transaction that first takes the workspace's **shared** advisory
      lock (`lockWorkspaceShared` from identity), coordinating with the workspace
      delete / content-revoke emptiness guards (which take it exclusively) so a
      new entry can't be orphaned by a concurrent delete/revoke.
    - `GET /content/:typeName/:id` — read one live entry (`content:read`).
    - `GET /content/:typeName/:id/relations` — every relation field's **first
      page** + total (`{ relations: { <field>: { items: RelationRef[], total } } }`,
      `RelationRef = { id, title, slug?, status?, missing? }`), for owning single/many
      **and** inverse back-references. A link whose target can't be resolved
      (soft-deleted, or outside the workspace) still yields a ref — id-only and
      flagged **`missing: true`**, so `items` never runs shorter than `total` —
      and the admin renders it as an unavailable record rather than printing the
      raw id. `slug` is the target's slug-field value —
      the field flagged `admin.widget === 'slug'`, else one literally named
      `slug` (`entrySlug` in `entry-row.ts`) — present only when the target has
      one and the row's slug is non-empty; the admin renders it as a `/handle`.
      `RelationLinkService.readAll` reads each field independently (paginated),
      so a relation with many links contributes only its first page, never every
      id. The editor titles single relations and seeds the section counts from it
      (`content:read`).
    - `GET /content/:typeName/:id/relations/:field?page=&pageSize=` — one page of
      a single relation field's links (`{ items, total }`), ordered by
      `position`. Drives the editor's **infinite-scroll** of a many/inverse
      relation. 400 if `field` isn't a relation (`content:read`).
    - `PATCH /content/:typeName/:id` — replace values (`content:update`).
    - `POST /content/:typeName/:id/publish` · `/unpublish` — stamp/clear
      `status`+`published_at`; publish **re-validates the stored row**; 400 on a
      non-publishable type (`content:publish`).
    - `DELETE /content/:typeName/:id` — soft delete (paranoid) or hard delete;
      `POST .../restore` + `DELETE .../permanent` for paranoid types
      (`content:delete`).
    - `POST /content/:typeName/bulk/{publish/preview,publish,unpublish,delete,restore,purge}` —
      `{ ids }` batch ops; `publish/preview` is a dry run returning a per-entry
      verdict (will-publish / already-published / blocked+issues / not-found),
      and `publish` re-validates and publishes only the valid drafts.
- **Routing order matters:** `BulkEntriesController` is registered **before** the
  single-item controllers in `ContentModule.forRoot` so the literal `bulk`
  segment wins over `:id` (single-item `:id` also carries `ParseUUIDPipe` as a
  backstop).
- **Relation persistence** (`RelationLinkService`): an owning **single** relation
  is a plain `<field>_id` FK column (written by `toColumns`, read off the row).
  Everything **join-backed** — an owning **many-to-many** and the **inverse**
  side of a two-way relation (which reuses the owning join table, source/target
  swapped) — is **paginated** on read and edited by an **incremental delta**
  carried in the save body (`SaveEntryDto.relations = { <field>: { link?, unlink?,
  order? } }`): inside the create/update transaction `applyDelta` unlinks the
  removed pairs, appends the new ones at `max(position)+1` for their source
  (`ON CONFLICT DO NOTHING`), and renumbers to `order` (owning side only) — so a
  relation with thousands of links is never sent or held whole, and the row and
  its links commit as one. The `max(position)+1` append is a read-modify-write on
  a contended column, so it first takes a **transaction-scoped advisory lock on
  the physical source list** (`<join table>:<sourceId>`, via `lockSource`) — the
  owning side, the inverse side, and a whole-set write all target the same list,
  and without it two concurrent appenders could read the same `max` and collide
  on `position`; the inverse loop locks its owners in sorted order to stay
  deadlock-free. A `relations` key that owns no writable link from this
  side — a single relation, an inverse-of-single (one-to-many), or an unknown
  key — is a **400** (so a delta is never silently dropped); a structurally
  malformed delta (`link`/`unlink`/`order` not a uuid array, an unknown inner
  key, an over-large id array, or too many fields) is a **400** at the DTO
  (`IsRelationDeltaMap`, which size-bounds the arrays and the map and rejects
  non-whitelisted inner keys), never a 500.
  `assertTargets` validates every linked id exists in the same workspace (uniform
  422, no enumeration signal). Join rows carry a float `position` (the source's
  own ordering) so a reorder survives a reload; the inverse reads by it but can't
  set it. An inverse of a *single* relation (one-to-many) owns no writable link
  from its side. The whole-document write still supports a many-relation
  submitted in the entry body (`writeLinks`, replace-set, position = array
  index) — used on **create** and by any legacy/bulk caller; a field absent from
  the body is left untouched (never wiped).
- Reads gated `@RequirePermissions(PERMISSIONS.CONTENT_READ)`; writes on the
  matching `content:create`/`update`/`publish`/`delete` (admin holds all,
  contributor create/update/publish, viewer read-only).

## The `entries` feature — layered (ADR-0003)

The **entries** feature is migrated to the tactical-DDD layering under
`src/lib/entries/`; the rest of the plugin (the DSL, registry, extension port,
schema builder) stays in its established shape — see the note below.

```
entries/
  domain/            # framework-free — the one hard rule
    entry.ts                       # Entry focused domain model (publish lifecycle)
    entry-publish-blocked.error.ts # transport-agnostic gate failure (carries issues)
    events/entry-events.ts         # entry.* domain-event factory + kinds
  application/
    use-cases/                     # publish / unpublish / bulk-publish / bulk-unpublish
  infrastructure/
    persistence/  # EntryWriterService (engine), entry-row (toColumns/toRecord),
                  # relation-link, entry-counter, bulk-publish-verdicts
    queries/      # EntriesService (list), entry-filter-schema, bulk-publish-preview
  http/
    controllers/  # thin controllers + resolve-type
    dto/          # class-validator DTOs (shape checks only)
  types/          # wire contracts (EntryRecord/EntryListView, bulk-publish)
```

**Why a focused domain model, not a full aggregate.** The entries engine is
**generic and registry-driven** — one `EntryWriterService`/`EntriesService`
backs *every* content type, with no per-aggregate table or fixed field set. A
classic row⇄aggregate aggregate + mapper would fight that metamodel (ADR-0003:
"DDD where it pays, CRUD where it doesn't"). So the part with real invariants —
the **publish lifecycle** — is modelled by the `Entry` domain object
(`draft ↔ published` via the `@ortha-cms/content-domain` state machine + publish
gate, raising `entry.published`/`entry.unpublished`), while the heavy,
battle-tested column/relation/extension persistence stays as the
`EntryWriterService` **infrastructure engine**. `domain/` imports nothing from
`@nestjs/*`, `drizzle-orm`, `class-validator`, or `infrastructure/`
(grep-enforced) — only the pure kernel and `@ortha-cms/database`'s framework-free
`createDomainEvent`/`DomainEvent`.

**The kernel (`@ortha-cms/content-domain`).** Field-value validation and the
publish gate live in the shared kernel; `EntryValidationService` delegates to it
(no behavior change) and the `Entry` model uses its `assertTransition`. See that
package's `AGENTS.md`.

**Use-cases + unit-of-work + outbox.** `publish`/`unpublish`/`bulk-publish`/
`bulk-unpublish` run through use-cases inside a `UnitOfWork` (from
`@ortha-cms/database`), so the status write and the `entry.*` outbox event commit
**atomically**; the status SQL is small executor-parameterized primitives on the
engine (`markPublished`/`markDraft`/`loadLiveByIdsForUpdate`/…). Bulk publish
keeps its **single locked (`FOR UPDATE`) transaction** (the TOCTOU protection the
original defended) and reports partial success; bulk unpublish keeps its
`{ count }` = live-matching-rows semantics and emits an event only per real
`published → draft` transition. Reads (list / get / relations / bulk-publish
preview) stay thin query services. **CRUD writes** (create / update / delete /
restore / purge and their bulk variants) stay on the engine directly — they carry
no publish-state transition, so per ADR-0003 they are not forced through the
lifecycle machinery; their domain rule (value validation) is already the kernel.
There is **no in-band `ACTIVITY_RECORDER`** in content today, so nothing to keep
in lockstep — the `entry.*` events are the audit seam a Wave-3 subscriber
consumes. create/update/delete event emission is **deferred** until those writes
move onto the `UnitOfWork` (they own their own advisory-lock/extension
transaction today).

**`CONTENT_ENTRY_EXTENSION` stays SYNCHRONOUS and unchanged.** It is an
**in-transaction open-host port** (i18n binds it for per-locale scoping,
column-stamping, and sibling sync). Its methods run *inside* the entry write
transaction — `createColumns` on the INSERT, `afterUpdate` after the row/relation
writes — so their effects commit or roll back with the write. It is **not** a
domain event and must not become one: an event fires post-commit, which would be
too late to stamp a NOT NULL `locale` column or to keep a save atomic with its
sibling sync. It is correct as-is and is left untouched by this migration.

The DSL / registry / schema-builder / extension-port machinery is deliberately
**not** turned into aggregates — that is the content framework/metamodel, and
forcing it into a domain shape would violate ADR-0003, not honor it. It keeps its
current layout and public API.

## Revisions — version history (`src/lib/revisions/`)

Every save keeps an immutable **snapshot** of the whole document, so an entry has
a browsable version history and can be restored. Layered per ADR-0003
(`domain / application / infrastructure / http`), sibling to `entries/`.

- **Storage.** One generic **HOST-owned** table, `content_entry_revisions`
  (defined in `revisions/infrastructure/persistence/revision-table.ts`, exported
  from the decorator-free `/define` barrel and re-exported by the host's
  `src/content/index.ts` for drizzle-kit — like every `content_<name>` table).
  One mechanism for all types, matching the generic `EntryWriterService`. Keyed
  **per-locale** (`entry_id` = the live row), so each translation has its own
  timeline. `snapshot` (jsonb) is `{ values, relations }`: the field values bag
  (scalars, localized + shared, single-relation FKs) plus the **full ordered
  link sets** of every join-backed relation (`RelationLinkService.snapshotLinks`).
- **Snapshot-on-save.** `EntryWriterService.create`/`update` append a **draft**
  revision **inside their existing transaction** (via the `REVISION_STORE` port),
  so the version commits atomically with the row + relation writes; the entry's
  advisory lock serializes concurrent savers so version numbers can't collide.
  This is the Phase-1 (history + restore) rollout — the live row still edits in
  place. Because these writes are **not yet on the `UnitOfWork`**, no
  `entry.revision.created` outbox event is emitted (same reason `entry.created`/
  `entry.updated` are still unemitted); the `Revision` model stays event-ready.
- **HTTP** (workspace-scoped, same guards as the entry routes):
  `GET :typeName/:id/revisions` (timeline, newest first), `.../revisions/:number`
  (one snapshot), `POST .../revisions/:number/restore` (`content:update`).
  `RestoreRevisionUseCase` re-applies a snapshot through `EntryWriterService.update`
  — which appends a **new** revision — so history is append-only (a restore of v2
  yields a fresh v6 equal to v2, never a rewrite).

## Architecture

- `ContentModule.forRoot(registry)` is **global** and exports the
  `CONTENT_REGISTRY` token + `EntryValidationService`. `ContentPlugin({ types })`
  builds the registry **eagerly** — duplicate names and unresolvable relation
  targets throw at construction, failing boot rather than the first request.
- It **binds identity's ports** to the registry: `CONTENT_CATALOG` (the type
  catalogue, so `GET /api/content-types` + the workspace-grant flow see the real
  code-defined types) and `CONTENT_ENTRY_COUNTER` (an `EntryCounterService`
  counting a type's rows in a workspace — and the workspace's total across all
  types — so identity's "revoke a content grant only when empty" and "delete a
  workspace only when it holds no content" checks see the real stored entries).
  Same inversion as `ACTIVITY_RECORDER` — identity owns the port, this plugin
  binds it.
- Register **after** `DatabasePlugin` + `IdentityPlugin` (it uses identity's
  `PermissionsGuard` and, for the entries list, the shared Drizzle client).
  Depends on `@ortha-cms/identity-server` (guards), `@ortha-cms/bootstrap-server`,
  `@ortha-cms/database` (`@InjectDatabase()` in `EntriesService`), and
  `@ortha-cms/utils-server` (the `?filter=` engine).
- `EntryValidationService` is the server-side authority for entry values (the
  admin renders the same rules as a courtesy). `EntryWriterService` calls it on
  every create/update and re-checks the stored row before any publish, so nothing
  invalid is written or published.
- Follows the `server-plugin` skill: thin controllers, permission-by-constant,
  JSDoc on exports, `interface` for contracts. The **`entries`** feature is
  layered per ADR-0003 (see above); the DSL / registry / schema machinery keeps
  the feature-then-kind layout.

## Commands

- `npx nx typecheck @ortha-cms/content-server` / `npx nx lint @ortha-cms/content-server`
- Migrations are generated on the **host**: `npx nx run server:db:generate --name=<change>`
