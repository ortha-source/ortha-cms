# @ortha-cms/activity-server — Test Artifact

> **Unit:** `packages/activity/server` · **Package:** `@ortha-cms/activity-server` · **Kind:** server plugin
> **Source of truth:** `packages/activity/server/AGENTS.md`
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

The audit-log plugin. It owns the `activity_events` table and its migration, **writes**
audit rows by subscribing to the transactional outbox, exposes one read route, and
contributes one copilot tool.

It is a deliberately **generic sink**: `kind` is free text and `meta` is open `jsonb`, so
each emitting plugin owns its own catalogue. Per ADR-0003 it is a read-side / CRUD context
with **no aggregate** and no `domain/` layer — that is compliance, not a gap.

It does **NOT** own:

- Any of the events. Identity emits `auth.*`, users emits `member.*`, workspaces emits
  `workspace.*`, content emits `entry.*`. Activity only maps them.
- The `ACTIVITY_RECORDER` port — that symbol lives in `@ortha-cms/identity-server`
  (activity merely binds it) and is `@deprecated`: **nothing writes through it**
  (`activity.service.ts:52-55`).
- The outbox itself, its dispatcher, or its retry policy — `@ortha-cms/database`.
- Any workspace scoping. `activity_events` has no `workspace_id` column, by design.

### Entry points

| Verb + path | Handler | Permission |
| --- | --- | --- |
| `GET /api/activity` | `activity/controllers/list-activity.controller.ts:22` | `PERMISSIONS.ACTIVITY_READ` (**admin-only** in the v1 matrix) |

**Write path (no HTTP surface).** `AuditEventSubscriber`
(`activity/infrastructure/audit-event.subscriber.ts:24`) registers itself with
`OutboxDispatcher` on `OnApplicationBootstrap` (`:36-38`) and is the **single live audit
writer**. It maps each delivered `DomainEvent` through the pure `toAuditRow`
(`audit-event-mapping.ts:235-251`) and inserts `ON CONFLICT DO NOTHING` on the event id.

**Copilot tool.** `activity_recent` (`copilot/activity-tool.provider.ts:52`),
`requires: [PERMISSIONS.ACTIVITY_READ]`, `readOnly: true`, `surfaces: ['copilot']`,
page size clamped to 25.

**Exports.** `ActivityPlugin()`, `ActivityModule` (**global**), `ActivityService`, and the
`ACTIVITY_RECORDER` binding.

### Runtime prerequisites

- Postgres + `npx nx run server:db:migrate` (activity ships `migrations/0000_init.sql`,
  tracked in `__drizzle_migrations_activity`).
- Registered **after** `DatabasePlugin` and `IdentityPlugin` (`AGENTS.md` §Architecture).
- A signed-in `admin` — `activity:read` is admin-only (`system-roles.ts:77` grants the
  full set to `admin`; it appears in neither `contributor` nor `viewer`).
- **Emitters must be registered.** With `UsersPlugin`/`WorkspacesPlugin` absent, the log is
  correctly empty rather than broken.
- The outbox dispatcher must be running: it polls every `POLL_INTERVAL_MS = 5_000`
  (`packages/database/src/lib/outbox/outbox-dispatcher.ts:22`) and is also kicked
  post-commit by `UnitOfWork` (`unit-of-work.ts:55-57`).

### How to exercise it manually

```bash
docker compose up -d && npx nx run server:db:migrate && npm run dev

BASE=http://localhost:3000/api
curl -s "$BASE/activity?pageSize=5" -b "$COOKIE"                      # admin cookie
curl -s "$BASE/activity?kind=user.invited,user.suspended" -b "$COOKIE"
curl -s "$BASE/activity?actorEmail=ada&from=2026-08-01T00:00:00.000Z" -b "$COOKIE"
curl -s --get "$BASE/activity" -b "$COOKIE" \
  --data-urlencode 'filter={"op":"and","rules":[{"field":"kind","op":"eq","value":"user.invited"}]}'
```

**To generate events:** log in (`auth.signed_in`), invite a member (`member.invited`),
disable one (`member.disabled`), create a workspace (`workspace.created`), publish an
entry (`entry.published`). Then wait ≤ 5 s and re-read `/api/activity`.

Admin UI: `http://localhost:4200/activity`.

### Dependencies that must be healthy

`@ortha-cms/database` (`OutboxDispatcher` — **if it stalls, the audit trail stops**),
`@ortha-cms/identity-server` (`PermissionsGuard`, `PERMISSIONS`,
`IDENTITY_ACTIVITY_KINDS`), `@ortha-cms/utils-server` (`parseFilterTree` /
`applyFilterTree`), optionally `@ortha-cms/tools-server` (copilot registry — injected
`@Optional()`).

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | `GET /api/activity` — paginated audit log, `activity:read` | `activity/controllers/list-activity.controller.ts:16-25` | ✅ E2E |
| F2 | `?subjectType=` / `?subjectId=` filters | `activity.service.ts:149-154` | ⚠️ PARTIAL |
| F3 | `?actorId=` filter (uuid-validated) | `activity.service.ts:155-157`, DTO `:63-65` | ❌ NONE |
| F4 | `?kind=` CSV → `IN` | `list-activity-query.dto.ts:79-91`, `activity.service.ts:158-160` | ✅ E2E |
| F5 | `?actorEmail=` case-insensitive substring, LIKE-escaped | `activity.service.ts:174-181` | ✅ E2E |
| F6 | `?from=` / `?to=` inclusive ISO range | `activity.service.ts:162-165` | ⚠️ PARTIAL |
| F7 | `?filter=` query-builder tree, AND-ed with the params | `activity-filter.ts:14-23`, `activity.service.ts:131-140` | ✅ E2E |
| F8 | `?page` / `?pageSize` (1-based, capped 100, default 25) | `activity.constants.ts:2-5`, DTO `:147-173` | ✅ E2E |
| F9 | `?sort=at\|kind` + `?order=asc\|desc`, `id` tiebreaker | `activity.service.ts:82-83,106` | ⚠️ PARTIAL |
| F10 | `created_at` never reaches the wire | `activity.service.ts:94-103`, `activity-view.ts:8-25` | ❌ NONE |
| F11 | Count and page run concurrently over one `where` | `activity.service.ts:88-109` | ❌ NONE |
| F12 | `AuditEventSubscriber` self-registers with the dispatcher | `audit-event.subscriber.ts:36-38` | ✅ E2E (indirect) |
| F13 | Event-kind → audit-row mapping (20 kinds) | `audit-event-mapping.ts:143-206` | 🧪 UNIT + ✅ E2E |
| F14 | Actor recovered from the event payload (`attachActor`) | `audit-event-mapping.ts:217-228` | ✅ E2E |
| F15 | Idempotent insert — PK is the source event id, `ON CONFLICT DO NOTHING` | `audit-event.subscriber.ts:50-53` | ❌ NONE |
| F16 | Unmapped kinds are silently ignored | `audit-event-mapping.ts:236-239`, `audit-event.subscriber.ts:46-49` | ❌ NONE |
| F17 | Audit row commits iff the mutation does (transactional outbox) | `unit-of-work.ts`, each producer's `outbox.append` | ✅ E2E |
| F18 | `activity_events` isolation: no FK on `actor_id`, text `subject_id`, frozen `actor_email` | `schema/activity-events.ts:23-33` | ✅ E2E (indirect) |
| F19 | Three composite indexes for the three query shapes | `schema/activity-events.ts:36-42` | ❌ NONE |
| F20 | `ActivityService.record` + `ACTIVITY_RECORDER` retained but deprecated | `activity.service.ts:57-70`, `activity.module.ts:33` | ❌ NONE |
| F21 | `activity_recent` copilot tool, `activity:read`-gated, `surfaces:['copilot']` | `copilot/activity-tool.provider.ts:52-170` | ⚠️ PARTIAL |
| F22 | Tool page size clamped to 25 in the handler as well as the schema | `activity-tool.provider.ts:136-139` | ❌ NONE |

