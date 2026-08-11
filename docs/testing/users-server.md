# @ortha-cms/users-server — Test Artifact

> **Unit:** `packages/users/server` · **Package:** `@ortha-cms/users-server` · **Kind:** server plugin
> **Source of truth:** `packages/users/server/AGENTS.md`
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

The **member** bounded context: the member-management API behind the admin's Members
page, layered per ADR-0003 (`domain / application / infrastructure / http`). It owns the
`Member` aggregate and its invariants — last-admin protection, lifecycle validity — and
the invite-**issuing** half of the invite flow.

It owns **no tables and ships no migrations**. Every table it touches
(`users`, `roles`, `tokens`, `sessions`) belongs to `@ortha-cms/identity-server`;
`workspaces` / `memberships` belong to `@ortha-cms/workspaces-server`. It reaches them
through those packages' exported Drizzle schema objects.

It does **NOT** own:

- Authentication, sessions, RBAC evaluation, or invite **redemption** — identity does.
- Deleting a real account. `DELETE /api/users/:id/invites` deletes only a `pending`
  placeholder row; a live account is disabled, never deleted
  (`revoke-invite.use-case.ts:39`).
- Per-workspace roles. There are none — the role is a single global key.
- Sending email. `TODO(users-email)`; the raw invite token is returned over HTTP instead
  (`invite-member.use-case.ts:62-63`).

### Entry points

| Verb + path | Controller | Permission | Origin-guarded? |
| --- | --- | --- | --- |
| `GET /api/users` | `member/http/controllers/list-members.controller.ts:22` | `'users:read'` | n/a (read) |
| `GET /api/users/:id` | `member/http/controllers/get-member.controller.ts:29` | `'users:read'` | n/a (read) |
| `POST /api/users/invites` | `member/http/controllers/invite-member.controller.ts:37` | `'users:create'` | **NO** |
| `PATCH /api/users/:id` | `member/http/controllers/update-member.controller.ts:42` | `'users:update'` | **NO** |
| `POST /api/users/:id/disable` | `member/http/controllers/set-member-status.controller.ts:42` | `'users:update'` | **NO** |
| `POST /api/users/:id/enable` | `member/http/controllers/set-member-status.controller.ts:55` | `'users:update'` | **NO** |
| `POST /api/users/:id/invites/resend` | `member/http/controllers/resend-invite.controller.ts:40` | `'users:create'` | **NO** |
| `DELETE /api/users/:id/invites` | `member/http/controllers/revoke-invite.controller.ts:36` | `'users:delete'` | **NO** |

**Copilot tool.** `workspace_members_list` (`copilot/workspace-tool.provider.ts`),
registered into the shared registry, workspace-scoped via `WorkspaceMembersQuery`.

**DI ports declared and bound here:** `MEMBER_REPOSITORY` → `DrizzleMemberRepository`,
`SESSION_REVOKER` → `DrizzleSessionRevoker`, `WORKSPACE_LINKER` → `DrizzleWorkspaceLinker`
(`users.module.ts:74-79`). The module is **not** global and exports nothing.

### Runtime prerequisites

- Postgres + identity's migrations applied (this package adds none).
- System roles seeded (`admin` / `contributor` / `viewer`) — `roleIdByKey` throws a 500 if
  a key is missing (`drizzle-member.repository.ts:156-160`).
- A signed-in `admin`: `users:create` / `users:update` / `users:delete` are admin-only in
  the v1 matrix. `users:read` is held by **every** role.
- `IdentityPlugin` registered **before** `UsersPlugin` (it injects `IDENTITY_CONFIG` for
  `token.inviteTtlSeconds` — `invite-token.service.ts:32`).
- At least one other `active` admin if you intend to exercise demote/disable on an admin.

### How to exercise it manually

```bash
docker compose up -d && npx nx run server:db:migrate && npm run dev

BASE=http://localhost:3000/api
# authenticate first (see docs/testing/identity-server.md §1) and keep the cookie
curl -s "$BASE/users?page=1&pageSize=10" -b "$COOKIE"
curl -s -X POST "$BASE/users/invites" -b "$COOKIE" -H 'Content-Type: application/json' \
  -d '{"email":"grace@example.com","role":"contributor","name":"Grace Hopper"}'
# → 201 { …member…, "inviteToken":"<64 hex chars>" }   ← the ONLY time it is returned
```

Admin UI: `http://localhost:4200/users`.

### Dependencies that must be healthy

