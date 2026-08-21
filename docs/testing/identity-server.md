# @orthacms/identity-server — Test Artifact

> **Unit:** `packages/identity/server` · **Package:** `@orthacms/identity-server` · **Kind:** server plugin
> **Source of truth:** `packages/identity/server/AGENTS.md`
> **Findings verified:** 2026-08-11 — 9 confirmed · 0 deleted · 3 corrected · 0 unverified
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

Identity owns **authentication** (who is this?), **RBAC** (what may they do?), the
**invite redemption** half of the invite flow, **self-service preferences**, **admin
session management**, and **external API bearer tokens**. It ships the auth/RBAC
Drizzle schema and its migrations.

It does **NOT** own:

- Issuing invites, editing members, disabling accounts — that is `@orthacms/users-server`.
- Workspaces / memberships — moved to `@orthacms/workspaces-server`. **`AGENTS.md` is stale
  here**: it documents a `workspaces/`, `users/` and `content/` feature folder under
  `src/lib/`, none of which exist in the tree (`find packages/identity/server/src -type d`).
  Treat the AGENTS.md §Conventions inventory as historical.
- The DB connection or migration execution (`@orthacms/database` + `@orthacms/nx`).
- Writing audit rows — since Wave 3 that is `activity/server`'s `AuditEventSubscriber`.
  `ACTIVITY_RECORDER` is retained but `@deprecated` and **nothing writes through it**
  (`packages/identity/server/src/lib/activity/activity-recorder.ts:53-57`).
- Email delivery. No mailer exists; invite tokens are handed back over HTTP.

### Entry points

| Verb + path | Controller | Auth | Permission |
| --- | --- | --- | --- |
| `POST /api/auth/login` | `auth/controllers/login.controller.ts:37` | `@Public()` + `ThrottlerGuard` + `OriginGuard` | none |
| `POST /api/auth/logout` | `auth/controllers/logout.controller.ts:28` | `@Public()` + `OriginGuard` | none |
| `GET /api/auth/me` | `auth/controllers/me.controller.ts:21` | session (global `AuthGuard`) | none |
| `GET /api/auth/invite/:token` | `auth/controllers/invite.controller.ts:54` | `@Public()` + `ThrottlerGuard` | none |
| `POST /api/auth/invite/accept` | `auth/controllers/invite.controller.ts:64` | `@Public()` + `ThrottlerGuard` + `OriginGuard` | none |
| `GET /api/users/:id/sessions` | `auth/controllers/user-sessions.controller.ts:67` | session + `PermissionsGuard` | `USERS_READ` |
| `DELETE /api/users/:id/sessions/:sessionId` | `auth/controllers/user-sessions.controller.ts:81` | session + `PermissionsGuard` + `OriginGuard` | `USERS_UPDATE` |
| `GET /api/preferences` | `preferences/controllers/preferences.controller.ts:27` | session | none (self-scoped) |
| `PUT /api/preferences` | `preferences/controllers/preferences.controller.ts:32` | session + `OriginGuard` | none (self-scoped) |
| `POST /api/api-tokens` | `api-tokens/http/controllers/api-tokens.controller.ts:64` | session + `PermissionsGuard` + `OriginGuard` | `TOKENS_CREATE` |
| `GET /api/api-tokens` | `api-tokens/http/controllers/api-tokens.controller.ts:83` | session + `PermissionsGuard` | `TOKENS_READ` |
| `DELETE /api/api-tokens/:id` | `api-tokens/http/controllers/api-tokens.controller.ts:99` | session + `PermissionsGuard` + `OriginGuard` | `TOKENS_DELETE` |

**Exported DI ports / values** (`src/index.ts`): `IdentityPlugin`, `IdentityModule`,
`PermissionsGuard`, `RequirePermissions`, `PERMISSIONS`, `PERMISSION_KEYS`,
`SYSTEM_ROLES`, `AccessPolicy`, `Actor`, `PERMISSIONS_KEY`, `OriginGuard`,
`CurrentUser`, `PublicUser`, `ApiTokenService`, `ACTIVITY_RECORDER`,
`IDENTITY_CONFIG` / `InjectIdentityConfig`, `MIN_PASSWORD_LENGTH`,
`MAX_PASSWORD_LENGTH`, and the whole Drizzle schema (`users`, `roles`,
`permissions`, `role_permissions`, `sessions`, `tokens`, `user_preferences`,
`api_tokens`, `api_token_workspaces`).

**App-wide guard.** `{ provide: APP_GUARD, useClass: AuthGuard }`
(`identity.module.ts:149`) — every route in the assembled app requires a session
unless `@Public()`.

### Runtime prerequisites

- Postgres: `docker compose up -d`.
- `.env` with `DATABASE_URL`, `ORTHA_ALLOWED_ORIGINS`, optional
  `ORTHA_ROOT_ADMIN_EMAIL` / `_PASSWORD` / `_NAME`, `INVITE_TTL_SECONDS`.
- Migrations applied: `npx nx run server:db:migrate` (identity ships
  `migrations/0000_init.sql` … `0003_api_token_workspaces.sql`).
- Boot seeds: `SystemRolesSeeder` then `RootAdminSeeder` (`identity.module.ts:96-101`).
  Without `ORTHA_ROOT_ADMIN_EMAIL` there is **no account at all** — identity is
  invite-only and there is no registration route.

### How to exercise it manually

```bash
docker compose up -d
npx nx run server:db:migrate
npm run dev                 # API on :3000, admin on :4200 (proxied /api)

# login (Origin must be in ORTHA_ALLOWED_ORIGINS)
curl -i -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:4200' \
  -d '{"email":"root@example.com","password":"<ORTHA_ROOT_ADMIN_PASSWORD>"}'
# → 201 {"ok":true} + Set-Cookie: ortha_session=…; HttpOnly; SameSite=Lax; Path=/

curl -s http://localhost:3000/api/auth/me -b 'ortha_session=<token>'
```

Interactive API reference: `http://localhost:3000/reference`.

### Dependencies that must be healthy

`@orthacms/database` (pool + `UnitOfWork` + `OutboxWriter`; registered **before**
identity), `@orthacms/bootstrap-server` (global `/api` prefix +
`ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`),
`@orthacms/activity-server` (the outbox subscriber that turns `auth.*` events
into audit rows — **optional**; without it logins are simply unaudited).

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | Email + password login, session cookie issued | `src/lib/auth/controllers/login.controller.ts:37`, `src/lib/application/use-cases/login.use-case.ts:48` | ✅ E2E |
| F2 | Uniform failure for unknown email / wrong password / pending / disabled / no-hash (timing-flat) | `src/lib/application/use-cases/login.use-case.ts:53-66` | ✅ E2E (body/status) · ⚠️ PARTIAL (timing unasserted) |
| F3 | Login rate limit (`ThrottlerGuard`, default 10/60s) | `src/lib/identity.module.ts:81-83`, `login.controller.ts:29` | ⚠️ PARTIAL |
| F4 | Login CSRF defense (`OriginGuard`) | `src/lib/auth/guards/origin.guard.ts:25-33` | ✅ E2E |
| F5 | `GET /auth/me` — current user + role permission keys | `src/lib/auth/controllers/me.controller.ts:21-25` | ✅ E2E |
| F6 | Global `AuthGuard`, `@Public()` opt-out | `src/lib/auth/guards/auth.guard.ts:31-54` | ✅ E2E |
| F7 | Session resolution rejects revoked / expired / non-`active` user | `src/lib/auth/services/auth.service.ts:54-74`, `drizzle-session.repository.ts:59-76` | ✅ E2E |
| F8 | Throttled `lastUsedAt` refresh (60s window) | `src/lib/application/use-cases/refresh-session.use-case.ts:29-41`, `domain/session-policy.ts:31-33` | ❌ NONE |
| F9 | Logout — revoke presented session only, idempotent, clears cookie | `src/lib/auth/controllers/logout.controller.ts:28-39`, `logout.use-case.ts:30-52` | ✅ E2E |
| F10 | Session cookie attributes (`HttpOnly` / `SameSite` / `Secure` / `Max-Age` / `Path`) | `src/lib/auth/services/cookie.service.ts:25-33` | ✅ E2E |
| F11 | Hand-rolled `Cookie` header parse | `src/lib/auth/services/cookie.service.ts:57-72` | ✅ E2E |
| F12 | `GET /auth/invite/:token` — describe an invite, read-only | `invite.controller.ts:54-61`, `describe-invite.use-case.ts:41-49` | ✅ E2E |
| F13 | `POST /auth/invite/accept` — activate + set first credential + sign in | `invite.controller.ts:64-86`, `accept-invite.use-case.ts:61-114` | ✅ E2E |
| F14 | Single-use invite via conditional `consumedAt` write | `drizzle-invite.repository.ts:49-60` | ✅ E2E |
| F15 | Invite expiry enforced in the lookup predicate | `drizzle-invite.repository.ts:34-43` | ✅ E2E |
| F16 | Every invite failure → one bare 404 | `invite.controller.ts:88-95` | ✅ E2E |
| F17 | Password length rule 12…72 + confirm-match | `auth/auth.constants.ts:7,15`, `accept-invite.dto.ts:14-35`, `matches-field.validator.ts` | ⚠️ PARTIAL |
| F18 | `GET /users/:id/sessions` — list a member's live sessions, `current` flag | `user-sessions.controller.ts:67-79` | ✅ E2E |
| F19 | `DELETE /users/:id/sessions/:sessionId` — revoke, scoped to `:id`, idempotent | `user-sessions.controller.ts:81-90`, `drizzle-session.repository.ts:124-138` | ✅ E2E |
| F20 | `GET /preferences` — own theme, defaults when no row | `preferences.controller.ts:27-30`, `preferences.service.ts:48-54` | ✅ E2E |
| F21 | `PUT /preferences` — upsert own theme, `ON CONFLICT DO UPDATE` | `preferences.service.ts:61-76` | ✅ E2E |
| F22 | `POST /api-tokens` — mint, plaintext once, dedupe bucket, reject past expiry | `api-tokens.controller.ts:64-79`, `api-token.service.ts:87-101` | ✅ E2E |
| F23 | `GET /api-tokens` — paginated metadata, `?workspaceId=` bucket-membership filter | `api-tokens.controller.ts:83-93`, `drizzle-api-token.repository.ts:109-148` | ✅ E2E |
| F24 | `DELETE /api-tokens/:id` — revoke, idempotent | `api-tokens.controller.ts:99-105`, `drizzle-api-token.repository.ts:154-161` | ✅ E2E |
| F25 | `ApiTokenService.verify` — unknown/revoked/expired all `null`; throttled `last_used_at` touch | `api-token.service.ts:110-121,160-167` | ⚠️ PARTIAL |
| F26 | Scope → permission-set map (`read` / `full`) | `api-tokens/domain/api-token-scope.ts:35-49` | 🧪 UNIT (`api-token-scope.spec.ts`) + ✅ E2E |
| F27 | `PermissionsGuard` → `AccessPolicy.canAll` all-of semantics | `rbac/guards/permissions.guard.ts:33-66`, `domain/access-policy.ts:54-60` | 🧪 UNIT (`access-policy.spec.ts`) + ✅ E2E |
| F28 | `Permission` shape validation | `domain/value-objects/permission.ts:12,30-35` | 🧪 UNIT (`permission.spec.ts`) |
| F29 | System-role seeding (idempotent, one transaction, `ON CONFLICT DO NOTHING`) | `rbac/seeders/seed-system-roles.ts`, `system-roles.ts:76-105` | ⚠️ PARTIAL |
| F30 | `RolesService.delete` refuses `isSystem` roles atomically | `rbac/services/roles.service.ts:21-40` | ❌ NONE |
| F31 | Root-admin bootstrap: idempotent, non-destructive, fail-fast without a password | `root-admin/services/root-admin.service.ts:43-106` | ✅ E2E |
| F32 | Password hashing bcrypt cost 12; token hashing SHA-256 | `auth/services/hashing.service.ts:10,25-50` | ⚠️ PARTIAL |
| F33 | `UserAccount` aggregate lifecycle (`activate`/`disable`/`enable`/`changeCredential`) | `domain/user-account.ts` | 🧪 UNIT (`user-account.spec.ts`) |
| F34 | `ChangePasswordUseCase` (no HTTP route wired) | `application/use-cases/change-password.use-case.ts:33-47` | ❌ NONE |
| F35 | OpenAPI security schemes contributed by the plugin | `utils/identity-plugin.ts:56-74` | ❌ NONE |
| F36 | `auth.signed_in` / `auth.signed_out` written to the transactional outbox | `login.use-case.ts:72-77`, `logout.use-case.ts:40-51` | ✅ E2E (via activity) |