## 3. Manual Test Plan

`BASE=http://localhost:3000/api`; `$COOKIE` is an **admin** session (nothing else can read
this API). Allow ≤ 5 s after any mutation for the outbox to drain.

### F1 — Read the audit log

**Preconditions:** ≥ 30 events across several kinds and actors.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `GET $BASE/activity` | `200 { items, total, page:1, pageSize:25 }` |
| 2 | Inspect one item | `{ id, kind, subjectType, subjectId, actorId, actorEmail, meta, at }` |
| 3 | Look for `createdAt` | **absent** — the write time never reaches the wire |
| 4 | Default order | newest `at` first, `id` descending as the tiebreaker |
| 5 | As a `contributor` | `403` |
| 6 | As a `viewer` | `403` |
| 7 | Unauthenticated | `401` |

### F2 / F3 — Subject and actor filters

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `?subjectType=user` | only `user`-subject rows |
| 2 | `?subjectType=workspace` | only `workspace`-subject rows |
| 3 | `?subjectId=<a member's id>` | that member's whole history, including rows written **after** the account was deleted |
| 4 | `?subjectType=user&subjectId=<id>` | intersection |
| 5 | `?subjectId=<256 chars>` | `400` |
| 6 | `?actorId=<an admin's uuid>` | only what that admin did |
| 7 | `?actorId=not-a-uuid` | `400` |
| 8 | `?actorId=<a uuid nobody has>` | `200`, `items: []` |
| 9 | `?actorId` on a login row | matches — the signer is their own actor |

### F4 — Kind filter (CSV → IN)

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `?kind=user.invited` | only invites |
| 2 | `?kind=user.invited,user.suspended` | both kinds, one `IN` clause |
| 3 | `?kind=user.invited, user.suspended` (space after the comma) | same — the transform trims |
| 4 | `?kind=user.invited,,user.suspended` | same — empty segments are filtered out |
| 5 | `?kind=` (empty) | treated as no filter |
| 6 | `?kind=not.a.real.kind` | `200`, `items: []` — kinds are free text, not a catalogue |
| 7 | `?kind=<256 chars>` | `400` (`@MaxLength(255, { each: true })`) |

### F5 — Actor-email search

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `?actorEmail=ADA` | matches `ada@example.com` (case-insensitive `ILIKE %…%`) |
| 2 | `?actorEmail=  ada  ` | same — the needle is trimmed |
| 3 | `?actorEmail=%` | `200`, `items: []` — `%` is escaped, so it matches a **literal** percent |
| 4 | `?actorEmail=_` | same literal treatment |
| 5 | `?actorEmail=a\\b` | the backslash is escaped, no SQL error |
| 6 | On a system-initiated row (`actor_email` null) | never matched by any needle |

### F6 — Time range

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `?from=<the exact `at` of a known row>` | that row **is** included (`gte`) |
| 2 | `?to=<the exact `at` of a known row>` | that row **is** included (`lte`) |
| 3 | `?from=<tomorrow>` | `200`, `items: []` |
| 4 | `?from=<later>&to=<earlier>` (inverted) | `200`, `items: []`, no error |
| 5 | `?from=yesterday` (not ISO) | `400` |
| 6 | `?from=2026-08-01` (date only, valid ISO-8601) | accepted; `new Date(...)` parses it as UTC midnight |

### F7 — Query-builder filter

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `filter={"op":"and","rules":[{"field":"kind","op":"eq","value":"user.invited"}]}` | only invites |
| 2 | An `or` group over two kinds | the union |
| 3 | `{"field":"at","op":"gte","value":"…"}` | date comparison works |
| 4 | Combine `?filter=` with `?kind=` | AND-ed, not replaced |
| 5 | `{"field":"meta",…}` | `400` — `meta` is deliberately **not** in `ACTIVITY_FILTER_SCHEMA` |
| 6 | `{"field":"createdAt",…}` | `400` — likewise excluded |
| 7 | `filter=not-json` | `400`, not 500 |
| 8 | 4097-character filter | `400` |
| 9 | A tree nested past the depth cap | `400` |

### F8 / F9 — Pagination and sort

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `?page=2&pageSize=10` | rows 11–20; the envelope echoes `page:2, pageSize:10` |
| 2 | `?pageSize=100` / `?pageSize=101` | `200` / `400` |
| 3 | `?page=0` | `400` |
| 4 | `?page=9999` | `200`, `items: []`, real `total` |
| 5 | `?sort=kind&order=asc` | alphabetical by kind |
| 6 | `?sort=at&order=asc` | oldest first |
| 7 | `?sort=meta` | `400` (whitelist) |
| 8 | `?order=sideways` | `400` |
| 9 | Insert three rows with an identical `at`, page through with `pageSize=1` | each row appears exactly once — the `desc(id)` tiebreaker makes paging deterministic |

### F12 / F13 / F14 / F17 — The write path

**Preconditions:** identity + users + workspaces + content plugins all registered.

| Step | Action | Expected audit row (within ≤ 5 s) |
| --- | --- | --- |
| 1 | Log in | `user.signed_in`, subject `user`/your id, `meta` null, `actor_email` = you |
| 2 | Log out | `user.signed_out` |
| 3 | Log out again (no live session) | **no** second row |
| 4 | Invite a member | `user.invited`, `meta.email` |
| 5 | Resend the invite | `user.invite_resent`, `meta.email` |
| 6 | Revoke the invite | `user.invite_revoked`, `meta.email`, `subject_id` = the now-deleted user id |
| 7 | Rename a member | `user.profile_updated`, `meta.name = { from, to }` |
| 8 | Re-role a member | `user.role_changed`, `meta = { from, to }` |
| 9 | Disable a member | `user.suspended`, `meta` null |
| 10 | Enable a member | `user.reactivated`, `meta` null |
| 11 | Create a workspace | `workspace.created`, subject `workspace`, `meta = { name, slug }` |
| 12 | Add a workspace member | `workspace.member_added` with subject **`user`** (the affected member), `meta = { workspaceId, email }` |
| 13 | Publish an entry | `entry.published`, subject `content_entry`, `meta.contentType` |
| 14 | Attempt a mutation that 409s (e.g. disable the last admin) | **no** row |
| 15 | For every row above | `actor_id`/`actor_email` is the **acting admin**, never the subject |

