# @ortha-cms/activity-server

The audit-log **plugin** for the Ortha CMS server. It owns the
`activity_events` schema (and **ships its own migrations**), records events
**in-band and transactionally**, and exposes the read API the admin's Activity
Log drives.

A **generic sink**: `kind` and `meta` are open (text / jsonb). Each emitting
plugin owns its own kinds — identity (auth + workspaces), users (member
lifecycle) — so this package stays decoupled from any one domain's events.

Under `/api/activity`:

- `GET /activity` — filterable (`subjectType`/`subjectId`/`actorId`, `kind`
  CSV→`IN`, `actorEmail` search, `from`/`to` range), paginated
  (`page`/`pageSize`, 1-based), sortable (`sort=at|kind`, `order=asc|desc`,
  default `at desc`) audit log. Gated `@RequirePermissions(PERMISSIONS.ACTIVITY_READ)`.
  Drops `created_at` from the wire.

## Recording (in-band, transactional)

`ActivityService.record(input, executor = this.db)` appends one row. Mutating
services pass their **transaction** as `executor`, so the audit row commits iff
the mutation does — no `@nestjs/event-emitter`, no silently-dropped writes.
`ActivityService implements ActivityRecorder` — the port + `ACTIVITY_RECORDER`
token live in **`@ortha-cms/identity-server`** (the foundational package), and
this module binds the token. That indirection lets identity record
sign-in/out + workspace events without depending on this package, which depends
back on identity for the read API's guard — keeping the graph acyclic.

## Schema (isolation by design — the audit outlives its subjects)

- `actor_id` uuid with **no FK** (the actor may later be deleted);
  `actor_email` a frozen snapshot; `subject_id` **text** (not always a uuid);
  `meta` open jsonb (each emitter owns its shape); `at` (logical) vs
  `created_at` (write time). Indexes on `(subject_type, subject_id, at)`,
  `(actor_id, at)`, `(kind, at)`.

## Architecture

- `ActivityModule.forRoot()` is **global** and **exports `ActivityService`** +
  the `ACTIVITY_RECORDER` binding. `ActivityPlugin()` returns the `ServerPlugin`
  with a `migrations` descriptor (`__drizzle_migrations_activity`). Register it
  **after** `DatabasePlugin` + `IdentityPlugin`.
- DB via `@InjectDatabase()` (`Database` alias); guards from identity. Follows
  the `server-plugin` skill: feature-then-kind layout, thin controller,
  permission-by-constant, JSDoc on exports, `interface` for contracts.

## Commands

- `npx nx run @ortha-cms/activity-server:db:generate --name=<change>` (commit the SQL)
- `npx nx typecheck @ortha-cms/activity-server` / `npx nx lint @ortha-cms/activity-server`