## 3. Manual Test Plan

Unless stated, `BASE=http://localhost:3000/api` and every state-changing call carries
`-H 'Origin: http://localhost:4200'`.

### F1 — Login with email + password

**Preconditions:** an `active` user with a bcrypt password (root admin, or an invitee
who accepted). Server booted, migrations applied.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `POST $BASE/auth/login` body `{"email":"root@example.com","password":"<correct>"}` | `201`, body exactly `{"ok":true}` |
| 2 | Inspect `Set-Cookie` | `ortha_session=<opaque base64url>; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax` — and `Secure` **absent** in dev (`NODE_ENV!=production`) |
| 3 | `select count(*) from sessions where user_id = '<id>'` | exactly one new row |
| 4 | `select id from sessions where user_id='<id>'` | 64 hex chars (SHA-256), **not** the cookie value |
| 5 | Repeat step 1 | a second, distinct session row — the first stays live |
| 6 | Repeat step 1 with the email upper-cased | `201` (matched via `lower(email)`) |

### F2 — Uniform credential failure

**Preconditions:** one `active` user, one `pending` invitee, one `disabled` user.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Login with an email that does not exist | `401` `{"message":"Invalid credentials",…}`, no `Set-Cookie` |
| 2 | Login with the right email + wrong password | byte-identical `401` body to step 1 |
| 3 | Login as the `pending` invitee (null `password_hash`) | identical `401` |
| 4 | Login as the `disabled` user with the correct password | identical `401` |
| 5 | Time steps 1 and 2 ×20 each | medians within noise — a dummy bcrypt compare runs when there is no hash (`login.use-case.ts:56`) |
| 6 | `select count(*) from sessions` after all of the above | unchanged |

### F3 — Login rate limit

**Preconditions:** server booted with `rateLimit: { ttlSeconds: 60, limit: 3 }`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Three failed logins from one IP | `401` ×3 |
| 2 | A fourth request, any credentials | `429` |
| 3 | From a *different* source IP, one login | `401`/`201` — the bucket is per client IP |
| 4 | Wait 60s, retry | allowed again |

### F4 — Login CSRF defense (OriginGuard)

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `POST /auth/login` with `Origin: https://evil.example.com` | `403 Origin not allowed`, no session row |
| 2 | Same with `Origin: http://localhost:4200` | proceeds to credential check |
| 3 | Same with **no** `Origin` header | proceeds (documented allowance for non-browser clients) |
| 4 | Bad `Origin` **and** a malformed body | `403`, not `400` — the guard runs before validation |

### F5 — `GET /auth/me`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `GET $BASE/auth/me -b 'ortha_session=<token>'` | `200 { id, email, name, roleId, status, permissions[] }` |
| 2 | Diff the keys against `PublicUser` | no `passwordHash`, no session token, no `createdAt` |
| 3 | As `viewer` | `permissions` is exactly `["workspaces:read","users:read","content:read","media:read","copilot:use"]` (order-insensitive) |
| 4 | As `admin` | all 23 keys of `PERMISSION_KEYS` |

### F6 — Global AuthGuard + `@Public()`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `GET $BASE/auth/me` with no cookie | `401` |
| 2 | `GET $BASE/preferences` with no cookie | `401` |
| 3 | `POST $BASE/auth/login` with no cookie | reaches the handler (not `401`) |
| 4 | `POST $BASE/auth/logout` with no cookie | `201 {"ok":true}` |

### F7 — Session validity is re-checked per request

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Log in, then `update sessions set revoked_at = now() where id = '<hash>'` | next `GET /auth/me` → `401` |
| 2 | `update sessions set expires_at = now() - interval '1 hour'` | `401` |
| 3 | `update users set status='disabled' where id='<id>'` (session left live) | `401` |
| 4 | Set status back to `active` | the **same** cookie authenticates again |
| 5 | `delete from users where id='<id>'` | `401` (session cascades away) |

### F8 — `lastUsedAt` refresh throttle

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Note `last_used_at`; issue 5 `GET /auth/me` inside 10s | `last_used_at` unchanged |
| 2 | Wait > 60s, issue one more | `last_used_at` advances once |

### F9 — Logout

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Log in twice (two cookies A, B) | two live rows |
| 2 | `POST $BASE/auth/logout` with cookie A | `201 {"ok":true}`, `Set-Cookie: ortha_session=; Expires=Thu, 01 Jan 1970…` |
| 3 | `GET /auth/me` with A | `401` |
| 4 | `GET /auth/me` with B | `200` — only the presented session was revoked |
| 5 | Repeat step 2 with A | `201` again (idempotent), no second `user.signed_out` audit row |
| 6 | Logout with a garbage cookie value | `201`, no error |
| 7 | Logout with `Origin: https://evil.example.com` | `403`, session A still live |

### F10 / F11 — Cookie attributes and header parsing

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Boot with `NODE_ENV=production` | `Set-Cookie` includes `Secure` |
| 2 | Send `Cookie: a=1; ortha_session=<token>; b=2` | authenticates |
| 3 | Send `Cookie: ortha_session=` | `401` (empty value → `null`) |
| 4 | Send `Cookie: garbage-with-no-equals` | `401`, no 500 |
| 5 | Send `Cookie: other_session=<token>` | `401` |

### F12 — Describe an invite

**Preconditions:** an admin invited `grace@example.com`; you hold the raw token.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `GET $BASE/auth/invite/<token>` with no cookie | `200 {"email":"grace@example.com","name":"Grace Hopper"}` |
| 2 | Diff the keys | exactly `email` + `name` — no `userId`, no `role`, no `expiresAt` |
| 3 | Repeat step 1 | identical `200`; `select consumed_at from tokens` is still `null` |
| 4 | `GET $BASE/auth/invite/not-a-real-token` | `404` with an empty/bare body |

### F13 — Accept an invite

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `POST $BASE/auth/invite/accept` `{"token":"<raw>","password":"correct horse battery","confirmPassword":"correct horse battery"}` | `201 {"ok":true}` + `Set-Cookie: ortha_session=…` |
| 2 | `select status, password_hash from users where email='grace@example.com'` | `active`, hash starts `$2b$12$` |
| 3 | `select consumed_at from tokens where user_id=…` | non-null |
| 4 | `GET /auth/me` with the returned cookie | `200`, `roleId` = the role the **admin** chose |
| 5 | Log in with the chosen password | `201` |
| 6 | Add `"email":"other@evil.com"` to the accept body | `400` (`forbidNonWhitelisted`) — the identity cannot be swapped |
| 7 | Add `"role":"admin"` to the body | `400` — the role cannot be escalated |

### F14 — Single-use invite

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Accept once (F13) | `201` |
| 2 | POST the same token again | `404` |
| 3 | Fire two accepts concurrently for one fresh token | exactly one `201`, one `404`; one session row |

### F15 / F16 — Expiry and uniform 404

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `update tokens set expires_at = now() - interval '1s'` then describe | `404` |
| 2 | Accept the expired token | `404`, user still `pending` |
| 3 | Compare the bodies of "unknown token", "expired", "already accepted", "revoked" | all four byte-identical `404` |
| 4 | Admin resends the invite, then use the **old** link | `404` (rotation kills the old one) |

