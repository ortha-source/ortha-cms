# Server E2E test catalog

> **Generated file — do not edit by hand.** Regenerate with
> `npx nx catalog server-e2e`. CI runs `npx nx catalog:check server-e2e`
> and fails if this file has drifted from the specs.

_178 test cases across 19 spec files._

<!-- source: apps/server-e2e/src/server/activity/activity-filter.spec.ts -->
_<sub>apps/server-e2e/src/server/activity/activity-filter.spec.ts</sub>_

## GET /api/activity (query-builder filter)

| Test case |
| --- |
| filters by a scalar kind rule (eq) |
| combines kinds with an OR group |
| filters by an `at` lower bound (gte) |
| AND-composes the filter with the existing kind param |
| rejects an unknown field with 400 (whitelist) |
| rejects malformed JSON with 400 |

<!-- source: apps/server-e2e/src/server/activity/activity.spec.ts -->
_<sub>apps/server-e2e/src/server/activity/activity.spec.ts</sub>_

## Activity log (GET /api/activity + recording)

### recording (in-band, transactional)

| Test case |
| --- |
| records user.signed_in on login and exposes it via the read API |
| records user.suspended when an admin disables a member |
| records user.role_changed with the from/to roles in meta |
| records user.invited with the email in meta |

### transactional guarantee

| Test case |
| --- |
| writes no audit row when the mutation is rejected and rolled back |
| records nothing for the member when re-enable is rejected |

### filtering, pagination, and sort

| Test case |
| --- |
| filters by a comma-separated kind list (IN) |
| filters by actor email (case-insensitive substring) |
| paginates with page/pageSize and echoes the envelope |
| sorts by time, newest first by default and oldest first on asc |
| returns an empty page for a future `from` bound |

### authorization (activity:read)

| Test case |
| --- |
| allows an admin (200) |
| forbids a contributor with 403 |
| forbids a viewer with 403 |
| rejects an unauthenticated request with 401 |

### logout

| Test case |
| --- |
| records user.signed_out for the session owner |
| records nothing extra for a logout with no live session |

<!-- source: apps/server-e2e/src/server/auth/login-throttle.spec.ts -->
_<sub>apps/server-e2e/src/server/auth/login-throttle.spec.ts</sub>_

## POST /api/auth/login (rate limit)

| Test case |
| --- |
| returns 429 once the limit is exceeded |

<!-- source: apps/server-e2e/src/server/auth/login.spec.ts -->
_<sub>apps/server-e2e/src/server/auth/login.spec.ts</sub>_

## POST /api/auth/login

### valid credentials

| Test case |
| --- |
| returns 201 with { ok: true } |
| sets an httpOnly session cookie |
| cookie carries the configured attributes (HttpOnly, Lax, Path, Max-Age, not Secure) |
| persists exactly one session row |
| opens a distinct session on each login |
| matches the email case-insensitively |

### rejected credentials (generic 401, no cookie)

| Test case |
| --- |
| rejects an unknown email |
| rejects a wrong password |
| rejects a pending (not-yet-active) user |
| rejects a disabled user |
| rejects a user with no password set (invite pending) |
| creates no session for a failed login |

### request validation (400)

| Test case |
| --- |
| rejects a missing email |
| rejects a missing password |
| rejects an empty body |
| rejects a malformed email |
| rejects an empty password string |
| rejects a non-string password |
| rejects a non-string email |
| rejects a null email |
| rejects an unknown extra field (forbidNonWhitelisted) |

### OriginGuard (login CSRF defense)

| Test case |
| --- |
| rejects a disallowed Origin with 403 |
| allows the configured Origin |
| allows a request with no Origin header |
| runs before body validation (bad Origin + bad body → 403) |

<!-- source: apps/server-e2e/src/server/auth/logout.spec.ts -->
_<sub>apps/server-e2e/src/server/auth/logout.spec.ts</sub>_

## POST /api/auth/logout

| Test case |
| --- |
| returns 201 { ok: true } and clears the cookie |
| revokes the session so the cookie no longer authenticates |
| is idempotent with no session cookie |
| is idempotent with a bogus session cookie |
| can be called twice with the same cookie (second is a no-op) |
| revokes only the presented session, not the user’s others |

### OriginGuard (CSRF defense)

| Test case |
| --- |
| rejects a disallowed Origin with 403 and keeps the session alive |
| allows the configured Origin |

<!-- source: apps/server-e2e/src/server/auth/me.spec.ts -->
_<sub>apps/server-e2e/src/server/auth/me.spec.ts</sub>_

## GET /api/auth/me

### unauthenticated (401)

