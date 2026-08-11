# @ortha-cms/workspaces-server — Test Artifact

> **Unit:** `packages/workspaces/server` · **Package:** `@ortha-cms/workspaces-server` · **Kind:** server plugin
> **Source of truth:** `packages/workspaces/server/AGENTS.md`
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns** the tenancy boundary: the `workspaces`, `memberships` and
`workspace_content` tables plus their migrations; the `Workspace` aggregate and
its invariants (slug format, no-orphaned-content on delete/revoke); the two
guards (`WorkspaceGuard` header-scoped, `WorkspaceMemberGuard` `:id`-scoped)
that every workspace-scoped route in *other* plugins is protected by; and the
`CONTENT_CATALOG` / `CONTENT_ENTRY_COUNTER` secondary ports that `content-server`
binds.

**Does NOT own:** users/roles/sessions (identity), permission *definitions*
(`PERMISSIONS` comes from `@ortha-cms/identity-server`), content entries or the
content catalogue itself (content-server, reached only through the two ports),
audit rows (activity-server subscribes to the outbox), or any per-workspace role
— membership is a pure link with no role
(`packages/workspaces/server/src/lib/workspace/domain/membership.ts:1-19`).

- **Entry points**

    | Verb + path | Controller | Permission | Guards |
    | --- | --- | --- | --- |
    | `POST /api/workspaces` | `create-workspace.controller.ts:45` | `workspaces:create` | `OriginGuard`, `PermissionsGuard` |
    | `GET /api/workspaces` | `list-workspaces.controller.ts:28` | `workspaces:read` | `PermissionsGuard` |
    | `GET /api/workspaces/slug-available?slug=` | `check-slug.controller.ts:13` | **none** | global `AuthGuard` only |
    | `PATCH /api/workspaces/:id` | `update-workspace.controller.ts:47` | `workspaces:update` | `OriginGuard`, `PermissionsGuard`, `WorkspaceMemberGuard` |
    | `POST /api/workspaces/:id/archive` | `set-workspace-status.controller.ts:44` | `workspaces:update` | same |
    | `POST /api/workspaces/:id/unarchive` | `set-workspace-status.controller.ts:52` | `workspaces:update` | same |
    | `DELETE /api/workspaces/:id` | `delete-workspace.controller.ts:43` | `workspaces:delete` | same |
    | `POST /api/workspaces/:id/members` | `add-workspace-member.controller.ts:46` | `workspaces:update` | same |
    | `DELETE /api/workspaces/:id/members/:userId` | `remove-workspace-member.controller.ts:36` | `workspaces:update` | same |
    | `POST /api/workspaces/:id/content` | `add-workspace-content.controller.ts:48` | `workspaces:update` | same |
    | `DELETE /api/workspaces/:id/content/:slug` | `remove-workspace-content.controller.ts:47` | `workspaces:update` | same |
    | `GET /api/workspaces/:id/content/:slug/entry-count` | `get-workspace-content-count.controller.ts:26` | `workspaces:update` | `PermissionsGuard`, `WorkspaceMemberGuard` |
    | `GET /api/workspaces/:id/entry-count` | `get-workspace-entry-count.controller.ts:26` | `workspaces:delete` | `PermissionsGuard`, `WorkspaceMemberGuard` |
    | `GET /api/content-types` | `list-content-types.controller.ts:17` | **none** | global `AuthGuard` only |

    All paths above live under `packages/workspaces/server/src/lib/workspace/http/controllers/`.

    **Exported API** (`packages/workspaces/server/src/index.ts:1-31`): `WorkspacesPlugin`,
    `WorkspacesModule`, `WorkspaceGuard`, `WorkspaceMemberGuard`, `WORKSPACE_HEADER`
    (`'x-workspace-id'`), `WORKSPACE_ID_PATTERN`, `CurrentWorkspace`,
    `MembershipCheckQuery`, `lockWorkspaceShared` / `lockWorkspaceExclusive` /
    `LockExecutor`, `CONTENT_CATALOG` + `ContentCatalog`, `CONTENT_ENTRY_COUNTER` +
    `ContentEntryCounter`, `ContentTypeDescriptor`, and `export * from schema`
    (`workspaces`, `memberships`, `workspaceContent`, `workspaceStatus`, `contentKind`).

    **DI ports declared here, bound elsewhere:** `CONTENT_CATALOG`
    (`application/ports/content-catalog.port.ts:19`) and `CONTENT_ENTRY_COUNTER`
    (`application/ports/content-entry-counter.port.ts:36`) — both injected
    `@Optional()` (`application/content/content-catalog.reader.ts:27`,
    `content-entry-counter.reader.ts:16`).
    **Ports declared and bound here:** `WORKSPACE_REPOSITORY`
    (`domain/workspace.repository.ts:47` → `DrizzleWorkspaceRepository`),
    `MEMBER_PROVISIONER` (`application/ports/member-provisioner.port.ts` →
    `DrizzleMemberProvisioner`).

- **Runtime prerequisites**
    - Postgres reachable at `DATABASE_URL` (`docker compose up -d`).
    - Migrations applied: `npx nx run server:db:migrate` — identity's must land
      first, because `memberships.user_id` FKs identity's `users(id)`
      (`infrastructure/schema/memberships.ts:16-18`, rationale in
      `infrastructure/schema/external-refs.ts:1-23`).
    - Plugin registration order in `apps/server/src/plugins.ts`: `DatabasePlugin`
      → `IdentityPlugin` → `WorkspacesPlugin` → `ContentPlugin`
      (`src/lib/utils/workspaces-plugin.ts:11-32`).
    - A logged-in session (httpOnly cookie from `POST /api/auth/login`) — the
      global `AuthGuard` covers every route here.
    - For CSRF-guarded routes (every POST/PATCH/DELETE) the `Origin` header must
      match the configured app origin, or be absent.

- **How to exercise it manually**

    ```bash
    docker compose up -d
    npx nx run server:db:migrate
    npm run dev                     # server on :3000, admin on :4200
    # log in and keep the cookie
    curl -c /tmp/c.txt -X POST localhost:3000/api/auth/login \
      -H 'content-type: application/json' \
      -d '{"email":"admin@example.com","password":"SecurePass123!"}'
    # list your workspaces (membership-scoped)
    curl -b /tmp/c.txt localhost:3000/api/workspaces
    # create one
    curl -b /tmp/c.txt -X POST localhost:3000/api/workspaces \
      -H 'content-type: application/json' \
      -d '{"name":"Marketing","slug":"marketing","description":"","color":"violet","members":[],"content":{"mode":"all"}}'
    ```

    OpenAPI reference: `http://localhost:3000/reference`.

