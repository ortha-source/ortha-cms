# @ortha-cms/workspaces-server

The **workspaces** bounded context — the tenancy boundary (workspaces, their
memberships, and their content-access grants) and the `WorkspaceGuard` every
workspace-scoped route in other plugins is protected by.

> **Reference implementation of ADR-0003 (tactical DDD inside plugins).** This
> is the first context extracted into the layered shape; later contexts copy it.
> When a layering question is ambiguous, this package is the worked example.

## Layered layout

Unlike a feature-folder plugin (see the `server-plugin` skill), this package is
organized into the four tactical-DDD layers under `src/lib/workspace/`:

```
domain/          # framework-free core — the one hard rule below
  workspace.ts                     # Workspace aggregate root
  membership.ts / content-grant.ts # child entities
  value-objects/                   # Slug, WorkspaceId, WorkspaceColor, WorkspaceStatus
  workspace.repository.ts          # WorkspaceRepository PORT + WORKSPACE_REPOSITORY symbol
  slug-uniqueness.service.ts       # domain service (cross-aggregate rule)
  events/workspace-events.ts       # domain-event factory + kinds
  errors/                          # transport-agnostic domain errors
application/     # orchestration — one use case per state change
  use-cases/                       # create / update / set-status / add|remove-member / grant|revoke-content / delete
  queries/workspace.view.ts        # read-model view types
  content/                         # catalogue + entry-counter readers, content-selection resolver
  ports/                           # secondary ports (CONTENT_CATALOG, CONTENT_ENTRY_COUNTER, MEMBER_PROVISIONER)
  dto/                             # class-validator DTOs (shape checks only)
infrastructure/  # adapters — the only layer that knows Drizzle/pg
  persistence/  # DrizzleWorkspaceRepository, WorkspaceMapper, DrizzleMemberProvisioner, workspace-lock
  queries/      # read models (WorkspaceViewQuery — membership-scoped list, SlugAvailabilityQuery,
                #              MemberLookupQuery, MembershipCheckQuery)
  schema/       # Drizzle tables + external-refs stub
  content/      # the mock catalogue fallback
http/            # thin controllers + the two workspace guards + @CurrentWorkspace
```

## The tenancy boundary — membership, not permissions

**Membership decides *where* a user may act; permissions decide *what* they may
do. Both must pass.** Holding `workspaces:update` does not grant reach into a
workspace you don't belong to, and no endpoint ever returns one.

- **`GET /api/workspaces` is membership-scoped.** It serves
  `WorkspaceViewQuery.listForMember(actor.id)`; there is deliberately **no**
  unscoped `listAll()` on the query. The admin's sidebar quick-list, workspace
  switcher, command palette, home widgets, and the workspaces table all render
  from this one response, so scoping it here scopes all of them at once — and
  the list can't be used to enumerate ids.
- **Every `/workspaces/:id/…` route carries `WorkspaceMemberGuard`** alongside
  `PermissionsGuard` (update, archive/unarchive, delete, add/remove member,
  grant/revoke content, and both entry-count pre-checks).
- **Two guards, one rule.** `WorkspaceGuard` resolves the workspace from the
  `X-Workspace-Id` header (what feature plugins like content and media use);
  `WorkspaceMemberGuard` resolves it from the `:id` path param (what this
  context's own routes use). Both delegate to `authorizeWorkspaceAccess`
  (`http/guards/workspace-access.ts`), so what "has access" means can't drift
  between them. Both are exported from the barrel and provided globally.
- **A non-member always gets a flat 403 — never a 404.** "Not a member" and "no
  such workspace" are indistinguishable, so the routes leak no ids. The guard
  runs before the handler, so the handler's own `WorkspaceNotFoundError → 404`
  is now only reachable for a workspace the caller *is* a member of (i.e. one
  deleted concurrently).
- **There is still no per-workspace owner or role.** Membership is a pure link:
  any member with `workspaces:update` can add or remove any other member,
  including themselves — self-removal simply ends their own access.

## The one hard rule

**`domain/` imports NOTHING from `@nestjs/*`, `drizzle-orm`, `class-validator`,
or `infrastructure/`.** It may use `@ortha-cms/database`'s framework-free
`createDomainEvent`/`DomainEvent` and node built-ins only. The `@ortha-cms/nx`
layer-boundary lint isn't wired yet — self-enforce it. (The domain service and
value objects are plain classes; the module wires `SlugUniquenessService` via a
`useFactory` so the domain never sees `@Injectable`.)