| Test case |
| --- |
| rejects a request with no cookie |
| rejects a bogus session token |
| rejects an empty session cookie value |
| rejects when only unrelated cookies are present |
| rejects a malformed cookie header |

### authenticated

| Test case |
| --- |
| returns the current user after login (cookie flow) |
| exposes only the public fields (no hash/token leak) |
| includes the permission keys the user’s role grants |
| works with an explicitly forwarded session cookie |
| finds the session cookie among several cookies |
| reflects the user’s assigned role |

### invalidated sessions (401)

| Test case |
| --- |
| rejects an expired session |
| rejects a revoked session |
| rejects a session whose user was deleted |

<!-- source: apps/server-e2e/src/server/auth/root-admin.spec.ts -->
_<sub>apps/server-e2e/src/server/auth/root-admin.spec.ts</sub>_

## Root admin bootstrap (RootAdminSeeder)

### provisioning on boot

| Test case |
| --- |
| creates an active admin user with the configured email |
| lets the provisioned admin log in |

### idempotency & non-destructive behavior

| Test case |
| --- |
| returns "created" then "exists" for the same email |
| inserts no duplicate row on a repeat ensure |
| matches an existing email case-insensitively (no overwrite) |

### misconfiguration (fail-fast)

| Test case |
| --- |
| aborts boot when an email is configured without a password |

<!-- source: apps/server-e2e/src/server/content/content-schema.spec.ts -->
_<sub>apps/server-e2e/src/server/content/content-schema.spec.ts</sub>_

## Content schema (GET /api/content-schema)

### authorization

| Test case |
| --- |
| 401s an unauthenticated list request |
| 401s an unauthenticated detail request |
| 403s an authenticated user whose role lacks content:read |

### list

| Test case |
| --- |
| returns a summary of every code-defined content type |

### detail

| Test case |
| --- |
| returns the full field schema for a type |
| 404s an unknown content type |

<!-- source: apps/server-e2e/src/server/server.spec.ts -->
_<sub>apps/server-e2e/src/server/server.spec.ts</sub>_

## server bootstrap

| Test case |
| --- |
| responds 404 on an unknown route under the global prefix |

<!-- source: apps/server-e2e/src/server/users/get-user.spec.ts -->
_<sub>apps/server-e2e/src/server/users/get-user.spec.ts</sub>_

## GET /api/users/:id

| Test case |
| --- |
| rejects an unauthenticated request with 401 |
| returns the member with role and workspaces |
| flags the sole active admin with isLastAdmin |
| returns 404 for an unknown id |
| returns 400 for a non-uuid id |
| allows a viewer (holds users:read) to read a member |

<!-- source: apps/server-e2e/src/server/users/invite-user.spec.ts -->
_<sub>apps/server-e2e/src/server/users/invite-user.spec.ts</sub>_

## POST /api/users/invites

| Test case |
| --- |
| rejects an unauthenticated request with 401 |
| creates a pending member, assigns the role, and issues an invite token |
| assigns the new member to the given workspaces (unknown ids ignored) |
| rejects a non-UUID workspace id with 400 |
| rejects a duplicate email with 409 |
| treats an existing email case-insensitively (409) |
| rejects a malformed email with 400 |
| rejects an unknown role with 400 |
| rejects an unknown extra field with 400 |
| forbids a contributor (lacks users:create) with 403 |

<!-- source: apps/server-e2e/src/server/users/list-users-filter.spec.ts -->
_<sub>apps/server-e2e/src/server/users/list-users-filter.spec.ts</sub>_

## GET /api/users (query-builder filter)

| Test case |
| --- |
| filters by a scalar email rule (ilike, %v%) |
| filters by the role relation (role.key eq) via an EXISTS subquery |
| combines rules with an OR group |
| AND-composes the filter with the existing status param |
| rejects an unknown field with 400 (whitelist) |
| rejects an unknown operator with 400 |
| rejects malformed JSON with 400 |
| rejects a tree nested past the group-depth cap with 400 |
| rejects an empty `in` list with 400 (never silently matches all) |
| rejects an oversized `in` list with 400 (DoS guard) |
| treats an empty filter as no filter (returns all) |

<!-- source: apps/server-e2e/src/server/users/list-users.spec.ts -->
_<sub>apps/server-e2e/src/server/users/list-users.spec.ts</sub>_

## GET /api/users