- **Dependencies that must be healthy**
    - `@ortha-cms/database` — `UnitOfWork`, `OutboxWriter`, `attachActor`,
      `@InjectDatabase()`. Every use case runs inside `uow.run`.
    - `@ortha-cms/identity-server` — `AuthGuard`, `PermissionsGuard`,
      `OriginGuard`, `PERMISSIONS`, `CurrentUser`, and the `users` / `roles`
      tables read by `MemberLookupQuery` and `DrizzleMemberProvisioner`.
    - `@ortha-cms/activity-server` — subscribes to the outbox and writes the
      audit rows the e2e suites assert on
      (`packages/activity/server/src/lib/activity/infrastructure/audit-event.subscriber.ts:13`).
    - `@ortha-cms/content-server` — binds both content ports. When absent, the
      readers fall back to the mock catalogue and a **zero** entry count.

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | Create a workspace (creator becomes first member) | `src/lib/workspace/http/controllers/create-workspace.controller.ts:45` | ✅ E2E |
| F2 | Create rejects a duplicate slug with 409 | `src/lib/workspace/domain/slug-uniqueness.service.ts:19` | ✅ E2E |
| F3 | Create rejects a malformed slug / colour with 400 | `src/lib/workspace/domain/value-objects/slug.ts:23`, `workspace-color.ts:37` | ✅ E2E + 🧪 UNIT |
| F4 | Create provisions `pending` users for invited emails | `src/lib/workspace/infrastructure/persistence/drizzle-member-provisioner.ts:46` | ❌ NONE |
| F5 | Create drops non-resolving directory ids instead of failing | `drizzle-member-provisioner.ts:37-42` | ❌ NONE |
| F6 | Create flattens `content: {mode:'all'}` into explicit grants | `src/lib/workspace/application/content/content-selection.ts:35` | ✅ E2E |
| F7 | Create flattens `specific` selections + `excludedIds` | `content-selection.ts:14-27` | ❌ NONE |
| F8 | List workspaces, membership-scoped, newest first | `http/controllers/list-workspaces.controller.ts:28` → `infrastructure/queries/workspace-view.query.ts:34` | ✅ E2E |
| F9 | Slug-availability probe | `http/controllers/check-slug.controller.ts:13` → `infrastructure/queries/slug-availability.query.ts:18` | ❌ NONE |
| F10 | List the content-type catalogue | `http/controllers/list-content-types.controller.ts:17` | ⚠️ PARTIAL |
| F11 | Partial profile update (name/description/colour) | `http/controllers/update-workspace.controller.ts:47` | ✅ E2E |
| F12 | Empty patch is a no-op that records nothing | `domain/workspace.ts:177-179` | ✅ E2E |
| F13 | Archive a workspace (idempotent) | `http/controllers/set-workspace-status.controller.ts:44` | ✅ E2E |
| F14 | Unarchive a workspace (idempotent) | `http/controllers/set-workspace-status.controller.ts:52` | ✅ E2E |
| F15 | Delete a workspace (memberships + grants cascade) | `http/controllers/delete-workspace.controller.ts:43` | ✅ E2E |
| F16 | Delete refused 409 while content entries remain | `domain/workspace.ts:283-291` | ✅ E2E |
| F17 | Delete takes the exclusive advisory lock first | `infrastructure/persistence/drizzle-workspace.repository.ts:48`, `workspace-lock.ts:30` | ❌ NONE |
| F18 | Add a member (idempotent) | `http/controllers/add-workspace-member.controller.ts:46` | ✅ E2E |
| F19 | Add member 404s an unknown user | `application/use-cases/add-member.use-case.ts:49-52` | ✅ E2E |
| F20 | Remove a member (no-op 204 for a non-member) | `http/controllers/remove-workspace-member.controller.ts:36` | ✅ E2E |
| F21 | No owner protection — the creator is removable | `domain/workspace.ts:223` | ✅ E2E |
| F22 | Grant one content type (idempotent, kind derived server-side) | `http/controllers/add-workspace-content.controller.ts:48` | ✅ E2E |
| F23 | Grant 400s an unknown content-type slug | `application/use-cases/grant-content.use-case.ts:42-45` | ✅ E2E |
| F24 | Revoke a content grant | `http/controllers/remove-workspace-content.controller.ts:47` | ✅ E2E |
| F25 | Revoke refused 409 while that type holds entries | `domain/workspace.ts:258-265` | ✅ E2E |
| F26 | Revoke of a never-held grant is a 200 no-op | `domain/workspace.ts:266-269` | ✅ E2E |
| F27 | Per-type entry count (revoke pre-check) | `http/controllers/get-workspace-content-count.controller.ts:26` | ✅ E2E |
| F28 | Whole-workspace entry count (delete pre-check) | `http/controllers/get-workspace-entry-count.controller.ts:26` | ⚠️ PARTIAL |
| F29 | `WorkspaceMemberGuard` — 403 for a non-member on every `:id` route | `http/guards/workspace-member.guard.ts:35`, `workspace-access.ts:27` | ✅ E2E |
| F30 | `WorkspaceGuard` — header-scoped sibling used by other plugins | `http/guards/workspace.guard.ts:28` | ✅ E2E (indirectly, content suites) |
| F31 | `@CurrentWorkspace()` throws 500 without the guard | `http/decorators/current-workspace.decorator.ts:20-24` | ❌ NONE |
| F32 | Domain events → outbox → activity audit rows | `application/use-cases/*.use-case.ts` (`outbox.append(attachActor(...))`) | ✅ E2E |
| F33 | Content-catalogue fallback when `CONTENT_CATALOG` is unbound | `application/content/content-catalog.reader.ts:34` | ❌ NONE |
| F34 | Entry-counter fallback (`0`) when `CONTENT_ENTRY_COUNTER` is unbound | `application/content/content-entry-counter.reader.ts:23-32` | ❌ NONE |
| F35 | Shared/exclusive advisory-lock pair exported to content-server | `infrastructure/persistence/workspace-lock.ts:30,40` | ⚠️ PARTIAL |
| F36 | `OriginGuard` (CSRF) on every state-changing route | controller `@UseGuards(OriginGuard, …)` | ✅ E2E |

## 3. Manual Test Plan

Common preconditions for every block: Postgres up, migrations applied, server on
`:3000`. `ADMIN` = a user with global role `admin`, `CONTRIB` = `contributor`,
`VIEWER` = `viewer`. "Log in" means `POST /api/auth/login` and keep the cookie.

### F1 — Create a workspace

**Preconditions:** logged in as `ADMIN` (holds `workspaces:create`).

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `POST /api/workspaces` with `{"name":"Marketing","slug":"marketing","description":"","color":"violet","members":[],"content":{"mode":"all"}}` | `201`, body is a `WorkspaceView` with a UUID `id`, `status:"active"`, `members` containing exactly the caller, `content` listing every catalogue slug |
| 2 | `GET /api/workspaces` | The new workspace appears first (newest-first order) |
| 3 | `GET /api/activity` (as admin) | A `workspace.created` row exists with `meta:{name:"Marketing",slug:"marketing"}` |

### F2 — Duplicate slug → 409

**Preconditions:** F1 has run; slug `marketing` exists.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Repeat the F1 `POST` verbatim | `409`, body message `Workspace slug already taken` |
| 2 | `GET /api/workspaces` | Still exactly one `marketing` workspace |

### F3 — Malformed slug / colour → 400

**Preconditions:** logged in as `ADMIN`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `POST /api/workspaces` with `slug:"My Workspace"` | `400` — `Slug.create` throws `InvalidSlugError` (`slug.ts:23`) |
| 2 | Same with `slug:"Blog_Post"` | `400` (underscore + uppercase both rejected by `/^[a-z0-9-]+$/`) |
| 3 | Same with `slug:"a".repeat(121)` | `400` (DTO `@MaxLength(120)`) |
| 4 | Same with `color:"chartreuse"` | `400` (DTO `@IsIn(WORKSPACE_COLORS)`) |
| 5 | Same with an extra unknown field `{"foo":1}` | `400` — the host's `ValidationPipe` uses `forbidNonWhitelisted` |

### F4 — Invited members are provisioned as pending users

**Preconditions:** logged in as `ADMIN`; `grace@example.com` has no account.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `POST /api/workspaces` with `members:[{"id":"grace@example.com","name":"grace@example.com","email":"Grace@Example.com","invited":true}]` | `201` |
| 2 | `GET /api/users?search=grace` | A user `grace@example.com` exists, `status:"pending"`, global role `viewer` (`drizzle-member-provisioner.ts:56-71`) |
| 3 | Inspect the response `members` array | Contains the creator **and** the provisioned user |
| 4 | Repeat step 1 with a second workspace and `email:"GRACE@example.com"` | The *same* user id is reused — lookup is `lower(email)` (`drizzle-member-provisioner.ts:48-53`) |

### F5 — Non-resolving directory ids are dropped

**Preconditions:** logged in as `ADMIN`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `POST /api/workspaces` with `members:[{"id":"00000000-0000-4000-8000-000000000000","name":"x","email":"x@example.com","invited":false}]` | `201`, not a 500 — the id is filtered out (`drizzle-member-provisioner.ts:37-42`) |
| 2 | Read `members` in the response | Only the creator |

### F6 — `content: {mode:'all'}` expands to explicit grants

**Preconditions:** `ContentPlugin` registered, so `CONTENT_CATALOG` is bound.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `GET /api/content-types` | Lists the code-defined registry (`test_article`, `test_page`, …), **not** `blog_post`/`product` from the mock |
| 2 | Create a workspace with `content:{mode:'all'}` | Response `content` array equals every `name` from step 1 |

### F7 — `specific` selection and `excludedIds`

**Preconditions:** as F6.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Create with `content:{mode:'specific',collections:{mode:'specific',ids:['test_article']},pages:{mode:'specific',ids:['test_page']}}` | `content` == `["test_article","test_page"]` |
| 2 | Create with `content:{mode:'specific',collections:{mode:'all',excludedIds:['test_article']}}` | `content` contains every collection slug except `test_article`, and **no** page slugs (`pages` absent → `selectionToSlugs` returns `[]`, `content-selection.ts:18`) |
| 3 | Create with `content:{mode:'specific',collections:{mode:'specific',ids:['not_a_type']}}` | `content` == `[]` — unknown ids are intersected away, not an error (`content-selection.ts:25-26`) |

### F8 — List is membership-scoped

**Preconditions:** two admins `A` and `B`, each with their own workspace.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `GET /api/workspaces` as `A` | Only `A`'s workspace id |
| 2 | `GET /api/workspaces` as `B` | Only `B`'s workspace id |
| 3 | `A` adds `B`: `POST /api/workspaces/{A}/members {"userId":B}` | `201` |
| 4 | `GET /api/workspaces` as `B` | Now contains both ids |
| 5 | `GET /api/workspaces` as a fresh admin in no workspace | `[]` (200, empty array — not 403) |

### F9 — Slug-availability probe

**Preconditions:** slug `marketing` exists; logged in as `VIEWER` (holds no `workspaces:*` write permission).

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `GET /api/workspaces/slug-available?slug=marketing` | `{"available":false}` |
| 2 | `GET /api/workspaces/slug-available?slug=free-slug` | `{"available":true}` |
| 3 | Omit the param entirely | `400` (DTO `@IsNotEmpty`) |
| 4 | `GET /api/workspaces/slug-available?slug=My Workspace` | `{"available":true}` — the probe applies **no** format rule (`slug-availability.query.ts:8-9`), so an invalid slug reads as "free" and only fails at create |
| 5 | Same request unauthenticated | `401` |
| 6 | Same request as `VIEWER` | `200` — see `🐞 BUG-workspaces-server-02` |

### F10 — Content-type catalogue

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `GET /api/content-types` unauthenticated | `401` |
| 2 | as `ADMIN` | `200`, array of `{name,kind,label?,description?,path?}` |
| 3 | as `VIEWER` who belongs to no workspace | `200` with the full catalogue — see `🐞 BUG-workspaces-server-03` |