### F17 — Password rules

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Accept with an 11-char password | `400`, `consumed_at` still null, user still `pending` |
| 2 | Accept with `'a'.repeat(73)` | `400` |
| 3 | Accept with a 12-char password | `201` |
| 4 | Accept with mismatched `confirmPassword` | `400 "confirmPassword must match password"`; nothing consumed |
| 5 | Accept with `'é'.repeat(72)` (72 chars, 144 bytes) | **Expected `400`; observed `201`** → 🐞 BUG-identity-server-03 |

### F18 — List a member's sessions

**Preconditions:** admin session; a target member with 2 live sessions and 1 revoked.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `GET $BASE/users/<memberId>/sessions` as admin | `200` array of 2, newest-`lastUsedAt` first |
| 2 | Inspect a row | `{ id, userAgent, ipAddress, createdAt, lastUsedAt, expiresAt, current:false }` — no token |
| 3 | `GET $BASE/users/<yourOwnId>/sessions` | exactly one row has `current: true` |
| 4 | Repeat step 1 as a `viewer` | `200` — see 🐞 BUG-identity-server-04 |
| 5 | `GET $BASE/users/not-a-uuid/sessions` | `400` (`ParseUUIDPipe`) |
| 6 | `GET $BASE/users/<random uuid>/sessions` | `200 []` |

### F19 — Revoke a session

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `DELETE $BASE/users/<memberId>/sessions/<sessionId>` as admin | `204`; the row drops off F18's list |
| 2 | The member replays a request with that cookie | `401` immediately (no cache TTL) |
| 3 | Repeat step 1 | `204` (idempotent) |
| 4 | `DELETE` with a `sessionId` belonging to a *different* user | `204`, but that session stays live (scoped by `user_id`) |
| 5 | Repeat step 1 as a `viewer` | `403` |
| 6 | Repeat step 1 with `Origin: https://evil.example.com` | `403`, session still live |
| 7 | Revoke **your own** `current` session | `204` — the server does not block it; the next request is `401` |

### F20 / F21 — Preferences

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `GET $BASE/preferences` as a brand-new user | `200 {"theme":"system"}`, **no row written** |
| 2 | Diff the keys | exactly `theme` — no `userId`, no `updatedAt` |
| 3 | `PUT $BASE/preferences {"theme":"dark"}` | `200 {"theme":"dark"}`; one `user_preferences` row |
| 4 | `PUT … {"theme":"light"}` again | `200`; still exactly one row |
| 5 | `PUT … {"theme":"neon"}` | `400` |
| 6 | `PUT … {"theme":"dark","userId":"<someone else>"}` | `400` (`forbidNonWhitelisted`) |
| 7 | As user B, `GET /preferences` | B's own row — there is no id in the path to tamper with |

### F22 — Mint an API token

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `POST $BASE/api-tokens {"name":"CI","workspaceIds":["<ws>"],"scope":"read"}` as admin | `201` with `secret` starting `orthacms_`, `lookupPrefix` = its first 15 chars |
| 2 | `GET $BASE/api-tokens` | the row is present; **no `secret` field anywhere** |
| 3 | `select token_hash from api_tokens` | 64 hex chars ≠ the secret |
| 4 | Mint with `workspaceIds:["<a>","<a>","<b>"]` | `201`, `workspaceIds` is `["a","b"]` |
| 5 | Mint with `workspaceIds: []` | `400` |
| 6 | Mint with `expiresAt` in the past | `400 "expiresAt must be in the future."` |
| 7 | Mint with 101 workspace ids | `400` (`ArrayMaxSize`) |
| 8 | Mint as `contributor` | `403` |
| 9 | `select * from activity_events where kind like 'token%'` | **empty** → 🐞 BUG-identity-server-01 |

### F23 — List API tokens

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `GET $BASE/api-tokens` | `{ items, total, page:1, pageSize:25 }`, newest first |
| 2 | `?workspaceId=<a>` on a token bucketed `[a,b]` | appears exactly once |
| 3 | `?workspaceId=<b>` | the same token appears again, once |
| 4 | `?pageSize=101` | `400` |
| 5 | `?page=0` | `400` |
| 6 | `?workspaceId=not-a-uuid` | `400` |
| 7 | `?page=99999` | `200` with `items: []` and the real `total` |

### F24 — Revoke an API token

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `DELETE $BASE/api-tokens/<id>` | `204`; `revoked_at` set |
| 2 | Immediately call `GET /api/v1/entries/...` with that bearer | `401` — revocation is effective on the next request, there is no cache |
| 3 | Repeat step 1 | `204` (idempotent) |
| 4 | `DELETE $BASE/api-tokens/not-a-uuid` | `400` |
| 5 | `DELETE` an unknown uuid | `204` |

### F27 — Permission enforcement

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | As `viewer`, `GET $BASE/api-tokens` | `403 "Insufficient permissions"` |
| 2 | As `admin` | `200` |
| 3 | Unauthenticated | `401` (AuthGuard fires first) |
| 4 | Seed a role with **zero** grants and call a `@RequirePermissions` route | `403` |

### F29 — RBAC seeding idempotency

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Boot the server twice against the same DB | `select count(*) from roles` unchanged; `permissions` = 23 rows |
| 2 | `select count(*) from role_permissions where role_id = (admin)` | 23 |
| 3 | Boot two instances simultaneously | both succeed, no unique-violation crash |

### F31 — Root-admin bootstrap

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Boot with `ORTHA_ROOT_ADMIN_EMAIL/_PASSWORD` set, empty DB | log `Root admin provisioned: …`; one `active` user with the `admin` role |
| 2 | Reboot | log `Root admin already present: …`; no duplicate row |
| 3 | Change `ORTHA_ROOT_ADMIN_PASSWORD` and reboot | the stored hash is **unchanged** (non-destructive) |
| 4 | Set the email to a differently-cased variant and reboot | still `exists`, no second row |
| 5 | Boot with an email but **no** password | boot aborts with `MissingRootAdminPasswordError` |
| 6 | Boot with `ORTHA_ROOT_ADMIN_EMAIL=''` | log `No root admin configured` |
| 7 | `grep -i password` the boot log | the password never appears |

### F34 — ChangePasswordUseCase

**Preconditions:** none — this has no HTTP route. Exercise it from a unit/integration
harness or accept that it is unreachable.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `grep -rn "ChangePasswordUseCase" packages apps --include=*.ts` | only the provider registration and the class itself — no controller |
| 2 | Call `execute(userId, 'a-new-password')` in a test | the hash changes; **other sessions stay live** → 🐞 BUG-identity-server-05 |
| 3 | `select * from activity_events where kind='user.password_changed'` | empty — the raised event has no mapper |

## 4. Edge Cases & Negative Paths

### Empty / zero / absent

- **EC-01 — `POST /auth/login` with an empty body.** `✅ E2E`
  Expected: `400` listing both fields. Cited: `login.spec.ts:198`.
- **EC-02 — `email: null` / non-string.** `✅ E2E` — `400`, no 500. `login.spec.ts:216,220`.
- **EC-03 — `password: ""`.** `✅ E2E` — `400` from `@IsNotEmpty()`. `login.spec.ts:208`.
- **EC-04 — `GET /auth/invite/` (empty token segment).** `❌ NONE`
  Expected: `404` from the router (no matching route), never a 500.
- **EC-05 — `GET /preferences` with no stored row.** `✅ E2E` — synthesised defaults,
  and critically **no INSERT on a read** (`preferences.service.ts:53`). `preferences.spec.ts:64`.
- **EC-06 — Mint a token with `workspaceIds: []`.** `✅ E2E` — `400`.
  `api-tokens-management.spec.ts:115`.
- **EC-07 — `GET /users/:id/sessions` for a user with none.** `❌ NONE` — expect `200 []`,
  not `404`. (Correct: this endpoint deliberately does not distinguish an unknown user.)

### Boundary

- **EC-08 — Password exactly 12 chars / exactly 72 chars.** `⚠️ PARTIAL` — the specs test
  11 (`accept-invite.spec.ts:349`) and 73 (`:367`) but neither boundary itself.
- **EC-09 — `?pageSize=100` vs `101` on `/api-tokens`.** `❌ NONE` for tokens (tested for
  `/api/users` at `list-users.spec.ts:205,211`). Expected `200` then `400`.
- **EC-10 — `?page=1` with `total=0`.** `❌ NONE` — expect `items: []`, `total: 0`, not a 404.
- **EC-11 — `?page` beyond the last page.** `❌ NONE` — expect an empty page with the real
  `total`; the offset arithmetic `(page-1)*pageSize` (`api-token.service.ts:142`) has no cap,
  so a very large `page` is a full-table offset scan (see EC-42).
- **EC-12 — Session at exactly `expires_at`.** `❌ NONE` — the predicate is
  `expires_at > now()` (`drizzle-session.repository.ts:72`), so the instant of expiry is
  **already invalid**. Correct, but unasserted.
- **EC-13 — Invite at exactly `expires_at`.** `❌ NONE` — same strict `gt`
  (`drizzle-invite.repository.ts:41`).
- **EC-14 — `lastUsedAt` refresh at exactly 60 000 ms.** `❌ NONE` — `>` not `>=`
  (`session-policy.ts:32`), so exactly 60 000 ms does **not** refresh.
- **EC-15 — API token `expiresAt` exactly `now()`.** `❌ NONE` — `verify` uses `<= now`
  (`api-token.service.ts:117`), so it is expired. The controller rejects `<= Date.now()`
  at mint (`:118`), so a token can never be born at its own expiry.

### Size & encoding

- **EC-16 — 10 MB login body.** `❌ NONE` — expect `413` from Express's default 100 kb
  JSON limit, never an OOM.
- **EC-17 — Unicode / emoji password.** `❌ NONE` — **this is the bug.** `@MaxLength(72)`
  counts UTF-16 code units; bcrypt truncates at 72 **bytes**. See 🐞 BUG-identity-server-03.
- **EC-18 — Email with a trailing space / different case.** `⚠️ PARTIAL` — case is covered
  (`login.spec.ts:102`); leading/trailing whitespace is not. `class-validator`'s `@IsEmail`
  rejects `" a@b.com"`, so expect `400`.