### F15 — Idempotency under redelivery

**Preconditions:** direct DB access.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Perform a mutation; let it drain; note the `activity_events.id` | one row |
| 2 | `update outbox_events set dispatched_at = null where id = '<same id>'` | forces redelivery |
| 3 | Wait one poll tick (5 s) | still **exactly one** `activity_events` row — the PK is the event id and the insert is `ON CONFLICT DO NOTHING` |
| 4 | `select attempts from outbox_events where id='<id>'` | unchanged (delivery succeeded) |

### F16 — Unmapped kinds

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Append an outbox event with `kind = 'made.up.kind'` | the dispatcher's allow-list (`AUDITED_EVENT_KINDS`) excludes it, so the subscriber is never called; the row is stamped `dispatched_at` |
| 2 | Force-deliver a mapped-looking but unmapped kind to `handle()` directly | `toAuditRow` returns `null`, `handle` returns early, no row, no throw |
| 3 | Change a password via `ChangePasswordUseCase` (no route today) | `user.password_changed` drains with **no** mapper → **no audit row** (see 🐞 BUG-activity-server-03) |

### F18 — The audit outlives its subjects

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Invite Grace, then revoke the invite (deletes the row) | the `user.invited` and `user.invite_revoked` rows **survive** |
| 2 | `?subjectId=<grace's id>` | both rows return; `subject_id` is `text` with no FK |
| 3 | Delete the acting admin's account | their `actor_id` rows survive; `actor_email` still shows the frozen snapshot |
| 4 | Rename that admin's email afterwards | historical rows keep the **old** email |

### F21 / F22 — The copilot tool

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Start a copilot run as an **admin**, ask "what happened yesterday?" | `activity_recent` is offered and returns rows |
| 2 | Same as a `contributor` or `viewer` | the tool is **not offered at all** (withheld at offer time by the capability profile) and is refused if forced |
| 3 | Call an MCP client with a `full`-scope API token and list tools | `activity_recent` is **absent** — `surfaces: ['copilot']` |
| 4 | Ask for `pageSize: 500` | clamped to 25 by the handler, independent of schema validation |
| 5 | Ask for `pageSize: 0` / a negative | clamped to 1 |
| 6 | Ask for `page: -3` | clamped to 1 |
| 7 | Inspect a returned item | `at` is an ISO string, and `meta` is passed through verbatim inside the run engine's `fenceUntrusted` envelope |

## 4. Edge Cases & Negative Paths

### Empty / zero

- **EC-01 — Empty log.** `❌ NONE` — `items: []`, `total: 0`, `page: 1`. Never 404.
- **EC-02 — Every filter absent.** `✅ E2E` implied — `and(undefined, …)` collapses to no
  predicate (`activity.service.ts:148,139`), so the list scans everything.
- **EC-03 — `?kind=` empty string.** `❌ NONE` — the transform splits, filters `Boolean`,
  yields `[]`, and `query.kind.length > 0` skips the `IN`
  (`activity.service.ts:158`). Critically it does **not** produce `IN ()`, which would
  match nothing and look like data loss.
- **EC-04 — `?actorEmail=   ` (whitespace only).** `❌ NONE` — trimmed to empty →
  `undefined` (`activity.service.ts:175-178`), i.e. no filter. Correct.
- **EC-05 — A row with `meta: null`.** `✅ E2E` (`activity.spec.ts:77` — `user.suspended`
  carries `meta: null`). The service maps it explicitly to `null`, never `{}`
  (`activity.service.ts:115`).
- **EC-06 — A system-initiated row (`actor_id` null).** `✅ E2E`
  (`apps/admin-e2e/src/activity/audit-log.spec.ts:36`, admin side). Server-side, an
  `?actorEmail=` search never matches it.

### Boundary

- **EC-07 — `pageSize` 100 / 101.** `❌ NONE` server-side (the equivalent is covered for
  `/api/users`).
- **EC-08 — `page=0` / `page` non-numeric.** `❌ NONE`.
- **EC-09 — `page` past the end.** `❌ NONE` — `offset = (page-1)*pageSize` is uncapped, so
  `?page=1000000&pageSize=100` issues a 100 M-row offset. Postgres will scan; there is no
  guard. Worth a bounded-cost assertion.
- **EC-10 — `from` exactly equal to a row's `at`.** `❌ NONE` — `gte`, so **inclusive**.
- **EC-11 — `to` exactly equal to a row's `at`.** `❌ NONE` — `lte`, so **inclusive**. The
  DTO doc says "inclusive" for both; verify, because an off-by-one here silently drops the
  most recent event from a "today" query.
- **EC-12 — Inverted range (`from > to`).** `❌ NONE` — empty result, not an error. Fine.
- **EC-13 — Three rows sharing one `at`, paged one at a time.** `⚠️ PARTIAL` — the
  `desc(activityEvents.id)` tiebreaker (`activity.service.ts:106`) is what makes this
  deterministic; `activity.spec.ts:227` asserts ordering but not the tie case.
- **EC-14 — `subjectType` / `subjectId` / `actorEmail` at exactly 255 / 256 chars.** `❌ NONE`.
- **EC-15 — `filter` at exactly 4096 / 4097 chars.** `❌ NONE`.

### Size & encoding

- **EC-16 — `%` or `_` in `?actorEmail`.** `❌ NONE` — **escaped**
  (`activity.service.ts:179`: `needle.replace(/[\\%_]/g, '\\$&')`), so a literal `%` search
  matches literally rather than everything. This is exactly right and is the kind of thing
  that regresses silently.
- **EC-17 — A backslash in `?actorEmail`.** `❌ NONE` — the character class includes `\\`,
  so `a\b` becomes `a\\b`. Confirm Postgres's default `ESCAPE '\'` applies.
- **EC-18 — Unicode / emoji / RTL in `meta`.** `❌ NONE` — `meta` is `jsonb`, round-trips
  verbatim. It reaches the copilot inside the untrusted-content fence
  (`activity-tool.provider.ts:159-163`).
- **EC-19 — A very large `meta` payload.** `❌ NONE` — no size cap on the emitter side and
  none here. A pathological `workspace.updated` `fields` array is stored and returned whole.
- **EC-20 — `<script>` in `meta.name`.** `❌ NONE` — stored and returned verbatim (correct);
  escaping is the admin renderer's job.
- **EC-21 — SQL metacharacters in `?subjectId`.** `❌ NONE` — parameterised `eq`; no
  injection surface.

### Permission matrix