### F11 — Partial profile update

**Preconditions:** `ADMIN` is a member of workspace `W`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `PATCH /api/workspaces/{W}` `{"name":"Renamed"}` | `200`, view has `name:"Renamed"`, `description` and `color` unchanged |
| 2 | `PATCH` `{"description":""}` | `200`, `description` is `""` |
| 3 | `PATCH` `{"color":"teal"}` | `200`, `color:"teal"` |
| 4 | `PATCH` `{"slug":"other"}` | `400` — slug is deliberately not patchable (`update-workspace.dto.ts:13-15` + `forbidNonWhitelisted`) |
| 5 | `GET /api/activity` | One `workspace.updated` row per real change, `meta.fields` naming the changed keys |

### F12 — Empty patch is a silent no-op

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `PATCH /api/workspaces/{W}` with `{}` | `200`, view unchanged |
| 2 | `GET /api/activity` | **No** new `workspace.updated` row (`workspace.ts:177-179`) |

### F13 / F14 — Archive & unarchive

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `POST /api/workspaces/{W}/archive` | `201`, view `status:"archived"`; `workspace.archived` audit row |
| 2 | Repeat | `201`, still archived, **no** second audit row (`workspace.ts:191-193`) |
| 3 | `POST /api/workspaces/{W}/unarchive` | `201`, `status:"active"`; `workspace.unarchived` audit row |
| 4 | `GET /api/workspaces` | The archived workspace is still listed — archiving hides nothing server-side |
| 5 | While archived, `POST /api/workspaces/{W}/content {"slug":"test_article"}` | `201` — archived is a label only, it blocks nothing (see EC-21) |

### F15 / F16 — Delete

**Preconditions:** `ADMIN` holds `workspaces:delete` and is a member of `W`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `GET /api/workspaces/{W}/entry-count` | `{"count":0}` |
| 2 | `DELETE /api/workspaces/{W}` | `204`; `workspace.deleted` audit row with `meta:{name,slug}` |
| 3 | `GET /api/workspaces` | `W` is gone |
| 4 | Query `memberships` / `workspace_content` for `W` | No rows (FK `onDelete:'cascade'`, `memberships.ts:22`, `workspace-content.ts:32`) |
| 5 | Create `W2`, create one entry in it, then `DELETE /api/workspaces/{W2}` | `409` `Workspace still has content entries` |
| 6 | Delete the entry, retry | `204` |

### F17 — Delete serialises against concurrent entry creates

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open a psql session, `BEGIN; select pg_advisory_xact_lock_shared(22347, hashtext('<W>'));` | Lock held |
| 2 | `DELETE /api/workspaces/{W}` | Blocks (does not return) until step 3 |
| 3 | `COMMIT;` in psql | The DELETE completes |

### F18 / F19 — Add a member

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `POST /api/workspaces/{W}/members {"userId":"<VIEWER id>"}` | `201`, view `members` now contains the viewer |
| 2 | Repeat verbatim | `201`, same view, **no** second `workspace.member_added` row |
| 3 | `POST` with a random UUID | `404` |
| 4 | `POST` with `{"userId":"not-a-uuid"}` | `400` (DTO `@IsUUID`) |
| 5 | Inspect the audit row | `subjectType:"user"`, `subjectId` = added user, `meta.email` = their email (`add-member.use-case.ts:59-66`) |

### F20 / F21 — Remove a member

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `DELETE /api/workspaces/{W}/members/{viewerId}` | `204`; `workspace.member_removed` recorded against the removed user |
| 2 | Repeat verbatim | `204`, **no** second audit row |
| 3 | Remove a user who was never a member | `204`, nothing recorded |
| 4 | As the creator, remove **yourself** while a second member exists | `204`; `GET /api/workspaces` no longer lists `W`; `PATCH /api/workspaces/{W}` now `403` |
| 5 | As the **only** member, remove yourself | `204` — and the workspace becomes permanently unreachable: `🐞 BUG-workspaces-server-01` |

### F22 / F23 — Grant a content type

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `POST /api/workspaces/{W}/content {"slug":"test_article"}` | `201`, view `content` includes `test_article`; `workspace.content_granted` with `meta:{slug,kind}` |
| 2 | Repeat | `201`, no second audit row |
| 3 | `POST` with `{"slug":"nope"}` | `400` `Unknown content type` |
| 4 | `POST` with `{"slug":""}` | `400` (DTO `@IsNotEmpty`) |

### F24 / F25 / F26 — Revoke a content grant

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `DELETE /api/workspaces/{W}/content/test_article` (no entries) | `200`, view `content` no longer lists it; `workspace.content_revoked` |
| 2 | Re-grant, create one `test_article` entry, retry the delete | `409` `Content type still has entries in this workspace` |
| 3 | `DELETE /api/workspaces/{W}/content/never_granted` | `200` (no-op), no audit row |
| 4 | `DELETE /api/workspaces/{W}/content/nope` (unknown slug, never granted) | `200` no-op — the revoke path does **not** validate the slug against the catalogue |

### F27 / F28 — Entry-count pre-checks

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `GET /api/workspaces/{W}/content/test_article/entry-count` as `ADMIN` | `{"count":0}`, then `{"count":1}` after creating one entry |
| 2 | Same as `CONTRIB` (lacks `workspaces:update`) | `403` |
| 3 | `GET /api/workspaces/{W}/entry-count` as `ADMIN` | `{"count":N}` summing every type |
| 4 | Same as `CONTRIB` (lacks `workspaces:delete`) | `403` |
| 5 | `GET /api/workspaces/{W}/content/%2E%2E%2F..%2Fetc/entry-count` | `{"count":0}` — an unknown slug resolves to 0, no error |

### F29 — `WorkspaceMemberGuard` on every `:id` route

**Preconditions:** admin `A` owns `WA`; admin `B` owns `WB`; neither is a member of the other's.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | As `B`: `PATCH /api/workspaces/{WA}` `{"name":"x"}` | `403` `You are not a member of this workspace.` — **not** 404 |
| 2 | As `B`: `POST /api/workspaces/{WA}/archive` | `403` |
| 3 | As `B`: `DELETE /api/workspaces/{WA}` | `403` |
| 4 | As `B`: `POST /api/workspaces/{WA}/members {"userId":B}` | `403` (cannot self-add) |
| 5 | As `B`: `DELETE /api/workspaces/{WA}/members/{A}` | `403` |
| 6 | As `B`: `POST` / `DELETE .../content/...` | `403` |
| 7 | As `B`: `GET /api/workspaces/{WA}/entry-count` | `403` |
| 8 | As `B`: any of the above with a UUID that exists nowhere | `403` — identical to steps 1-7, so ids cannot be enumerated |
| 9 | As `B`: `PATCH /api/workspaces/not-a-uuid` | `400` |
| 10 | After every rejected call, re-read `WA` as `A` | Unchanged |

### F30 — `WorkspaceGuard` (header-scoped)

**Preconditions:** a route in content-server carrying `@UseGuards(WorkspaceGuard)`, e.g. `GET /api/content/entries?type=test_article`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Request with no `X-Workspace-Id` | `400` `Missing or malformed X-Workspace-Id header.` |
| 2 | Request with `X-Workspace-Id: garbage` | `400` |
| 3 | Request with another tenant's workspace id | `403` |
| 4 | Send the header twice (array value) | The **first** value is used (`workspace.guard.ts:37`) — verify the first is what is authorized |

### F31 — `@CurrentWorkspace()` without the guard

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Code-review only: any route using `@CurrentWorkspace()` must carry `WorkspaceGuard` | Otherwise the request 500s with `@CurrentWorkspace() used on a route without WorkspaceGuard.` (`current-workspace.decorator.ts:21-24`) — fails closed, never unscoped |

### F32 — Domain events reach the audit log

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Perform each mutation F1/F11/F13/F14/F15/F18/F20/F22/F24 | `GET /api/activity` shows exactly one row per real change with `kind` matching the `WORKSPACE_EVENT_KINDS` string (`domain/events/workspace-events.ts:9-19`) |
| 2 | Trigger a mutation that fails after the aggregate mutated (e.g. force a DB error) | No audit row and no state change — both live in one `uow.run` transaction |

### F33 / F34 — Port fallbacks when content-server is absent

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Boot the server with `ContentPlugin` removed from `apps/server/src/plugins.ts` | Server boots; `@Optional()` injection resolves to `undefined` |
| 2 | `GET /api/content-types` | Returns the eight mock descriptors `blog_post`…`pricing` (`infrastructure/content/content-catalog.mock.ts:10-63`) |
| 3 | `GET /api/workspaces/{W}/entry-count` | `{"count":0}` |
| 4 | `DELETE /api/workspaces/{W}` | `204` — no entry check is possible, see EC-30 |

### F35 — Advisory-lock pair

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Hold `pg_advisory_xact_lock(22347, hashtext('<W>'))` (exclusive) in psql | A content-entry create in `W` blocks |
| 2 | Two content-entry creates concurrently (both shared) | Both proceed without blocking each other |

