# @orthacms/activity-server

The audit-log **plugin** for the Ortha CMS server. It owns the
`activity_events` schema (and **ships its own migrations**), records events by
**subscribing to the transactional outbox**, and exposes the read API the
admin's Activity Log drives.

A **generic sink**: `kind` and `meta` are open (text / jsonb). Each emitting
plugin owns its own kinds — identity (auth, API tokens, workspaces), users
(member lifecycle), content (publish lifecycle), media (asset + folder
lifecycle) — so this package stays decoupled from any one domain's events.

> **Adding a producer means adding a mapper here.** An event kind with no entry
> in `FACET_MAPPERS` is not an error anywhere: the dispatcher finds no
> subscriber, stamps the row `dispatched_at`, and the action is simply never
> audited. That failure is completely silent, and it has happened three times
> (API tokens, entry publishes, and the whole media library). The check is one
> query — compare `select distinct kind from outbox_events` against
> `AUDITED_EVENT_KINDS`.

> **Layered (ADR-0003 — tactical DDD inside plugins).** `activity` is a
> read-side / CRUD audit context: ADR-0003 says **don't force DDD on CRUD**, so
> there is **no aggregate**. The layering is light — a thin `ActivityService`
> query for the list read model, and the write side is one outbox
> `DomainEventSubscriber` under `activity/infrastructure/`. Wave 3 flipped this
> package from an in-band recorder to that subscriber.

Under `/api/activity`:

- `GET /activity` — filterable (`subjectType`/`subjectId`/`actorId`, `kind`
  CSV→`IN`, `actorEmail` search, `from`/`to` range), paginated
  (`page`/`pageSize`, 1-based), sortable (`sort=at|kind`, `order=asc|desc`,
  default `at desc`) audit log. Gated `@RequirePermissions(PERMISSIONS.ACTIVITY_READ)`.
  Drops `created_at` from the wire.

## Recording (outbox subscriber — the live path)

`activity/infrastructure/audit-event.subscriber.ts` (`AuditEventSubscriber`) is
the **single live audit writer**. It self-registers with the
`OutboxDispatcher` (from `@orthacms/database`) on `OnApplicationBootstrap`; the
dispatcher then delivers every audited domain event to it. `handle(event)` maps
the event to the same `activity_events` row the old in-band recorder wrote, via
the **pure** `audit-event-mapping.ts` (`toAuditRow`) — the event-kind → audit-kind
table (e.g. `member.* → user.*`, `auth.signed_in → user.signed_in`; workspace
kinds pass through). Producers put the actor on the event payload with
`attachActor(...)` before appending to the outbox, so the subscriber can recover
`actorId`/`actorEmail` from the event alone.

**Idempotent** (delivery is at-least-once): the row's primary key is the source
**event id** and the insert is `ON CONFLICT DO NOTHING`, so a re-delivered event
never double-records. The audit is derived downstream — the write path and the
audit path now evolve independently.

**A mapper may refuse.** `toAuditRow` returning `null` means "not an audited
kind, skip it" and the dispatcher marks the event delivered. Throwing
`UnmappableAuditEventError` means the opposite — this *should* be audited and
the payload cannot say who it is about — so the outbox row stays undispatched,
is retried with backoff, and parks at `MAX_DELIVERY_ATTEMPTS` for the
dead-letter query. `subject_id` is the only handle a row keeps on its subject
(no FK, no denormalised name), so a defaulted `''` is not a degraded row but an
unreadable one that no client can repair; refusing makes the gap loud instead.

**Parity is unit-tested** DB-free: `audit-event-mapping.spec.ts` asserts each
kind's produced row equals what the in-band `recorder.record(...)` wrote.

`ActivityService.record(...)` and the `ACTIVITY_RECORDER` token (the port lives
in **`@orthacms/identity-server`**, the foundational package; this module binds
it) are **retained but `@deprecated`** — nothing writes through them anymore.
They keep the public surface stable. That indirection kept the package graph
acyclic (identity never depended on this package); the outbox now decouples them
entirely.

## Schema (isolation by design — the audit outlives its subjects)

- `actor_id` uuid with **no FK** (the actor may later be deleted);
  `actor_email` a frozen snapshot; `subject_id` **text** (not always a uuid);
  `meta` open jsonb (each emitter owns its shape); `at` (logical) vs
  `created_at` (write time). Indexes on `(subject_type, subject_id, at)`,
  `(actor_id, at)`, `(kind, at)`.

## The copilot tool (`src/lib/copilot/`)

`ActivityCopilotToolProvider` binds one read tool, `activity_recent`, wrapping
`ActivityService.list`. Registered by `copilotToolsRegistrar('activity', …)` in
`ActivityModule.forRoot`, which injects the copilot registry **optionally** — a
deployment without `CopilotPlugin` is normal.

**The tool is deployment-wide, not workspace-scoped, and that is not an
oversight.** `activity_events` has no workspace column by design (see Schema
above): the trail records invites, role changes and workspace lifecycle
alongside content edits, and several of those belong to no workspace at all.
There is nothing to scope by, so the tool's description says so rather than
implying a boundary it cannot enforce.

What bounds it is `activity:read`, admin-only in the v1 role matrix and the same
key guarding `GET /api/activity`. The copilot's capability profile withholds the
tool at **offer** time, so a viewer's or contributor's run is never told it
exists (ADR-0005 §3), and re-checks at execution. An admin asking their copilot
about the audit log reads exactly what the Activity page already shows them.

`meta` is passed through rather than stripped. It is an open per-kind payload
and some of it is user-authored, so it is untrusted — but it reaches the model
inside the run engine's `fenceUntrusted` envelope like every other tool result.
The fence is what makes that safe; omission would only make the tool less useful.

## Architecture

- `ActivityModule.forRoot()` is **global** and **exports `ActivityService`** +
  the `ACTIVITY_RECORDER` binding. `ActivityPlugin()` returns the `ServerPlugin`
  with a `migrations` descriptor (`__drizzle_migrations_activity`). Register it
  **after** `DatabasePlugin` + `IdentityPlugin`.
- DB via `@InjectDatabase()` (`Database` alias); guards from identity. Follows
  the `server-plugin` skill: feature-then-kind layout, thin controller,
  permission-by-constant, JSDoc on exports, `interface` for contracts.

## Commands

- `npx nx run @orthacms/activity-server:db:generate --name=<change>` (commit the SQL)
- `npx nx typecheck @orthacms/activity-server` / `npx nx lint @orthacms/activity-server`