`@ortha-cms/identity-server` (guards, `users`/`roles`/`tokens`/`sessions` schema, config),
`@ortha-cms/workspaces-server` (`workspaces`/`memberships`), `@ortha-cms/database`
(`UnitOfWork` + `OutboxWriter`), `@ortha-cms/utils-server` (`parseFilterTree` /
`applyFilterTree`), `@ortha-cms/activity-server` (optional — without it every member
mutation is unaudited).

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | `GET /api/users` — paginated member list with role, workspaces, `isLastAdmin` | `list-members.controller.ts:22`, `member-view.query.ts` | ✅ E2E |
| F2 | `?search=` — case-insensitive name/email `ILIKE` | `list-members-query.dto.ts:29-37` | ✅ E2E |
| F3 | `?status=` — `pending` / `active` / `disabled` | `list-members-query.dto.ts:44-51` | ✅ E2E |
| F4 | `?filter=` — query-builder tree, AND-ed with the structured params | `member-filter.ts`, `list-members-query.dto.ts:60-71` | ✅ E2E |
| F5 | `?page` / `?pageSize` (1-based, capped at 100) | `member.constants.ts:2-5`, DTO `:73-99` | ✅ E2E |
| F6 | `GET /api/users/:id` — one member's full view | `get-member.controller.ts:29-36` | ✅ E2E |
| F7 | `POST /api/users/invites` — create a `pending` member + issue a token | `invite-member.controller.ts:37`, `invite-member.use-case.ts:45-80` | ✅ E2E |
| F8 | Duplicate-email rejection (up-front check + DB unique-index backstop) | `invite-member.use-case.ts:50-52`, `drizzle-member.repository.ts:89-96` | ✅ E2E |
| F9 | Optional `workspaceIds` on invite; unknown ids silently ignored | `drizzle-workspace-linker.ts:19-35` | ✅ E2E |
| F10 | `PATCH /api/users/:id` — rename and/or re-role | `update-member.controller.ts:42`, `update-member.use-case.ts:45-95` | ✅ E2E |
| F11 | Last-admin protection on demote, under an advisory lock | `member.ts:132-149`, `member-lock.ts:27-30` | ⚠️ PARTIAL |
| F12 | Self-role-change rejected (409) | `update-member.use-case.ts:66-68` | ❌ NONE |
| F13 | `POST /:id/disable` — disable + revoke live sessions in one transaction | `set-member-status.use-case.ts:46-65`, `drizzle-session-revoker.ts:17-23` | ✅ E2E |
| F14 | Self-disable rejected (409) | `set-member-status.use-case.ts:47-49` | ✅ E2E |
| F15 | Last-admin protection on disable | `member.ts:157-172` | ⚠️ PARTIAL |
| F16 | `POST /:id/enable` — reactivate a disabled member | `set-member-status.use-case.ts:68-88` | ✅ E2E |
| F17 | Lifecycle validity (only `active` disables, only `disabled` enables) → 409 | `member.ts:158,180` | ✅ E2E |
| F18 | `POST /:id/invites/resend` — rotate the token, reveal-once | `resend-invite.controller.ts:40`, `resend-invite.use-case.ts:38-68` | ✅ E2E |
| F19 | Resend rejected for a non-`pending` member (409) | `member.ts:197-204` | ✅ E2E |
| F20 | Rotation keeps exactly one live invite, under a per-user advisory lock | `invite-token.service.ts:48-82` | ⚠️ PARTIAL |
| F21 | Invite TTL from the host's `token.inviteTtlSeconds` | `invite-token.service.ts:51-52` | ❌ NONE |
| F22 | `DELETE /:id/invites` — delete the pending placeholder, cascading | `revoke-invite.controller.ts:36`, `revoke-invite.use-case.ts:31-44` | ✅ E2E |
| F23 | Revoke rejected for a non-`pending` member (409) | `member.ts:212-221` | ✅ E2E |
| F24 | Domain events → outbox → audit rows (`member.*` → `user.*`) | each use case's `outbox.append(attachActor(…))` | ✅ E2E |
| F25 | `isLastAdmin` advisory flag on every read | `member-view.query.ts` | ✅ E2E |
| F26 | `workspace_members_list` copilot tool, workspace-scoped | `copilot/workspace-tool.provider.ts`, `workspace-members.query.ts` | ⚠️ PARTIAL |
| F27 | `MemberId` / `Role` / `MemberStatus` value objects | `member/domain/value-objects/*` | 🧪 UNIT |
| F28 | Unique-violation (`23505`) → `EmailTakenError` (409, not 500) | `drizzle-member.repository.ts:166-177` | ⚠️ PARTIAL |

## 3. Manual Test Plan

`BASE=http://localhost:3000/api`; `$COOKIE` is an authenticated `admin` session unless a
step says otherwise.

### F1 — List members

**Preconditions:** ≥ 12 members across all three statuses; at least two admins.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `GET $BASE/users` | `200 { items, total, page:1, pageSize:10 }` |
| 2 | Inspect one item | `{ id, email, name, role:{id,key,name}, status, createdAt, isLastAdmin, workspaces[] }` |
| 3 | `grep passwordHash` the response | absent — assert this explicitly |
| 4 | Compare `total` to `select count(*) from users` | equal |
| 5 | Repeat as a `viewer` | `200` — `users:read` is held by every role |
| 6 | Unauthenticated | `401` |

### F2 / F3 / F5 — Search, status filter, pagination

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `?search=GRACE` | matches `grace@example.com` (case-insensitive, name **or** email) |
| 2 | `?search=` (empty) | same as no filter |
| 3 | `?status=active` | only `active` rows — this is the workspace-member typeahead's contract |
| 4 | `?status=archived` | `400` |
| 5 | `?page=2&pageSize=5` | rows 6–10, `page:2`, `pageSize:5` echoed |
| 6 | `?pageSize=100` | `200` |
| 7 | `?pageSize=101` | `400` |
| 8 | `?page=0` | `400` |
| 9 | `?page=9999` | `200`, `items: []`, real `total` |
| 10 | `?page=abc` | `400` |
| 11 | `?bogus=1` | `400` (`forbidNonWhitelisted`) |
| 12 | `?search=<256 chars>` | `400` (`@MaxLength(255)`) |

### F4 — Query-builder filter

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `?filter={"op":"and","rules":[{"field":"role","op":"eq","value":"admin"}]}` | admins only |
| 2 | Combine with `?status=active` | intersection (AND) |
| 3 | `?filter={"field":"passwordHash",…}` | `400` — the schema is a whitelist |
| 4 | `?filter=not-json` | `400`, not 500 |
| 5 | `?filter=` with 4097 chars | `400` (`FILTER_MAX_LENGTH`) |
| 6 | A tree nested past the depth cap | `400` |
| 7 | `{"op":"in","value":[]}` | `400` — an empty `in` must never silently match all |

### F6 — Get one member

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `GET $BASE/users/<id>` | `200`, same shape as a list item |
| 2 | `GET $BASE/users/<random uuid>` | `404` |
| 3 | `GET $BASE/users/not-a-uuid` | `400` |
| 4 | As a `viewer` | `200` |
| 5 | On the sole active admin | `isLastAdmin: true` |

### F7 / F8 / F9 — Invite a member

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `POST $BASE/users/invites {"email":"grace@example.com","role":"contributor","name":"Grace Hopper"}` | `201` with `status:"pending"` and `inviteToken` = 64 hex chars |
| 2 | `select token_hash from tokens where type='invite'` | 64 hex chars ≠ the returned token |
| 3 | `GET $BASE/users/<newId>` | the member is there; **no `inviteToken` field** |
| 4 | Invite the same email again | `409 "A user with this email already exists"` |
| 5 | Invite `GRACE@EXAMPLE.COM` | `409` (case-insensitive) |
| 6 | Invite with `"role":"superuser"` | `400` |
| 7 | Invite with `"email":"not-an-email"` | `400` |
| 8 | Invite with `"name":""` | `400` (`@IsNotEmpty`) |
| 9 | Invite with `workspaceIds:["<real>","<random uuid>"]` | `201`; only the real workspace is linked |
| 10 | Invite with `workspaceIds:["<a>","<a>"]` | `400` (`@ArrayUnique`) |
| 11 | Invite with an extra field `"isAdmin":true` | `400` |
| 12 | As a `contributor` | `403` |
| 13 | Unauthenticated | `401` |

### F10 / F11 / F12 — Update a member