### F36 — `OriginGuard` (CSRF)

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `POST /api/workspaces` with `Origin: https://evil.example` | `403` |
| 2 | Same with the configured app origin | `201` |
| 3 | Same with no `Origin` header (curl default) | `201` — non-browser clients are allowed |
| 4 | `GET /api/workspaces/{W}/entry-count` with a hostile `Origin` | `200` — reads carry no `OriginGuard` (documented, `get-workspace-entry-count.controller.ts:13`) |

## 4. Edge Cases & Negative Paths

**Empty / zero**

- **EC-01 — `GET /api/workspaces` for a user in no workspace.** `✅ E2E`
  Expected: `200 []`. Asserted at `apps/server-e2e/src/server/workspaces/workspace-access.spec.ts:112`.
- **EC-02 — Create with `members: []`.** `✅ E2E`
  Expected: `201`, `members` == `[the creator]` only (`workspace.ts:115` dedupes the creator in).
- **EC-03 — Create with `content: {mode:'specific'}` and both selections absent.** `❌ NONE`
  Expected: `201` with `content: []`. `selectionToSlugs(undefined)` returns `[]` (`content-selection.ts:18`). The workspace is then reachable but shows no Content Library at all.
- **EC-04 — `description: ""`.** `✅ E2E`
  Expected: stored as `''`; the view maps a `null` column back to `''` (`workspace-view.query.ts:76`).
- **EC-05 — Empty patch `{}`.** `✅ E2E` — no-op, no audit row (`update-workspace.spec.ts:132`).

**Boundary & size**

- **EC-06 — `name` of exactly 120 / 121 chars.** `❌ NONE` Expected: `201` / `400` (`create-workspace.dto.ts:145`).
- **EC-07 — `slug` of exactly 120 / 121 chars.** `🧪 UNIT` for 121 (`domain/value-objects/slug.spec.ts:19`); the DTO also caps at 120. Expected `201` / `400`.
- **EC-08 — `description` of 2000 / 2001 chars.** `❌ NONE` Expected `201` / `400`.
- **EC-09 — 10 MB request body.** `❌ NONE` Expected: rejected by the body-parser limit (413), never reaching the DTO.
- **EC-10 — `members` array of 10 000 entries, all `invited:true`.** `❌ NONE`
  Suspected: `DrizzleMemberProvisioner.resolve` loops **sequentially**, two queries per member (`drizzle-member-provisioner.ts:25-31`), inside one transaction. 10 000 members ⇒ 20 000 round-trips holding a write transaction open. See `🐞 BUG-workspaces-server-06`.

**Encoding & injection**

- **EC-11 — `name` containing `<script>alert(1)</script>`.** `❌ NONE`
  Expected: stored verbatim (correct — the server is not the escaping layer), returned verbatim. The admin must escape it; React does by default.
- **EC-12 — `slug` with unicode (`marketing-café`) or RTL marks.** `❌ NONE`
  Expected: `400` — the `Slug` regex is ASCII-only (`slug.ts:4`).
- **EC-13 — `slug` with a leading/trailing space (`" marketing"`).** `❌ NONE` Expected `400`; no trimming happens anywhere.
- **EC-14 — Content slug with path traversal: `DELETE /api/workspaces/{W}/content/..%2F..%2Fetc%2Fpasswd`.** `❌ NONE`
  Expected: `200` no-op. The slug is only ever a bound parameter in `eq(workspaceContent.slug, …)` (`drizzle-workspace.repository.ts:118`), never interpolated — no traversal or injection surface.
- **EC-15 — SQL-ish `slug=' OR 1=1--` on `/slug-available`.** `❌ NONE` Expected `{"available":true}`; Drizzle parameterises.
- **EC-16 — Invited `email` that is whitespace-only.** `❌ NONE`
  Suspected: `findOrCreateInvited` trims and lowercases (`drizzle-member-provisioner.ts:48`) producing `''`, then inserts a user with an **empty email** — the DTO only enforces `@IsString @IsNotEmpty`, never `@IsEmail`. See `🐞 BUG-workspaces-server-05`.

**Permission matrix** (global roles; membership assumed unless stated)

| Route | unauth | viewer | contributor | admin | admin, non-member |
| --- | --- | --- | --- | --- | --- |
| `POST /api/workspaces` | 401 ✅ | 403 ✅ | 403 ✅ | 201 ✅ | n/a |
| `GET /api/workspaces` | 401 ❌ | 200 (own) ✅ | 200 (own) ❌ | 200 (own) ✅ | 200 without it ✅ |
| `GET /workspaces/slug-available` | 401 ❌ | **200** ❌ | 200 ❌ | 200 ❌ | 200 ❌ |
| `GET /api/content-types` | 401 ✅ | **200** ❌ | 200 ❌ | 200 ✅ | 200 ❌ |
| `PATCH /workspaces/:id` | 401 ❌ | 403 ❌ | 403 ✅ | 200 ✅ | 403 ✅ |
| `POST /workspaces/:id/archive`\|`unarchive` | 401 ❌ | 403 ❌ | 403 ✅ | 201 ✅ | 403 ✅ |
| `DELETE /workspaces/:id` | 401 ❌ | 403 ❌ | 403 ✅ | 204 ✅ | 403 ✅ |
| `POST /workspaces/:id/members` | 401 ❌ | 403 ❌ | 403 ✅ | 201 ✅ | 403 ✅ |
| `DELETE /workspaces/:id/members/:userId` | 401 ❌ | 403 ✅ | 403 ❌ | 204 ✅ | 403 ✅ |
| `POST`\|`DELETE /workspaces/:id/content` | 401 ❌ | 403 ✅ | 403 ❌ | 200/201 ✅ | 403 ✅ |
| `GET /workspaces/:id/content/:slug/entry-count` | 401 ❌ | 403 ✅ | 403 ❌ | 200 ✅ | 403 ✅ |
| `GET /workspaces/:id/entry-count` | 401 ❌ | 403 ❌ | 403 ✅ | 200 ✅ | 403 ✅ |

- **EC-17 — A **global admin** is *not* implicitly a member.** `✅ E2E`
  Asserted at `workspace-lifecycle.spec.ts:148` and `update-workspace.spec.ts:165`. This is the headline tenancy rule and it holds on every `:id` route.
- **EC-18 — Denial is 403, never 404, for a cross-tenant or non-existent id.** `✅ E2E`
  `workspace-access.spec.ts:157-233`, `workspace-lifecycle.spec.ts:139,194`, `update-workspace.spec.ts:154`, `workspace-members.spec.ts:158`. Matches BUGBOT's "no enumeration signal".

**Tenant isolation** — same id, different workspace

- **EC-19 — Read another tenant's workspace.** `✅ E2E` There is no `GET /api/workspaces/:id`; the only read path is `listForMember` (`workspace-view.query.ts:34`), which joins `memberships` on the actor. **No unscoped `listAll()` exists** — verified by reading the whole query class.
- **EC-20 — Count another tenant's entries.** `✅ E2E` `workspace-access.spec.ts:171`, `workspace-lifecycle.spec.ts:217`.
- **EC-21 — `WorkspaceViewQuery.byId` is unscoped.** `⚠️ PARTIAL`
  `byId` (`workspace-view.query.ts:55-63`) filters only on `workspaces.id`. It is safe **today** because all five of its callers sit behind `WorkspaceMemberGuard`, but it is a loaded gun: any future controller calling `views.byId(id)` without that guard leaks a foreign workspace's full member roster. Reported as `🐞 BUG-workspaces-server-07` (Low, latent).

**Lifecycle**

- **EC-22 — Archive then mutate.** `❌ NONE`
  Trigger: archive `W`, then `PATCH`, add a member, grant content, create an entry.
  Expected (per `workspace-status.ts:10-11`, "archiving is a soft state change"): all succeed.
  Suspected: they do — **nothing** anywhere consults `status` before a write. Whether that is intended is a product question; flagged as EC only, not a bug.
- **EC-23 — Delete a workspace holding media assets, API-token bucket rows, or copilot threads.** `❌ NONE`
  Expected: entries block the delete; nothing else does. `workspace_content` and `memberships` cascade via FK, but tables in *other* plugins scope by a plain `workspace_id` uuid with no FK (documented at `delete-workspace.use-case.ts:15-16`). Suspected orphans — see `🐞 BUG-workspaces-server-04`.
- **EC-24 — Delete the last workspace a user belongs to.** `❌ NONE` Expected: `204`; the user's `GET /api/workspaces` returns `[]` and the admin shows its empty state. No "last workspace" protection exists, by design.
- **EC-25 — Remove a user from the only workspace they belong to while they have it open.** `❌ NONE`
  Expected: their next `/api/workspaces/:id/...` call 403s and the SPA must recover. See the admin artifact's EC on 403 handling.
- **EC-26 — Remove the **last** member of a workspace.** `❌ NONE`
  Expected: refused, or the workspace is reassigned/deleted.
  Suspected: `204` and the workspace is orphaned forever — `🐞 BUG-workspaces-server-01`.

**Concurrency**

- **EC-27 — Two concurrent creates with the same slug.** `❌ NONE`
  Expected: one `201`, one `409`. Suspected: one `201`, the other a **500** — `SlugUniquenessService.assertAvailable` is a read-then-write check (`slug-uniqueness.service.ts:20`) with no lock; the DB unique constraint on `workspaces.slug` (`schema/workspaces.ts:19`) is the real backstop but its `23505` is not translated to `ConflictException` anywhere in `create-workspace.controller.ts:57-68`. This is the BUGBOT "count-then-write race" shape. See `🐞 BUG-workspaces-server-08`.
