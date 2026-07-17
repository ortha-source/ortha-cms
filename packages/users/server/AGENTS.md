# @ortha-cms/users-server

The users **plugin** for the Ortha CMS server: the member-management API the
admin's Members page drives. Exposes, under `/api/users`:

- `GET /users` — searchable (`?search=`, name/email `ILIKE`), paginated
  (`?page=&pageSize=`, 1-based) member list; each row joins the global role, the
  member's workspaces, and a server-computed `isLastAdmin` flag the UI uses to
  disable guarded controls. Also honours a query-builder `?filter=` tree.
- `GET /users/:id` — one member's full view (the same `MemberView` the list
  returns), backing the admin user detail page; `users:read`, 404 on unknown id.
- `POST /users/invites` — invite by email: creates a `pending` user + invite
  token, and optionally links the new member to `workspaceIds` (memberships;
  unknown ids are ignored). **No email is sent yet** (`TODO(users-email)`,
  identity epic #11).
- `PATCH /users/:id` — edit display name and/or role.
- `POST /users/:id/disable` / `POST /users/:id/enable` — flip account status;
  disabling also revokes the member's live sessions.
- `POST /users/:id/invites/resend` — rotate a pending member's invite token.
- `DELETE /users/:id/invites` — revoke a pending invite by deleting the
  placeholder row (cascades drop token + memberships). Real accounts are
  **never deleted** through this API.

> **Layered per ADR-0003 (tactical DDD inside plugins).** This is Wave 2 of the
> migration; the structure copies the `@ortha-cms/workspaces-server` pilot —
> when a layering question is ambiguous, that package is the worked example.

## Layered layout

Organized into the four tactical-DDD layers under `src/lib/member/`:

```
domain/          # framework-free core — the one hard rule below
  member.ts                        # Member aggregate root (identity's users row)
  member.repository.ts             # MemberRepository PORT + MEMBER_REPOSITORY symbol
  value-objects/                   # MemberId, Role, MemberStatus
  events/member-events.ts          # domain-event factory + kinds (member.*)
  errors/                          # transport-agnostic domain errors
application/     # orchestration — one use case per state change
  use-cases/                       # invite / update / set-status / resend-invite / revoke-invite
  queries/member.view.ts           # read-model view types (MemberView …)
  ports/                           # secondary ports (SESSION_REVOKER, WORKSPACE_LINKER)
  dto/                             # class-validator DTOs (shape checks only)
  member-activity.ts               # in-band audit kinds (user.*)
  member-filter.ts                 # query-builder filter schema
infrastructure/  # adapters — the only layer that knows Drizzle/pg
  persistence/  # DrizzleMemberRepository, MemberMapper, member-lock, InviteTokenService,
                # DrizzleSessionRevoker, DrizzleWorkspaceLinker
  queries/      # MemberViewQuery (the paginated list + byId read model)
http/            # thin controllers (routes/permissions/error-mapping unchanged)
member.constants.ts                # page sizes, invite TTL, filter length cap
```

## The one hard rule

**`domain/` imports NOTHING from `@nestjs/*`, `drizzle-orm`, `class-validator`,
or `infrastructure/`.** It may use `@ortha-cms/database`'s framework-free
`createDomainEvent`/`DomainEvent` and node built-ins only. The layer-boundary
lint isn't wired yet — self-enforce it.

## The aggregate

`Member` is the aggregate root — a person who can authenticate, mapping to
identity's `users` row (a single global `Role` + a `MemberStatus`). Workspace
memberships and invite tokens live in other contexts and are orchestrated by the
application layer via ports, not owned here. Every state change goes through a
method that enforces the invariants and (for the primary transitions) raises a
domain event. Invariants guarded here:

- **last-admin protection** — the last remaining *active admin* can be neither
  demoted (`changeRole`) nor disabled (`disable`); the current admin count is
  supplied by the application under a lock and the aggregate decides;
- **lifecycle validity** — only `active` disables, only `disabled` enables, only
  `pending` resends/revokes (`InvalidMemberStateError`).

The **self-action** guard (a member cannot disable or re-role their own account)
needs the acting user's identity, which the aggregate does not know, so the
application enforces it (`SelfActionError`).

## Ports & adapters

- `MemberRepository` (`MEMBER_REPOSITORY`) → `DrizzleMemberRepository` over
  identity's `users`/`roles` tables. `findByIdForAdminGuard` loads under the
  transaction-scoped **active-admin advisory lock** — the loading strategy for
  demote/disable, serializing against concurrent admin-count mutations so
  `countActiveAdmins()` returns a count the aggregate can trust (the lock is
  private infrastructure, `member-lock.ts`). Insert maps the DB's
  case-insensitive unique-email violation to `EmailTakenError`.
- `SessionRevoker` (`SESSION_REVOKER`) → `DrizzleSessionRevoker`: revokes a
  disabled member's live sessions (identity's `sessions`).
- `WorkspaceLinker` (`WORKSPACE_LINKER`) → `DrizzleWorkspaceLinker`: links an
  invited member to workspaces (the workspaces context's `memberships`).

## Last-admin race-safety

Preserved exactly as before: the write path takes `pg_advisory_xact_lock` at the
guarded load (`findByIdForAdminGuard`), then reads the admin count under it, so
two concurrent demotes/disables cannot both pass and drop the active-admin count
below one. The read model's `isLastAdmin` flag is advisory (UI hint) and needs
no lock.

## Unit of work + outbox

Each state-changing use case runs inside `UnitOfWork.run` (one transaction),
loads the aggregate via the repo port, calls one aggregate method, `save`s, and
appends `aggregate.pullEvents()` to the transactional outbox (`OutboxWriter`).
Reads (list / byId) bypass the aggregate as a thin CQRS query service
(`MemberViewQuery`).

## Audit transition (Wave 3 will change this)

Audit is **still recorded in-band** via the `ACTIVITY_RECORDER` token inside each
use case (`user.*` kinds, same meta as before), so the audit log stays correct
and gap-free. The same operations **also** emit `member.*` domain events to the
outbox; with no subscriber yet those auto-mark dispatched (harmless). **Do NOT
double-record.** Wave 3 moves auditing onto an outbox subscriber and removes the
in-band `recorder.record(...)` calls. Unlike the workspaces pilot, the users
event kinds (`member.*`) intentionally **differ** from the audit kinds
(`user.*`), so that move maps between the two catalogues rather than reusing the
same strings.

## Architecture notes

- Plain `ServerPlugin` factory (`UsersPlugin()`), no config, **no migrations**
  — every table it touches (`users`, `roles`, `memberships`, `workspaces`,
  `sessions`, `tokens`) is owned and migrated by `@ortha-cms/identity-server`
  (and, for `workspaces`/`memberships`, `@ortha-cms/workspaces-server`).
- Authorization: identity's `PermissionsGuard` bound per controller with
  `@RequirePermissions('users:read' | 'users:create' | 'users:update' |
  'users:delete')`. Authentication is identity's global `AuthGuard`.
- Module is **not** global and exports nothing; every provider is private.
- `InviteTokenService` mirrors identity's hashing convention: only the SHA-256
  of an invite token is stored; rotation keeps at most one live invite per user.

## Commands

- `npm exec nx typecheck @ortha-cms/users-server`
- `npm exec nx lint @ortha-cms/users-server`
- `npm exec nx test @ortha-cms/users-server`