**Preconditions:** two `active` admins (A = you, B), one contributor C.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `PATCH $BASE/users/<C> {"name":"Grace H."}` | `200` with the new name |
| 2 | `PATCH $BASE/users/<C> {"role":"admin"}` | `200`, `role.key === "admin"` |
| 3 | `PATCH $BASE/users/<C> {}` (empty body) | `200`, unchanged view, **no** audit row |
| 4 | `PATCH $BASE/users/<C> {"name":"Grace H."}` again (same value) | `200`, **no** audit row (rename returns `false`) |
| 5 | Demote B to `viewer` while A is still admin | `200` |
| 6 | Now demote A (the last admin) | `409 "The last remaining admin cannot be demoted"` |
| 7 | `PATCH $BASE/users/<A> {"role":"viewer"}` — your own id, with another admin present | `409 "You cannot change your own role"` |
| 8 | `PATCH $BASE/users/<A> {"name":"Ada L."}` — rename **yourself** | `200` — renaming yourself is allowed, only re-roling is not |
| 9 | `PATCH` with `"role":"root"` | `400` |
| 10 | `PATCH $BASE/users/<random uuid>` | `404` |
| 11 | `PATCH $BASE/users/not-a-uuid` | `400` |
| 12 | As a `viewer` | `403` |
| 13 | `PATCH` with `Origin: https://evil.example.com` | **Expected 403; observed 200** → 🐞 BUG-users-server-01 |

### F13 / F14 / F15 / F16 / F17 — Disable and enable

**Preconditions:** member M is `active` with two live sessions; two admins exist.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `POST $BASE/users/<M>/disable` | `200` with `status:"disabled"` |
| 2 | `select revoked_at from sessions where user_id='<M>'` | **both** rows stamped |
| 3 | M replays a request with either cookie | `401` |
| 4 | M attempts to log in | `401` (identity refuses a non-`active` account) |
| 5 | `POST $BASE/users/<M>/disable` again | `409` (already disabled) |
| 6 | `POST $BASE/users/<yourOwnId>/disable` | `409 "You cannot disable your own account"` |
| 7 | Demote the second admin, then disable the remaining admin | `409 "The last remaining admin cannot be disabled"` |
| 8 | `POST $BASE/users/<M>/enable` | `200` with `status:"active"` |
| 9 | M logs in | `201`, a **fresh** session (the old ones stay revoked) |
| 10 | `POST $BASE/users/<M>/enable` again | `409` |
| 11 | `POST $BASE/users/<pendingInvitee>/disable` | `409` (only `active` disables) |
| 12 | `POST $BASE/users/<random uuid>/disable` | `404` |
| 13 | As a `contributor` | `403` |
| 14 | `POST … /enable` on your own disabled self | unreachable — a disabled session cannot authenticate |
| 15 | `POST … /disable` with `Origin: https://evil.example.com` | **Expected 403; observed 200** → 🐞 BUG-users-server-01 |

### F18 / F19 / F20 / F21 — Resend an invite

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Invite Grace, keep token T1 | `201` |
| 2 | `POST $BASE/users/<grace>/invites/resend` | `201` with a **different** token T2 |
| 3 | `select count(*) from tokens where user_id='<grace>' and type='invite'` | exactly **1** |
| 4 | `GET $BASE/auth/invite/T1` | `404` — rotation killed it |
| 5 | `GET $BASE/auth/invite/T2` | `200` |
| 6 | `select expires_at - created_at from tokens where user_id='<grace>'` | equals `INVITE_TTL_SECONDS`, **not** a hard-coded 7 days |
| 7 | Resend to an `active` member | `409` |
| 8 | Resend to a `disabled` member | `409` |
| 9 | Resend for a random uuid | `404` |
| 10 | As a `viewer` | `403` |
| 11 | Fire two resends concurrently | still exactly one live token row |

### F22 / F23 — Revoke an invite

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Invite Grace with `workspaceIds:["<ws>"]`, then `DELETE $BASE/users/<grace>/invites` | `204` |
| 2 | `select * from users where id='<grace>'` | gone |
| 3 | `select * from tokens where user_id='<grace>'` | gone (cascade) |
| 4 | `select * from memberships where user_id='<grace>'` | gone (cascade) |
| 5 | `GET /api/activity?kind=user.invite_revoked` | one row whose `subject_id` is Grace's now-deleted id and whose `meta.email` is `grace@example.com` |
| 6 | `DELETE` on an `active` member | `409` — real accounts are never deleted this way |
| 7 | `DELETE` on a `disabled` member | `409` |
| 8 | `DELETE` on a random uuid | `404` |
| 9 | Repeat step 1 | `404` (the row is gone) |
| 10 | As a `contributor` | `403` |

### F24 — Audit trail

| Step | Action | Expected result (after ≤ 5 s of outbox drain) |
| --- | --- | --- |
| 1 | Invite | `user.invited`, subject `user`, `meta.email` |
| 2 | Resend | `user.invite_resent`, `meta.email` |
| 3 | Revoke invite | `user.invite_revoked`, `meta.email` |
| 4 | Rename | `user.profile_updated`, `meta.name = { from, to }` |
| 5 | Re-role | `user.role_changed`, `meta = { from, to }` |
| 6 | Disable | `user.suspended`, `meta` null |
| 7 | Enable | `user.reactivated`, `meta` null |
| 8 | Every row above | `actor_id` / `actor_email` = **you**, not the subject |
| 9 | A rejected mutation (409) | **no** row |

### F26 — Copilot member tool

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Start a copilot run in workspace W as an admin, ask "who is on this team?" | `workspace_members_list` returns only W's members |
| 2 | Compare against `GET /api/users` | strictly fewer rows — the tool is workspace-scoped, the roster is deployment-wide |
| 3 | Inspect a tool result | email, name, role key, status only — no invite token, no session data |
| 4 | Run as a `viewer` | the tool is still offered (`users:read` is universal) and returns the same columns the members page shows that viewer |

## 4. Edge Cases & Negative Paths

### Empty / zero

- **EC-01 — `PATCH` with `{}`.** `❌ NONE` — both `roleChanged` and `nameChanged` are
  false, the use case returns early (`update-member.use-case.ts:78-80`), the view is
  refetched and returned. No write, no event. Correct; unasserted.
- **EC-02 — `PATCH {"name": <same as current>}`.** `❌ NONE` — `rename` returns `false`
  (`member.ts:115-117`), so no `user.profile_updated` row. Correct; unasserted.
- **EC-03 — `PATCH {"role": <same as current>}`.** `❌ NONE` — `changeRole` returns
  `false` (`member.ts:133-135`) **before** the self-action guard runs
  (`update-member.use-case.ts:62`), so PATCHing yourself with your own role is a 200 no-op
  rather than a 409. That is the right call; unasserted.
- **EC-04 — Invite with `workspaceIds: []`.** `❌ NONE` — the linker returns early
  (`drizzle-workspace-linker.ts:21-23`). `201` with no memberships.
- **EC-05 — Empty roster.** `❌ NONE` — `items: []`, `total: 0`, `page: 1`. Never 404.
- **EC-06 — `?search` that matches nothing.** `⚠️ PARTIAL` — server side unasserted;
  the admin's empty state is covered at `apps/admin-e2e/src/users/members.spec.ts:66`.