- **EC-28 — Concurrent `DELETE /workspaces/:id` and content-entry create.** `⚠️ PARTIAL`
  Handled: delete takes `pg_advisory_xact_lock` exclusive before loading (`drizzle-workspace.repository.ts:47`), entry creates take the shared lock. No e2e proves the interleaving.
- **EC-29 — Concurrent `PATCH` from two editors.** `❌ NONE`
  Expected/actual: **last write wins silently.** There is no version column, no `If-Match`, no `updatedAt` precondition — `save()` issues a bare `UPDATE … WHERE id = …` (`drizzle-workspace.repository.ts:72-75`). Acceptable for a workspace profile; recorded so the same pattern is questioned for content entries.
- **EC-30 — Concurrent add + remove of the same member.** `❌ NONE` Expected: converges; the membership insert is `onConflictDoNothing` and the delete is idempotent, so no constraint error either way. Audit may record both.

**Failure & partiality**

- **EC-31 — `CONTENT_ENTRY_COUNTER` unbound while entries physically exist.** `❌ NONE`
  Trigger: boot without `ContentPlugin` against a database that has content rows.
  Expected: refuse to delete. Suspected: the reader returns `0` (`content-entry-counter.reader.ts:23-32`) so the aggregate's `assertDeletable(0)` passes and the workspace is deleted, orphaning every entry row. See `🐞 BUG-workspaces-server-04`.
- **EC-32 — DB error mid-`uow.run`.** `❌ NONE` Expected: transaction rolls back; no partial membership rows, no outbox row, no audit row.
- **EC-33 — Outbox dispatcher down after commit.** `❌ NONE` Expected: state change persists, audit row appears when the dispatcher recovers (that is the point of the outbox). Worth an explicit test.
- **EC-34 — Migration applied twice.** `❌ NONE` Expected: `__drizzle_migrations_workspaces` makes it a no-op.

**Idempotency & replay**

- **EC-35 — Re-`POST` `:id/members` with the same body.** `✅ E2E` `workspace-members.spec.ts:134` — `201`, no second audit row.
- **EC-36 — Re-`POST` `:id/content` with the same slug.** `✅ E2E` `workspace-content.spec.ts:104`.
- **EC-37 — Re-`POST` `:id/archive` twice.** `✅ E2E` `workspace-lifecycle.spec.ts:100`.
- **EC-38 — `DELETE` an already-deleted workspace.** `❌ NONE` Expected: `403` (the guard no longer finds a membership), **not** 404 — consistent with EC-18 but worth pinning.
- **EC-39 — Revoke a grant twice.** `✅ E2E` `workspace-content.spec.ts:199` (never-granted case).

**Header / param handling**

- **EC-40 — `X-Workspace-Id` sent twice.** `❌ NONE` Actual: `Array.isArray(header) ? header[0] : header` (`workspace.guard.ts:37`) — the **first** wins. Node/Express joins duplicate non-set-cookie headers with `, ` into a single string rather than an array, so the array branch is largely defensive; a doubled header more likely arrives as `"idA, idB"` and fails the UUID regex with a 400. Either way it fails closed.
- **EC-41 — `:id` path param that is a valid UUID but with uppercase hex.** `❌ NONE` Expected: accepted — both `WORKSPACE_ID_PATTERN` (`workspace-access.ts:11`) and `WorkspaceId` (`workspace-id.ts:6`) use the `i` flag, and Postgres normalises uuids. Confirm the membership lookup still matches.
- **EC-42 — `ParseUUIDPipe` vs the guard.** `❌ NONE` Guards run **before** pipes in Nest, so a non-UUID `:id` yields the guard's `400 Missing or malformed workspace id.`, not the pipe's message. Pin the exact message if the admin branches on it.

**Domain-object invariants (framework-free layer)**

- **EC-43 — `Slug.create` rejects empty / uppercase / space / punctuation / underscore / >120.** `🧪 UNIT` `domain/value-objects/slug.spec.ts:9-22`.
- **EC-44 — `WorkspaceColor.create('nope')`.** `❌ NONE` Expected `InvalidWorkspaceColorError`. No unit spec exists for colour, id, or status VOs — only `Slug` and `Workspace` have one.
- **EC-45 — Value-object immutability & equality.** `⚠️ PARTIAL`
  `WorkspaceId.equals` and `WorkspaceStatus.equals` implement value equality (`workspace-id.ts:42`, `workspace-status.ts:48`); **`Slug` and `WorkspaceColor` have no `equals`** — comparing two `Slug`s uses reference identity. All four hold their state in `private readonly` fields with no setters, so they are effectively immutable. Low-severity asymmetry, noted not filed.
- **EC-46 — `domain/` imports no framework.** `✅` Verified by reading every file under `domain/`: the only non-relative import in the whole layer is `import type { DomainEvent } from '@ortha-cms/database'` (`domain/workspace.ts:1`) plus `createDomainEvent` (`domain/events/workspace-events.ts:1`) and `node:crypto` (`workspace-id.ts:1`) — exactly what AGENTS.md sanctions. No `@nestjs/*`, no `drizzle-orm`, no `class-validator`, no `infrastructure/`.

### 4A. Accessibility & Section 508 Conformance

This unit renders **no UI**. It is assessed only against the provisions that can
be violated by a headless API: **508 Chapter 5 / 504 Authoring Tools** (a CMS
back end is part of the authoring tool, and 504.2.1 requires accessibility
information to be *preserved*), plus anything that constrains what the admin can
render. Every Chapter 4 hardware provision and every WCAG Perceivable/Operable
criterion is **Not Applicable** here.

Standards tested against: Revised Section 508 (36 CFR Part 1194, App. A–C),
which incorporates WCAG 2.0 A+AA by reference (E205.4 for content, 504.2 for
authoring tools); the repo's `accessibility` skill targets WCAG **2.1** AA
(`.agents/skills/accessibility/SKILL.md:10`), so findings are stated at 2.1 AA
with the 508 provision cited alongside.

| Provision | Scope here | Verdict |
| --- | --- | --- |
| 508 E205.4 → WCAG 1.x/2.x/3.x/4.x | No content is rendered | **Not Applicable** |
| 508 502.2 / 502.3 (AT interoperability) | No platform UI | **Not Applicable** |
| 508 503.2 (platform preferences) | No UI | **Not Applicable** |
| 508 504.2 (produce conformant content) | Workspace `name` / `description` are free text with no structural markup; nothing here constrains conformance | **Supports** |
| 508 504.2.1 (preserve a11y information) | See ♿ A11Y-workspaces-server-01 | **Partially Supports** |
| 508 504.3 (prompt for a11y information) | No authoring surface in this unit | **Not Applicable** |
| 508 504.4 (templates) | The content-type catalogue is surfaced but not defined here | **Not Applicable** — see `content-domain.md` / `content-server.md` |

#### ♿ A11Y-workspaces-server-01 — Workspace `description` is unstructured text with no language-of-parts or markup channel

- **WCAG:** `3.1.2 Language of Parts (AA)`, `1.3.1 Info and Relationships (A)`
- **508:** `504.2 / 504.2.1`
- **Verdict:** **Partially Supports**
- **Location:** `packages/workspaces/server/src/lib/workspace/infrastructure/schema/workspaces.ts:21`
  (`description: text('description')`), surfaced verbatim at
  `packages/workspaces/server/src/lib/workspace/application/queries/workspace.view.ts:19-20`.
- **Repro:** `PATCH /api/workspaces/:id` with
  `{"description":"Le site marketing d'Acme"}` on an English installation; read
  it back via `GET /api/workspaces`.
- **What a keyboard-only user experiences:** nothing — this is not an
  interactive surface.
  **What a screen-reader user experiences:** the admin renders the description
  inside the English page, so a French description is announced with English
  phonemes. There is no field on the wire (`WorkspaceView`) that could carry a
  `lang` marker, so the admin *cannot* emit `<span lang="fr">` even if it wanted
  to. The same is true of any structural markup — the field is a single opaque
  string, so an author cannot express a list or a heading and have it survive.
- **Remediation:** if descriptions are ever to carry mixed-language or
  structured text, model them as a typed value (locale-tagged, or a constrained
  rich-text shape) rather than bare `text`; otherwise document the field as
  plain-text-in-the-site-locale so the admin can state that contract to authors.
- **Cross-reference:** the substantive version of this question — whether the
  *content model* can store alt text, table captions and a language marker — is
  filed against the content units, where the field-type system lives.

#### Checked and Not Applicable

- **Colour/contrast (1.4.3, 1.4.11)** — the unit does define a palette
  (`domain/value-objects/workspace-color.ts:9-17`), but only as opaque keys;
  the actual colour values and their contrast live in
  `apps/admin/src/styles.css`. Assessed in `workspaces-admin.md`.
- **3.3.1 / 3.3.3 error identification & suggestion** — the API returns machine
  error shapes (`400`/`403`/`409` with a message); turning them into an
  identified, suggested, announced error is the admin's obligation. Worth
  noting that the messages *are* human-readable and specific
  (`Workspace slug already taken`, `Content type still has entries in this
  workspace`), which is what 3.3.3 needs from the server side. **Supports.**
