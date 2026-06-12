# @ortha-cms/users-server

The users **plugin** for the Ortha CMS server: the member-management API the
admin's Members page drives. One feature (`users/`) exposing, under
`/api/users`:

- `GET /users` — searchable (`?search=`, name/email `ILIKE`), paginated
  (`?page=&pageSize=`, 1-based, defaults in `users.constants.ts`) member list;
  each row joins the global role, the member's workspaces, and a
  server-computed `isLastAdmin` flag the UI uses to disable guarded controls.
- `POST /users/invites` — invite by email: creates a `pending` user + invite
  token. **No email is sent yet** (`TODO(users-email)`, identity epic #11).
- `PATCH /users/:id` — edit display name and/or role.
- `POST /users/:id/disable` / `POST /users/:id/enable` — flip account status;
  disabling also revokes the member's live sessions.
- `POST /users/:id/invites/resend` — rotate a pending member's invite token.
- `DELETE /users/:id/invites` — revoke a pending invite by deleting the
  placeholder row (cascades drop token + memberships). Real accounts are
  **never deleted** through this API.

## Invariants (enforced in `UsersService`, inside transactions)

- The last remaining **active admin** cannot be demoted or disabled
  (`LastAdminProtectedError` → 409).
- A member cannot disable **their own** account (`SelfActionError` → 409).
- Lifecycle ops check state: only `active` can be disabled, only `disabled`
  enabled, only `pending` resent/revoked (`InvalidMemberStateError` → 409).
- Invite email uniqueness is checked up front and backstopped by the DB's
  case-insensitive unique index (`EmailTakenError` → 409).

## Architecture

- Plain `ServerPlugin` factory (`UsersPlugin()`), no config, **no migrations**
  — every table it touches (`users`, `roles`, `memberships`, `workspaces`,
  `sessions`, `tokens`) is owned and migrated by `@ortha-cms/identity-server`.
- Authorization: identity's `PermissionsGuard` bound per controller with
  `@RequirePermission('users:read' | 'users:create' | 'users:update' |
'users:delete')`. Authentication is identity's global `AuthGuard`.
- Module is **not** global and exports nothing; services are private.
- `InviteTokenService` mirrors identity's hashing convention: only the
  SHA-256 of an invite token is stored; rotation keeps at most one live
  invite token per user.

## Conventions

Follows the `server-plugin` skill: feature-then-kind layout
(`users/{controllers,services,dto,errors,types}`), one controller per use
case, thin controllers mapping domain errors to HTTP, `@InjectDatabase()`
with the `Database` alias, `interface` for contracts, JSDoc on exports.

## Commands

- `npm exec nx typecheck @ortha-cms/users-server`
- `npm exec nx lint @ortha-cms/users-server`