### Boundary

- **EC-07 — `pageSize` exactly 100 / 101.** `✅ E2E` (`list-users.spec.ts:205,211`).
- **EC-08 — `page=0` / non-numeric.** `⚠️ PARTIAL` — non-numeric covered
  (`list-users.spec.ts:200`); `page=0` is not.
- **EC-09 — `page` past the end.** `❌ NONE` — expect `items: []` with the real `total`,
  never a 404. The admin clamps client-side (`MembersPage/index.tsx:129-136`), so a
  regression here would only surface via a hand-typed URL.
- **EC-10 — `search` exactly 255 / 256 chars.** `❌ NONE` — `@MaxLength(255)`.
- **EC-11 — `filter` exactly 4096 / 4097 chars.** `❌ NONE`.
- **EC-12 — Demote the second-to-last admin (count = 2).** `✅ E2E`
  (`update-user.spec.ts:105`) — allowed.
- **EC-13 — Demote an admin who is `disabled`.** `❌ NONE` — the guard is
  `this._role.isAdmin && !role.isAdmin && this._status.isActive && activeAdminCount <= 1`
  (`member.ts:136-141`). A **disabled** admin is not counted by `countActiveAdmins`
  (`drizzle-member.repository.ts:54-58` filters `status='active'`) **and** is excluded by
  `this._status.isActive`, so demoting them is always allowed. Correct, and a genuinely
  subtle case worth pinning.
- **EC-14 — Disable an admin when `activeAdminCount === 1` but that admin is someone
  else.** `✅ E2E`-adjacent — the disable guard is `this._role.isAdmin &&
  activeAdminCount <= 1` (`member.ts:165`) with **no** `isActive` clause, but the
  preceding branch already rejects a non-`active` member, so the states cannot diverge.

### Size & encoding

- **EC-15 — Email at 320 characters.** `❌ NONE` — `@IsEmail()` has no explicit length
  cap here and the column is `text`. A 10 000-character local part is accepted by Postgres.
  Expect a `400`; verify what actually happens.
- **EC-16 — Unicode / emoji / RTL in `name`.** `❌ NONE` — stored verbatim, echoed in
  `user.profile_updated` meta and rendered in the admin. Verify no mojibake round-trip.