- **EC-19 — RTL / combining characters in a token `name`.** `❌ NONE` — stored verbatim,
  rendered by the admin; verify no encoding corruption round-trips.
- **EC-20 — `%` / `_` in an invite token path segment.** `❌ NONE` — the token is
  `randomBytes(32).toString('hex')` so it is `[0-9a-f]{64}`; anything else simply misses
  the hash lookup. `encodeURIComponent` is applied client-side
  (`httpAuthGateway/index.ts:49`).
- **EC-21 — SQL metacharacters in `email`.** `❌ NONE` — every query is a parameterised
  Drizzle builder; `lower(${users.email})` (`user-lookup.query.ts:49`) interpolates the
  **column**, not user input. No injection surface, but worth one regression assertion.
- **EC-22 — A `Cookie` header with 200 cookies.** `❌ NONE` — `readSession` is a linear
  scan (`cookie.service.ts:62-70`); confirm no quadratic blowup.

### Permission matrix

The v1 matrix (`rbac/system-roles.ts:76-105`) is global — there is no per-workspace role.

| Route | `admin` | `contributor` | `viewer` | authenticated, no grants | unauthenticated |
| --- | --- | --- | --- | --- | --- |
| `POST /auth/login` | n/a | n/a | n/a | n/a | allowed (`@Public`) |
| `POST /auth/logout` | 201 | 201 | 201 | 201 | 201 |
| `GET /auth/me` | 200 | 200 | 200 | 200 | **401** |
| `GET /auth/invite/:token` | 200 | 200 | 200 | 200 | 200 (`@Public`) |
| `POST /auth/invite/accept` | 201/404 | 201/404 | 201/404 | 201/404 | 201/404 (`@Public`) |
| `GET /preferences` | 200 | 200 | 200 | 200 | **401** |
| `PUT /preferences` | 200 | 200 | 200 | 200 | **401** |
| `GET /users/:id/sessions` | 200 | **200** ⚠️ | **200** ⚠️ | 403 | 401 |
| `DELETE /users/:id/sessions/:sid` | 204 | 403 | 403 | 403 | 401 |
| `POST /api-tokens` | 201 | 403 | 403 | 403 | 401 |
| `GET /api-tokens` | 200 | 403 | 403 | 403 | 401 |
| `DELETE /api-tokens/:id` | 204 | 403 | 403 | 403 | 401 |

- **EC-23 — Every route carries a permission constant, not a literal.** `✅ verified`
  All five decorated sites in this package use `PERMISSIONS.*`
  (`user-sessions.controller.ts:68,82`; `api-tokens.controller.ts:65,84,100`).
- **EC-24 — Routes with no `@RequirePermissions` at all.** `✅ verified, intentional`
  `/auth/me` (any session), `/preferences` GET+PUT (self-scoped by `@CurrentUser()`,
  no id in the path to tamper with — `preferences.controller.ts:29,38`), and the four
  `@Public()` auth routes. None of them can act on another user.
- **EC-25 — `PermissionsGuard` without `AuthGuard`.** `❌ NONE` — the guard denies with
  `403` when `request.user` is absent (`permissions.guard.ts:48-50`) rather than crashing.
  There is no route in this package where that can happen, but the fail-closed branch is
  untested.
- **EC-26 — A `PermissionKey` that fails `Permission.create`'s regex.** `🧪 UNIT` shape
  only. A malformed key in `SYSTEM_ROLES` would make the guard throw a 500, not a 403
  (`permissions.guard.ts:60`). The `PermissionKey` union makes this a compile error, so it
  is a theoretical failure mode only.

### Tenant isolation & enumeration

- **EC-27 — Cross-user session revoke.** `⚠️ PARTIAL` — `revokeById` is scoped by
  `user_id` (`drizzle-session.repository.ts:131-133`) so a mismatched pair is a silent
  no-op returning `204`. `user-sessions.spec.ts:105` asserts the unknown-session case but
  **not** the wrong-owner case.
- **EC-28 — Does an unknown user id 403 or 404 on `/users/:id/sessions`?** `❌ NONE` —
  it returns `200 []`. That is the strongest answer: it leaks nothing about existence.
- **EC-29 — Does login distinguish "no such user" by status, body, or time?** `✅ E2E`
  for status+body (`login.spec.ts:116,125,131,146,161`); `❌ NONE` for **timing** —
  the dummy-hash equalisation (`login.use-case.ts:56`) is unasserted.
- **EC-30 — Does the invite describe endpoint distinguish live from dead?** `✅ E2E` —
  four distinct causes all render one bare 404 (`accept-invite.spec.ts:131,137,146,303`).
- **EC-31 — Can an API token pick a workspace outside its bucket?** Not decided here —
  `X-Workspace-Id` selection lives in `content/server`'s `public-api/`. Identity only
  guarantees the bucket is non-empty and returned with every read
  (`drizzle-api-token.repository.ts:83-93`). Covered by
  `apps/server-e2e/src/server/api-tokens/public-content-api.spec.ts`.

### Sessions

- **EC-32 — Session fixation on login.** `✅ safe` — `issue()` mints a fresh 256-bit
  token every time (`drizzle-session.repository.ts:41`); there is no pre-auth session to
  elevate. Asserted indirectly by `login.spec.ts:96` ("opens a distinct session on each login").
- **EC-33 — Logout is server-side.** `✅ E2E` — `revokeByToken` stamps `revoked_at`
  (`:89-98`); `logout.spec.ts:79` asserts the cookie stops working.