| Route / surface | `admin` | `contributor` | `viewer` | authenticated, no grants | unauthenticated | API token (`read` or `full`) |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /api/activity` | 200 | **403** | **403** | 403 | 401 | not routed (session API) |
| `activity_recent` (copilot) | offered | withheld at offer time | withheld at offer time | withheld | n/a | **not offered** (`surfaces:['copilot']`) |

- **EC-22 — Can a non-admin read another user's activity?** **No.** `activity:read` is
  admin-only, and there is no per-user variant of the route. The admin's per-user Activity
  tab (`packages/users/admin/.../UserActivityPage`) calls the same global endpoint with
  `?subjectId=`, so a non-admin never reaches it — and the tab itself is hidden behind
  `useHasPermission('activity:read')`
  (`packages/users/admin/.../UserDetailTabs/index.tsx:113`). `✅ E2E`
  (`activity.spec.ts:262,272`).
- **EC-23 — Is the actor spoofable?** **No.** The actor is stamped by the producer via
  `attachActor(events, actor)` from `@CurrentUser()` — e.g.
  `packages/users/server/.../invite-member.use-case.ts:76`. It is never read from a request
  body or header, and the read API has no write surface. `toAuditRow` recovers it from the
  event payload only (`audit-event-mapping.ts:217-228`).
- **EC-24 — Route carries a permission constant?** `✅ verified` —
  `@RequirePermissions(PERMISSIONS.ACTIVITY_READ)` (`list-activity.controller.ts:17`), a
  constant, not a literal.
- **EC-25 — Tool `surfaces` decided deliberately?** `✅ verified` —
  `surfaces: ['copilot']` with a documented rationale
  (`activity-tool.provider.ts:22-27`), which is exactly what `.cursor/BUGBOT.md` demands
  for a tool requiring a permission no token scope mints (`scopePermissions` yields only
  `content:*` + `media:read`/`media:create`, never `activity:read`).

### Tenant isolation

- **EC-26 — Is the log workspace-scoped?** **No, and deliberately so** — there is no
  `workspace_id` column (`schema/activity-events.ts:23-33`). Since the read is admin-only
  and admins are global, there is no tenant boundary to breach. `AGENTS.md` §copilot-tool
  argues this explicitly. It does mean an admin's copilot answering "what happened in this
  workspace?" is answering about the **whole deployment**; the tool description says so.
- **EC-27 — Does `meta` leak secrets or PII across a boundary?** Audit each emitter's
  payload. Reviewed: `user.invited` / `user.invite_resent` / `user.invite_revoked` carry
  `email`; `user.profile_updated` carries `{ from, to }` names; `user.role_changed` carries
  role keys; `workspace.member_added/removed` carry `{ workspaceId, email }`;
  `workspace.created/deleted` carry `{ name, slug }`; `entry.*` carries `contentType`.
  **No password, no hash, no invite token, no session token, no API-token secret** appears
  in any mapper (`audit-event-mapping.ts:170-205`). The emails are already visible to
  every role via `GET /api/users`, and the log itself is admin-only. `✅ cleared.`

### Concurrency

- **EC-28 — Two concurrent drains (poll tick vs post-commit).** `❌ NONE` — the dispatcher
  claims rows `FOR UPDATE SKIP LOCKED` (`outbox-dispatcher.ts:84`), so they take disjoint
  batches. Plus the subscriber's insert is idempotent. Correct by construction.
- **EC-29 — Two app instances draining the same outbox.** `❌ NONE` — same mechanism.
- **EC-30 — The subscriber's insert runs on a different connection from the dispatcher's
  transaction.** `handle` uses `this.db` (`audit-event.subscriber.ts:50`), **not** the
  dispatcher's `tx`. See 🐞 BUG-activity-server-02.

### State after mutation / consistency

- **EC-31 — Read `/api/activity` immediately after a mutation.** `⚠️ PARTIAL` — the row is
  **not** there yet. The mutation's transaction commits the *outbox* row; `UnitOfWork`
  then fires a best-effort post-commit `dispatcher.drain()` (`unit-of-work.ts:55-57`) which
  is `await`ed but swallowed, so in practice the audit row usually lands within the same
  request. When that drain is lost (a swallowed error, a crash, contention), the poll
  backstop picks it up **up to 5 s later**. See 🐞 BUG-activity-server-01.
- **EC-32 — Rolled-back mutation.** `✅ E2E` (`activity.spec.ts:144,161`) — no outbox row is
  written, so no audit row. This is the transactional-outbox guarantee working.

### Failure & partiality

- **EC-33 — The subscriber throws (e.g. a `NOT NULL` violation on `subject_id`).** `❌ NONE`
  — the dispatcher catches, logs, increments `attempts`, and leaves the row undispatched
  (`outbox-dispatcher.ts:104-113`). **There is no cap on `attempts` and no dead-letter
  state**, so a permanently-failing event is retried forever every 5 s. See
  🐞 BUG-activity-server-04.
- **EC-34 — `subject_id` derived as `''`.** `❌ NONE` —
  `membershipSubject` does `nullableString(payload.userId) ?? ''`
  (`audit-event-mapping.ts:105`). A `workspace.member_added` event whose payload lacks
  `userId` inserts a row with an **empty-string** subject id rather than failing. Silent
  corruption of the trail. See 🐞 BUG-activity-server-05.
- **EC-35 — No activity plugin registered at all.** `❌ NONE` — producers still append to
  the outbox; the dispatcher finds no subscriber for those kinds and auto-marks them
  dispatched. The app runs, unaudited. Correct degradation.
- **EC-36 — `ActivityService.record` called directly (deprecated path).** `❌ NONE` — it
  still inserts, with `id` defaulted by the DB rather than the event id
  (`activity.service.ts:61-69`), so it would **not** be idempotent under redelivery. No
  caller does this today; the risk is a future contributor reaching for the exported,
  still-working method.
- **EC-37 — Migration applied twice.** `❌ NONE` — `__drizzle_migrations_activity` guards it.

### Idempotency & replay

- **EC-38 — Replay the same event id.** `❌ NONE` — the PK is `event.eventId` and the
  insert is `onConflictDoNothing({ target: activityEvents.id })`. **This is the single most
  important untested property in the package**: at-least-once delivery is explicitly the
  contract (`outbox-dispatcher.ts:29`), so idempotency is the only thing standing between
  a redelivery and a duplicated audit trail.
- **EC-39 — Two different events producing the same audit facet.** Distinct event ids →
  distinct rows. Correct.
- **EC-40 — Replay a read.** Pure; no side effects.

### 4A. Accessibility & Section 508 Conformance

**Scope.** This unit renders no UI — it is a NestJS plugin with one read route
(`GET /api/activity`) and one outbox subscriber that writes `activity_events` rows. Under
Revised Section 508 (36 CFR Part 1194) its output is not electronic content a user
perceives directly, so the perceivable/operable criteria belong to `activity-admin`. Two
things genuinely apply and are assessed below: whether the **error payloads** on the read
route are usable by a client, and — the substantive one — whether the **audit row this
plugin writes carries enough to be rendered accessibly at all**, which is a 508 §504.2
data-model question and cannot be fixed downstream.

**Not Applicable, with justification (one line each):** 1.1.1, 1.3.x, 1.4.x, 2.1.x, 2.4.x,
3.2.x, 3.3.2, 4.1.2 (directly), 4.1.3, 502.2/502.3, 503.2, 503.4, 504.3 — each requires a
rendered interface, a focusable control, or an accessibility tree, none of which exist
here. **2.2.1 Timing Adjustable** is Not Applicable: the 5 s `POLL_INTERVAL_MS`
(`packages/database/src/lib/outbox/outbox-dispatcher.ts:22`) is a background drain
interval, not a time limit imposed on a user's interaction.

**Inherited, not restated:** the global `ValidationPipe`'s prose-only, field-unassociated
400 body applies verbatim to `ListActivityQueryDto`
(`packages/activity/server/src/lib/activity/dto/list-activity-query.dto.ts:32`) — filed
once as `♿ A11Y-identity-server-01`. Note the route is read-only and admin-gated
(`list-activity.controller.ts:16-18`), so its 400s are reached by a malformed URL rather
than by a user filling in a form; the 3.3.1 stake is correspondingly lower than on the
write routes.

---

#### ♿ A11Y-activity-server-01 — An audit row's subject can be an empty string, producing a row with no accessible name that no client can repair

**SC:** 4.1.2 Name, Role, Value (A) — via the consuming client; 1.3.1 Info and
Relationships (A)
**508:** **504.2 (Authoring Tools — accessibility information preserved)**
**Verdict:** **Does Not Support**
**Location:** `packages/activity/server/src/lib/activity/infrastructure/audit-event-mapping.ts:97-109`
(`membershipSubject`), schema at
`packages/activity/server/src/lib/schema/activity-events.ts:26`
(`subjectId: text('subject_id').notNull()`)

This is the accessibility face of `🐞 BUG-activity-server-05`, filed here rather than
duplicated because the consequence is different in kind. `membershipSubject` writes
`subjectId: nullableString(payload.userId) ?? ''`, and `subject_id` is `text NOT NULL`, so
`''` inserts cleanly.

**Why it is a 508 finding and not just a data bug:** `subject_id` is the *only* identifier
the audit row carries for the entity it is about — there is no FK, no denormalised name,
and `actor_email` is the actor's, not the subject's. The admin's Subject cell derives its
entire accessible text from it. With `''` the cell renders `user ·` followed by nothing, so
a screen-reader user hears the row type and then silence, with no way to tell *who* the
entry is about. Unlike a missing `aria-label`, this cannot be fixed in `activity-admin`:
the information was never written.

**Repro:** append an outbox event `{ kind: 'workspace.member_added', aggregateId: '<ws>',
payload: { email: 'x@y.z' } }` with no `userId`, wait for the drain, then load `/activity`
with a screen reader and try to identify the row's subject.

**Remediation:** as in BUG-05 — refuse the mapping rather than substituting `''`, so the
event is retried or parked and the gap is loud. Additionally consider a `subject_label`
column so a row remains renderable (and announceable) after its subject is deleted, which
the package explicitly wants ("the audit genuinely outlives its subjects").

---

#### ♿ A11Y-activity-server-02 — Audit `meta` carries free text in an unknown language with no language marker

**SC:** 3.1.2 Language of Parts (AA)
**508:** E205.4 · 504.2
**Verdict:** **Partially Supports**
**Location:** `packages/activity/server/src/lib/schema/activity-events.ts:20-32`
(`meta: jsonb('meta')`, no locale column), populated by the mappers at
`audit-event-mapping.ts:143-206`

Audit rows embed user-authored strings — workspace `name`, member `name`, invitee `email`,
content-type `slug` — inside `meta`, and the row records no language for any of them. The
audit log is deployment-wide, so in a multilingual workspace a single page mixes a
Japanese workspace name, an Arabic member name and an English event label with nothing to
distinguish them.

**Consequence:** a client cannot emit `<span lang="…">` around the interpolated fragments,
so a screen reader pronounces every value with the page's language voice. It is Partially
rather than Does Not Support because the surrounding event label *is* localisable by the
client (the `kind` is a stable machine key), and mispronunciation is a degradation rather
than a total barrier.

**Note:** this is a general property of the repo's content model rather than a defect
unique to this plugin — `activity_events` faithfully records what it was given. It is
recorded here because the audit log is the one surface that aggregates strings from every
context in the product, so it is where the absence bites hardest.

**Remediation:** none urgent. If per-workspace or per-user locales are ever introduced (see
`♿ A11Y-identity-server-03`), carry the source locale alongside each free-text `meta`
value so a client can mark it up.

---

**a11y verdict tally: 2 findings · 0 Supports · 1 Partially Supports · 1 Does Not Support ·
the remaining WCAG 2.1 AA criteria Not Applicable (server unit, no rendered UI), enumerated
above.**
**a11y coverage: `❌ NONE`.** `apps/server-e2e/src/server/activity/*` asserts rows, filters
and status codes; nothing asserts that a written row is renderable, and axe has nothing to
scan on a JSON endpoint.
**WCAG 2.2 (advisory only — 508 references 2.0):** 2.4.11 and 2.5.8 are Not Applicable (no
UI).

## 5. E2E Coverage Map

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F1 Read + authz | `apps/server-e2e/src/server/activity/activity.spec.ts:257,262,272,282` | admin 200, contributor 403, viewer 403, unauthenticated 401 | ✅ E2E |
| F2 Subject filters | — | — | ⚠️ PARTIAL — `subjectId` is exercised only indirectly by the admin's per-user tab (`apps/admin-e2e/src/users/user-detail.spec.ts:110`); no server-side assertion |
| F3 `actorId` | — | — | ❌ NONE |
| F4 Kind CSV | `activity.spec.ts:192` | comma-separated list → `IN` | ✅ E2E — but no whitespace/empty-segment/unknown-kind cases |
| F5 Actor email | `activity.spec.ts:203` | case-insensitive substring | ✅ E2E — **the LIKE-metacharacter escaping is unasserted**, which is the part most likely to regress |
| F6 Time range | `activity.spec.ts:244` | a future `from` returns an empty page | ⚠️ PARTIAL — no boundary-inclusive case, no `to`, no inverted range |
| F7 Filter tree | `apps/server-e2e/src/server/activity/activity-filter.spec.ts:70,83,99,117,140,149` | scalar eq, OR group, `at` gte, AND-composition with `kind`, unknown field 400, malformed JSON 400 | ✅ E2E |
| F8 Pagination | `activity.spec.ts:216` | page/pageSize + envelope echo | ⚠️ PARTIAL — no cap, `page=0`, or past-the-end cases |
| F9 Sort | `activity.spec.ts:227` | default `at desc`, `asc` reverses | ⚠️ PARTIAL — no `sort=kind`, no invalid-value 400, **no equal-timestamp tiebreaker test** |
| F10 `created_at` off the wire | — | — | ❌ NONE |
| F11 Concurrent count+page | — | — | ❌ NONE (behavioural, not observable) |
| F12 Subscriber registration | `activity.spec.ts:55` (indirect) | a login produces `user.signed_in` via the read API | ✅ E2E |
| F13 Kind mapping | `packages/activity/server/src/lib/activity/infrastructure/audit-event-mapping.spec.ts` + `activity.spec.ts:55,77,100,123,288` | each kind's produced row is pinned against what the old in-band recorder wrote; signed-in / suspended / role-changed with from-to meta / invited with email / signed-out | 🧪 UNIT + ✅ E2E |
| F14 Actor from payload | `activity.spec.ts:100,123` | the acting admin is the actor, not the subject | ✅ E2E |
| F15 Idempotent redelivery | — | — | ❌ NONE — **the highest-value gap** |
| F16 Unmapped kinds ignored | — | — | ❌ NONE |
| F17 Transactional guarantee | `activity.spec.ts:144,161` | no audit row when the mutation is rejected and rolled back (×2 paths) | ✅ E2E — note the `describe` is titled "recording (in-band, transactional)" (`activity.spec.ts:54`), which is **stale**: recording has not been in-band since Wave 3 |
| F18 Audit outlives subjects | `activity.spec.ts:123` (indirect via `user.invite_revoked`) | the row survives the placeholder's deletion | ⚠️ PARTIAL — no explicit "delete the actor, row survives with a frozen email" case |
| F19 Indexes | — | — | ❌ NONE |
| F20 Deprecated recorder | — | — | ❌ NONE |
| F21 Copilot tool | `apps/server-e2e/src/server/copilot/copilot-read-catalogue.spec.ts`, `apps/server-e2e/src/server/mcp/mcp.spec.ts` | the surface split — offered to copilot, absent from MCP | ⚠️ PARTIAL — surface membership only; the permission gate and the clamping are unasserted |
| F22 Tool clamping | — | — | ❌ NONE |

**Coverage tally: 22 features · 8 ✅ · 6 ⚠️ · 8 ❌**

## 6. 🐞 Potential Bugs

### 🐞 BUG-activity-server-01 — The documented "audit commits iff the mutation does, in the same transaction" invariant no longer describes the code, and `ARCHITECTURE.md` still asserts it · Severity: Medium

**Location:** `packages/activity/server/src/lib/activity/infrastructure/audit-event.subscriber.ts:45-54`;
contradicted documentation at `ARCHITECTURE.md:§5.4` and `.cursor/BUGBOT.md` §Server.
**Category:** correctness (documentation ↔ implementation drift, with an observable
behavioural consequence)

**What the code does:**

```ts
async handle(event: DomainEvent): Promise<void> {
    const row = toAuditRow(event);
    if (!row) return;
    await this.db                       // ← the ROOT connection
        .insert(activityEvents)
        .values(row)
        .onConflictDoNothing({ target: activityEvents.id });
}
```

The audit row is written by a **subscriber**, on the root pool, at drain time — never
inside the mutation's transaction.

**Why it is wrong:** `ARCHITECTURE.md:§5.4` states: *"The service runs the mutation … and
records an audit row via `ActivityService.record(...)` **using the same transaction** — so
the audit commits if and only if the mutation does."* `.cursor/BUGBOT.md` restates it as a
bug pattern: *"**Audit outside the transaction.** `ActivityService.record(...)` must run
with the *same* transaction/executor as the mutation."* Neither is true any more.
Wave 3 replaced it with a transactional outbox, which is a **better** design — the *event*
commits with the mutation, so nothing is lost — but the guarantee it provides is
*eventual*, not atomic, and two of the repo's canonical context files still promise the
stronger one.

This is not purely cosmetic. The observable difference:

**Repro:**
1. `POST /api/users/<id>/disable` and, in the same script, immediately
   `GET /api/activity?kind=user.suspended&pageSize=1`.
2. Repeat under load, or with the post-commit drain suppressed.
→ Observed: the audit row may be absent for up to `POLL_INTERVAL_MS` (5 s,
`outbox-dispatcher.ts:22`). The mutation's own response has already returned 200.
/ Expected per `ARCHITECTURE.md`: the row exists the instant the mutation's transaction
commits.

In practice `UnitOfWork` fires a best-effort `await this.dispatcher.drain()` right after
commit (`unit-of-work.ts:55-57`) and swallows failures, so the row usually lands
synchronously — which is precisely why this has not been noticed. Any test or client that
relies on read-after-write will pass locally and flake under contention.

**Blast radius:** two audiences. (a) Anyone writing a new plugin follows `ARCHITECTURE.md`
and reaches for `ActivityService.record(tx)` — still exported, still working, but
**non-idempotent** (it lets the DB default the `id` rather than using the event id,
`activity.service.ts:61-69`), so it reintroduces the duplicate-audit problem the outbox
solved. (b) Any e2e or client code assuming read-after-write on `/api/activity` is
timing-dependent. The e2e suite's own `describe` block is titled
"recording (in-band, transactional)" (`activity.spec.ts:54`), showing the stale mental
model is already embedded in the tests.

**Suggested fix:** update `ARCHITECTURE.md:§5.4` and `.cursor/BUGBOT.md` to describe the
outbox path and its eventual-consistency window, and state the read-after-write bound
explicitly. Do NOT implement.

---

### 🐞 BUG-activity-server-02 — The subscriber's insert does not join the dispatcher's transaction, so audit rows and their dispatch bookkeeping can diverge · Severity: Low

**Location:** `packages/activity/server/src/lib/activity/infrastructure/audit-event.subscriber.ts:50`
vs `packages/database/src/lib/outbox/outbox-dispatcher.ts:77-115`
**Category:** correctness / race

**What the code does:** the dispatcher opens one transaction, claims a batch
`FOR UPDATE SKIP LOCKED`, and for each row calls `subscriber.handle(event)` then stamps
`dispatched_at` **inside `tx`**. The subscriber writes on `this.db` — a **different**
connection, auto-committing immediately.

**Why it is wrong:** the two writes are not atomic. If the dispatcher's outer transaction
rolls back after the subscriber's insert has committed (a later row in the same batch
throwing outside the per-row `try`, a connection drop, a statement timeout), the audit rows
are durable but `dispatched_at` is not — so the whole batch is redelivered.

**Repro:** hard to trigger deliberately; force it by killing the connection mid-drain, or
by making `tx.update` fail after a successful `handle`.
→ Observed: the batch is redelivered; each event's audit row already exists.
/ Expected: one durable outcome per event.

**Why it is Low, not High:** the divergence is **benign**, and by design. Redelivery is the
documented contract, and the insert is idempotent on the event id
(`onConflictDoNothing({ target: activityEvents.id })`), so a redelivered event produces no
duplicate row. Writing on a separate connection is also arguably correct — it means a slow
audit insert does not extend the lock the dispatcher holds over the claimed batch. Filed
because the safety depends entirely on the idempotency key, which has **no test**
(F15 ❌) — remove or weaken that `onConflictDoNothing` and this becomes a duplicate-audit
bug with no failing test to catch it.

**Blast radius:** none today. It is a load-bearing assumption with no guard rail.

**Suggested fix:** none to the code. Add the redelivery-idempotency e2e test (§7 item 1) so
the assumption is pinned. Do NOT implement.

---

### 🐞 BUG-activity-server-03 — `user.password_changed` is emitted but has no mapper, so a credential change would be unauditable · Severity: Medium · 🔒

**Location:** `packages/activity/server/src/lib/activity/infrastructure/audit-event-mapping.ts:143-206`
(the `FACET_MAPPERS` table), against the emitter at
`packages/identity/server/src/lib/application/use-cases/change-password.use-case.ts:44-46`
and `packages/identity/server/src/lib/domain/user-account.ts` (`changeCredential` raises
`user.password_changed`).
**Category:** correctness (audit gap)

**What the code does:** `FACET_MAPPERS` enumerates exactly 20 kinds — nine `workspace.*`,
seven `member.*`, two `auth.*`, two `entry.*`. `AUDITED_EVENT_KINDS` is derived from its
keys (`:212-214`) and is the dispatcher's delivery allow-list, so an unlisted kind is never
even delivered: it drains, matches no subscriber, and is stamped `dispatched_at`.
`user.password_changed` is not in the table.

**Why it is wrong:** a password change is a security-relevant account event and the one
thing an incident responder looks for when asked "was this account taken over?".
The event exists, is raised by the aggregate, and is appended to the outbox — every
ingredient is in place except the mapping, so it is lost silently rather than loudly.

**Repro:**
1. `grep -n "password_changed" packages/activity/server/src/lib/activity/infrastructure/audit-event-mapping.ts`
   → no match.
2. Invoke `ChangePasswordUseCase.execute(userId, 'new-password')` from a test harness.
3. `select * from activity_events where kind like '%password%'`.
→ Observed: empty. `select kind, dispatched_at from outbox_events where kind='user.password_changed'`
shows the event committed and marked dispatched. / Expected: a `user.password_changed`
audit row.

**Blast radius:** **zero in production today** — `ChangePasswordUseCase` has no HTTP route
(`grep -rn "ChangePasswordUseCase" packages apps --include=*.ts` finds only its provider
registration). Filed as Medium because it is a pre-armed gap: the moment a
change-password or reset-password route lands, the most audit-worthy account event in the
product will be silently absent, and nothing in the pipeline will complain — the event
will drain "successfully" every time.

**Suggested fix:** add a `'user.password_changed'` entry to `FACET_MAPPERS` (subject
`user`, `meta: null`) before any route wires the use case, and extend
`audit-event-mapping.spec.ts` to pin it. Do NOT implement.

---

### 🐞 BUG-activity-server-04 — A permanently-failing audit event is retried forever with no attempt cap or dead-letter state · Severity: Medium

**Location:** `packages/database/src/lib/outbox/outbox-dispatcher.ts:104-113` (the
mechanism), consumed by `packages/activity/server/src/lib/activity/infrastructure/audit-event.subscriber.ts:45-54`
(the only registered subscriber, and the one that writes to the DB).
**Category:** perf / data-loss (of *later* audit rows)

**What the code does:**

```ts
} catch (error) {
    this.logger.error(`Delivery failed for event ${row.id} (${row.kind}); will retry`, …);
    await tx.update(outboxEvents).set({ attempts: row.attempts + 1 })
        .where(eq(outboxEvents.id, row.id));
}
```

`attempts` is incremented and **never read**. There is no maximum, no backoff, and no
terminal state. The claim query is
`where(isNull(dispatchedAt)).orderBy(occurredAt).limit(100)` (`:81-83`) — oldest first,
batch of 100.

**Why it is wrong:** the audit subscriber is the only thing that writes to
`activity_events`, and its insert can fail deterministically for a given event — for
example `subject_id` violating `NOT NULL`, or a `meta` payload exceeding a limit, or a
`kind` longer than the column allows. Such an event is undispatchable forever. It is
re-claimed on every 5-second tick, re-fails, and its `attempts` counter climbs without
bound.

Worse, because the claim is **oldest-first with a batch cap of 100**: once more than 100
poison events accumulate ahead of the queue, the drain never reaches anything newer, and
**the entire audit trail stops advancing** while every mutation continues to succeed.

**Repro:**
1. `insert into outbox_events (id, kind, aggregate_type, aggregate_id, occurred_at, payload)
   values (gen_random_uuid(), 'member.invited', 'member', 'x', now() - interval '1 day',
   '{"email": null}')` — 101 rows of a shape whose mapper produces a row the DB rejects.
2. Perform a normal mutation.
3. Wait several poll ticks; `select * from activity_events order by at desc limit 1`.
→ Observed: the new mutation's audit row never appears; the log grows only in
`outbox_events`, and `attempts` climbs into the thousands. / Expected: poison events are
parked after N attempts and the queue drains past them.

**Blast radius:** the audit trail — the compliance artifact — silently stops, while the
application appears entirely healthy. The only signal is `logger.error` lines and a
growing `outbox_events` table. Nothing surfaces it in the admin.

**Note on ownership:** the retry policy lives in `@ortha-cms/database`, not this package.
It is filed here because `AuditEventSubscriber` is its only consumer and the audit log is
where the consequence is visible; the fix belongs in the dispatcher.

**Suggested fix:** cap `attempts` (e.g. skip rows past 10 in the claim predicate), or add a
`failed_at` column and a dead-letter view, and surface the depth of the undispatched queue
in the insights/health surface. Do NOT implement.

---

### 🐞 BUG-activity-server-05 — A membership event with no `userId` writes an audit row with an empty-string subject instead of failing · Severity: Low

**Location:** `packages/activity/server/src/lib/activity/infrastructure/audit-event-mapping.ts:97-109`
**Category:** correctness

**What the code does:**

```ts
function membershipSubject(event: DomainEvent, auditKind: string): AuditFacet {
    const payload = event.payload;
    return {
        kind: auditKind,
        subjectType: 'user',
        subjectId: nullableString(payload.userId) ?? '',
        meta: { workspaceId: event.aggregateId, email: nullableString(payload.email) }
    };
}
```

`nullableString` returns `null` for anything non-string (`:56-58`), and the `?? ''`
converts that to an empty string. `activity_events.subject_id` is `text NOT NULL`
(`schema/activity-events.ts:26`), so `''` inserts cleanly.

**Why it is wrong:** every other mapper derives `subjectId` from `event.aggregateId`, which
is structurally guaranteed to exist. `membershipSubject` is the only one that reads the
subject out of the **payload** — because for `workspace.member_added`/`_removed` the
aggregate is the workspace but the subject is the affected user. That inversion is correct
and well-reasoned, but the fallback turns a producer contract violation into a silently
malformed row rather than a loud failure. `''` is not a user id; it matches no
`?subjectId=` query, renders as an empty Subject cell in the admin, and cannot be traced
back to anyone.

**Repro:**
1. Append an outbox event `{ kind: 'workspace.member_added', aggregateId: '<ws>',
   payload: { email: 'x@y.z' } }` — no `userId`.
2. Wait for the drain; `select subject_id from activity_events where kind='workspace.member_added'`.
→ Observed: `''`. The admin's Subject cell renders `user · ` with nothing after it
(`packages/activity/admin/.../ActivitySubjectCell/index.tsx`). / Expected: the delivery
fails and the event is retried/parked, so the gap is visible rather than papered over.

**Blast radius:** low — the producer
(`packages/workspaces/server`'s add/remove-member use cases) does supply `userId` today, so
this is a latent robustness gap rather than a live defect. It matters because it is
precisely the "mapper fallback that silently rewrites data" pattern `.cursor/BUGBOT.md`
names for the admin layer, appearing here on the server side.

**Suggested fix:** throw (or return `null`, skipping the row) when `payload.userId` is
absent, so the dispatcher records a failure rather than the mapper inventing a subject.
Do NOT implement.

---

**Checked and cleared** (examined, no defect found):

- **Is the audit row written in the same transaction as the mutation?** Not literally, but
  the property that matters holds: the *event* is appended inside the mutation's
  `UnitOfWork.run`, so a rolled-back mutation produces no event and therefore no audit row.
  e2e-proven twice (`activity.spec.ts:144,161`). The wording drift is BUG-01; the guarantee
  is intact.
- **Is any mutation path completely unaudited?** Yes, three — but none of them are this
  package's fault: API-token mint/revoke (no producer event —
  🐞 BUG-identity-server-01), `PUT /api/preferences` (deliberate; a theme is not an audit
  event), and `user.password_changed` (BUG-03 above).
- **Is the actor spoofable?** No. Stamped server-side from `@CurrentUser()` via
  `attachActor`; never read from a request body, query, or header. The read API has no
  write surface.
- **Can a non-admin read another user's activity?** No — `activity:read` is admin-only,
  there is no per-user route, and the admin UI hides the tab. e2e-proven for both
  non-admin roles.
- **Are secrets or PII copied into `meta`?** No — every mapper's payload was enumerated
  (EC-27). Emails appear, and they are already readable by every role via `GET /api/users`.
- **LIKE-metacharacter escaping on `?actorEmail`.** Correct
  (`activity.service.ts:179`) — a literal `%` searches for a percent sign rather than
  matching everything.
- **Sort-column whitelist.** `SORT_COLUMNS` is `satisfies Record<SortableField, unknown>`
  (`activity.service.ts:33`) and the DTO `@IsIn(SORTABLE_FIELDS)`, so no user-supplied
  string reaches `orderBy`. No injection, no unindexed sort.
- **Deterministic paging.** `desc(activityEvents.id)` tiebreaker on every sort
  (`activity.service.ts:106`), so equal timestamps cannot duplicate or drop a row across pages.
- **`created_at` off the wire.** Never selected (`activity.service.ts:94-103`) and absent
  from `ActivityEventView`.
- **Permission by constant.** `PERMISSIONS.ACTIVITY_READ`, not a literal.
- **Copilot tool surface.** `surfaces: ['copilot']` with the rationale BUGBOT asks for: a
  tool requiring `activity:read` can never be listed for a token, because
  `scopePermissions` mints only `content:*` + `media:read`/`media:create` — so relying on
  that coincidence would be the bug, and the explicit narrowing is the fix.
- **Copilot tool clamping.** Page size and page number are clamped in the handler
  (`activity-tool.provider.ts:136-139,149`) as well as declared in the JSON schema —
  "the validator is defence in depth, not the boundary".
- **Index coverage.** The three indexes (`subject_type,subject_id,at`), (`actor_id,at`),
  (`kind,at`) match the three filter shapes the API actually serves.
- **Schema isolation.** No FK on `actor_id`, `subject_id` is `text`, `actor_email` is a
  frozen snapshot — the audit genuinely outlives its subjects.

**Defect tally:** `5 🐞 · 0 Critical · 0 High · 3 Medium · 2 Low · 1 🔒`
**Accessibility tally:** `2 ♿ · 0 Supports · 1 Partially Supports · 1 Does Not Support ·
the rest Not Applicable (server unit, no rendered UI)`

## 7. Recommended E2E Tests

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | `apps/server-e2e` | `server/activity/audit-idempotency.spec.ts` | after a mutation drains, resetting `outbox_events.dispatched_at = null` and waiting a poll tick leaves **exactly one** `activity_events` row; its `id` equals the outbox event's `id` | F15 ❌, 🐞 BUG-02 |
| 2 | `apps/server-e2e` | `server/activity/audit-poison.spec.ts` | an event whose mapper produces an invalid row increments `attempts`, is retried, and — post-fix — is parked so that later events still drain | 🐞 BUG-04, EC-33 |
| 3 | `apps/server-e2e` | extend `server/activity/activity-filter.spec.ts` | `?actorEmail=%` returns `[]` rather than everything; `?actorEmail=_` likewise; a backslash does not error | F5 ⚠️, EC-16/17 |
| 4 | `apps/server-e2e` | extend `server/activity/activity.spec.ts` | `?from`/`?to` are boundary-**inclusive** against a row's exact `at`; an inverted range returns `[]`; a non-ISO value is 400 | F6 ⚠️, EC-10/11/12 |
| 5 | `apps/server-e2e` | `server/activity/activity-paging.spec.ts` | three rows sharing one `at`, paged with `pageSize=1`, yield each row exactly once; `pageSize=101` 400; `page=0` 400; `page=9999` returns `[]` with the real total | F8/F9 ⚠️, EC-07/08/09/13 |
| 6 | `apps/server-e2e` | `server/activity/audit-mapping-coverage.spec.ts` | drive one real mutation per mapped kind and assert the resulting row's `kind`, `subjectType`, `subjectId` and `meta` — closing the gap between the DB-free parity unit test and reality, especially `workspace.member_added`'s user-subject inversion | F13, 🐞 BUG-05 |
| 7 | `apps/server-e2e` | extend `server/activity/activity.spec.ts` | delete the acting admin's account, then confirm their historical rows survive with the frozen `actor_email`; delete a subject and confirm `?subjectId=` still returns its history | F18 ⚠️, EC-26 |
| 8 | `apps/server-e2e` | extend `server/activity/activity.spec.ts` | no response item carries `createdAt`; `?actorId=<uuid>` narrows correctly and `?actorId=not-a-uuid` is 400 | F3 ❌, F10 ❌ |
| 9 | `apps/server-e2e` | extend `server/copilot/copilot-read-catalogue.spec.ts` | `activity_recent` is refused for a contributor/viewer run even when named explicitly; `pageSize: 500` returns at most 25 items; `page: -1` is treated as page 1 | F21/F22 ⚠️ |
| 10 | `apps/server-e2e` | `server/activity/audit-latency.spec.ts` | after a mutation returns 200, the audit row is readable within a bounded window — pinning the eventual-consistency contract that BUG-01's documentation fix should state | 🐞 BUG-01, EC-31 |