- **3.3.4 Error prevention (destructive)** — the server does enforce the
  reversal-of-harm half: delete and revoke both refuse with 409 while data would
  be orphaned (`domain/workspace.ts:258-291`). The *confirmation* half is the
  admin's. **Supports** for the server's share.

## 5. E2E Coverage Map

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F1 Create | `apps/server-e2e/src/server/workspaces/create-workspace.spec.ts:72` | 201, creator seeded as sole member | ✅ E2E |
| F2 Duplicate slug | `create-workspace.spec.ts:115` | 409 | ✅ E2E — sequential only, no concurrent case (EC-27) |
| F3 Validation | `create-workspace.spec.ts:145,152,160,168` | missing name, illegal slug chars, unknown extra field, missing content block → 400 | ⚠️ PARTIAL — no length-boundary, unicode, or colour case |
| F1 authz | `create-workspace.spec.ts:123,130,138` | 401 unauth; 403 contributor; 403 viewer | ✅ E2E |
| F36 CSRF | `create-workspace.spec.ts:177,186,195` | bad Origin 403; app Origin OK; no Origin OK | ✅ E2E — only on create, not on the other eight mutating routes |
| F8 List scoping | `workspace-access.spec.ts:101,112,123` | only own workspaces; empty for a non-member; appears after being added | ✅ E2E |
| F8 permission | `workspace-access.spec.ts:141` | requires `workspaces:read` | ✅ E2E |
| F29 Cross-tenant | `workspace-access.spec.ts:171,184,200,220,234` | non-member 403 on entry counts, edit/archive/delete, members, content; state untouched after | ✅ E2E — the strongest suite in the unit |
| F11 Update | `update-workspace.spec.ts:80,116` | full update + `workspace.updated` audit; partial patch leaves other fields | ✅ E2E |
| F12 Empty patch | `update-workspace.spec.ts:132` | no-op, records nothing | ✅ E2E |
| F11 authz | `update-workspace.spec.ts:144,154,165` | contributor 403; unknown id 403 not 404; non-member admin 403 | ✅ E2E |
| F13/F14 Archive | `workspace-lifecycle.spec.ts:81,100,113` | archives + audit; idempotent; unarchive + audit | ✅ E2E |
| F13 authz | `workspace-lifecycle.spec.ts:129,139,148` | contributor 403; unknown 403; non-member admin 403 | ✅ E2E |
| F15 Delete | `workspace-lifecycle.spec.ts:160` | 204 + `workspace.deleted` audit | ✅ E2E — does **not** assert membership/grant rows are gone, nor that other plugins' workspace-scoped rows are cleaned (EC-23) |
| F16 Delete blocked | `workspace-lifecycle.spec.ts:229` | 409 while entries remain | ✅ E2E |
| F28 Entry count | `workspace-lifecycle.spec.ts:217,262` | non-member admin 403; contributor 403 | ⚠️ PARTIAL — no assertion of the **value** for the whole-workspace count, only the per-type one |
| F18 Add member | `workspace-members.spec.ts:102,134,189` | 201 + audit against the added user; idempotent; unknown user 404 | ✅ E2E |
| F18 authz | `workspace-members.spec.ts:158,173,198` | unknown workspace 403; non-member admin cannot self-add; contributor 403 | ✅ E2E |
| F20/F21 Remove member | `workspace-members.spec.ts:218,248,289,308` | removal + audit; creator removable, self-removal ends access; non-member no-op 204; viewer 403 | ⚠️ PARTIAL — **line 253-256 deliberately adds a second member "so the workspace stays observable"**, i.e. the last-member case is knowingly avoided (`🐞 BUG-workspaces-server-01`) |
| F22/F23 Grant | `workspace-content.spec.ts:83,104,123,132` | grant + audit; idempotent; unknown slug 400; viewer 403 | ✅ E2E |
| F24/F25/F26 Revoke | `workspace-content.spec.ts:144,167,199,214` | revoke + audit; 409 with entries; never-granted no-op; viewer 403 | ✅ E2E |
| F27 Per-type count | `workspace-content.spec.ts:229,250` | 0 then live count; viewer 403 | ✅ E2E |
| F10 Catalogue | `apps/server-e2e/src/server/content/content-types.spec.ts:74,79` | 401 unauth; serves the real registry not the mock | ⚠️ PARTIAL — no role case; a viewer's 200 is unasserted |
| F6 Grant expansion | `content-types.spec.ts:97` | `mode:'all'` grants the real registry slugs | ✅ E2E |
| F9 Slug availability | — | — | ❌ NONE |
| F4/F5 Member provisioning | — | — | ❌ NONE |
| F7 `specific` selection | — | — | ❌ NONE |
| F17/F35 Advisory locks | — | only indirectly, via F16's 409 | ⚠️ PARTIAL |
| F31 `@CurrentWorkspace()` misuse | — | — | ❌ NONE |
| F33/F34 Port fallbacks | — | — | ❌ NONE |
| F3 `Slug` VO | `packages/workspaces/server/src/lib/workspace/domain/value-objects/slug.spec.ts:5-22` | accepts valid; rejects empty/upper/space/punct/underscore/>120 | 🧪 UNIT |
| Aggregate invariants | `packages/workspaces/server/src/lib/workspace/domain/workspace.spec.ts` | see the file for the exact set | 🧪 UNIT |

**Coverage tally:** `36 features · 22 ✅ · 5 ⚠️ · 9 ❌`

**Accessibility tally:** `1 ♿ · 0 Supports (as a finding) · 1 Partially Supports · 0 Does Not Support`
(plus 5 provisions assessed **Not Applicable** and 3 **Supports** with no finding — see §4A).
No axe or keyboard suite applies to this unit; there is no rendered surface to scan.

## 6. 🐞 Potential Bugs

### 🐞 BUG-workspaces-server-01 — Removing the last member orphans the workspace permanently · Severity: High

**Location:** `packages/workspaces/server/src/lib/workspace/domain/workspace.ts:223-234`,
`packages/workspaces/server/src/lib/workspace/application/use-cases/remove-member.use-case.ts:37-45`
**Category:** data-loss

**What the code does:**

```ts
removeMember(userId: string): boolean {
    const index = this._members.findIndex(
        (member) => member.userId === userId
    );
    if (index === -1) {
        return false;
    }
    this._members.splice(index, 1);
```

No invariant guards the member count. The use case loads, calls
`removeMember`, saves, and returns 204 regardless of how many members are left.

**Why it is wrong:** every read and write path in this context is
membership-scoped by design — `listForMember` joins `memberships`
(`infrastructure/queries/workspace-view.query.ts:34-43`) and there is
deliberately no `listAll()`; `WorkspaceMemberGuard` 403s every `/:id/…` route
for a non-member (`http/guards/workspace-access.ts:44-48`). A zero-member
workspace is therefore invisible to **everyone**, including a global admin, and
**cannot be deleted** — `DELETE /api/workspaces/:id` is itself behind
`WorkspaceMemberGuard` (`http/controllers/delete-workspace.controller.ts:37`).
Its slug also stays permanently reserved by the unique constraint
(`infrastructure/schema/workspaces.ts:19`), so the name can never be reused.
The e2e suite shows the authors were aware of the boundary: `workspace-members.spec.ts:252-256`
explicitly adds a second member with the comment *"so the workspace stays
observable after the creator drops out (the list is membership-scoped)"* —
i.e. the last-member case was routed around rather than tested. AGENTS.md
(`packages/workspaces/server/AGENTS.md:66-68`) sanctions self-removal but says
nothing about the last member.

**Repro:**
1. As an admin, `POST /api/workspaces` with `members: []` → id `W`, one member (you).
2. `DELETE /api/workspaces/W/members/{yourUserId}` → `204`.
3. `GET /api/workspaces` → `W` is absent.
4. `DELETE /api/workspaces/W` → `403`. Same for every other `/W/…` route, as any user.

→ Observed: `W`, its grants and any content entries it holds are unreachable and
undeletable through the API forever; only direct SQL can recover them.
Expected: either a `409 LastMemberError`, or the delete/reassign path stays open.

**Blast radius:** any workspace whose membership drains to zero — most likely via
an admin "tidying up" members, or by removing a departing employee who was the
sole member. Silent: the API reports success. Recovery needs DBA access.

**Suggested fix:** add a last-member invariant to `Workspace.removeMember`
(throw `LastMemberError` → 409), mirroring the "last admin" pattern the identity
context already uses; or allow a global `workspaces:delete` holder to bypass
`WorkspaceMemberGuard` on the delete route only.

### 🐞 BUG-workspaces-server-04 — Deleting a workspace orphans every workspace-scoped row outside content entries · Severity: High

**Location:** `packages/workspaces/server/src/lib/workspace/application/use-cases/delete-workspace.use-case.ts:41-54`,
`packages/workspaces/server/src/lib/workspace/domain/workspace.ts:283-291`
**Category:** data-loss

**What the code does:**

```ts
const workspace = await this.workspaces.findByIdForContentMutation(id);
if (!workspace) { throw new WorkspaceNotFoundError(workspaceId); }
const entryCount = await this.counter.countWorkspaceEntries(workspaceId);
workspace.assertDeletable(entryCount);
await this.workspaces.delete(workspace);
```