| Test case |
| --- |
| rejects an unauthenticated request with 401 |
| returns the paginated envelope with the expected shape |
| never leaks the password hash |
| filters by a name or email substring, case-insensitively |
| paginates with page and pageSize |
| returns every status when unfiltered (the members grid contract) |
| scopes to active accounts when status=active (the typeahead contract) |
| rejects an unknown status with 400 |
| rejects an unknown query field with 400 |
| rejects a non-numeric page with 400 |
| accepts the maximum page size (100) |
| rejects a page size over the maximum with 400 |
| allows a viewer to read (users:read is granted to every role) |

<!-- source: apps/server-e2e/src/server/users/manage-invites.spec.ts -->
_<sub>apps/server-e2e/src/server/users/manage-invites.spec.ts</sub>_

## manage pending invites

### POST /api/users/:id/invites/resend

| Test case |
| --- |
| rotates the invite token, keeping exactly one live |
| rejects resending to an active member with 409 |
| returns 404 for an unknown id |
| forbids a contributor (lacks users:create) with 403 |

### DELETE /api/users/:id/invites

| Test case |
| --- |
| revokes a pending invite, deleting the placeholder user (204) |
| refuses to revoke an active member with 409 |
| returns 404 for an unknown id |
| forbids a contributor (lacks users:delete) with 403 |

<!-- source: apps/server-e2e/src/server/users/set-user-status.spec.ts -->
_<sub>apps/server-e2e/src/server/users/set-user-status.spec.ts</sub>_

## POST /api/users/:id/(disable|enable)

| Test case |
| --- |
| disables an active member and revokes their sessions |
| refuses to let a member disable themselves with 409 |
| rejects disabling an already-disabled member with 409 |
| re-enables a disabled member |
| rejects enabling an already-active member with 409 |
| returns 404 disabling an unknown id |
| rejects an unauthenticated request with 401 |
| forbids a contributor (lacks users:update) with 403 |

<!-- source: apps/server-e2e/src/server/users/update-user.spec.ts -->
_<sub>apps/server-e2e/src/server/users/update-user.spec.ts</sub>_

## PATCH /api/users/:id

| Test case |
| --- |
| rejects an unauthenticated request with 401 |
| changes a member’s role and persists it |
| updates the display name |
| refuses to demote the last remaining admin with 409 |
| allows demoting an admin when another active admin remains |
| rejects an unknown role with 400 |
| rejects an unknown extra field with 400 |
| returns 404 for an unknown id |
| returns 400 for a non-uuid id |
| forbids a viewer (lacks users:update) with 403 |

<!-- source: apps/server-e2e/src/server/users/user-sessions.spec.ts -->
_<sub>apps/server-e2e/src/server/users/user-sessions.spec.ts</sub>_

## User sessions (admin)

| Test case |
| --- |
| rejects unauthenticated access with 401 |
| lists a member’s live sessions |
| marks the caller’s own session as current |
| revokes a session and drops it from the list |
| is idempotent — revoking an unknown session still 204s |
| lets a viewer read sessions but not revoke them (403) |
| returns 400 for a non-uuid user id |

<!-- source: apps/server-e2e/src/server/workspaces/create-workspace.spec.ts -->
_<sub>apps/server-e2e/src/server/workspaces/create-workspace.spec.ts</sub>_

## POST /api/workspaces

### authenticated admin (holds workspaces:create)

| Test case |
| --- |
| creates a workspace and seeds the owner as its sole member |
| rejects a duplicate slug with 409 |

### authorization

| Test case |
| --- |
| rejects an unauthenticated request with 401 |
| forbids a contributor (lacks workspaces:create) with 403 |
| forbids a viewer (lacks workspaces:create) with 403 |

### validation (400)

| Test case |
| --- |
| rejects a missing name |
| rejects a slug with illegal characters |
| rejects an unknown extra field |
| rejects a missing content block |

### OriginGuard (CSRF)

| Test case |
| --- |
| rejects a disallowed Origin with 403 |
| allows the configured app origin |
| allows a request with no Origin (non-browser client) |

<!-- source: apps/server-e2e/src/server/workspaces/workspace-members.spec.ts -->
_<sub>apps/server-e2e/src/server/workspaces/workspace-members.spec.ts</sub>_

## Workspace members + activity

### workspace.created

| Test case |
| --- |
| records workspace.created when an admin creates a workspace |

### POST /api/workspaces/:id/members

| Test case |
| --- |
| adds a member and records workspace.member_added |
| is idempotent — re-adding a member records nothing new |
| 404s for an unknown workspace |
| 404s for an unknown user |
| forbids a contributor (lacks workspaces:update) with 403 |

### DELETE /api/workspaces/:id/members/:userId

| Test case |
| --- |
| removes a member and records workspace.member_removed |
| is a no-op (204) and records nothing when not a member |
| forbids a viewer (lacks workspaces:update) with 403 |