- **EC-17 — `<script>alert(1)</script>` as `name`.** `❌ NONE` — stored verbatim (correct;
  escaping is the renderer's job). Assert the API returns it unescaped **and** the admin
  table renders it as text, not markup.
- **EC-18 — Whitespace-only `name`.** `❌ NONE` — `@IsNotEmpty()` rejects `""` but
  **accepts `"   "`**. Expect a trim-then-validate; observed behaviour is that a
  whitespace name is stored.
- **EC-19 — `%` / `_` in `?search`.** `❌ NONE` — check whether `MemberViewQuery` escapes
  LIKE metacharacters. `ActivityService` does (`activity.service.ts:179`); confirm the
  member query does too, or `?search=%` silently matches everything.
- **EC-20 — 10 MB invite body.** `❌ NONE` — expect `413`.
- **EC-21 — SQL metacharacters in `?search` / `?filter`.** `⚠️ PARTIAL` — Drizzle
  parameterises everything and `applyFilterTree` translates against a whitelist schema; the
  whitelist itself is e2e-asserted (`list-users-filter.spec.ts:153,162`).

### Permission matrix

| Route | `admin` | `contributor` | `viewer` | authenticated, no grants | unauthenticated |
| --- | --- | --- | --- | --- | --- |
| `GET /api/users` | 200 | 200 | 200 | 403 | 401 |
| `GET /api/users/:id` | 200 | 200 | 200 | 403 | 401 |
| `POST /api/users/invites` | 201 | 403 | 403 | 403 | 401 |
| `PATCH /api/users/:id` | 200 | 403 | 403 | 403 | 401 |
| `POST /api/users/:id/disable` | 200 | 403 | 403 | 403 | 401 |
| `POST /api/users/:id/enable` | 200 | 403 | 403 | 403 | 401 |
| `POST /api/users/:id/invites/resend` | 201 | 403 | 403 | 403 | 401 |
| `DELETE /api/users/:id/invites` | 204 | 403 | 403 | 403 | 401 |

There is no tenant dimension: the member directory is deployment-wide by design
(`list-members.controller.ts:11-15`). "Authenticated but not a member of this workspace"
is therefore not a distinct row — every signed-in account sees the full roster.

- **EC-22 — Every route carries a permission decorator.** `✅ verified` — all seven
  controllers decorate at the **class** level, so no handler can be added without one
  silently. But every one uses a **string literal** rather than the exported `PERMISSIONS`
  constant → 🐞 BUG-users-server-02.
- **EC-23 — Routes with no guard at all.** `✅ verified: none.` Every controller carries
  `@UseGuards(PermissionsGuard)` and identity's `AuthGuard` is app-wide.
- **EC-24 — `users:read` is universal.** So a `viewer` reads every colleague's email and
  workspace memberships. Deliberate and e2e-asserted (`list-users.spec.ts:216`,
  `get-user.spec.ts:99`).

### Tenant isolation & enumeration

- **EC-25 — Cross-workspace member read.** Not applicable — no workspace scoping on this
  API. The **copilot tool** is the scoped surface (`workspace-members.query.ts`).
- **EC-26 — Unknown id: 403 or 404?** `✅ E2E` — `404` on `GET`
  (`get-user.spec.ts:87`), `PATCH` (`update-user.spec.ts:144`), disable
  (`set-user-status.spec.ts:145`), resend (`manage-invites.spec.ts:85`), revoke
  (`manage-invites.spec.ts:128`). Correct: 404 leaks nothing, and since the whole
  directory is readable by every role there is nothing to leak anyway.
- **EC-27 — Non-uuid id.** `✅ E2E` — `400` from `ParseUUIDPipe`
  (`get-user.spec.ts:94`, `update-user.spec.ts:152`).
- **EC-28 — Does invite reveal whether an email already has an account?** **Yes, by
  design** — `409 "A user with this email already exists"`
  (`invite-member.controller.ts:53-57`). This is an authenticated, `users:create`-gated
  endpoint, so the caller can already list every account; the disclosure adds nothing.
  Contrast the *unauthenticated* login and invite-describe endpoints, which correctly
  reveal nothing.

### Concurrency — the count-then-write surface

- **EC-29 — Two concurrent demotes of the last two admins.** `❌ NONE` — **the highest-value
  untested case in this package.** Both `UpdateMemberUseCase` and `SetMemberStatusUseCase`
  load through `findByIdForAdminGuard`, which takes
  `pg_advisory_xact_lock(0x55534552)` **before** the load
  (`drizzle-member.repository.ts:42-45`, `member-lock.ts:27-30`), so the count read at
  `:57`/`:69` is stable. The lock is transaction-scoped and taken by both paths, so the
  sections are mutually exclusive. This is correct — but nothing proves it.
- **EC-30 — One demote racing one disable.** `❌ NONE` — same lock, so serialised. Verify.
- **EC-31 — Two concurrent invites of the same email.** `⚠️ PARTIAL` — the up-front
  `existsByEmail` check runs **outside** the unit of work
  (`invite-member.use-case.ts:50`); the real guarantee is the DB's
  `users_email_lower_unique` index, whose `23505` is mapped to `EmailTakenError`
  (`drizzle-member.repository.ts:89-96,166-177`). The single-request 409 is covered
  (`invite-user.spec.ts:116`); the concurrent case is not.
- **EC-32 — Two concurrent resends for one member.** `❌ NONE` — guarded by a **per-user**
  advisory lock `pg_advisory_xact_lock(0x494e5654, hashtext(userId))`
  (`invite-token.service.ts:58`), so the delete/insert pair cannot interleave and leave two
  live links. Unasserted, and this is exactly the failure the lock was added for.
- **EC-33 — Enable racing disable.** `❌ NONE` — `enable` uses `findById`, **not**
  `findByIdForAdminGuard` (`set-member-status.use-case.ts:72`), so it takes no lock. That
  is safe: enabling only ever *increases* the admin count, so it cannot violate the
  last-admin invariant. Worth a comment, not a fix.
- **EC-34 — Rename takes the global admin lock.** `❌ NONE` — `UpdateMemberUseCase` always
  loads via `findByIdForAdminGuard` (`:53`), even for a pure rename. Every member update in
  the deployment therefore serialises on one global advisory lock. See
  🐞 BUG-users-server-04.
- **EC-35 — Disable racing the member's own in-flight request.** `❌ NONE` — the revoke
  commits with the status change (`drizzle-session-revoker.ts:18-22`), so the *next*
  request 401s. A request already past `AuthGuard` completes.

### State after mutation

- **EC-36 — Disable then read the view.** `✅ E2E` (`set-user-status.spec.ts:50`) — the
  controller refetches through `MemberViewQuery` after the write
  (`set-member-status.controller.ts:49`), so the response reflects the new status.
- **EC-37 — Revoke the invite of the member you are currently viewing.** `❌ NONE` — the
  row is deleted; a subsequent `GET /api/users/:id` is `404`. The admin's detail page must
  handle that; verify it does not render a blank shell.
- **EC-38 — `isLastAdmin` after promoting a second admin.** `❌ NONE` — should flip to
  `false` on the next read. It is advisory (UI hint), computed without a lock, so it can be
  momentarily stale — acceptable and documented.
- **EC-39 — Delete the last member on page 3.** Server-side there is nothing to clamp;
  the admin clamps (`MembersPage/index.tsx:129`). `✅ E2E` on the admin side.

### Failure & partiality

- **EC-40 — Invite fails after the user row is inserted.** `❌ NONE` — the insert, the
  token rotation, and the workspace linking all run inside one `uow.run`
  (`invite-member.use-case.ts:54`), and `InviteTokenService.rotate` reuses the caller's
  executor (`:66`), so a failure anywhere rolls all three back. Assert by forcing the
  linker to throw.
- **EC-41 — `InviteTokenService.rotate` called with no executor.** `❌ NONE` — it opens
  its own transaction (`invite-token.service.ts:78`). No caller currently does this.
- **EC-42 — The `admin` role row is missing.** `❌ NONE` — `roleIdByKey` throws a plain
  `Error` → 500 (`drizzle-member.repository.ts:156-160`). Deliberate ("a broken
  deployment rather than bad input").
- **EC-43 — Outbox appended, dispatcher never runs.** The mutation commits and the audit
  row appears on the next poll (≤ 5 s). See `docs/testing/activity-server.md`.

### Idempotency & replay

- **EC-44 — Replay `POST /:id/disable`.** `✅ E2E` (`set-user-status.spec.ts:109`) — `409`,
  not a silent success. Correct: it is a state transition, not an idempotent setter.
- **EC-45 — Replay `DELETE /:id/invites`.** `⚠️ PARTIAL` — second call is `404` (row gone).
- **EC-46 — Replay `POST /invites` with the same email.** `✅ E2E` — `409`.
- **EC-47 — Replay `POST /:id/invites/resend`.** `❌ NONE` — succeeds each time, rotating
  again. Every replay silently kills the previous link. That is the documented contract,
  but an admin who double-clicks hands over a dead link. See
  `docs/testing/users-admin.md` §4A for the UI consequence.

## 5. E2E Coverage Map

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F1 List | `apps/server-e2e/src/server/users/list-users.spec.ts:44,48,82,145` | 401 unauthenticated, envelope shape, **never leaks the password hash**, all statuses unfiltered | ✅ E2E |
| F2 Search | `list-users.spec.ts:90` | name-or-email substring, case-insensitive | ✅ E2E |
| F3 Status | `list-users.spec.ts:168,190` | `status=active` typeahead contract; unknown status 400 | ✅ E2E |
| F4 Filter | `apps/server-e2e/src/server/users/list-users-filter.spec.ts:54,73,97,123,153,162,171,179,186,209,223` | scalar ilike, role relation via EXISTS, OR group, AND with `status`, unknown field/operator 400, malformed JSON 400, depth cap, empty `in` 400, oversized `in` 400, empty filter = no filter | ✅ E2E — exemplary |
| F5 Pagination | `list-users.spec.ts:111,195,200,205,211` | page/pageSize, unknown query field 400, non-numeric page 400, max 100 OK, 101 400 | ⚠️ PARTIAL — no `page=0`, no page-past-the-end |
| F6 Get one | `apps/server-e2e/src/server/users/get-user.spec.ts:50,56,81,87,94,99` | 401, full view, `isLastAdmin`, 404 unknown, 400 non-uuid, viewer allowed | ✅ E2E |
| F7 Invite | `apps/server-e2e/src/server/users/invite-user.spec.ts:49,56,136,144,152,160` | 401, creates pending + role + token, malformed email 400, unknown role 400, extra field 400, contributor 403 | ✅ E2E |
| F8 Duplicate email | `invite-user.spec.ts:116,128` | 409, and 409 case-insensitively | ✅ E2E (single-request) — the **concurrent** path relying on the unique index is untested |
| F9 Workspace links | `invite-user.spec.ts:82,104` | assigns given workspaces, ignores unknown ids, non-uuid 400 | ✅ E2E |
| F10 Update | `apps/server-e2e/src/server/users/update-user.spec.ts:49,61,79,118,131,144,152,160` | 401, role change persists, name change, unknown role 400, extra field 400, 404, 400 non-uuid, viewer 403 | ✅ E2E |
| F11 Last-admin demote | `update-user.spec.ts:93,105` | 409 for the last admin; allowed with another admin present | ⚠️ PARTIAL — **the concurrency the advisory lock exists for is untested** |
| F12 Self-role-change | — | — | ❌ NONE — `SelfActionError` on the update path has no test at all |
| F13 Disable + revoke | `apps/server-e2e/src/server/users/set-user-status.spec.ts:50,82` | disables and revokes sessions; a reactivated member signs in on a fresh session | ✅ E2E |
| F14 Self-disable | `set-user-status.spec.ts:101` | 409 | ✅ E2E |
| F15 Last-admin disable | — | — | ⚠️ PARTIAL — the aggregate branch is covered by `member.spec.ts`, but no HTTP-level or concurrent test |
| F16 Enable | `set-user-status.spec.ts:119,135` | re-enables; 409 when already active | ✅ E2E |
| F17 Lifecycle 409s | `set-user-status.spec.ts:109,135,145,152,163` | already-disabled, already-active, unknown 404, 401, contributor 403 | ✅ E2E |
| F18/F19 Resend | `apps/server-e2e/src/server/users/manage-invites.spec.ts:59,73,85,94` | rotates keeping exactly one live token; active member 409; unknown 404; contributor 403 | ✅ E2E |
| F20 Rotation lock | — | — | ⚠️ PARTIAL — the one-live-token invariant is asserted single-threaded (`manage-invites.spec.ts:59`), never concurrently |
| F21 Invite TTL from config | — | — | ❌ NONE — the AGENTS.md notes this "used to hard-code 7 days, so a deployment setting `INVITE_TTL_SECONDS` silently got nothing"; the regression that would catch it recurring does not exist |
| F22/F23 Revoke invite | `manage-invites.spec.ts:107,115,128,137` | 204 + placeholder deleted; active member 409; 404; contributor 403 | ✅ E2E |
| F24 Audit | `apps/server-e2e/src/server/activity/activity.spec.ts:77,100,123,144,161` | `user.suspended`, `user.role_changed` with from/to, `user.invited` with email, no row on a rolled-back mutation ×2 | ✅ E2E |
| F25 `isLastAdmin` | `get-user.spec.ts:81` | flagged for the sole active admin | ✅ E2E |
| F26 Copilot tool | `apps/server-e2e/src/server/copilot/copilot-read-catalogue.spec.ts` | the tool's surface membership | ⚠️ PARTIAL — surface only; the workspace-scoping that is the tool's whole point is unasserted |
| F27 Value objects | `packages/users/server/src/lib/member/domain/member.spec.ts` | aggregate invariants incl. both last-admin branches | 🧪 UNIT |
| F28 `23505` → 409 | `invite-user.spec.ts:116` (indirect) | 409 on a duplicate | ⚠️ PARTIAL — reaches the **up-front** check, never the unique-index backstop, so `isUniqueViolation`'s `cause`-chain walk (`drizzle-member.repository.ts:166-177`) is dead code as far as the suite is concerned |

**Coverage tally: 28 features · 17 ✅ · 8 ⚠️ · 3 ❌**

## 6. 🐞 Potential Bugs

### 🐞 BUG-users-server-01 — Not one state-changing route in this package carries `OriginGuard`; it is the only plugin in the repo that omits it · Severity: High · 🔒

**Location:** `packages/users/server/src/lib/member/http/controllers/invite-member.controller.ts:28-30`,
`update-member.controller.ts:33-35`, `set-member-status.controller.ts:33-35`,
`resend-invite.controller.ts:31-33`, `revoke-invite.controller.ts:30-32`
**Category:** permission-bypass (CSRF)

**What the code does:**

```ts
@UseGuards(PermissionsGuard)
@RequirePermissions('users:update')
@Controller('users')
export class SetMemberStatusController { … }
```

No `OriginGuard`. Verified exhaustively:
`grep -rn "OriginGuard" packages --include=*.ts` returns hits in
`identity/server` (login, logout, invite-accept, preferences, api-tokens, user-sessions),
`workspaces/server` (all eight mutations), `media/server` (all seven), `content/server`
(all six admin writes), and `copilot/server` (four) — **and none in `users/server`**.

**Why it is wrong:** `ARCHITECTURE.md:§5.3` states the request-flow invariant plainly —
"State-changing POSTs additionally pass an **`OriginGuard`** (CSRF defense)". Every other
plugin holds it. `users/server` exposes the most privileged mutations in the product
(promote to admin, disable an account, delete a pending account) and holds it nowhere.
The gap is invisible in review because the class-level decorator stack *looks* complete.

**Repro:**
1. Sign in to the admin as an admin so the `ortha_session` cookie is set.
2. Serve this from any other origin and visit it in the same browser:
   ```html
   <form method="POST" action="http://localhost:3000/api/users/<victimId>/disable"></form>
   <script>document.forms[0].submit()</script>
   ```
→ Observed: the guard chain is `AuthGuard` → `PermissionsGuard` only, so the request is
authorised on the cookie alone. / Expected: `403 Origin not allowed`, as an identical
request to `POST /api/workspaces` or `PUT /api/preferences` would get.

**What currently saves it, and why that is not enough.** The session cookie is issued with
`SameSite=Lax` (`apps/server/ortha.config.ts:121`), and Lax suppresses the cookie on a
cross-site `POST`, so the attack above does not land **today**. But: (a)
`IdentitySessionConfig.cookieSameSite` accepts `'none'`
(`packages/identity/server/src/lib/types/index.ts:75`), which is exactly what a
separate-origin deployment would set — and the identity AGENTS.md names that as the
rejected-but-available alternative; (b) `SameSite=Lax` does **not** protect a top-level
`GET`-shaped navigation, and while none of these routes is a GET, adding one would be
silently unprotected; (c) defence-in-depth is the entire reason every sibling carries the
guard. A one-line config change in a deployment turns a latent gap into a live CSRF on
account takeover.

**Blast radius:** with `SameSite=none` (or any future change to the cookie policy), any
site an admin visits can promote an attacker's pending account to `admin`
(`PATCH /api/users/:id {"role":"admin"}`), disable every other admin, or delete pending
invites — with no user interaction beyond loading a page.

**Suggested fix:** add `OriginGuard` to the `@UseGuards(...)` of all five state-changing
controllers, matching `workspaces/server`'s
`@UseGuards(OriginGuard, PermissionsGuard, WorkspaceMemberGuard)` ordering. Do NOT implement.

---

### 🐞 BUG-users-server-02 — Permission strings are inline literals, the exact anti-pattern BUGBOT names; this is the only package that does it · Severity: Low · 🔒

**Location:** `list-members.controller.ts:17`, `get-member.controller.ts:24`,
`invite-member.controller.ts:29`, `update-member.controller.ts:34`,
`set-member-status.controller.ts:34`, `resend-invite.controller.ts:32`,
`revoke-invite.controller.ts:31`
**Category:** correctness

**What the code does:**

```ts
@RequirePermissions('users:update')
```

Every other plugin imports the constant:
`@RequirePermissions(PERMISSIONS.WORKSPACES_UPDATE)`
(`packages/workspaces/server/.../update-workspace.controller.ts:39`),
`@RequirePermissions(PERMISSIONS.ACTIVITY_READ)`
(`packages/activity/server/.../list-activity.controller.ts:17`),
`@RequirePermissions(PERMISSIONS.MEDIA_DELETE)`, `PERMISSIONS.CONTENT_READ`, and so on —
`grep -rn "@RequirePermissions(" packages --include=*.ts` shows **users/server is the sole
holdout**, 7 sites out of ~50.

**Why it is wrong:** `.cursor/BUGBOT.md` opens its server section with exactly this: *"**Permission
strings as literals.** Guard with shared permission constants, not inline `'users:read'`
strings — a typo silently disables enforcement."* The `server-plugin` skill lists
permission-by-constant among its review-critical invariants.

**Honest assessment of the actual risk — this is why it is Low, not High.** The stated
failure mode does **not** apply here. `RequirePermissions` is typed
`(...permissions: PermissionKey[])` (`require-permissions.decorator.ts:13`), and
`PermissionKey` is a closed union derived from `PERMISSIONS`
(`system-roles.ts:40`). A typo — `'users:reed'` — is a **compile error**, not a silent
grant. So the literal cannot mint a permission nobody holds, and it cannot bypass the guard.

What it does cost is real but modest: renaming a permission key becomes a repo-wide
string search instead of a refactor; and the divergence hides the *shape* of the
convention from anyone copying this package as a template (it is the ADR-0003 Wave-2
worked example, alongside `workspaces/server`, which does it correctly).

**Repro:**
1. `grep -rn "@RequirePermissions('" packages --include=*.ts` → seven hits, all in users/server.
2. `grep -rn "@RequirePermissions(PERMISSIONS" packages --include=*.ts` → every other plugin.

**Blast radius:** maintenance only. No runtime authorization gap.

**Suggested fix:** import `PERMISSIONS` from `@ortha-cms/identity-server` (already a
dependency for the guard) and swap the seven literals. Do NOT implement.

---

### 🐞 BUG-users-server-03 — Resending an invite is silently destructive and has no idempotency window · Severity: Medium

**Location:** `packages/users/server/src/lib/member/application/use-cases/resend-invite.use-case.ts:50-53`,
`packages/users/server/src/lib/member/infrastructure/persistence/invite-token.service.ts:60-70`
**Category:** data-loss / ux-state

**What the code does:**

```ts
await db.delete(tokens).where(and(eq(tokens.userId, userId), eq(tokens.type, 'invite')));
await db.insert(tokens).values({ type: 'invite', userId, tokenHash: this.hash(raw), expiresAt });
```

Every call to `POST /:id/invites/resend` unconditionally deletes the live token and mints
a new one. There is no "the current token is still valid for N minutes, return that"
branch, no request-id de-duplication, and no rate limit.

**Why it is wrong:** the invariant "at most one live invite per user" is enforced, and the
per-user advisory lock correctly prevents two concurrent resends leaving two live links
(`invite-token.service.ts:58`). But the operation's *cost* — killing a link the invitee may
already be holding — is not bounded. `AGENTS.md` acknowledges this
("Rotation kills the link the invitee may already hold, so handing the new one over is the
rest of the operation, not a nicety"), and the admin surfaces it correctly with a
reveal-once dialog. The gap is that nothing stops the admin generating the situation
repeatedly: two clicks 200 ms apart produce two rotations, the admin is shown **two**
dialogs (or one, depending on which mutation settles last), and the link they end up
copying may be the **dead** one.

**Repro:**
1. Invite Grace; note token T1.
2. Double-click "Resend invite" in the row menu (or fire two `POST` calls ~200 ms apart).
3. `select count(*) from tokens where user_id='<grace>'` → 1 (the lock works).
4. Compare the token in the dialog the admin is shown against
   `select token_hash from tokens where user_id='<grace>'`.
→ Observed: the two responses return T2 and T3; only T3's hash survives. If the UI settled
on T2's response, the admin copies a link that is already dead. / Expected: a second resend
inside a short window returns the still-live token, or the endpoint rejects a rapid repeat.

**Blast radius:** the invitee receives a link that 404s, contacts the admin, and the loop
repeats. There is no server-side signal that anything went wrong — the audit log records
two `user.invite_resent` rows and both requests returned `201`. In a deployment with no
mailer (i.e. all of them today) this is the only delivery path.

**Suggested fix:** return the existing token when it is still comfortably within its TTL,
or throttle `resend` per user (a natural fit for the same per-user advisory-lock key).
Do NOT implement.

---

### 🐞 BUG-users-server-04 — Every member update takes a single global advisory lock, including a pure rename · Severity: Low

**Location:** `packages/users/server/src/lib/member/application/use-cases/update-member.use-case.ts:53`,
`packages/users/server/src/lib/member/infrastructure/persistence/drizzle-member.repository.ts:42-45`,
`packages/users/server/src/lib/member/infrastructure/persistence/member-lock.ts:19,27-30`
**Category:** perf

**What the code does:**

```ts
const member = await this.members.findByIdForAdminGuard(memberId);   // takes the lock
…
if (dto.role !== undefined && dto.role !== previousRole) { … countActiveAdmins() … }
const nameChanged = dto.name !== undefined ? member.rename(dto.name) : false;
```

`findByIdForAdminGuard` unconditionally runs
`select pg_advisory_xact_lock(0x55534552)` — a **single deployment-wide key**, not
per-member — before loading, regardless of whether the request touches the role at all.

**Why it is wrong:** the lock exists to serialise the last-admin count-then-write, and it
must be taken *before* the count for that to work — that part is right, and
`SetMemberStatusUseCase.enable` correctly opts out by using `findById`
(`set-member-status.use-case.ts:72`). But `UpdateMemberUseCase` cannot know whether the
role is changing until after it has loaded the aggregate, so it pessimistically locks
every time. The consequence is that `PATCH /api/users/:id {"name":"…"}` for member A blocks
`PATCH /api/users/:id {"name":"…"}` for member B, and blocks every disable/enable in the
deployment, for the duration of its transaction.

**Repro:**
1. Open two psql sessions. In one: `begin; select pg_advisory_xact_lock(1431520594);`
   (0x55534552 = 1431520594).
2. `PATCH /api/users/<anyone> {"name":"x"}` — a rename that touches no role.
→ Observed: the request hangs until the psql transaction commits. / Expected: a rename
contends with nothing.

**Blast radius:** low today — member edits are rare, admin-driven, and short. It becomes a
throughput ceiling only if member mutations are ever automated or bulk-applied. Filed
because the lock is deliberately documented as guarding one specific invariant
(`member-lock.ts:10-17`) and quietly guards far more than that.

**Suggested fix:** branch on `dto.role !== undefined` before choosing the loader — take the
lock only when a role change is actually requested; fall back to `findById` for a pure
rename. Do NOT implement.

---

**Checked and cleared** (examined, no defect found):

- **Last-admin race safety.** Both mutating paths take the same transaction-scoped
  advisory lock *before* reading `countActiveAdmins`, and the aggregate — not the
  application — makes the decision (`member.ts:136-142,165-167`). This is the
  lock-the-contended-invariant pattern `.cursor/BUGBOT.md` demands, done correctly.
  The read model's `isLastAdmin` is explicitly advisory and takes no lock.
- **Unique-email registration.** The pre-check is a convenience; the real guarantee is
  `users_email_lower_unique` plus a `23505` → `EmailTakenError` mapping that walks the
  `cause` chain (`drizzle-member.repository.ts:166-177`). Not a count-then-write.
- **Invite-rotation race.** Per-user `pg_advisory_xact_lock(namespace, hashtext(userId))`
  around the delete/insert pair, and rotations for different invitees do not contend.
- **Self-action guards.** Disable checks `actor.id === id` before opening the transaction
  (`set-member-status.use-case.ts:47`); re-role checks it inside, but only on the branch
  where the role actually changes (`update-member.use-case.ts:66`), so PATCHing yourself
  with your own role is correctly a no-op rather than a 409.
- **Can a user demote or delete themselves to escalate?** No. Self-re-role and
  self-disable are 409; there is no self-delete route (`DELETE /:id/invites` requires
  `pending`, and you cannot be signed in while `pending`).
- **Does a disabled user's session keep working?** No — `DrizzleSessionRevoker.revoke`
  runs in the disable's own transaction (`set-member-status.use-case.ts:61`), and identity
  independently refuses to resolve a session to a non-`active` user.
- **Token hashing at rest.** Only SHA-256 is stored (`invite-token.service.ts:68,85`); the
  raw token appears solely in the HTTP response.
- **Invite TTL source.** Read from `IDENTITY_CONFIG.token.inviteTtlSeconds`
  (`invite-token.service.ts:51`), not hard-coded — the regression AGENTS.md warns about is
  currently fixed.
- **Workspace linking.** Requested ids are filtered against real `workspaces` rows before
  insert, and inserted `onConflictDoNothing` (`drizzle-workspace-linker.ts:25-35`), so a
  stale id cannot fail the invite and a duplicate is a no-op.
- **`MemberRepository.save` patch construction.** Only changed columns are written, and an
  empty patch short-circuits (`drizzle-member.repository.ts:110-112`).
- **Password hash never reaches the wire.** `MemberViewQuery` selects an explicit column
  list; asserted at `list-users.spec.ts:82`.
- **Copilot tool scoping.** `workspace_members_list` reads through a purpose-built
  `WorkspaceMembersQuery` with a workspace predicate, deliberately not through the
  deployment-wide `MemberViewQuery`, and returns no invite or session data.

## 7. Recommended E2E Tests

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | `apps/server-e2e` | `server/users/users-csrf.spec.ts` | each of the five mutations rejects `Origin: https://evil.example.com` with 403 and leaves state unchanged, and accepts the configured origin — mirroring `preferences.spec.ts:186-204` | 🐞 BUG-01 |
| 2 | `apps/server-e2e` | `server/users/last-admin-race.spec.ts` | with exactly two active admins, two **concurrent** `PATCH {"role":"viewer"}` (one per admin) yield one 200 and one 409, and `countActiveAdmins()` never reaches 0; same for two concurrent disables; same for one demote racing one disable | F11/F15 ⚠️, EC-29, EC-30 |
| 3 | `apps/server-e2e` | extend `server/users/update-user.spec.ts` | `PATCH /users/<self> {"role":"viewer"}` → 409 "You cannot change your own role"; `PATCH /users/<self> {"name":"…"}` → 200; `PATCH /users/<self> {"role":<current>}` → 200 no-op with no audit row | F12 ❌, EC-03 |
| 4 | `apps/server-e2e` | `server/users/invite-race.spec.ts` | two concurrent invites of the same email → one 201, one 409 (exercising the `23505` backstop, not the pre-check); two concurrent resends → exactly one live token row and both responses' tokens checked against it | EC-31, EC-32, F20 ⚠️, F28 ⚠️ |
| 5 | `apps/server-e2e` | extend `server/users/manage-invites.spec.ts` | with `INVITE_TTL_SECONDS=3600`, a freshly issued token's `expires_at - created_at` is one hour, not seven days | F21 ❌ |
| 6 | `apps/server-e2e` | extend `server/users/set-user-status.spec.ts` | demoting a **disabled** admin is allowed even when they are the only admin-roled row (EC-13); disabling a `pending` invitee is 409 | EC-13, F17 |
| 7 | `apps/server-e2e` | extend `server/users/list-users.spec.ts` | `page=0` → 400; `page=9999` → `items: []` with the real total; `search` of 256 chars → 400; `search=%` does not match everything (LIKE escaping) | F5 ⚠️, EC-08/09/10/19 |
| 8 | `apps/server-e2e` | `server/users/member-encoding.spec.ts` | emoji / RTL / `<script>` names round-trip byte-identically through invite → list → detail → `user.profile_updated` meta; a whitespace-only name is rejected | EC-16/17/18 |
| 9 | `apps/server-e2e` | `server/copilot/workspace-members-scope.spec.ts` | `workspace_members_list` in workspace W returns only W's members while `GET /api/users` returns everyone; the result carries no token or session field | F26 ⚠️ |
| 10 | `apps/server-e2e` | `server/users/invite-rollback.spec.ts` | forcing `WorkspaceLinker.link` to throw leaves no `users` row, no `tokens` row and no `memberships` row | EC-40 |