`delete` issues one `DELETE FROM workspaces WHERE id = …`
(`infrastructure/persistence/drizzle-workspace.repository.ts:126-131`). Only
`memberships` and `workspace_content` carry FKs back to it
(`infrastructure/schema/memberships.ts:22`, `workspace-content.ts:32`), so only
those cascade. The **only** other check is the content-entry count, and it comes
from an `@Optional()` port that returns `0` when unbound
(`application/content/content-entry-counter.reader.ts:27-32`).

**Why it is wrong:** the stated invariant is "a delete never orphans records"
(`domain/workspace.ts:277-279`). But every other plugin scopes its rows by a
plain `workspace_id` uuid with no FK — media assets and folders, API-token
workspace-bucket rows, copilot threads/proposals, entry revisions. None is
counted, so all survive the delete as unreachable rows. Two concrete
consequences: (a) an API token whose bucket still names the deleted workspace,
and (b) storage-backed media blobs no UI can ever reach or reclaim.
Separately, when `ContentPlugin` is not registered the reader's documented
fallback ("a missing counter means zero entries",
`application/ports/content-entry-counter.port.ts:13-15`) turns the entry check
itself into a no-op — a single misordered plugin list makes the delete unguarded.

**Repro (orphan):**
1. Create workspace `W`; upload one media asset into it.
2. `GET /api/workspaces/W/entry-count` → `{"count":0}` (media are not entries).
3. `DELETE /api/workspaces/W` → `204`.
4. `select count(*) from media_assets where workspace_id = 'W'` → still ≥ 1.

**Repro (unguarded check):**
1. Remove `ContentPlugin` from `apps/server/src/plugins.ts`, restart against a DB that has content rows.
2. `DELETE /api/workspaces/W` → `204` even though entries exist.

→ Observed: rows survive with a dangling `workspace_id`.
Expected: either they cascade, or the delete is refused, or the count is
authoritative rather than optional.

**Blast radius:** every workspace deletion. Grows unbounded (storage never
reclaimed) and can resurface as cross-tenant confusion if a UUID is ever reused.

**Suggested fix:** make `countWorkspaceEntries` sum contributions from a
`WORKSPACE_PURGE`-style multi-provider port that each workspace-scoped plugin
registers, and fail closed (throw) when the counter port is unbound rather than
returning `0`.

### 🐞 BUG-workspaces-server-08 — Concurrent create with the same slug 500s instead of 409 · Severity: Medium

**Location:** `packages/workspaces/server/src/lib/workspace/domain/slug-uniqueness.service.ts:19-23`,
`packages/workspaces/server/src/lib/workspace/http/controllers/create-workspace.controller.ts:56-68`
**Category:** race

**What the code does:**

```ts
async assertAvailable(slug: Slug): Promise<void> {
    if (await this.workspaces.existsBySlug(slug.value)) {
        throw new SlugTakenError(slug.value);
    }
}
```

A read (`select … where slug = …`, `drizzle-workspace.repository.ts:135-141`)
followed by an insert, with no lock and no `ON CONFLICT`. The controller's catch
translates `SlugTakenError` → 409 but has no branch for a Postgres `23505`.

**Why it is wrong:** this is exactly BUGBOT's *"Count-then-write races — don't
read a count and then mutate on a contended invariant… otherwise two concurrent
requests both pass the check"* (`.cursor/BUGBOT.md:15-18`). The service's own
docstring calls the DB constraint "the race-proof backstop", and it is — but the
resulting `23505` is unmapped, so the loser gets a `500 Internal Server Error`
instead of the `409` the sequential path returns. The same context does this
correctly elsewhere: delete/revoke take an advisory lock before their
count-then-write (`drizzle-workspace.repository.ts:47`).

**Repro:**
1. Fire two simultaneous `POST /api/workspaces` with `slug:"race"` from two sessions.
→ Observed: one `201`; the other `500` (unique-violation escaping as an
unhandled error). Expected: `409 Workspace slug already taken`.

**Blast radius:** low frequency (only genuine simultaneous creates with the same
slug), but a 500 leaks a stack/driver error shape to the client and the admin's
create wizard renders it as a generic failure rather than "slug taken".

**Suggested fix:** catch the Postgres unique-violation in the create use case
and rethrow `SlugTakenError`, or insert with `onConflictDoNothing().returning()`
and treat an empty result as taken.

### 🐞 BUG-workspaces-server-02 — `GET /api/workspaces/slug-available` has no permission guard · Severity: Low · 🔒

**Location:** `packages/workspaces/server/src/lib/workspace/http/controllers/check-slug.controller.ts:9-18`
**Category:** permission-bypass

**What the code does:**

```ts
@Controller('workspaces')
export class CheckSlugController {
    constructor(private readonly slugs: SlugAvailabilityQuery) {}

    @Get('slug-available')
    async check(@Query() query: CheckSlugDto): Promise<{ available: boolean }> {
        return { available: await this.slugs.isAvailable(query.slug) };
    }
}
```

No `@UseGuards(PermissionsGuard)`, no `@RequirePermissions`. Every other
controller in the folder carries both.

**Why it is wrong:** the endpoint exists solely to back the create wizard
(`check-slug.controller.ts:6-7`), which only a `workspaces:create` holder can
reach — yet any authenticated user, including a `viewer` who belongs to no
workspace, can call it. The query is deliberately unscoped
(`infrastructure/queries/slug-availability.query.ts:22`: `where(eq(workspaces.slug, slug))`
with no membership join), so it is a **global** existence oracle: a viewer can
confirm that a workspace with slug `acme-internal` exists in a tenant they have
no relationship with. That contradicts the context's stated rule that "no
endpoint ever returns a workspace you don't belong to"
(`packages/workspaces/server/AGENTS.md:44-51`) and BUGBOT's "Enumeration
signal" pattern (`.cursor/BUGBOT.md:20-22`).

**Repro:**
1. Log in as a `viewer` who is a member of nothing.
2. `GET /api/workspaces/slug-available?slug=acme-internal` → `{"available":false}`.
→ Observed: existence of another tenant's workspace confirmed.
Expected: `403`, or the probe scoped so it cannot report on foreign slugs.

**Blast radius:** any authenticated user; leaks only slug existence (a
low-entropy guess space, so it is a real dictionary-attack surface for tenant
names), not contents.

**Suggested fix:** add `@UseGuards(PermissionsGuard)` +
`@RequirePermissions(PERMISSIONS.WORKSPACES_CREATE)` to match the only caller.

### 🐞 BUG-workspaces-server-03 — `GET /api/content-types` has no permission guard · Severity: Low · 🔒

**Location:** `packages/workspaces/server/src/lib/workspace/http/controllers/list-content-types.controller.ts:13-21`
**Category:** permission-bypass

**What the code does:** the controller carries no `@UseGuards` at all; only the
app-wide `AuthGuard` applies. It returns the whole code-defined catalogue —
every content type's `name`, `kind`, `label`, `description` and page `path`.

**Why it is wrong:** the catalogue is the input to the *grant* decision, so its
natural gate is `workspaces:create`/`workspaces:update` — the same permissions
every other route that consumes it requires
(`add-workspace-content.controller.ts:40`). As written, a `viewer` who is a
member of nothing enumerates the full content model of the installation, whose
slugs and page paths are exactly the parameters of the workspace-scoped content
routes. It is also **not** filtered by the caller's grants, which is defensible
for a create wizard but is a second, quieter reason to gate it. The e2e asserts
only 401-vs-200 (`apps/server-e2e/src/server/content/content-types.spec.ts:74,79`),
never a role.

**Repro:**
1. Log in as a `viewer` in no workspace. 2. `GET /api/content-types` → `200` with the full catalogue.
→ Expected: `403`.

**Blast radius:** all authenticated users; discloses the installation's content
schema names, not data.

**Suggested fix:** gate with `@RequirePermissions(PERMISSIONS.WORKSPACES_CREATE)`,
matching the wizard that is its only consumer.

### 🐞 BUG-workspaces-server-05 — Invited members are accepted without email validation, provisioning users with junk or empty emails · Severity: Medium

**Location:** `packages/workspaces/server/src/lib/workspace/application/dto/create-workspace.dto.ts:39-47`,
`packages/workspaces/server/src/lib/workspace/infrastructure/persistence/drizzle-member-provisioner.ts:46-72`
**Category:** correctness

**What the code does:** the DTO validates the member's `email` with
`@IsString() @IsNotEmpty()` only — **no `@IsEmail()`**. The provisioner then
trims, lowercases and inserts it as a real `users` row:

```ts
const normalized = email.trim().toLowerCase();
…
const [createdUser] = await executor
    .insert(users)
    .values({ email: normalized, status: 'pending', roleId: viewer.id })
    .returning({ id: users.id });
```

`" "` passes `@IsNotEmpty()` and normalises to `''`.

**Why it is wrong:** this endpoint is a *write path into identity's user
directory* — it is the only place outside `users/server` that creates accounts.
Anything the DTO fails to constrain becomes a permanent directory row: an empty
email, `"not an email"`, or a 4 KB string. The identity invite flow validates
addresses properly; this back door does not, so the two disagree on what a user
is. BUGBOT's *"Re-verify the DTO (`class-validator`) still constrains input"*
(`.cursor/BUGBOT.md:22-24`) applies directly. Note the TODO at
`drizzle-member-provisioner.ts:57-58` confirms this path is half-built (no
invite token is issued), which makes the missing validation more likely an
oversight than a decision.

