# Server E2E test catalog

> **Generated file — do not edit by hand.** Regenerate with
> `npx nx catalog server-e2e`. CI runs `npx nx catalog:check server-e2e`
> and fails if this file has drifted from the specs.

_54 test cases across 6 spec files._

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

<!-- source: apps/server-e2e/src/server/server.spec.ts -->
_<sub>apps/server-e2e/src/server/server.spec.ts</sub>_

## server bootstrap

| Test case |
| --- |
| responds 404 on an unknown route under the global prefix |