## The aggregate

`Workspace` is the aggregate root. It owns its `Membership` links and
`ContentGrant`s, mints its own id, and is the **only** way to change workspace
state. Every mutator is idempotent and returns whether it actually changed
anything (so the application records an audit event only on a real change) and
raises a domain event. Invariants guarded here:

- **slug format** — via the `Slug` value object (the regex moved off the DTO's
  `@Matches` into `Slug.create`);
- **no orphaned content** — a workspace can't be deleted while it holds content
  entries (`assertDeletable`), and a grant can't be revoked while that type has
  entries (`revokeContent`); the entry counts come from the content context via
  the `CONTENT_ENTRY_COUNTER` port, so the application supplies them and the
  aggregate decides.

The aggregate exposes its accumulated `changes()` (a small persistence delta) so
`DrizzleWorkspaceRepository.save` emits minimal, idempotent SQL
(`onConflictDoNothing` membership/grant writes) — identical effects to the
transaction-script services this replaced.

## Ports & adapters

- `WorkspaceRepository` (`WORKSPACE_REPOSITORY`) → `DrizzleWorkspaceRepository`.
  `findByIdForContentMutation` loads under the workspace's **exclusive** advisory
  content lock — the loading strategy for delete/revoke, serializing against
  concurrent entry writes (which take the *shared* lock, exported for
  `content-server`). The lock is private infrastructure.
- `MemberProvisioner` (`MEMBER_PROVISIONER`) → `DrizzleMemberProvisioner`:
  provisions pending users for invited emails, drops stale ids.
- `CONTENT_CATALOG` / `CONTENT_ENTRY_COUNTER`: secondary ports **this context
  owns** and `content-server` binds — the acyclic inversion (content depends on
  workspaces for its route guards, so workspaces must not depend on content).
- `WORKSPACE_DIRECTORY` → `WorkspaceExistenceQuery`: the same inversion pointing
  the other way. **Identity** owns this port (this package depends on identity,
  so identity cannot depend back), and binds it here so minting an API token can
  reject a bucket naming a workspace that does not exist —
  `api_token_workspaces` deliberately carries no cross-plugin foreign key, so
  this is the only thing standing between a typo and a token scoped to nothing.
  Answers **existence**, not status: an archived workspace is still a valid
  scope.

## Unit of work + outbox

Each state-changing use case runs inside `UnitOfWork.run` (one transaction),
loads the aggregate via the repo port, calls one aggregate method, `save`s, and
appends `aggregate.pullEvents()` to the transactional outbox (`OutboxWriter`).
Reads (list / check-slug / counts / view assembly) bypass the aggregate as thin
CQRS query services.

## Audit transition (Wave 3 will change this)

Audit is **still recorded in-band** via the `ACTIVITY_RECORDER` token inside each
use case (same kinds/meta as before), so the audit log stays correct and
gap-free. The same operations **also** emit domain events to the outbox; with no
subscriber yet those auto-mark dispatched (harmless). **Do NOT double-record.**
Wave 3 moves auditing onto an outbox subscriber and removes the in-band
`recorder.record(...)` calls. The event `kind` strings intentionally match the
audit kinds so that move needs no data change.

## Schema note

`memberships.user_id` carries a cross-context FK to identity's `users(id)`. The
schema references `users` via a **reference-only stub**
(`infrastructure/schema/external-refs.ts`, not re-exported), so `drizzle-kit
generate` bundles a pure-Drizzle graph (importing identity's runtime barrel would
pull its NestJS providers into drizzle-kit's esbuild, which has no
`experimentalDecorators`). Runtime queries use identity's real table via the
services. Identity owns and migrates the physical `users` table (applied first).