**Repro:**
1. `POST /api/workspaces` with `members:[{"id":"x","name":"x","email":"   ","invited":true}]`.
→ Observed: `201`; `select email from users where status='pending'` contains `''`.
2. Repeat with a second workspace and the same blank email → the *same* user is
matched and silently re-linked, so unrelated workspaces share one ghost account.
Expected: `400` on step 1.

**Blast radius:** any `workspaces:create` holder. Pollutes the shared user
directory with unreachable accounts that appear in the members roster and in
`GET /api/users`, and the empty-email collision cross-links workspaces.

**Suggested fix:** add `@IsEmail()` to `CreateWorkspaceMemberDto.email`, and
have the provisioner reject rather than normalise an address that fails it.

### 🐞 BUG-workspaces-server-06 — Member provisioning is a sequential N+1 inside the create transaction · Severity: Low

**Location:** `packages/workspaces/server/src/lib/workspace/infrastructure/persistence/drizzle-member-provisioner.ts:22-43`
**Category:** perf

**What the code does:**

```ts
for (const member of members) {
    memberIds.push(
        member.invited
            ? await this.findOrCreateInvited(member.email)
            : member.id
    );
}
```

`findOrCreateInvited` runs up to three statements per invited member (lookup,
role lookup, insert), all awaited serially, all inside the create use case's
single `uow.run` transaction (`create-workspace.use-case.ts:50-65`).

**Why it is wrong:** the `members` array has no `@ArrayMaxSize` in the DTO
(`create-workspace.dto.ts:193-196`), so its length is caller-controlled. A
create with a large `members` array holds a write transaction open for
`O(3n)` sequential round-trips while also holding it across the slug check and
the workspace insert. The `roles` lookup for `'viewer'` is re-issued for every
invited member even though it is constant.

**Repro:** `POST /api/workspaces` with 2 000 `invited:true` members → the request
holds one transaction for thousands of serial round-trips; connection-pool
pressure and lock retention scale linearly with a value the client picks.

**Blast radius:** self-inflicted DoS by any `workspaces:create` holder; no data
corruption.

**Suggested fix:** cap the array with `@ArrayMaxSize`, hoist the `viewer` role
lookup out of the loop, and batch the email lookups into one `inArray` query
plus one multi-row insert.

### 🐞 BUG-workspaces-server-07 — `WorkspaceViewQuery.byId` is unscoped and one guard away from a tenant leak · Severity: Low · 🔒

**Location:** `packages/workspaces/server/src/lib/workspace/infrastructure/queries/workspace-view.query.ts:50-63`
**Category:** tenant-leak (latent)

**What the code does:**

```ts
async byId(workspaceId: string): Promise<WorkspaceView | null> {
    const rows = await this.db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId));
```

No membership join. Its own comment says so: *"Unscoped by itself — every caller
sits behind `WorkspaceMemberGuard`"*.

**Why it is wrong:** it is not a live defect — all five callers
(`create`/`update`/`set-status`/`add-member`/`add-content`/`remove-content`
controllers) are guarded, and I verified each `@UseGuards` line. But the
sibling read on the same class deliberately bakes the scope **into the query**
(`listForMember`, line 34-43) precisely so it cannot be forgotten, and the
package's own AGENTS.md frames that as the design rule
(`packages/workspaces/server/AGENTS.md:45-51`). `byId` returns the full member
roster (ids, names, emails) and every content grant, so a single future
controller that calls it without the guard is a complete cross-tenant
disclosure with no other line of defence.

**Repro:** none today — this is a latent hazard, reported per the spec's
"report it, say what you could not confirm" rule. The concrete check performed:
`grep -n 'views.byId' packages/workspaces/server/src` returns six call sites,
all in controllers whose class carries `WorkspaceMemberGuard`.

**Blast radius:** zero today; a full member-roster leak on any future
unguarded caller.

**Suggested fix:** give `byId` a required `actorUserId` parameter and join
`memberships`, matching `listForMember`, so the scope is structural.

### Checked and cleared

- **`GET /api/workspaces` unscoped path** — there is genuinely no `listAll()`;
  `WorkspaceViewQuery` exposes exactly `listForMember` and `byId`
  (`workspace-view.query.ts:34,55`). The list, the sidebar, the switcher and the
  command palette all consume the one scoped response.
- **Permission-by-constant** — every `@RequirePermissions` in the unit uses
  `PERMISSIONS.*` from identity; no inline `'workspaces:update'` literal exists
  (`grep -rn "RequirePermissions('" packages/workspaces/server/src` → no hits).
- **SQL injection** — every user value reaches Drizzle as a bound parameter. The
  only raw `sql` templates are the two advisory-lock calls
  (`infrastructure/persistence/workspace-lock.ts:34,44`) and the case-insensitive
  email lookup (`drizzle-member-provisioner.ts:52`); all three interpolate
  through Drizzle's parameter binding, not string concatenation.
- **Audit-in-transaction** — audit is no longer written in-band; the use cases
  append to the transactional outbox inside `uow.run` and
  `packages/activity/server/.../audit-event.subscriber.ts:13` is the single
  consumer, so the BUGBOT "audit outside the transaction" pattern cannot occur.
  (Note: `packages/workspaces/server/AGENTS.md:121-130` still describes the
  pre-Wave-3 in-band `ACTIVITY_RECORDER` calls that no longer exist in the
  source — stale prose, not a code defect. `ARCHITECTURE.md:141-147` is stale in
  the same way, claiming "there is no content model".)
- **`domain/` purity** — verified file by file; see EC-46.
- **`@CurrentWorkspace()` fail-closed** — throws rather than returning
  `undefined` (`current-workspace.decorator.ts:20-24`), so it cannot silently
  unscope a query.
- **Guard drift** — both guards funnel into one `authorizeWorkspaceAccess`
  (`http/guards/workspace-access.ts:27`), so header- and path-scoped routes
  cannot diverge on what access means.

## 7. Recommended E2E Tests

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | `apps/server-e2e` | `workspaces/workspace-members.spec.ts` (new case) | Removing the sole member either 409s or leaves the workspace reachable; today it 204s and the workspace vanishes from every list and 403s on every route | 🐞 BUG-workspaces-server-01 |
| 2 | `apps/server-e2e` | `workspaces/workspace-lifecycle.spec.ts` (new case) | After `DELETE /api/workspaces/:id`, no rows remain in `memberships`, `workspace_content`, **and** the media/API-token/copilot tables scoped to that id | 🐞 BUG-workspaces-server-04, F15 gap |
| 3 | `apps/server-e2e` | `workspaces/create-workspace.spec.ts` (new case) | Two concurrent `POST`s with the same slug yield exactly one 201 and one **409** (not 500) | 🐞 BUG-workspaces-server-08, EC-27 |
| 4 | `apps/server-e2e` | `workspaces/workspace-authz.spec.ts` (new file) | `GET /api/workspaces/slug-available` and `GET /api/content-types` 403 for a viewer holding no `workspaces:*` permission | 🐞 BUG-workspaces-server-02, -03, F9/F10 rows |
| 5 | `apps/server-e2e` | `workspaces/create-workspace.spec.ts` (new case) | `members:[{email:'   ',invited:true}]` → 400; no `users` row with an empty email is created | 🐞 BUG-workspaces-server-05, F4 row |
| 6 | `apps/server-e2e` | `workspaces/create-workspace.spec.ts` (new case) | Invited email is matched case-insensitively (`Grace@` reuses `grace@`); an unresolvable member uuid is dropped, not a 500 | F4, F5 rows |
| 7 | `apps/server-e2e` | `workspaces/workspace-content.spec.ts` (new case) | `content:{mode:'specific'}` with `ids` and with `excludedIds` produces exactly the expected grant set; unknown ids are intersected away | F7 row, EC-03 |
| 8 | `apps/server-e2e` | `workspaces/workspace-lifecycle.spec.ts` (new case) | `GET /api/workspaces/:id/entry-count` returns the **summed** count across two content types, not just a permission check | F28 ⚠️ |
| 9 | `apps/server-e2e` | `workspaces/workspace-concurrency.spec.ts` (new file) | A delete blocks while a concurrent entry create holds the shared advisory lock, and no entry is orphaned either way | F17, F35, EC-28 |
| 10 | Unit (`packages/workspaces/server`) | `domain/value-objects/workspace-color.spec.ts`, `workspace-status.spec.ts`, `workspace-id.spec.ts` (new) | Each VO rejects out-of-palette / unknown / non-UUID input and compares by value | EC-44, EC-45 |
| 11 | `apps/server-e2e` | `workspaces/create-workspace.spec.ts` (new cases) | Length boundaries: `name` 120/121, `description` 2000/2001, `slug` 120/121; unicode slug → 400 | EC-06, EC-07, EC-08, EC-12 |
| 12 | `apps/server-e2e` | `workspaces/workspace-lifecycle.spec.ts` (new case) | Every mutating route (not just create) 403s a hostile `Origin` | F36 gap |