- **EC-34 — Concurrent-session limit.** `❌ NONE, and none exists.` A user may open
  unbounded sessions; nothing prunes expired rows (AGENTS.md admits "expired-session
  pruning" is deferred). Over years `sessions` grows without bound.
- **EC-35 — Revoking a session kills an in-flight request.** `⚠️ PARTIAL` — validity is
  re-read on every request (`auth.service.ts:55`), so the *next* request fails, but a
  long-running request already past the guard completes. Acceptable; unasserted.
- **EC-36 — Session TTL.** `Max-Age=604800` (7 days) in the test config, and `expires_at`
  is set from the same `ttlSeconds` (`session-policy.ts:22`). Cookie lifetime and row
  lifetime therefore cannot drift. `✅ E2E` (`login.spec.ts:87`).

### Invites

- **EC-37 — Token entropy and hashing at rest.** `❌ NONE` — the raw token is
  `randomBytes(32).toString('hex')` (256 bits) minted in `users-server`
  (`invite-token.service.ts:49`) and only its SHA-256 is stored
  (`:68`). Assert the DB never contains the raw value.
- **EC-38 — Replay an accepted invite.** `✅ E2E` (`accept-invite.spec.ts:234`).
- **EC-39 — Two concurrent accepts.** `✅ E2E` (`accept-invite.spec.ts:260`) — exactly one wins.
- **EC-40 — Accept an invite whose account is already `active`.** `✅ E2E`
  (`accept-invite.spec.ts:420`) — `404` via the `!account.status.isPending` branch
  (`accept-invite.use-case.ts:88`).
- **EC-41 — Change the email or role between issue and acceptance.** `✅ E2E`
  (`accept-invite.spec.ts:185`) — the DTO's `forbidNonWhitelisted` rejects any extra field,
  and the use case reads the role from the stored row, never the body.
- **EC-42 — Invite for an email that already exists.** Rejected upstream at issue time
  (`409`, `invite-user.spec.ts:116`). At accept time the token is bound to a `userId`, so
  there is no collision path. `✅ E2E`.

### Passwords

- **EC-43 — Algorithm and cost.** bcrypt, `SALT_ROUNDS = 12`
  (`hashing.service.ts:10`). `❌ NONE` — assert a stored hash matches `/^\$2[aby]\$12\$/`.
- **EC-44 — Timing-safe comparison.** Delegated to `bcrypt.compare`
  (`hashing.service.ts:35`), which is constant-time for a given hash. `❌ NONE`.
- **EC-45 — A corrupt / empty stored hash.** `verifyPassword` catches and returns `false`
  (`:37-39`), so a corrupt row reads as "wrong password" rather than a 500. `❌ NONE`.
- **EC-46 — Reset-token handling.** The `tokens` table has a `reset` enum member
  (`schema/tokens.ts:12`) but **no code path issues, describes, or redeems one.** Password
  reset does not exist. `❌ NONE` — nothing to test yet; flag it as a gap in the product.
- **EC-47 — Does a password change revoke other sessions?** **No.** See
  🐞 BUG-identity-server-05.

### Throttling

- **EC-48 — Throttle scope.** Per **client IP** per route handler (Nest's default
  `ThrottlerGuard` tracker), in-memory, **per process**
  (`identity.module.ts:76-83`). `⚠️ PARTIAL` (`login-throttle.spec.ts:42`).
- **EC-49 — Can an attacker lock out a victim?** Not by account — the bucket is not
  keyed on the email, so hammering `victim@x.com` costs the attacker's own IP quota, not
  the victim's. **But behind a proxy it locks out everyone** → 🐞 BUG-identity-server-02.
- **EC-50 — Is the throttle bypassable by varying the email case?** No — the key does not
  include the body. `❌ NONE`.
- **EC-51 — Is it bypassable by a header?** Not directly; but because `trust proxy` is
  unset, `X-Forwarded-For` is **ignored**, which is the safe direction (no spoofing) and
  the harmful one (no per-client bucketing). See BUG-identity-server-02.
- **EC-52 — Is `/auth/invite/accept` throttled?** Yes, same guard
  (`invite.controller.ts:45`) — an invite-token brute force costs the same 10/min.
  `❌ NONE`.
- **EC-53 — Is `/api-tokens` mint throttled?** No. An admin can mint unbounded tokens.
  Low risk (admin-only) but there is no quota. `❌ NONE`.

### Concurrency

- **EC-54 — Two concurrent logins for one account.** `✅ E2E` (`login.spec.ts:96`) —
  two independent rows, no contention.
- **EC-55 — Two concurrent invite accepts.** `✅ E2E` (`accept-invite.spec.ts:260`).
- **EC-56 — Two concurrent `PUT /preferences`.** `❌ NONE` — a single
  `INSERT … ON CONFLICT DO UPDATE` (`preferences.service.ts:65-72`), so last-write-wins
  with no lost row. Correct by construction.
- **EC-57 — Concurrent boot of two instances (role seeding).** `❌ NONE` —
  `ON CONFLICT DO NOTHING` in one transaction makes it safe; assert both boot cleanly.
- **EC-58 — Concurrent root-admin ensure.** `❌ NONE` — the case-insensitive unique index
  plus `onConflictDoNothing` (`root-admin.service.ts:101`) means exactly one insert.
- **EC-59 — Revoke a token while a request using it is in flight.** `❌ NONE` — `verify`
  re-reads the row per request, so the *next* request fails. There is **no cache**
  (`api-token.service.ts:112`), which is the correct answer to "does revocation take
  effect immediately or after a TTL?".

### Failure & partiality

- **EC-60 — Accept-invite fails after the token is burned.** `❌ NONE` — the burn, the
  activate, and the session insert all run inside one `uow.run`
  (`accept-invite.use-case.ts:68`), so a later failure rolls the burn back and the link
  stays usable. Assert by forcing a hash failure mid-flight.
- **EC-61 — The outbox append succeeds but the dispatcher never runs.** `❌ NONE` — the
  session commits and the audit row appears only on the next poll tick (5 s) or process
  restart. See the cross-cutting note in `docs/testing/activity-server.md`.
- **EC-62 — Migration applied twice.** `❌ NONE` — `__drizzle_migrations_identity`
  guards it; assert `nx run server:db:migrate` twice is a no-op.
- **EC-63 — `ACTIVITY_RECORDER` unbound (no activity plugin).** `❌ NONE` — identity
  injects nothing from it any more, so the app boots and logins simply go unaudited.

### Idempotency & replay

- **EC-64 — Replay a login request.** New session each time; no idempotency key. Correct.
- **EC-65 — Replay a logout.** `✅ E2E` (`logout.spec.ts:99`).
- **EC-66 — Replay a token revoke.** `204` both times (`drizzle-api-token.repository.ts:158`).
  `✅ E2E` implied by `api-tokens-management.spec.ts:167`; the second call is unasserted → `⚠️ PARTIAL`.
- **EC-67 — Replay `DELETE /users/:id/sessions/:sid`.** `✅ E2E` (`user-sessions.spec.ts:105`).

### 4A. Accessibility & Section 508 Conformance

**Scope.** This unit renders no UI — it is a NestJS plugin serving JSON. Under Revised
Section 508 (36 CFR Part 1194) its output is not "electronic content" a user perceives
directly, so the perceivable/operable criteria are **Not Applicable** here and belong to
`identity-admin`. What *does* apply, and is assessed below, is (a) whether the **error
payloads** this API returns carry enough information for a client to satisfy 3.3.1 / 3.3.3
on its behalf, (b) whether validation errors identify the offending field
**programmatically** rather than only in prose, and (c) the **504 (Authoring Tools)
data-model** question — whether the schema this plugin owns has anywhere to store the
accessibility-relevant information a conformant client needs.

**Not Applicable, with justification (one line each):** 1.1.1, 1.3.1–1.3.5, 1.4.1–1.4.13,
2.1.1/2.1.2, 2.4.1–2.4.7, 3.1.2, 3.2.1/3.2.2, 4.1.2, 4.1.3, 502.2/502.3, 503.4 — all
require a rendered user interface, a focusable control, or an accessibility tree; this
plugin produces none of these. 2.2.1 Timing Adjustable is **Not Applicable** in the WCAG
sense (the 7-day session TTL and the 10/min login throttle are security limits, which
2.2.1 exempts), but see `♿ A11Y-identity-server-03` for the client-facing consequence.
504.3 (prompt for accessibility information) is Not Applicable — no authoring UI here.

---

#### ♿ A11Y-identity-server-01 — Validation failures identify the offending field only inside an English prose sentence, never as a machine-readable field name

**SC:** 3.3.1 Error Identification (A), 3.3.3 Error Suggestion (AA)
**508:** E205.4 (WCAG 2.0 A/AA by reference) · 502.3.1 Object Information (via the client)
**Verdict:** **Partially Supports**
**Location:** `packages/bootstrap/server/src/lib/create-server.ts:28-34` (the global
`ValidationPipe`, no `exceptionFactory`); consumed by
`packages/identity/server/src/lib/auth/dto/accept-invite.dto.ts:16-35` and
`packages/identity/server/src/lib/preferences/dto/update-preferences.dto.ts:14-24`

The host constructs `new ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`
with **no `exceptionFactory`**, and `grep -rn "ExceptionFilter|exceptionFactory" packages
apps --include=*.ts` finds only `media/server`'s upload filter — nothing global. So a
`class-validator` failure serialises as Nest's default:
`{ "statusCode": 400, "error": "Bad Request", "message": ["password must be longer than or
equal to 12 characters", "confirmPassword must match password"] }`. The property name is
present, but only as the first token of a free-text English sentence.

**Repro:** `POST /api/auth/invite/accept` with a 5-character `password` and a mismatched
`confirmPassword`; inspect the response body.

**What a client can and cannot do:** to wire `aria-describedby` from the `password` input
to its own error node — the mechanism 3.3.1 actually depends on — the client must
**string-parse** `message[i]` to work out which field each entry belongs to. Nothing in the
payload states it. A screen-reader user therefore hears whatever the client managed to
guess: today `identity-admin` sidesteps this entirely by validating client-side and
mapping the server 400 to one generic banner, so the two per-field messages above are
announced as a single undifferentiated alert with no association to either input.
The strings are also English-only with no message key, so a localised client cannot
translate them — 3.1.2 is unreachable for any text sourced from here.

**Remediation:** give the host's `ValidationPipe` an `exceptionFactory` that emits
`{ field, code, message }` triples (the `constraints` keys `class-validator` already
produces), so a client can bind each error to its input and localise it. This is a
**bootstrap-server** change; filed here because identity's DTOs are the highest-traffic
consumer.

---

#### ♿ A11Y-identity-server-02 — The invite endpoints return a bodiless 404, so the client has no server-supplied text to present at all

**SC:** 3.3.1 Error Identification (A), 3.3.3 Error Suggestion (AA)
**508:** E205.4
**Verdict:** **Partially Supports**
**Location:** `packages/identity/server/src/lib/auth/controllers/invite.controller.ts:88-94`

```ts
/** Collapses an invalid-token failure to a bare 404; passes the rest through. */
private toHttpError(error: unknown): Error {
    if (error instanceof InvalidInviteTokenError) {
        return new NotFoundException();
    }
    …
}
```

`new NotFoundException()` with no argument serialises as
`{ "statusCode": 404, "message": "Not Found" }` — the bare HTTP reason phrase. Unknown,
expired, already-consumed and revoked invites are deliberately indistinguishable
(anti-enumeration, and correct — see the "Checked and cleared" list in §6).

**Consequence:** the security requirement and 3.3.3 genuinely conflict, and security
rightly wins. The residual accessibility duty therefore falls entirely on the client: it
must render its own explanatory text plus a recovery route ("ask your administrator for a
new invite"). `identity-admin` does render a dead-link state, but a *different* client
built against this API from the OpenAPI document alone would have literally nothing to
show. Verdict is Partially Supports rather than Supports because the contract does not
document that obligation.

**Remediation:** keep the flat 404, but document in the OpenAPI description for both invite
routes that the response body is intentionally uninformative and that clients MUST supply
their own user-facing message and recovery path.

---

#### ♿ A11Y-identity-server-03 — The schema this plugin owns can store a theme preference but has nowhere to store a user's language

**SC:** 3.1.1 Language of Page (A), 3.1.2 Language of Parts (AA)
**508:** 504.2 (Authoring Tools — accessibility information preserved) · 503.2 (user
preferences)
**Verdict:** **Does Not Support** (for the language half) / **Supports** (for the theme
half)
**Location:** `packages/identity/server/src/lib/schema/user-preferences.ts:23-38`,
`packages/identity/server/src/lib/preferences/dto/update-preferences.dto.ts:14-24`

`user_preferences` has exactly one preference column — `theme` (`light`/`dark`/`system`) —
and `UpdatePreferencesDto` accepts exactly one field, `theme`, under
`forbidNonWhitelisted`. There is **no locale, language, reduced-motion, or contrast
column**, and no other table in this plugin's schema (`users`, `roles`, `permissions`,
`role_permissions`, `sessions`, `tokens`, `api_tokens`) carries one.

**Why this is the server's finding, not the admin's:** `<html lang>` must reflect the
language the user actually reads. With no durable per-user locale, the admin can only ever
emit a build-time constant or a per-session browser guess, and a user's language choice
cannot survive a device change — a 508 §504.2 "accessibility information is not preserved"
gap at the data-model level, which is precisely the class of finding the spec calls out as
more valuable than a missing `aria-label`.

**The theme half is fine:** `system` is the column default
(`user-preferences.ts:29`) and the DTO's enum includes it, so the platform
`prefers-color-scheme` preference is honoured by default rather than overridden — 503.2
**Supports**. Reduced-motion and forced-colors need no persistence (pure CSS media
queries), so their absence here is correct, not a gap.

**Remediation:** add a nullable `locale` column to `user_preferences` (BCP-47, null =
"follow the browser"), widen `UpdatePreferencesDto`, and return it from
`GET /api/preferences` so the admin can set `<html lang>` from it.

---

**a11y verdict tally: 3 findings · 1 Supports (503.2, within A11Y-03) · 2 Partially
Supports · 1 Does Not Support (3.1.1, within A11Y-03) · the remaining WCAG 2.1 AA criteria
Not Applicable (no rendered UI), enumerated above.**
**a11y coverage: `❌ NONE`.** No suite asserts anything about this API's error-payload
shape. `apps/server-e2e` asserts status codes, never the body's field-level structure, and
axe has nothing to scan on a JSON endpoint.
**WCAG 2.2 (advisory only — 508 references 2.0):** 2.4.11 and 2.5.8 are Not Applicable
(no UI).

## 5. E2E Coverage Map

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F1 Login | `apps/server-e2e/src/server/auth/login.spec.ts:60,67,91,96,102` | 201 + `{ok:true}`, httpOnly cookie, one session row, distinct per login, case-insensitive email | ✅ E2E |
| F2 Uniform failure | `login.spec.ts:116,125,131,146,161,175` | unknown email / wrong password / pending / disabled / null-hash all 401 with no cookie and no session | ✅ E2E — but **no timing assertion**, so the dummy-hash equalisation is unverified |
| F3 Throttle | `apps/server-e2e/src/server/auth/login-throttle.spec.ts:42` | 3 × 401 then 429 with `limit: 3` | ⚠️ PARTIAL — one test; nothing about window reset, per-IP scoping, or behaviour behind a proxy |
| F4 OriginGuard | `login.spec.ts:235,242,249,253` | 403 on a bad Origin, pass on the configured one, pass with none, guard-before-validation | ✅ E2E |
| F5 `/auth/me` | `apps/server-e2e/src/server/auth/me.spec.ts:93,112,126,157` | current user, no hash/token leak, permission keys, role reflected | ✅ E2E |
| F6 AuthGuard | `me.spec.ts:69,73,79,83,87` | no cookie / bogus / empty / unrelated cookies / malformed header all 401 | ✅ E2E |
| F7 Session validity | `me.spec.ts:167,173,179,191,197,206` | expired, revoked, deleted user, suspended, reactivated, fell-back-to-pending | ✅ E2E — unusually thorough |
| F8 lastUsedAt throttle | — | — | ❌ NONE |
| F9 Logout | `apps/server-e2e/src/server/auth/logout.spec.ts:67,79,86,92,99,105,116,126` | clears cookie, revokes, idempotent ×3, per-device, Origin-guarded | ✅ E2E |
| F10 Cookie attributes | `login.spec.ts:76` | `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=604800`, `Secure` absent in the plain-HTTP test config | ✅ E2E — note it asserts `Secure` is **absent**, so the production `Secure` path is untested |
| F11 Cookie parsing | `me.spec.ts:83,87,150` | unrelated cookies, malformed header, found among several | ✅ E2E |
| F12 Describe invite | `apps/server-e2e/src/server/auth/accept-invite.spec.ts:92,105,118,131,137,146` | works with no session, leaks only email+name, does not consume, 404 unknown/expired/revoked | ✅ E2E |
| F13 Accept invite | `accept-invite.spec.ts:158,185,215` | activates + credential + session, role is the admin's choice, invitee can then log in | ✅ E2E |
| F14 Single use | `accept-invite.spec.ts:234,260` | same link twice fails; exactly one of two concurrent accepts wins | ✅ E2E |
| F15/F16 Expiry + uniform 404 | `accept-invite.spec.ts:284,303,318,420` | expired, unknown "without hinting", rotated-away, already-active | ✅ E2E |
| F17 Password rules | `accept-invite.spec.ts:349,367,382` | under-minimum 400, `'a'.repeat(73)` 400, mismatch 400 with nothing spent | ⚠️ PARTIAL — the 73 case is **ASCII only**, so the byte-vs-character bug (BUG-02) slips through; no exact-boundary cases |
| F18 List sessions | `apps/server-e2e/src/server/users/user-sessions.spec.ts:62,74,129` | lists live sessions, `current` flag on your own, 400 on a non-uuid | ✅ E2E |
| F18 role gate | `user-sessions.spec.ts:112` | **asserts a viewer may read another member's sessions** and may not revoke | ✅ E2E — the behaviour is deliberate; see 🐞 BUG-01 for why it is still a defect |
| F19 Revoke session | `user-sessions.spec.ts:83,105,112` | drops off the list, idempotent, viewer 403 | ⚠️ PARTIAL — no wrong-owner case, no Origin case, no self-revoke case |
| F20/F21 Preferences | `apps/server-e2e/src/server/preferences/preferences.spec.ts:64,72,86,105,126,148,175,186,204` | defaults, no leak, upsert, no duplicate row, each theme, validation ×4, Origin ×3 | ✅ E2E |
| F22 Mint token | `apps/server-e2e/src/server/api-tokens/api-tokens-management.spec.ts:59,80,101,115,154` | plaintext once, multi-workspace, dedupe, empty bucket 400, past expiry 400 | ✅ E2E |
| F23 List tokens | `api-tokens-management.spec.ts:123` | a multi-workspace token appears under each workspace, once each | ⚠️ PARTIAL — no pagination or page-size-cap assertions |
| F24 Revoke token | `api-tokens-management.spec.ts:167` | revokes | ⚠️ PARTIAL — no second-revoke idempotency, no "bearer stops working immediately" assertion here (that lives in `public-content-api.spec.ts`) |
| F25 verify() | `public-content-api.spec.ts` | unknown/revoked/expired bearer → 401 | ⚠️ PARTIAL — `last_used_at` throttling is unasserted |
| F26 Scope map | `packages/identity/server/src/lib/api-tokens/domain/api-token-scope.spec.ts` | each scope's exact permission set | 🧪 UNIT |
| F27 Permission guard | `api-tokens-management.spec.ts:183,198` + `access-policy.spec.ts` | a role with no grants gets 403 on GET and POST; unauthenticated 401; pure all-of semantics | ✅ E2E + 🧪 UNIT |
| F28 Permission VO | `permission.spec.ts` | shape validation | 🧪 UNIT |
| F29 Role seeding | `me.spec.ts:126` (indirect) | the admin's permission keys come back | ⚠️ PARTIAL — no direct idempotency or concurrent-boot test |
| F30 System-role protection | — | — | ❌ NONE — `RolesService.delete` has no caller and no test |
| F31 Root admin | `apps/server-e2e/src/server/auth/root-admin.spec.ts:41,48,58,74,88,122` | creates, can log in, created→exists, no duplicate, case-insensitive no-overwrite, fail-fast | ✅ E2E |
| F32 Hashing | — | — | ❌ NONE — no assertion on the bcrypt cost factor or the SHA-256 session id format |
| F33 UserAccount aggregate | `packages/identity/server/src/lib/domain/user-account.spec.ts` | lifecycle transitions + events | 🧪 UNIT |
| F34 ChangePassword | — | — | ❌ NONE |
| F35 OpenAPI schemes | — | — | ❌ NONE |
| F36 Outbox events | `apps/server-e2e/src/server/activity/activity.spec.ts:55,288,303` | `user.signed_in` on login, `user.signed_out` on logout, nothing for a phantom logout | ✅ E2E |

**Coverage tally: 36 features · 22 ✅ · 9 ⚠️ · 5 ❌**
(`🧪 UNIT` on F26/F28/F33 counted within the ✅ column; F26/F27 carry both markers.)

## 6. 🐞 Potential Bugs

### 🐞 BUG-identity-server-01 — API-token mint and revoke are completely unaudited · Severity: Medium · 🔒

> **Resolved on `claude/identity-server-bugs-tests-myase3`.** `mint`/`revoke` now run
> in a `UnitOfWork` and append `api_token.created` / `api_token.revoked` to the outbox;
> the activity subscriber maps them to `token.created` / `token.revoked` rows on an
> `api_token` subject. The payload carries the name, scope, bucket and the non-secret
> `lookupPrefix` — never the secret or its hash. A replayed (idempotent) revoke appends
> nothing.

> **Verified 2026-08-11.** Claim confirmed against source; **severity downgraded High →
> Medium** and the blast radius corrected — revocation is soft
> (`drizzle-api-token.repository.ts:154-160` sets `revoked_at`, it does not delete), so the
> `api_tokens` row and its `created_by` survive. The defect is a detection/forensics gap in
> the surface operators actually read, not a loss of all provenance, and it crosses no
> privilege boundary on its own.

**Location:** `packages/identity/server/src/lib/api-tokens/http/controllers/api-tokens.controller.ts:64-105`,
`packages/identity/server/src/lib/api-tokens/application/api-token.service.ts:87-154`
**Category:** correctness (audit gap) / security

**What the code does:**

```ts
async create(@Body() body: CreateApiTokenDto, @CurrentUser() user: PublicUser) {
    const expiresAt = parseExpiry(body.expiresAt);
    const { token, secret } = await this.tokens.mint({ …, createdBy: user.id });
    return { ...token, secret };
}
```

`mint` calls `repo.insert` and returns. `revoke` calls `repo.revoke` and returns. Neither
touches `OutboxWriter`, neither raises a domain event, and neither calls the
(now-deprecated) `ACTIVITY_RECORDER`. Cross-check the audit sink:
`packages/activity/server/src/lib/activity/infrastructure/audit-event-mapping.ts:143-206`
enumerates every audited kind — `workspace.*`, `member.*`, `auth.*`, `entry.*`. There is
no `token.*` entry, because no producer emits one.

**Why it is wrong:** minting a bearer credential that can read or write a workspace's
entire content, and revoking one, are the highest-privilege operations this package
exposes. `ARCHITECTURE.md:§5` describes audit as part of every mutation, and
`.cursor/BUGBOT.md` treats a missing audit row as a defect class. Every sibling mutation
in the repo emits one: `users-server` disable → `member.disabled` → `user.suspended`
(`set-member-status.use-case.ts:63`); `workspaces-server` delete → `workspace.deleted`.
API tokens are the only privileged mutation surface with no trail at all.

**Repro:**
1. Log in as admin; `POST /api/api-tokens {"name":"exfil","workspaceIds":["<ws>"],"scope":"full"}`.
2. `DELETE /api/api-tokens/<id>`.
3. `GET /api/activity?pageSize=100` (or `select kind from activity_events order by at desc`).
→ Observed: no row for either action. / Expected: `token.created` and `token.revoked`
rows naming the actor, the token id, its scope, and its workspace bucket.

**Blast radius:** a compromised or malicious admin session can mint a `full`-scope token
for every workspace, exfiltrate through the public content API, and revoke the token —
leaving **zero** evidence in the audit log, which is the only surface an operator reviews.
Provenance is not entirely lost: `revoke` is a soft update
(`drizzle-api-token.repository.ts:154-160`), so `api_tokens.created_by`, `created_at`,
`revoked_at`, `name`, `scope` and the bucket rows persist and can be read straight from the
database. What is missing is the timeline: nothing correlates the mint with the session,
IP, or user-agent that requested it, and nothing surfaces it to `GET /api/activity`.

**Suggested fix:** append `token.created` / `token.revoked` domain events to the outbox
inside a `UnitOfWork.run` in `ApiTokenService`, and add the two mappers to
`FACET_MAPPERS`. Do NOT implement.

---

### 🐞 BUG-identity-server-02 — Login throttling collapses to one global bucket behind a proxy (`trust proxy` is never set) · Severity: High · 🔒

> **Resolved on `claude/identity-server-bugs-tests-myase3`.** `createServer` gained a
> `trustProxy` option (sourced from `TRUST_PROXY`), applied to the Express adapter before
> anything reads `req.ip`. It stays **unset by default** — a directly-exposed server must
> not believe a client-supplied `X-Forwarded-For` — so this is a deployment setting, not a
> code default. `login-throttle.spec.ts` and `login-throttle-proxy.spec.ts` boot the app
> both ways.

**Location:** `packages/identity/server/src/lib/identity.module.ts:76-83`;
absence verified by `grep -rn "trust proxy\|trustProxy\|set('trust" apps packages --include=*.ts`
→ the only hit is the **comment** at `identity.module.ts:79`.
**Category:** permission-bypass / availability

**What the code does:**

```ts
// Per-instance, in-memory rate limit guarding /auth/login … set Express
// `trust proxy` behind a load balancer so the client IP — not the
// proxy's — is what gets throttled.
ThrottlerModule.forRoot([{ ttl: rateLimit.ttlSeconds * 1000, limit: rateLimit.limit }])
```

`ThrottlerGuard`'s default tracker is `req.ip`. Express derives `req.ip` from the socket
unless `app.set('trust proxy', …)` is configured. `createServer`
(`packages/bootstrap/server`) never sets it, and neither does `apps/server`.

**Why it is wrong:** the comment states the requirement and nothing satisfies it. In any
deployment behind a reverse proxy, load balancer, or ingress — i.e. every production
deployment — `req.ip` is the **proxy's** address for every request. All logins therefore
share a single 10-requests-per-minute bucket.

**Repro:**
1. Put the API behind nginx/Caddy on the default `IdentityPluginConfig` (limit 10/60 s).
2. From one client, send 10 failed logins in a second.
3. From a completely different client, attempt a valid login.
→ Observed: `429`. / Expected: the second client has its own quota.

**Blast radius:** two-fold. (a) **Availability** — any unauthenticated party can lock
every user out of the product indefinitely with ~10 requests per minute, at zero cost.
(b) **Forensics** — `ipAddress` recorded on every session row
(`login.controller.ts:47` → `drizzle-session.repository.ts:52`) is the proxy's IP, so the
admin Sessions tab shows the same address for everyone and the audit trail is useless for
"where did this sign-in come from?".

**Suggested fix:** set `trust proxy` on the Express instance from host config in
`createServer` (a transport concern, per the plugin's own note), and add a
`login-throttle` e2e case asserting two distinct `X-Forwarded-For` clients get
independent buckets. Do NOT implement.

---

### 🐞 BUG-identity-server-03 — `MAX_PASSWORD_LENGTH` is counted in characters but bcrypt truncates at bytes, so a non-ASCII passphrase is silently shortened · Severity: Medium · 🔒

> **Resolved on `claude/identity-server-bugs-tests-myase3`.** A `@MaxByteLength`
> validator replaces `@MaxLength` on `AcceptInviteDto.password`, and
> `HashingService.hashPassword` throws `PasswordTooLongError` past the bound as the
> backstop for the paths with no DTO (`ChangePasswordUseCase`, the root-admin bootstrap).
> The admin's client-side rule now measures bytes too.

**Location:** `packages/identity/server/src/lib/auth/auth.constants.ts:9-15`,
`packages/identity/server/src/lib/auth/dto/accept-invite.dto.ts:21-24`
**Category:** correctness / security

**What the code does:**

```ts
/** bcrypt silently truncates its input at 72 **bytes** — everything past that is
 *  ignored … We reject rather than truncate, so what the user typed is always
 *  what protects the account. */
export const MAX_PASSWORD_LENGTH = 72;
…
@MinLength(MIN_PASSWORD_LENGTH)
@MaxLength(MAX_PASSWORD_LENGTH)
password!: string;
```

`class-validator`'s `@MaxLength` measures `value.length` — UTF-16 code units, not bytes.
`HashingService.hashPassword` then calls `bcrypt.hash`, which truncates at 72 **bytes**.

**Why it is wrong:** the constant's own JSDoc states the invariant — "we reject rather
than truncate, so what the user typed is always what protects them" — and the
implementation does not hold it. Any password whose UTF-8 encoding exceeds 72 bytes while
staying ≤ 72 code units is accepted and silently truncated. `'é' × 72` is 72 code units
and 144 bytes: bcrypt sees only the first 36 characters. `'🔑' × 36` is 72 code units and
144 bytes: bcrypt sees the first 18 emoji. The admin client mirrors the same bug
(`packages/identity/admin/src/lib/domain/value-objects/password/index.ts:32-33`), so
neither side catches it.

**Repro:**
1. Issue an invite for `grace@example.com`.
2. `POST /api/auth/invite/accept` with `password` = `'é'.repeat(72)` (72 chars, 144 bytes),
   `confirmPassword` the same.
→ Observed: `201`, the account activates. Logging in with the **first 36 `é`** also
succeeds. / Expected: `400`, or the full passphrase actually protecting the account.

**Blast radius:** users who deliberately choose long non-ASCII passphrases get materially
less entropy than they believe. It is not exploitable without knowing the truncation
point, but it silently defeats the one control the product tells users to rely on
("length is what keeps a password hard to guess" —
`packages/identity/admin/src/lib/presentation/components/AcceptInviteForm/useAcceptInviteSchema.ts:20-21`).
`apps/server-e2e/src/server/auth/accept-invite.spec.ts:367` tests only `'a'.repeat(73)`,
which is 73 bytes and does trip the check, so the suite reads as green.

**Suggested fix:** validate `Buffer.byteLength(password, 'utf8') <= 72` with a custom
`class-validator` constraint, and mirror it in the admin's `Password` value object.
Do NOT implement.

---

### 🐞 BUG-identity-server-04 — Every signed-in role can read any member's session list, including IP addresses · Severity: Medium · 🔒

> **Resolved on `claude/identity-server-bugs-tests-myase3`.** Both `/users/:id/sessions`
> routes now require `users:update` rather than `users:read`. The admin already gated its
> Sessions tab on `users:update`, so only the API moved.

**Location:** `packages/identity/server/src/lib/auth/controllers/user-sessions.controller.ts:67-79`,
matrix at `packages/identity/server/src/lib/rbac/system-roles.ts:83,99`
**Category:** tenant-leak / privacy

**What the code does:**

```ts
@Get(':id/sessions')
@RequirePermissions(PERMISSIONS.USERS_READ)
async list(@Req() req, @Param('id', ParseUUIDPipe) id: string) { … }
```

`USERS_READ` is granted to **all three** system roles — `contributor`
(`system-roles.ts:83`) and `viewer` (`system-roles.ts:99`) both hold it. The response
includes `ipAddress` and `userAgent` for every live session
(`drizzle-session.repository.ts:104-110`).

**Why it is wrong:** the controller's own JSDoc calls this "Admin session management for a
single member" (`:46-47`) and the sibling revoke on the same controller correctly requires
`USERS_UPDATE` (admin-only). The read is gated on a permission every role holds, so the
stated intent and the enforced rule disagree. Substantively, home IP addresses and device
strings for every colleague are a category of data that a read-only `viewer` has no
business reading — the members roster deliberately exposes name/email/role/status
(`list-members.controller.ts:11-15`) and stops there.

**Repro:**
1. Log in as a `viewer`.
2. `GET /api/users/<any admin's id>/sessions`.
→ Observed: `200` with the admin's IP addresses, user-agent strings, and login times.
/ Expected: `403`.

**Note — this is asserted as intended.** `apps/server-e2e/src/server/users/user-sessions.spec.ts:112`
is titled "lets a viewer read sessions but not revoke them (403)". So the behaviour is a
deliberate decision, not an oversight, and the fix is a product call rather than a patch.
It is filed here because the decision looks unexamined: it is the only place in the
codebase where a `viewer` reads network-level metadata about another account, and the
JSDoc contradicts it.

**Blast radius:** any account with the lowest role can map every colleague's home/office
IPs and devices. In a CMS with external contributors on `viewer`, that is a meaningful
privacy exposure and a plausible finding in a security review.

**Suggested fix:** gate the list on `PERMISSIONS.USERS_UPDATE` (matching the revoke), or
introduce a dedicated `users:sessions:read` key. Update `user-sessions.spec.ts:112`
accordingly. Do NOT implement.

---

### 🐞 BUG-identity-server-05 — Changing a password does not revoke other sessions, and the change is unaudited · Severity: Medium · 🔒

> **Resolved on `claude/identity-server-bugs-tests-myase3`.** `ChangePasswordUseCase`
> revokes the account's live sessions in the same unit of work as the hash write
> (`SessionRepository.revokeAllForUser`, with `keepSessionId` to spare the caller's own
> device), and the `user.password_changed` event now has an audit mapper carrying the
> eviction count. Driven end-to-end out of DI by `change-password.spec.ts`, since the use
> case still has no HTTP route.

**Location:** `packages/identity/server/src/lib/application/use-cases/change-password.use-case.ts:33-47`
**Category:** permission-bypass (latent)

**What the code does:**

```ts
await this.uow.run(async () => {
    const account = await this.accounts.findById(id);
    if (!account) throw new UserAccountNotFoundError(userId);
    account.changeCredential(passwordHash);
    await this.accounts.save(account);
    await this.outbox.append(account.pullEvents());
});
```

No `SessionRepository` is injected and no revoke is performed. `users-server`'s disable
path does exactly the opposite — it injects `SESSION_REVOKER` and revokes in the same
transaction (`set-member-status.use-case.ts:61`), which is the pattern this use case
should copy. Separately, the `user.password_changed` event it drains has **no entry** in
`packages/activity/server/src/lib/activity/infrastructure/audit-event-mapping.ts:143-206`,
so it drains to the outbox, matches no subscriber, is auto-marked dispatched, and
produces no audit row.

**Why it is wrong:** "I changed my password because I think someone has my session" is the
single most common reason a user changes a password. Not revoking other sessions makes
that action ineffective. `AGENTS.md` states account status is "checked on every request"
as defense in depth, but a credential change flips nothing status-like, so the stale
session survives to its full 7-day TTL.

**Repro (no HTTP route exists — exercise via DI or a unit harness):**
1. Open two sessions A and B for one user.
2. `changePassword.execute(userId, 'a-brand-new-password')`.
3. `GET /api/auth/me` with cookie A.
→ Observed: `200`, cookie A still authenticates. / Expected: `401`.
4. `select * from activity_events where kind = 'user.password_changed'`.
→ Observed: empty.

**Blast radius:** currently **zero in production** — `grep -rn "ChangePasswordUseCase"`
finds only the provider registration in `identity.module.ts:118`; no controller wires it.
It is filed as Medium rather than Low because the class is presented as ready
("ready for that controller" — `change-password.use-case.ts:19`) and whoever adds the
route will inherit both gaps.

**Suggested fix:** inject `SESSION_REPOSITORY`, add a `revokeAllForUser(userId, exceptId?)`
port method, call it inside the same `uow.run`, and add a `user.password_changed` mapper
to `FACET_MAPPERS`. Do NOT implement.

---

### 🐞 BUG-identity-server-06 — A token can be minted for a workspace that does not exist · Severity: Low

> **Resolved on `claude/identity-server-bugs-tests-myase3`.** Minting validates the
> bucket against a new `WORKSPACE_DIRECTORY` port (identity owns it, the workspaces plugin
> binds `WorkspaceExistenceQuery`), so an unknown id 400s. A mixed real/phantom bucket is
> rejected whole rather than narrowed, and the check is existence, not status — an
> archived workspace stays a valid scope.

**Location:** `packages/identity/server/src/lib/api-tokens/http/dto/create-api-token.dto.ts:56-60`,
`packages/identity/server/src/lib/api-tokens/infrastructure/persistence/drizzle-api-token.repository.ts:60-75`
**Category:** correctness

**What the code does:** `workspaceIds` is validated as `@IsUUID(undefined, { each: true })`
and inserted straight into `api_token_workspaces`, which by design carries **no
cross-plugin FK** (`schema/api-tokens.ts:87`, documented as intentional). Nothing checks
that the ids resolve to real workspaces, or that the minting admin is a member of them.
Contrast `DrizzleWorkspaceLinker.link` in `users-server`
(`.../drizzle-workspace-linker.ts:25-31`), which explicitly filters the requested ids
down to ones that exist before inserting.

**Why it is wrong:** the package's own guarantee is that "no caller can observe a token
scoped to nothing" (`drizzle-api-token.repository.ts:51-53`). A token bucketed entirely
to non-existent uuids satisfies the letter of that (the bucket is non-empty) and violates
its intent: the admin sees a green "created" and a token that authenticates but can never
reach any content, with no error explaining why.

**Repro:**
1. `POST /api/api-tokens {"name":"typo","workspaceIds":["00000000-0000-4000-8000-000000000000"],"scope":"read"}`.
→ Observed: `201`. / Expected: `400` naming the unknown workspace, or `404`.

**Blast radius:** low. Workspace ids are `defaultRandom()` v4 uuids, so pre-minting a
token against a *future* workspace id is not feasible. The real cost is a confusing
failure mode (a token that silently works against nothing) and a stale-grant row that
outlives a deleted workspace.

**Suggested fix:** validate the bucket against the workspaces the caller can see (a
`WORKSPACE_EXISTS` port, mirroring `CONTENT_ENTRY_COUNTER`) and `400` on an unknown id.
Do NOT implement.

---

**Checked and cleared** (examined, no defect found):

- **Session token generation** — `randomBytes(32).toString('base64url')`, 256 bits,
  never predictable, never derived (`drizzle-session.repository.ts:41`).
- **Session hashing at rest** — the PK is SHA-256 of the token; the raw value is written
  nowhere (`:48`). A DB dump yields no usable sessions.
- **Session fixation** — no pre-auth session exists; login always mints a fresh token.
- **Invite one-time guarantee** — a single conditional `UPDATE … WHERE consumed_at IS NULL
  RETURNING` (`drizzle-invite.repository.ts:53-59`), not read-then-write. Correct under
  concurrency and e2e-proven.
- **Invite enumeration** — every failure mode collapses to one bare `NotFoundException`
  with no body (`invite.controller.ts:88-95`).
- **Login enumeration** — one bcrypt comparison always runs, including against a cached
  dummy hash when the account is absent (`login.use-case.ts:56`). Body and status are
  identical across all five failure modes.
- **Permission-by-constant** — all five `@RequirePermissions` sites in this package use
  `PERMISSIONS.*`, never a string literal.
- **Routes with no guard** — enumerated in EC-24; every ungated route is either `@Public()`
  by design or self-scoped through `@CurrentUser()` with no id in the path.
- **`RolesService.delete`** — the `is_system = false` predicate is in the SQL, so
  protection is atomic rather than check-then-act (`roles.service.ts:24`).
- **Root-admin bootstrap** — `onConflictDoNothing` on the case-insensitive unique index;
  never overwrites an existing password, role, or status; logs the email only.
- **`PreferencesService.save`** — one `INSERT … ON CONFLICT DO UPDATE`, no check-then-write.
- **`DEFAULT_PREFERENCES`** — frozen and copied per caller (`preferences.service.ts:23-30`),
  so one caller cannot mutate the process-wide default.
- **API-token revocation latency** — `verify` re-reads the row every request; there is no
  cache and therefore no TTL window.
- **Cookie attribute drift** — `clearSession` mirrors `setSession`'s `secure`/`sameSite`/
  `path`, so the browser matches and drops the cookie (`cookie.service.ts:41-49`).
- **`AccessPolicy`** — pure all-of membership test, framework-free, unit-tested.

**Defect tally:** `6 🐞 · 0 Critical · 1 High · 4 Medium · 1 Low · 5 🔒`
**Accessibility tally:** `3 ♿ · 1 Supports · 2 Partially Supports · 1 Does Not Support ·
the rest Not Applicable (server unit, no rendered UI)`
(A11Y-03 carries two verdicts — Supports for 503.2, Does Not Support for 3.1.1 — so the
verdict counts exceed the finding count by one.)

## 7. Recommended E2E Tests

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | `apps/server-e2e` | `server/api-tokens/api-tokens-audit.spec.ts` | minting and revoking a token each write an `activity_events` row naming the actor, token id, scope and bucket | 🐞 BUG-01 |
| 2 | `apps/server-e2e` | extend `server/auth/accept-invite.spec.ts` | a 72-character / 144-byte non-ASCII password is rejected with 400; a 72-**byte** password is accepted; log-in with the truncated prefix fails | 🐞 BUG-03, F17 ⚠️ |
| 3 | `apps/server-e2e` | extend `server/auth/login-throttle.spec.ts` | with `trust proxy` configured, two distinct `X-Forwarded-For` clients get independent buckets; without it they share one | 🐞 BUG-02, F3 ⚠️ |
| 4 | `apps/server-e2e` | `server/users/user-sessions.spec.ts` (extend) | a viewer gets 403 on the session list (post-fix); a wrong-owner `sessionId` leaves that session live; `Origin: evil` is 403; revoking your own `current` session 401s the next request | 🐞 BUG-04, EC-27, F19 ⚠️ |
| 5 | `apps/server-e2e` | `server/auth/login-timing.spec.ts` | 20 unknown-email and 20 wrong-password attempts have overlapping timing distributions (assert the medians are within a generous factor, not an exact bound) | EC-29, F2 ⚠️ |
| 6 | `apps/server-e2e` | `server/auth/change-password.spec.ts` | once the route lands: changing the password revokes the user's other sessions, keeps the caller's, and writes `user.password_changed` | 🐞 BUG-05, F34 ❌ |
| 7 | `apps/server-e2e` | extend `server/api-tokens/api-tokens-management.spec.ts` | `pageSize=100` OK / `101` 400; `page=0` 400; `page=9999` returns `[]` with the real total; a second `DELETE` still 204s; minting for an unknown workspace uuid | 🐞 BUG-06, F23/F24 ⚠️, EC-09/10/11 |
| 8 | `apps/server-e2e` | `server/auth/session-refresh.spec.ts` | five requests inside 10 s leave `last_used_at` untouched; one after 60 s advances it exactly once | F8 ❌ |
| 9 | `apps/server-e2e` | `server/auth/rbac-seed.spec.ts` | booting twice leaves 23 permissions, 3 roles and 23 admin grants; two simultaneous boots both succeed | F29 ⚠️, EC-57 |
| 10 | `apps/server-e2e` | `server/auth/hashing.spec.ts` | a stored password hash matches `/^\$2[aby]\$12\$/`; a stored session id is 64 lowercase hex and never equals the cookie value | F32 ❌ |
| 11 | `apps/server-e2e` | extend `server/auth/login.spec.ts` | with `cookieSecure: true` the `Set-Cookie` carries `Secure`; a 10 MB body is rejected with 413 | F10 ⚠️, EC-16 |
| 12 | `apps/server-e2e` | `server/auth/roles.spec.ts` | `RolesService.delete` throws `SystemRoleProtectedError` for a seeded role and `RoleNotFoundError` for an unknown id | F30 ❌ |
