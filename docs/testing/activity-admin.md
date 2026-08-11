# @ortha-cms/activity-admin — Test Artifact

> **Unit:** `packages/activity/admin` · **Package:** `@ortha-cms/activity-admin` · **Kind:** admin plugin
> **Source of truth:** `packages/activity/admin/AGENTS.md`
> **Findings verified:** 2026-08-11 — 15 confirmed · 0 deleted · 1 corrected · 1 unverified
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns:** the global **Activity Log** page at `/activity` (toolbar, actor-email
search, the inline query-builder filter panel, the **When · Actor · Action ·
Subject** table with expandable detail rows, pagination, and the
skeleton/error/empty/no-access states), the shell sidebar's **Activity** nav
entry, the home dashboard's **Recent activity** panel, and the exported
`useActivityLog` hook + `activityKeys` factory that `users-admin`'s per-user
Activity tab consumes.

**Does NOT own:** the API or the audit **write** path — `@ortha-cms/activity-server`
owns `GET /api/activity`, the `AuditEventSubscriber`, and the kind→row mapping
(`docs/testing/activity-server.md`). It owns **no mutations at all**: the log is
an append-only read-side projection, which is why (per
[ADR-0003](../adr/0003-tactical-ddd-inside-plugins.md)) it has no `domain/`
layer. It does not own the per-user Activity **tab** — that page lives in
`packages/users/admin/src/lib/presentation/pages/UserActivityPage/` and is covered by
`docs/testing/users-admin.md`; only the hook it calls is this unit's. And it
performs no authorization: `useHasPermission` hides affordances, the server's
`@RequirePermissions(PERMISSIONS.ACTIVITY_READ)` is the boundary
(`.cursor/BUGBOT.md`).

- **Entry points**
  - Route: `/activity` → `ActivityLogPage`, `lazy()` + `<Suspense>` with a
    full-page skeleton (`presentation/activityPlugin/index.tsx:46-55`,
    page at `presentation/pages/ActivityLogPage/index.tsx:81`).
  - Slots **filled**:
    | Slot (owner) | Item | Detail |
    | --- | --- | --- |
    | `SIDEBAR_NAV_SLOT` (shell) | Activity | `group: 'overview'`, `order: 20`, `permission: 'activity:read'` (`activityPlugin:56-71`) |
    | `HOME_SECTION_SLOT` (shell) | `activity.home.recent` | `region: 'panel'`, `order: 20`, `RecentActivityPanel` (`activityPlugin:72-83`) |
  - Public API (`src/index.ts:1-10`): `ActivityPlugin`, `useActivityLog`,
    `activityKeys`, and the `ActivityEvent` / `ActivityActor` / `ActivityList` /
    `ActivityListParams` types.
  - Data seam: `ActivityGateway` port (`infrastructure/activityGateway/index.ts:13`)
    → `httpActivityGateway.list` (`infrastructure/httpActivityGateway/index.ts:26`,
    the **only** `apiClient` call site in the plugin) → `toActivityEvent`
    anti-corruption mapper (`infrastructure/activityMapper/index.ts:28`) →
    `useActivityLog` (`application/useActivityLog/index.ts:20`, `keepPreviousData`).
  - URL contract: `?actorEmail=`, `?filter=` (query-builder JSON), `?page=`,
    `?pageSize=` — all owned by `useTableUrlState`
    (`packages/utils/admin/src/lib/useTableUrlState/index.ts:65`), which writes
    with `{ replace: true }`.

- **Runtime prerequisites**
  - A running API with migrations applied (activity ships its own
    `migrations/0000_init.sql`), or the admin-e2e mock
    (`apps/admin-e2e/src/support/api/activity.ts:165`).
  - **A signed-in `admin`.** `activity:read` is admin-only in the v1 role matrix
    — it appears in neither `contributor` nor `viewer`
    (`docs/testing/activity-server.md`, Permission matrix). A `contributor` or
    `viewer` gets the no-access state and **zero requests**.
  - Data in the log: the **outbox dispatcher must be running** and the emitting
    plugins (`UsersPlugin`, `WorkspacesPlugin`, `ContentPlugin`) registered —
    otherwise the log is legitimately empty, not broken.
  - The plugin is registered at `apps/admin/src/main.tsx:43`, after
    `ShellPlugin()` (whose slots it fills).

- **How to exercise it manually**
  ```bash
  docker compose up -d && npx nx run server:db:migrate && npm run dev
  ```
  - Sign in as an admin, then produce events: sign out and back in
    (`user.signed_in`/`user.signed_out`), invite a member (`user.invited`),
    change a role (`user.role_changed`), create a workspace
    (`workspace.created`), publish an entry (`entry.published`).
  - Global log: `http://localhost:4200/activity`
  - Home panel: `http://localhost:4200/`
  - Per-user log: `http://localhost:4200/users/<id>/activity`
  - Raw API for comparison:
    `curl -b cookies.txt 'http://localhost:3000/api/activity?pageSize=5'`
  - Mocked, no backend:
    `npx nx e2e admin-e2e -- --project=chromium src/activity`

- **Dependencies that must be healthy:** `@ortha-cms/utils-admin` (`apiClient`,
  `toApiError`, `useTableUrlState`, `avatarColorForId`, `initialsFromEmail`),
  `@ortha-cms/identity-admin` (`useHasPermission`), `@ortha-cms/shell-admin`
  (`PageTopBar`, `SIDEBAR_NAV_SLOT`, `HOME_SECTION_SLOT`),
  `@ortha-cms/query-builder-admin` (`QueryBuilderPanel`, `QueryBuilderSummary`,
  `jsonFilterToTree`, `treeToJsonFilter`, `countRules`),
  `@ortha-cms/design-system` (`Table*`, `Alert`, `Empty*`, `Pagination`,
  `Select`, `SearchToolbar`, `Skeleton`, `Avatar`, `Badge`, `Card`).
  **Not** workspace-scoped: the audit table has no `workspace_id`
  (`docs/testing/activity-server.md`, EC-26), so no `useCurrentWorkspace`
  dependency and no workspace in the query key.

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | `/activity` route, code-split behind `<Suspense>` + page skeleton | `packages/activity/admin/src/lib/presentation/activityPlugin/index.tsx:46-55` | ✅ E2E |
| F2 | Sidebar **Activity** nav entry, hidden without `activity:read` | `.../presentation/activityPlugin/index.tsx:56-71` | ✅ E2E |
| F3 | Home dashboard **Recent activity** panel (6 latest events) | `.../presentation/components/RecentActivityPanel/index.tsx:50` | ⚠️ PARTIAL |
| F4 | Page header + "{n} events across the workspace." subtitle | `.../presentation/pages/ActivityLogPage/index.tsx:202-207` | ⚠️ PARTIAL |
| F5 | Actor-email search, debounced into `?actorEmail=` | `.../components/ActivityToolbar/index.tsx:32`, `useTableUrlState:99-103` | ✅ E2E |
| F6 | Inline query-builder filter panel over 6 whitelisted fields | `.../pages/ActivityLogPage/index.tsx:243-251`, `.../activityFilterFields/index.ts:31-42` | ✅ E2E |
| F7 | Applied-filter chips when the panel is collapsed (`QueryBuilderSummary`) | `.../pages/ActivityLogPage/index.tsx:252-259` | ❌ NONE |
| F8 | Rule count on the Filters toggle (`Filters (2)`) + `aria-expanded`/`aria-controls` | `.../pages/ActivityLogPage/index.tsx:214-235` | ✅ E2E |
| F9 | Deep-linkable URL state (`actorEmail` / `filter` / `page` / `pageSize`) | `useTableUrlState:65-114`, page at `:85-112` | ⚠️ PARTIAL |
| F10 | Table: expand column + **When · Actor · Action · Subject**, named "Activity log" | `.../components/ActivityTable/index.tsx:45-81` | ⚠️ PARTIAL |
| F11 | Expandable detail row (Details, Subject, Actor, Time, Metadata), `inert` when collapsed | `.../components/ActivityTable/ActivityRow/index.tsx:111-172` | ✅ E2E |
| F12 | The whole row toggles on click (the toggle stops the bubble) | `.../ActivityRow/index.tsx:66-79` | ✅ E2E |
| F13 | Localized **Action** label per kind, raw kind as fallback | `.../activityMessages/index.ts:74-113`, `.../ActivityActionCell/index.tsx:11` | ⚠️ PARTIAL |
| F14 | Per-kind **Details** summary derived from `meta` | `.../activityMessages/index.ts:120-152` | ⚠️ PARTIAL |
| F15 | **Actor** cell — avatar + email, `System` for a null actor, `Unknown` for a null email | `.../ActivityActorCell/index.tsx:29-57` | ⚠️ PARTIAL |
| F16 | **Subject** cell — capitalized type over a truncated mono id with a native `title` | `.../ActivitySubjectCell/index.tsx:8-19` | ❌ NONE |
| F17 | Pagination — prev/next, "Page N of M", "{from}–{to} of {total}", rows-per-page | `.../components/ActivityPagination/index.tsx:49` | ❌ NONE |
| F18 | Page clamped to `pageCount` after a narrowing change | `.../pages/ActivityLogPage/index.tsx:147-154` | ❌ NONE |
| F19 | Table skeleton (also the lazy-route fallback), single `role="status"` | `.../components/ActivityLogSkeleton/index.tsx:29,95` | ✅ E2E |
| F20 | Error state — `role="alert"` Alert with a **Retry** | `.../pages/ActivityLogPage/index.tsx:271-284` | ❌ NONE |
| F21 | Empty state — filtered ("No activity matches" + Clear) vs genuinely empty | `.../components/ActivityEmpty/index.tsx:42` | ⚠️ PARTIAL |
| F22 | No-access state; the query never fires without `activity:read` | `.../components/ActivityNoAccess/index.tsx:29`, page `:83,136,156` | ✅ E2E |
| F23 | `useActivityLog` exported and reused by `users-admin`'s per-user Activity tab | `src/index.ts:3`; consumer at `packages/users/admin/src/lib/presentation/pages/UserActivityPage/index.tsx:247` | ✅ E2E |
| F24 | Gateway/mapper seam: one `apiClient` call site, `ApiError` normalisation, wire→view mapping | `.../httpActivityGateway/index.ts:26-43`, `.../activityMapper/index.ts:28-40` | ⚠️ PARTIAL |
| F25 | `activityKeys` query-key factory (`all` + `list(params)`) | `.../infrastructure/activityKeys/index.ts:23-28` | ❌ NONE |
| F26 | Result count announced to AT after a filter change (`role="status"` sr-only) | `.../pages/ActivityLogPage/index.tsx:263-267` | ❌ NONE |

## 3. Manual Test Plan

All blocks: signed in as an **`admin`** (holding `activity:read`) unless the
block says otherwise, with at least ~60 audit events across several kinds and
actors so paging is exercisable. Quoted strings are the real `defineMessages`
defaults; locators in parentheses are the accessible names the e2e POM uses
(`apps/admin-e2e/src/support/pages/ActivityLogPage.ts:23-92`).

### F1–F2 — Route and nav entry

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | From the home page, open the sidebar | an **Activity** entry in the _overview_ group, second (order 20) |
| 2 | Click it | the URL becomes `/activity`; a full-page skeleton flashes while the chunk loads, then the page renders with an `<h1>` "Activity" |
| 3 | Confirm the code split | in DevTools ▸ Network, a separate JS chunk is fetched the **first** time only (`lazy()`, `activityPlugin:10-14`) |
| 4 | Confirm the shell wrapped it | the primary nav (`role="navigation"`, name "Primary") and the `PageTopBar` breadcrumb "Activity" are present |
| 5 | Sign in as a `viewer` and look at the sidebar | **no** Activity entry — the slot item carries `permission: 'activity:read'` |
| 6 | As that `viewer`, navigate to `/activity` directly | the route still resolves and shows "You don't have access to the activity log"; **no `GET /api/activity` is issued** (`useActivityLog(params, canRead)`) |

**Keyboard-only path:** Tab reaches the sidebar's Activity button; Enter
navigates; focus then follows the router's default (see EC-27).
**Screen-reader expectation:** one `<h1>` "Activity"; the nav button is named
"Activity".

### F3 — Home Recent activity panel

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open `/` | a card headed **Recent activity** (`<h2>`) with a **View all** link to `/activity` |
| 2 | Count the rows | at most **6** (`PREVIEW_SIZE`, `RecentActivityPanel:42`); one request `GET /api/activity?page=1&pageSize=6` |
| 3 | Read a row | the actor's email (or "System") and, beside it, a **mono badge showing the raw kind** — e.g. `user.role_changed`, not "Changed role" (see `🐞 BUG-activity-admin-02`) |
| 4 | Inspect the timestamp | a `<time datetime="2026-06-11T12:00:00.000Z">` with a short "Jun 11, 12:00" rendering |
| 5 | Empty log | "No activity yet." |
| 6 | Stop the API and reload | a `role="alert"` "Couldn't load activity." — distinct from the empty state |
| 7 | As a `viewer` | the panel **renders nothing at all** (`return null`, `:58-60`), so the dashboard grid has one panel, not an empty second one |

### F4–F5 — Header and the actor-email search

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open `/activity` | the subtitle reads "{n} events across the workspace." with the server's `total` — note the copy says "workspace" for a log that is **deployment-wide** (see EC-24) |
| 2 | Type `ada` in **Search by actor email** (a `role="searchbox"`) | after ~300 ms the URL gains `?actorEmail=ada`, the magnifier swaps to a spinner while in flight, and the table narrows |
| 3 | Read the subtitle again | it now reflects the **filtered** total |
| 4 | Type `ADA` | same results — the server matches case-insensitively |
| 5 | Type `%` | matches a literal `%` only; the server escapes LIKE metacharacters |
| 6 | Type three spaces | trimmed server-side to no filter |
| 7 | Clear the box | `?actorEmail=` is removed from the URL entirely |
| 8 | Search for a system event's actor | no match — a `null` actor has no email to search |

### F6–F8 — The query-builder filter

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Press **Filters** | the button's `aria-expanded` flips to `true`; an inline `region` named "Filters" expands **in place**, pushing the table down (no overlay) |
| 2 | Open the field picker | exactly six fields: **Kind**, **Actor email**, **Actor ID**, **Subject type**, **Subject ID**, **Time** (`ACTIVITY_FILTER_FIELDS:31-42`) |
| 3 | Note the Kind editor | a **free-text box**, not a picker of the known kinds — you must type `user.suspended` exactly (see `🐞 BUG-activity-admin-04`) |
| 4 | Build `Kind equals user.suspended` and press Apply | the panel collapses, focus returns to the **Filters** toggle, the URL gains `?filter={"field":"kind",...}`, and the table narrows |
| 5 | Read the toggle | it reads "Filters (1)" |
| 6 | Look below the toolbar | the applied condition renders as a removable chip (`QueryBuilderSummary`, `ActivityLogPage:252-259`) |
| 7 | Remove the chip | the rule is dropped from the URL and the table widens |
| 8 | Build `Actor ID is one of not-a-uuid` and Apply | the panel **stays open**, the rule shows "Must be a valid UUID", and nothing reaches the URL — caught client-side, never round-tripped to a 400 |
| 9 | Reload with `?filter=` in the URL | the panel rehydrates the tree and the count badge (`jsonFilterToTree`, `:101-105`) |
| 10 | Press Escape inside the open panel | it collapses and focus returns to the toggle (`setFiltersPanelOpen`, `:123-126`) |
| 11 | Combine the search box **and** a filter rule | both are sent; the server AND-composes them |

### F9 — URL as the source of truth

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Apply a search + a filter, then copy the URL into a new tab | the same filtered view loads |
| 2 | Go to page 3 and copy the URL | `?page=3`; the new tab lands on page 3 |
| 3 | Press browser **Back** after paging | you leave `/activity` — every write uses `{ replace: true }` (`useTableUrlState:91`), so paging and filtering leave **no history entries** |
| 4 | Hand-edit `?page=abc` | treated as page 1 (`readInt`, `:9-12`) |
| 5 | Hand-edit `?page=0` or `?page=-4` | page 1 |
| 6 | Hand-edit `?pageSize=1000` | the server rejects it with **400** and the page shows the error state permanently — see `🐞 BUG-activity-admin-03` |

### F10–F12 — The table and its rows

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Inspect the table | a real `<table>` with `aria-label="Activity log"`, five `<th>`: an **empty** one for the toggle then When, Actor, Action, Subject (each `scope="col"`) |
| 2 | Try to sort by clicking **When** | nothing happens — **there is no sortable column anywhere in this UI** (see `🐞 BUG-activity-admin-05`) |
| 3 | Read a **When** cell | an absolute local date-time, e.g. "Jun 11, 2026, 12:00" (`dateStyle: 'medium'`, `timeStyle: 'short'`) — never a relative "2h ago" |
| 4 | Press a row's chevron | it rotates 90°, `aria-expanded` becomes `true`, and the details panel grows open |
| 5 | Read the panel | **Details** (when the kind has one), **Subject** (`user · u_grace`, mono), **Actor** (email, or "System"), **Time** (long form, seconds included), **Metadata** (`from: viewer  ·  to: contributor`) |
| 6 | Collapse it | `aria-expanded` returns to `false` and the `<dl>` becomes `inert` (`ActivityRow:120`) |
| 7 | Click anywhere on the row body | it toggles too (`TableRow onClick`, `:67`) |
| 8 | Click the chevron specifically | it toggles **once**, not twice — the button stops propagation (`:76-79`) |
| 9 | Expand two rows, then page forward and back | both collapse — `expanded` is component state keyed by event id, and the table remounts |
| 10 | Try to select text inside a row | the selection gesture also toggles the row (`onClick` fires on mouseup) |

**Keyboard-only path:** Tab reaches the search box → Filters → each row's
disclosure button in order → the pagination controls. Enter/Space on the
disclosure toggles it. There is no way to reach the row itself — the disclosure
is the only control.
**Screen-reader expectation:** "Show details, button, collapsed"; on expand, the
panel becomes reachable; but note EC-31 and `♿ A11Y-activity-admin-04` — the
table reports **two** rows per event.

### F13–F14 — Action labels and details

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Find a `user.role_changed` row | the Action badge reads "Changed role"; the Details line reads "viewer → contributor" |
| 2 | Find a `user.invited` row | "Invited member" / the invitee's email |
| 3 | Find a `user.profile_updated` row | "Updated profile" / **always** the constant "Name changed" — the `meta` is not read (see EC-19) |
| 4 | Find a `user.suspended` / `user.signed_in` row | a label, and **no** Details line (the kind carries no meta) |
| 5 | Find an `entry.published` row | "Published content" / the content-type name from `meta.contentType` |
| 6 | Find a `workspace.created` row | "Created workspace" / the workspace name |
| 7 | **Archive, rename, or delete a workspace, or grant/revoke a content type, then reload** | the Action column shows the **raw** string `workspace.archived` / `workspace.updated` / `workspace.deleted` / `workspace.content_granted` / `workspace.content_revoked`, and the Details line is empty → `🐞 BUG-activity-admin-01` |
| 8 | Remove an **active** member | the row reads "Revoked invite", because the server maps `member.removed` → the `user.invite_revoked` kind (see EC-20) |

### F15–F16 — Actor and Subject cells

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | A normal event | a coloured initials avatar (`aria-hidden`) plus the actor's email |
| 2 | A system event (`actorId: null`) | the muted word "System", no avatar |
| 3 | An event whose actor has an id but no captured email | "Unknown" with a `?` avatar (`ActivityActorCell:40,52`) |
| 4 | A very long email | truncated with ellipsis; the full value is **not** available anywhere |
| 5 | The Subject cell | the capitalized `subjectType` over the mono `subjectId` |
| 6 | Hover a truncated subject id | a native browser tooltip with the full value (`title`, `ActivitySubjectCell:14`) |
| 7 | Tab to the subject id | **you cannot** — it is a `<p>`, so the full id is mouse-only (see `♿ A11Y-activity-admin-06`) |
| 8 | A `workspace.member_*` event | the subject is the **user**, not the workspace — the workspace id lives in `meta` |

### F17–F18 — Pagination and the page clamp

**Preconditions:** ≥60 events so there are 3 pages at the default size of 25.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Scroll below the table | "Rows per page" + a Select, "1–25 of 60", and "Page 1 of 3" between named prev/next buttons |
| 2 | Press **Next page** | page 2 renders; the URL gains `?page=2`; the previous rows stay on screen until the new page lands (`keepPreviousData`) and the container is `aria-busy` meanwhile |
| 3 | On page 1, look at **Previous page** | disabled |
| 4 | On the last page, look at **Next page** | disabled |
| 5 | Change **Rows per page** to 100 | `?pageSize=100`, and `?page=` is dropped — a size change resets to page 1 (`updateParams` default `resetPage`) |
| 6 | With one page of results | the prev/next cluster is **absent** entirely; the "1–4 of 4" readout remains |
| 7 | Empty result | the pagination bar is not rendered at all (it lives inside the data branch) |
| 8 | Deep-link `?page=99` | the first response lands, then the effect clamps to the real last page (`ActivityLogPage:147-154`) and refetches |
| 9 | On page 3, type in the search box | the page resets to 1 (the reducer's default), so the classic "stranded past the end" case never arises here |

### F19–F21 — Loading, error and empty

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Throttle the API to 5 s and reload | a table-shaped skeleton with the **same five columns**, so nothing reflows on swap; one `role="status"` with an sr-only "Loading activity…", and the decorative table `aria-hidden` |
| 2 | Reload with a cold JS cache | the **full-page** skeleton (header + toolbar + table) from the `Suspense` fallback |
| 3 | Stop the API and reload | a destructive `Alert` (`role="alert"`) reading "Couldn't load activity. Please try again." with a **Retry** button — *not* the empty state |
| 4 | Press **Retry** | the query refetches |
| 5 | Search for a term matching nothing | "No activity matches" / "Try a different action, actor, or date range." with a **Clear filters** button |
| 6 | Press **Clear filters** | the search box empties, `?actorEmail=`/`?filter=` are removed, and the full log returns |
| 7 | Point at a deployment with an empty log and no filters | "No activity yet" / "Actions across the workspace will appear here." and **no** Clear button |

### F22 — Permissions

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Sign in as `contributor`, open `/activity` | the no-access `Empty` with a lock: "You don't have access to the activity log" + the `activity:read` explanation |
| 2 | Watch the network | **no request at all** — `enabled` is false |
| 3 | Same as `viewer` | identical |
| 4 | Open a member's detail page as a `contributor` | there is **no Activity tab** (`UserDetailTabs:113-119`) |
| 5 | Force the URL `/users/<id>/activity` as a `contributor` | `UserActivityPage` renders but its query is disabled (`useActivityLog(…, canRead)`); the server would answer **403** anyway |
| 6 | Call `GET /api/activity` directly as a `contributor` | **403** (`docs/testing/activity-server.md`, pinned at `apps/server-e2e/src/server/activity/activity.spec.ts:262,272`) |

### F23 — The per-user Activity tab (consumer)

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open `/users/<id>` → **Activity** | a timeline card of events about **or** by that member |
| 2 | Inspect the request | one `GET /api/activity` whose `filter` is `{"or":[{"and":[{subjectType eq user},{subjectId eq <id>}]},{actorId eq <id>}]}` (`UserActivityPage:210-244`) |
| 3 | Note the URL | the tab's page/pageSize are **component state**, not URL params — unlike the global page, this view is not deep-linkable |
| 4 | A member with no history | "No activity yet" |
| 5 | Stop the API | a `role="alert"` with Retry, distinct from the empty state |

### F24–F26 — Seam, keys and the live region

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `grep -rn "apiClient" packages/activity/admin/src` | exactly one hit — `infrastructure/httpActivityGateway/index.ts:1` (the ADR-0003 seam holds) |
| 2 | Return a 500 | the thrown value is an `ApiError` carrying `status: 500`, never an axios error |
| 3 | Return `actorId: null, actorEmail: "x@y.z"` | the mapper collapses the actor to `null` outright — the orphan email is discarded (`activityMapper:34-36`) |
| 4 | Watch the query keys in the React Query devtools | `['activity','list',{actorEmail,filter,page,pageSize}]`; a repeat of the same params is a cache hit |
| 5 | With a screen reader running, apply a filter | "12 events found." is announced politely without focus moving (`ActivityLogPage:263-267`) |
| 6 | Press **Next page** with the same screen reader | **nothing is announced** — the total is unchanged and "Page 2 of 3" is outside any live region → `♿ A11Y-activity-admin-01` |

## 4. Edge Cases & Negative Paths

### Empty / zero

- **EC-01 — Empty log, no filters.** `⚠️ PARTIAL` `ActivityEmpty(filtered=false)` —
  distinct copy, no Clear button. Pinned for the **user tab**
  (`mockEmptyActivity`, `apps/admin-e2e/src/support/api/userDetail.ts:106`) but
  not for the global page.
- **EC-02 — Filtered to nothing.** `✅ E2E` "No activity matches" + Clear
  (`audit-log.spec.ts:106`).
- **EC-03 — `total: 0` and the header.** `❌ NONE` The subtitle reads "0 events
  across the workspace." — correct plural handling (`{count, plural, one … other …}`).
- **EC-04 — `meta: null`.** `❌ NONE` `dto.meta ?? null` (`activityMapper:37`), and
  the detail panel omits the Metadata row entirely
  (`ActivityRow:158-159` requires `Object.keys(meta).length > 0`). Correct.
- **EC-05 — `meta: {}`.** `❌ NONE` Same guard — no Metadata row. Correct.
- **EC-06 — `actorEmail: null` with a non-null `actorId`.** `❌ NONE` "Unknown" +
  `?` initials. Handled; untested.
- **EC-07 — A kind with no Details mapping.** `❌ NONE`
  `formatActivityDetails` returns `''` and the row omits the Details row
  (`ActivityRow:123`). The JSDoc claims the row "renders as a muted dash"
  (`activityMessages:118`) — it does not; it renders nothing. Doc drift only.

### Boundary

- **EC-08 — `?page=0` / `-1` / `abc` / `1.5`.** `❌ NONE` All collapse to 1
  (`readInt` requires `Number.isInteger(n) && n >= 1`).
- **EC-09 — `?page=99` on a 3-page log.** `❌ NONE` The clamp effect pulls back to
  page 3 after the first response (`ActivityLogPage:147-154`). Guarded on `data`
  so a deep link survives the pending state — correct.
- **EC-10 — The clamp reads placeholder data.** `❌ NONE`
  `useActivityLog` sets `placeholderData: keepPreviousData`, and this page's clamp
  — unlike the reference implementation it was copied from
  (`content/admin/.../LoadedRecordsView/index.tsx:329-340`, which guards on
  `!isPlaceholderData` with a comment explaining exactly this) — does **not**.
  **I could not construct a failing repro**: every narrowing control here
  (`applyFilter`, the debounced search, the page-size Select) goes through
  `updateParams` with the default `resetPage: true`, which deletes `page`, so the
  page is 1 before any stale `pageCount` can be read. Recorded as a divergence
  from the sibling rather than filed, because the sibling's guard is load-bearing
  there (its sort control uses `resetPage: false`) and this page has no equivalent.
- **EC-11 — `?pageSize=1000`.** `❌ NONE` `readInt` accepts it and forwards it; the
  server's `@Max(MAX_PAGE_SIZE = 100)` rejects with **400**
  (`packages/activity/server/src/lib/activity/dto/list-activity-query.dto.ts:172`).
  → `🐞 BUG-activity-admin-03`.
- **EC-12 — `?pageSize=0` / `-5`.** `❌ NONE` `readInt` clamps to the default 25.
  Correct.
- **EC-13 — `?pageSize=50` (valid, not in `PAGE_SIZE_OPTIONS`… it is).** `❌ NONE`
  The three options are 25/50/100 and the server caps at 100, so the Select can
  always represent a legal value. Cleared.
- **EC-14 — Last page holds exactly one row.** `❌ NONE` `to = min(page*pageSize,
  total)` (`ActivityPagination:67`), so the readout is "51–51 of 51". Correct.
- **EC-15 — `total` exactly divisible by `pageSize`.** `❌ NONE`
  `Math.ceil(50/25) = 2`; no phantom empty third page. Correct.
- **EC-16 — Deep link `?page=5&actorEmail=zzz` (0 matches).** `❌ NONE`
  First response `total: 0` → `pageCount = max(1, 0) = 1` → clamp deletes `page` →
  refetch → filtered empty state. Correct chain, untested.

### Size & encoding

- **EC-17 — A 10 KB `meta` payload.** `❌ NONE`
  `renderMeta` (`ActivityRow:178-182`) flattens the whole record into one
  `key: value  ·  key: value` string with `JSON.stringify` for objects, rendered
  into a `break-words` `<dd>`. The server sets **no size cap** on `meta`
  (`docs/testing/activity-server.md`, EC-19), so a pathological
  `workspace.updated` `fields` array renders as a wall of text inside the row.
  Layout/perf only; no truncation, no "show more".
- **EC-18 — `<script>` or HTML in `meta.name` / `actorEmail` / `subjectId`.**
  `❌ NONE` Everything is rendered as a JSX text child, so React escapes it. There
  is no `dangerouslySetInnerHTML` anywhere in the package
  (`grep -rn "dangerouslySetInnerHTML" packages/activity/admin` → no matches).
  **Checked and cleared** — the server deliberately stores `meta` verbatim and
  calls escaping the renderer's job (server EC-20), and the renderer does it.
- **EC-19 — `user.profile_updated` meta is ignored.** `❌ NONE`
  `formatActivityDetails` returns the constant "Name changed"
  (`activityMessages:137-138`) regardless of `meta`, even though the server
  records the name (`audit-event-mapping.ts:182-185`) and its own doc table says
  the payload is `{ name: { from, to } }`. The one kind whose details could be
  informative renders a fixed string. Low; folded into `🐞 BUG-activity-admin-01`'s
  fix area.
- **EC-20 — "Revoked invite" for an active member removal.** `❌ NONE`
  The server maps the domain event `member.removed` → the audit kind
  `user.invite_revoked` (`audit-event-mapping.ts:178-181`), and this plugin
  faithfully labels that kind "Revoked invite" (`activityMessages:23-26`). So
  removing a **fully onboarded** member is logged and displayed as revoking an
  invite. The mislabel originates server-side; recorded here because this is where
  a reader sees it, and cross-referenced to `docs/testing/activity-server.md`.
- **EC-21 — Unicode / emoji / RTL in `meta`.** `❌ NONE` Passed through as text.
  No `dir` handling anywhere in the admin (see `♿ A11Y-i18n-admin-02`), so RTL
  metadata renders LTR inside the mono `<dd>`.
- **EC-22 — A 255-char `subjectId`.** `❌ NONE` Truncated by CSS in the cell; the
  full value is only in the native `title` and, once expanded, in the Subject
  detail row (`ActivityRow:135`, which is `break-words`, so it does show fully).
  Good — the detail panel is the escape hatch.

### Permission matrix and tenancy

| Surface | `admin` | `contributor` | `viewer` | authenticated, no grants | unauthenticated |
| --- | --- | --- | --- | --- | --- |
| Sidebar nav entry | shown | hidden | hidden | hidden | n/a (route gate) |
| `/activity` page | table | no-access, 0 requests | no-access, 0 requests | no-access | shell redirects to sign-in |
| Home Recent activity panel | shown | `null` | `null` | `null` | n/a |
| `/users/:id` Activity tab | shown | tab hidden | tab hidden | tab hidden | n/a |
| `GET /api/activity` | 200 | **403** | **403** | 403 | 401 |

- **EC-23 — 🔒 Can a non-admin read another user's activity?** **No, and the UI
  gating matches the server exactly.** Four independent client gates —
  the nav item's `permission` field (`activityPlugin:68`), the page's
  `useHasPermission('activity:read')` (`ActivityLogPage:83`) which also drives
  `enabled` (`:136`), the home panel's early `return null`
  (`RecentActivityPanel:52,58`), and the user-detail tab's `canReadActivity`
  (`packages/users/admin/src/lib/presentation/components/UserDetailLayout/UserDetailTabs/index.tsx:83,113`) — all read the
  **same** permission the server's `@RequirePermissions(PERMISSIONS.ACTIVITY_READ)`
  enforces, and `activity:read` is granted only to `admin`. `⚠️ PARTIAL` client-side
  (`audit-log.spec.ts:117` covers the page + nav; the home panel and the user tab
  have no negative test), `✅ E2E` server-side
  (`apps/server-e2e/src/server/activity/activity.spec.ts:262,272,282`).
  **Checked and cleared** — this is the hunt this brief called for, and the two
  halves agree.
- **EC-24 — 🔒 The log is deployment-wide, but the copy says "workspace".**
  `❌ NONE` There is no `workspace_id` on the audit table
  (server EC-26), and this page sends no workspace context. Yet the subtitle reads
  "{n} events **across the workspace**" (`ActivityLogPage:51-53`) and the empty
  state says "Actions across the workspace will appear here."
  (`ActivityEmpty:32-34`). An admin reading a multi-workspace deployment is told
  the figure is scoped when it is not. Copy-level, but it misstates the
  data's scope on the page whose job is being the record of record.
  → `🐞 BUG-activity-admin-06`.
- **EC-25 — 🔒 Cached audit pages survive a session switch.** `❌ NONE`
  `useLogoutMutation` invalidates **only** `currentUserKey`
  (`packages/identity/admin/src/lib/application/useLogoutMutation/index.ts:17-19`)
  — it never calls `queryClient.clear()`. So `['activity','list',…]` pages fetched
  by admin A stay in memory when admin B signs in on the same tab. Because
  `activity:read` is admin-only and the log is global, B's view of the data is
  identical to A's, so there is **no privilege escalation** — and a
  non-admin B renders none of the surfaces at all. Defence-in-depth only;
  **checked and cleared**, but worth stating since the cached rows are audit data.
- **EC-26 — The query key carries no user and no workspace.** `❌ NONE`
  Deliberate and consistent with the server's model. Cleared.

### State, focus and UI states

- **EC-27 — Focus after navigating to `/activity`.** `❌ NONE`
  Nothing moves focus to the new page's `<h1>` or `<main>`; the router swaps the
  tree and focus stays wherever it was (or falls to `<body>`). This is an
  app-wide gap the `accessibility` skill calls out ("Manage focus on route
  change"), not specific to this unit — recorded, cross-referenced from
  `♿ A11Y-activity-admin-02`.
- **EC-28 — Focus after pressing "Clear filters" in the empty state.** `❌ NONE`
  `clearFilters` (`ActivityLogPage:184-187`) unmounts the `ActivityEmpty` that
  holds the button, so focus lands on `<body>`. → `♿ A11Y-activity-admin-02`.
- **EC-29 — Focus after collapsing the filter panel.** `❌ NONE`
  **Correct** — `setFiltersPanelOpen(false)` explicitly refocuses the toggle
  (`:123-126`), and the panel is `inert` when closed. Checked and cleared;
  this is the pattern EC-28 is missing.
- **EC-30 — Expanded rows survive a page change.** `❌ NONE`
  They do not: `expanded` is `useState` inside `ActivityTable`
  (`ActivityTable:30`), keyed by event id, and the table re-renders with new ids.
  Correct behaviour, since the ids are gone.
- **EC-31 — Every event contributes two `<tr>`s.** `❌ NONE`
  `ActivityRow` always renders the data row **and** the detail row
  (`ActivityRow:64-173`); only the inner `<dl>` is `inert`. A 25-row page is 50
  table rows to AT. → `♿ A11Y-activity-admin-04`.
- **EC-32 — `aria-busy` during a refetch.** `❌ NONE`
  Set on the results container from `isPlaceholderData` (`ActivityLogPage:291`).
  Correct — and rare in this repo.
- **EC-33 — Two live regions at once.** `❌ NONE`
  The results `role="status"` renders only when `!isPending && !isError`
  (`:263`), and the skeleton's `role="status"` only when `isPending`, so they
  never coexist — which is exactly the `admin-e2e` skill's "don't stack two
  announcing regions" gotcha, respected. Checked and cleared.
- **EC-34 — Error vs empty vs loading are three states.** `❌ NONE`
  Genuinely three branches with distinct markup: skeleton, `role="alert"` Alert +
  Retry, `Empty`. The `.cursor/BUGBOT.md` "error masquerading as empty" pattern
  does **not** apply. Cleared for both the page and the home panel
  (`RecentActivityPanel:78-100`).
- **EC-35 — Retry on an unrecoverable error.** `❌ NONE`
  Retry re-issues the *same* request. For a 500 that is right; for a 400 caused by
  a bad URL param it can never succeed → `🐞 BUG-activity-admin-03`.
- **EC-36 — Over-invalidation.** `❌ NONE` Not applicable: the plugin has **no
  mutations** and calls `invalidateQueries` nowhere
  (`grep -rn "invalidate" packages/activity/admin/src` → no matches).
  `activityKeys.all` is exported for other plugins to invalidate after their own
  writes, and **nothing in the repo calls it**: `grep -rn "activityKeys.all" packages apps`
  matches only its own JSDoc (`activityKeys:19`) and its declaration (`:25`). (The wider
  `activityKeys` symbol *is* imported — by `useActivityLog:22`, the gateway pair and the
  page's type import — so it is `.all` specifically that is dead, not the module.)
  So a member-role change made in another tab does not refresh an open log; the
  default `staleTime: 0` means only a remount does.
- **EC-37 — The log grows while the user reads page 1.** `❌ NONE`
  No polling, no refetch interval. Page 2 will have shifted by the number of new
  events since — the classic offset-paging skew on an append-heavy table, made
  worse because the default sort is newest-first. Untested and unmentioned in the
  UI.
- **EC-38 — A malformed `at` from the API.** `❌ NONE`
  `new Date(dto.at)` with no validation (`activityMapper:38`) →
  `RecentActivityPanel:123` calls `.toISOString()` on it → **RangeError inside
  render**. → `🐞 BUG-activity-admin-04`.
- **EC-39 — A kind the admin does not know.** `❌ NONE`
  `toActivityEvent` casts `dto.kind as ActivityKind` (`activityMapper:31`) — an
  unchecked assertion in the layer whose stated job is anti-corruption. The
  consequences are the raw label and the empty details of
  `🐞 BUG-activity-admin-01`.

### 4A. Accessibility & Section 508 Conformance

**Baseline: this is the best-covered unit in the admin for automated a11y, and
the artifact spec's premise understates it.** The spec's note that axe suites
exist "only [for] auth, content, copilot, insights, users and workspaces" is
**wrong for activity**: `apps/admin-e2e/src/activity/audit-log.spec.ts:136-179`
is a five-state axe describe block (table initial, **expanded row**, loading
skeleton, filtered-empty, no-access), `activity-filter.spec.ts:122-131` scans the
**open filter panel with a rule**, and `audit-log.spec.ts:186-213` is a real
keyboard suite (type-to-filter, and expanding a row with Enter). No rules are
disabled — `apps/admin-e2e/src/support/a11y.ts:12-23` only formats violations, and
`makeAxe` uses the four standard tag sets (`support/fixtures.ts:108-117`).

That said, **a clean axe run is not conformance**, and the gaps below are exactly
the classes axe cannot see: announcement timing on paging, focus restoration when
a trigger unmounts, whether a `title` is reachable, and whether the table's row
count means what it says. Both axe suites also run in a **single theme**; contrast
in the dark palette is unverified.

Credit where due, because a rewrite must not lose these: a real `<table>` with an
accessible name and `scope="col"` headers; a genuine disclosure pattern
(`aria-expanded` + `aria-controls` + `inert`) rather than a hidden div; a
`role="status"` **result count** announced after a filter (`ActivityLogPage:263-267`
— almost nothing else in this repo does this); `aria-busy` on the refetching
container; explicit focus return to the Filters toggle; a `role="alert"` error
distinct from two distinct empty states; named pagination buttons and a labelled
rows-per-page Select; a decorative `aria-hidden` avatar with the email carrying
the meaning; a skeleton that owns one `role="status"` and marks its decorative
table `aria-hidden`; and `motion-reduce:` on both the chevron and the grid-rows
transition.

**504 Authoring Tools** — largely **Not Applicable**: the activity log authors no
content, offers no editor, and has no template. One genuine 504.2.1 observation
rather than padding: the log is the deployment's record of *what changed*, and its
`entry.published`/`entry.unpublished` rows carry only `{ contentType }`
(`packages/activity/server/src/lib/activity/infrastructure/audit-event-mapping.ts:85-97`). So there is no audit
trail that could show whether accessibility information (alt text, headings,
language markers) was preserved across a publish — the evidence a 508 audit of the
authoring path would ask for. That is a gap in the **server's** meta granularity;
noted here because this is the surface where such evidence would be read.

#### ♿ A11Y-activity-admin-01 — Paging changes every row and announces nothing
**WCAG:** 4.1.3 Status Messages (AA), 2.4.3 Focus Order (A) · **508:** 502.2, 502.3 · **Verdict: Partially Supports**
**Location:** `packages/activity/admin/src/lib/presentation/pages/ActivityLogPage/index.tsx:263-267`; `packages/activity/admin/src/lib/presentation/components/ActivityPagination/index.tsx:118-125`
```tsx
{!isPending && !isError && (
    <p role="status" aria-live="polite" className="sr-only">
        {intl.formatMessage(messages.results, { count: total })}
    </p>
)}
```
The live region carries the **total**, which is invariant across pages — so
pressing **Next page** replaces all 25 rows and the region's text does not
change, producing no announcement. The one thing that *did* change, "Page 2 of
3", is a plain `<span>` inside a `PaginationItem` with no live region, no
`aria-current`, and no association with the button that changed it. Focus stays
on **Next page**, which is correct (nothing should steal it), so a screen-reader
user has no signal at all that the table turned over.
**Repro:** with a screen reader, Tab to **Next page** and press Enter.
→ Observed: silence; the reader must manually re-navigate into the table to
discover new content. → Expected: "Page 2 of 3, showing 26–50 of 60."
**Keyboard-only experience:** fine visually — the readout is on screen.
**Remediation:** move the "{from}–{to} of {total}" + "Page N of M" readout into
the polite live region (or add a second sr-only region carrying it), so the
region's text actually changes when the page does.

#### ♿ A11Y-activity-admin-02 — "Clear filters" destroys its own button, dropping focus to `<body>`
**WCAG:** 2.4.3 Focus Order (A), 3.2.2 On Input (A) · **508:** 502.2 · **Verdict: Partially Supports**
**Location:** `packages/activity/admin/src/lib/presentation/pages/ActivityLogPage/index.tsx:184-187, 285-289`; button at `packages/activity/admin/src/lib/presentation/components/ActivityEmpty/index.tsx:72-82`
```tsx
const clearFilters = () => {
    setEmailInput('');
    updateParams({ actorEmail: undefined, filter: undefined });
};
```
Clearing the filters makes the query return rows, so `events.length === 0`
becomes false, `ActivityEmpty` unmounts, and the button the user just activated
ceases to exist. React does not move focus, so the next Tab starts from the top of
the document. The page **already knows how to do this correctly** twelve lines
away — `setFiltersPanelOpen` explicitly restores focus to the toggle
(`:123-126`) — so this is an inconsistency inside one file, not a missing concept.
**Repro:** filter to nothing, Tab to **Clear filters**, press Enter, then press
Tab.
→ Observed: focus resumes from the document start; the newly-populated table is
never announced (the live region's total changed, so it *is* announced — but the
user is now at the top of the page with no idea where they are).
→ Expected: focus moves to the search box, the table, or the results heading.
**Remediation:** capture a ref to the search input (or the table container) and
focus it after `clearFilters`, mirroring `setFiltersPanelOpen`.

#### ♿ A11Y-activity-admin-03 — The table's timestamps have no machine-readable value, though the home panel's do
**WCAG:** 1.3.1 Info and Relationships (A) · **508:** 502.3 · **Verdict: Partially Supports**
**Location:** `packages/activity/admin/src/lib/presentation/components/ActivityTable/ActivityRow/index.tsx:95-100` vs `packages/activity/admin/src/lib/presentation/components/RecentActivityPanel/index.tsx:121-131`
The home panel does it right:
```tsx
<time className="…" dateTime={event.at.toISOString()}>
    {intl.formatDate(event.at, { month: 'short', day: 'numeric', … })}
</time>
```
The table's **When** cell is a bare `TableCell` with a formatted string and no
`<time>` element, no `datetime`, and no title. Two consequences: the exact instant
(seconds, timezone, year in the panel's case) is not machine-readable to AT,
translation tools or user scripts; and the same event's time is *formatted
differently* in the two surfaces the user compares side by side ("Jun 11, 2026,
12:00" vs "Jun 11, 12:00" — the panel drops the year entirely, which is
ambiguous for an audit log that spans years).
**Note on the brief's "2h ago" concern:** this unit uses **no relative
timestamps anywhere** — every surface formats an absolute date via `intl.formatDate`
— so the "relative time needs a machine-readable full value" failure is *not*
present. The gap here is the inverse and milder: the absolute value has no
`<time>` wrapper in the table.
**Remediation:** wrap the When cell in `<time dateTime={event.at.toISOString()}>`,
matching the panel, and include the year in the panel's format.

#### ♿ A11Y-activity-admin-04 — Every event occupies two table rows, so AT reports twice the data
**WCAG:** 1.3.1 Info and Relationships (A) · **508:** 502.3 · **Verdict: Partially Supports**
**Location:** `packages/activity/admin/src/lib/presentation/components/ActivityTable/ActivityRow/index.tsx:64-173`
The component always returns two sibling `<TableRow>`s — the data row and the
detail row — regardless of whether the disclosure is open. `inert` is applied to
the inner `<dl>` (`:120`), **not** to the `<tr>`/`<td>` wrapping it, so the empty
second row remains a structural row of the table. A 25-event page therefore
announces as a 50-row table, and row-by-row navigation lands on an empty row
between every pair of events.
**Repro:** with a screen reader in table-navigation mode, press Ctrl+Alt+↓
repeatedly down the default page.
→ Observed: alternating content rows and empty rows; the reader's "row N of 50"
count does not match the 25 events on screen. → Expected: 25 rows, with the
detail panel exposed only when its disclosure is open.
**Keyboard-only experience:** unaffected (the empty row holds nothing focusable).
**Remediation:** render the detail `<tr>` only when `open` (accepting the loss of
the grow animation), or move `inert`/`hidden` up to the `<tr>` so the row leaves
the accessibility tree while collapsed.

#### ♿ A11Y-activity-admin-05 — The disclosure column's header cell is empty and unnamed
**WCAG:** 1.3.1 Info and Relationships (A) · **508:** 502.3 · **Verdict: Partially Supports**
**Location:** `packages/activity/admin/src/lib/presentation/components/ActivityTable/index.tsx:50`
```tsx
<TableHead className="w-8" />
```
The other four carry `scope="col"` and a localized label; this one is an empty
`<th>` with neither. In column-header announcement mode a screen reader reads
"blank" for the first cell of every row, and the header row's shape is
under-described. The skeleton reproduces it (`ActivityLogSkeleton:41`).
**Remediation:** give it `scope="col"` and an `sr-only` label ("Details"), which
also names what the column's buttons do.

#### ♿ A11Y-activity-admin-06 — The full subject id is available only through a native `title` tooltip
**WCAG:** 1.4.13 Content on Hover or Focus (AA), 1.3.1 (A) · **508:** 502.3 · **Verdict: Partially Supports**
**Location:** `packages/activity/admin/src/lib/presentation/components/ActivityTable/ActivitySubjectCell/index.tsx:12-17`
```tsx
<p className="truncate font-mono text-xs text-muted-foreground" title={event.subjectId}>
    {event.subjectId}
</p>
```
The `<p>` is not focusable, so the tooltip is mouse-only; a native `title` is also
not dismissible with Escape and not hoverable, which is what 1.4.13 asks for. The
same pattern was already fixed once elsewhere in this repo — `i18n.spec.ts:127-131`
pins the localized-field mark's conversion from "a bare span with a native `title`
— invisible to keyboard and touch users" into a real focusable tooltip trigger, so
the house pattern exists and is not used here.
**Mitigating:** the expanded detail row shows the full `type · id` with
`break-words` (`ActivityRow:131-137`), so the information is reachable — via three
more interactions.
**Remediation:** drop the `title` and rely on the detail panel, or use the
design-system `Tooltip` on a focusable trigger the way the i18n mark does.

#### ♿ A11Y-activity-admin-07 — The row is a click target with no role, so the large hit area is mouse-only
**WCAG:** 4.1.2 Name, Role, Value (A) · **508:** 502.3 · **Verdict: Partially Supports** · (WCAG 2.2's 2.5.8 Target Size is **advisory** here)
**Location:** `packages/activity/admin/src/lib/presentation/components/ActivityTable/ActivityRow/index.tsx:66-69`
```tsx
<TableRow onClick={onToggle} className="cursor-pointer">
```
The `<tr>` gets a click handler and `cursor-pointer` but no `role`, no `tabIndex`,
and no state — nothing tells AT the row is interactive, and it duplicates the
button's function invisibly. **2.1.1 is met**, because the 24 px chevron button is
a full keyboard equivalent, so nothing is unreachable; the failure is that the
generous target exists for mouse users only, and that the row's interactivity is
undiscoverable to a screen-reader user who never finds the small button. It also
means a text-selection drag inside a row toggles it on mouseup.
**Remediation:** either drop the row handler and enlarge the button's hit area, or
give the row `aria-hidden` interactivity semantics it can honour — the first is
simpler and loses nothing.

#### ♿ A11Y-activity-admin-08 — No column is sortable, so `aria-sort` is Not Applicable — but the server's sort is unreachable
**WCAG:** 1.3.1 (A) · **508:** 502.3 · **Verdict: Not Applicable**
**Location:** `packages/activity/admin/src/lib/presentation/components/ActivityTable/index.tsx:48-64`
No header contains a button and none carries `aria-sort`, which is **correct**,
because nothing is sortable. Recording it explicitly so a reviewer does not file
a false positive: the `accessibility` skill's "a sortable column sets `aria-sort`"
rule simply does not bind here. The *functional* consequence — that
`ActivityListParams.sort`/`order` and the server's whitelisted sort exist but no
control sends them — is `🐞 BUG-activity-admin-05`, not an a11y finding.

#### ♿ A11Y-activity-admin-09 — Contrast is verified in one theme only
**WCAG:** 1.4.3 Contrast (Minimum) (AA), 1.4.11 Non-text Contrast (AA) · **508:** E205.4 · **Verdict: Unverified**
**Location:** `packages/activity/admin/src/lib/presentation/components/ActivityTable/ActivityActionCell/index.tsx:14` (`Badge variant="secondary"`), `.../ActivitySubjectCell/index.tsx:13` (`text-muted-foreground` at `text-xs`), `.../ActivityRow/index.tsx:121` (`bg-muted/30` detail panel), `.../RecentActivityPanel/index.tsx:115` (`text-[11px]` mono badge)
The axe suites do enforce `color-contrast`, but every scan runs in whatever theme
the browser defaults to — no test sets `data-theme="dark"` or
`prefers-color-scheme`. Three of the surfaces above stack a muted token on a muted
background at 11–12 px, and the detail panel adds a 30%-alpha fill under muted
text, which axe evaluates against the composited colour only when it can compute
it. **I did not measure the ratios.**
**Remediation:** parameterise the existing axe describe block over both themes;
this closes the largest remaining unknown for a unit that is otherwise well
covered.

## 5. E2E Coverage Map

Every citation is from a spec file I read; none is inferred from a filename.

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F1 route + lazy | `apps/admin-e2e/src/activity/audit-log.spec.ts:20-27` | `/activity` renders the `<h1>`, the gated shell nav, and the named table | ✅ E2E |
| F2 nav entry | `audit-log.spec.ts:26`, `:117-129` | the nav is present for an admin; the Activity button has **count 0** without `activity:read` | ✅ E2E |
| F3 home panel | `apps/admin-e2e/src/home/dashboard.spec.ts:33`, `:42-45` | the "Recent activity" `<h2>` is visible; two "View all" links exist | ⚠️ PARTIAL — no row content, no kind badge, no empty/error branch, and no negative-permission case (the `return null` path is untested) |
| F4 header/subtitle | `audit-log.spec.ts:24` | the `<h1>` "Activity" | ⚠️ PARTIAL — the "{n} events across the workspace." subtitle is never asserted, so `🐞 BUG-activity-admin-06` is invisible to CI |
| F5 actor-email search | `audit-log.spec.ts:83-94`, `:96-104`; `:192-203` | filling the box narrows the table and only the matching actor survives; `?actorEmail=` lands in the URL; typing key-by-key filters as you go | ✅ E2E |
| F6 filter panel | `apps/admin-e2e/src/activity/activity-filter.spec.ts:19-33`, `:35-61`, `:77-93`, `:95-120`, `:133-153` | the panel is a `region` named "Filters" and reports `aria-expanded`; a Kind rule narrows the log and serialises to `?filter=`; a deep link rehydrates it; a non-UUID "is one of" is blocked client-side with the rule error and no URL write; Reset clears it | ✅ E2E |
| F7 summary chips | — | — | ❌ NONE — `QueryBuilderSummary` renders only when the panel is **closed** with rules, and no spec closes it with rules |
| F8 rule count | `activity-filter.spec.ts:63-75` | the toggle reads "Filters (1)" after applying | ✅ E2E |
| F9 URL state | `audit-log.spec.ts:96`; `activity-filter.spec.ts:77` | `actorEmail` and `filter` round-trip | ⚠️ PARTIAL — `?page=` / `?pageSize=` are never deep-linked or asserted, which is why EC-11 is undetected |
| F10 table columns | `audit-log.spec.ts:27` (`getByRole('table', { name: 'Activity log' })`) | the table exists under its accessible name | ⚠️ PARTIAL — none of the four column headers is asserted, nor the empty fifth |
| F11 detail panel | `audit-log.spec.ts:45-69`; `:148-153` | collapsed by default; expand reveals "viewer → contributor" and sets `aria-expanded=true`; re-toggling returns it to `false`; axe scans the **expanded** state | ✅ E2E |
| F12 row-body click | `audit-log.spec.ts:71-81` | clicking the row body (not the button) expands it | ✅ E2E |
| F13 action labels | `audit-log.spec.ts:29`, `:41` | "Changed role" and "Invited member" render | ⚠️ PARTIAL — 2 of 14 mapped kinds; the **raw-kind fallback is never exercised**, so `🐞 BUG-activity-admin-01` cannot be caught |
| F14 details summary | `audit-log.spec.ts:50` | "viewer → contributor" for `user.role_changed` | ⚠️ PARTIAL — 1 of 8 detail branches; the constant "Name changed" and the empty-details path are untested |
| F15 actor cell | `audit-log.spec.ts:31-33`, `:36-43` | an actor email renders in its row; a null actor renders "System" | ⚠️ PARTIAL — the "Unknown" branch (non-null id, null email) is untested |
| F16 subject cell | — | — | ❌ NONE |
| F17 pagination | — | — | ❌ NONE — `DEFAULT_ACTIVITY` holds **4** events (`apps/admin-e2e/src/support/api/activity.ts:20-61`) against a page size of 25, so the pager never renders in any spec, even though the mock implements offset paging (`:204-206`) |
| F18 page clamp | — | — | ❌ NONE |
| F19 skeleton | `audit-log.spec.ts:155-164` | the `role="status"` "Loading activity…" region appears under a 30 s delay and passes axe | ✅ E2E |
| F20 error + retry | — | — | ❌ NONE — no spec fails `/api/activity`; `mockActivity` has a `delayMs` option but no failure option (`support/api/activity.ts:167`) |
| F21 empty state | `audit-log.spec.ts:106-115`, `:166-171` | the filtered-empty copy renders and passes axe | ⚠️ PARTIAL — the unfiltered "No activity yet" copy is untested on this page (only via `mockEmptyActivity` on the users tab, `support/api/userDetail.ts:106`) |
| F22 no-access | `audit-log.spec.ts:117-129`, `:173-178` | the no-access text renders, the nav entry is gone, and the state passes axe | ✅ E2E — but nothing asserts that **no request is issued** |
| F23 exported hook | `apps/admin-e2e/src/users/user-detail.spec.ts:110-131`, `:132-156` | the per-user timeline renders "Role changed … by ada@ortha.dev" and a `workspace.member_removed` event about that member | ✅ E2E |
| F24 gateway/mapper | `audit-log.spec.ts:36-43` | the null-actor mapping surfaces as "System" | ⚠️ PARTIAL — `ApiError` normalisation is untested (see F20), and `at` mapping is never asserted |
| F25 `activityKeys` | — | — | ❌ NONE |
| F26 result-count live region | — | — | ❌ NONE — axe cannot see it, and no spec reads the sr-only text |
| **a11y** | `audit-log.spec.ts:136-179` (5 states), `activity-filter.spec.ts:122-131` (open panel + rule) | axe, no violations, on: table initial, **expanded row**, loading skeleton, filtered-empty, no-access, and the open filter panel | ⚠️ PARTIAL — **one theme only**; nothing asserts announcement timing, focus after Clear filters, or the doubled row count |
| **keyboard** | `audit-log.spec.ts:186-213` | the search box filters as you type; a row expands from focus + Enter | ⚠️ PARTIAL — no Tab-order pass, no Escape on the filter panel, no keyboard path through pagination |

**Coverage tally:** `26 features · 10 ✅ · 9 ⚠️ · 7 ❌`

**Server-side counterpart** (for cross-reading, not counted here):
`apps/server-e2e/src/server/activity/activity.spec.ts` and
`activity-filter.spec.ts` — see `docs/testing/activity-server.md` §5.

## 6. 🐞 Potential Bugs

### 🐞 BUG-activity-admin-01 — Six of the twenty audit kinds the server writes have no admin label, so the Action column prints a raw wire token · Severity: Medium

**Location:** `packages/activity/admin/src/lib/types/activityKinds/index.ts:9-24` (14 kinds); `packages/activity/admin/src/lib/presentation/activityMessages/index.ts:74-89, 110-113, 120-152`
**Category:** correctness / ux-state

**What the code does:**
```typescript
export const ACTIVITY_KINDS = [
    'user.invited', 'user.invite_resent', 'user.invite_revoked',
    'user.profile_updated', 'user.role_changed', 'user.suspended',
    'user.reactivated', 'user.signed_in', 'user.signed_out',
    'workspace.created', 'workspace.member_added', 'workspace.member_removed',
    'entry.published', 'entry.unpublished'
] as const;
```
and the fallback:
```typescript
export function formatActivityAction(intl: IntlShape, kind: string): string {
    const descriptor = ACTION_MESSAGES[kind as ActivityKind];
    return descriptor ? intl.formatMessage(descriptor) : kind;
}
```

**Why it is wrong:** the server's `FACET_MAPPERS`
(`packages/activity/server/src/lib/activity/infrastructure/audit-event-mapping.ts:143-206`,
with the authoritative event-kind → audit-kind table in its JSDoc at `:113-142`) writes **twenty** distinct
audit kinds. `workspaceSubject` sets `kind: event.kind` verbatim (`:69-83`), so the
log can contain — and this admin has no label for:

| Written by the server | Meta it carries | What the admin shows |
| --- | --- | --- |
| `workspace.updated` | `{ fields }` | `workspace.updated` (raw), no details |
| `workspace.archived` | `{}` | `workspace.archived` (raw) |
| `workspace.unarchived` | `{}` | `workspace.unarchived` (raw) |
| `workspace.deleted` | `{ name, slug }` | `workspace.deleted` (raw), **name discarded** |
| `workspace.content_granted` | `{ slug, kind }` | `workspace.content_granted` (raw), **grant discarded** |
| `workspace.content_revoked` | `{ slug }` | `workspace.content_revoked` (raw), **revocation discarded** |

The admin's own AGENTS.md states the contract this breaks: "`presentation/activityMessages`
maps a kind → an 'Action' label … **no hardcoded action strings**". The fallback
turns that into a hardcoded *wire* string, untranslated, in the page's primary
column. `formatActivityDetails`'s `default: return ''` (`:149-150`) then discards
the meta, so the two most security-relevant rows in the whole log — a workspace
**deletion** and a content **grant/revoke** — display as an opaque identifier with
no detail whatsoever. `toActivityEvent`'s `dto.kind as ActivityKind`
(`activityMapper:31`) is the unchecked cast that lets the drift pass silently: the
type system asserts the set is closed and the runtime never checks.

**Repro:**
1. As an admin, grant a content type to a workspace, then archive that workspace,
   then delete another one.
2. Open `/activity`.
→ Observed: three rows whose Action badges read `workspace.content_granted`,
`workspace.archived`, `workspace.deleted`, each with an empty Details line; the
deleted workspace's name and the granted type's slug are in the response's `meta`
and are never rendered.
→ Expected: "Granted content access", "Archived workspace", "Deleted workspace",
each with its meta summarised the way `workspace.created` already is.

**Blast radius:** every deployment. Six of twenty kinds — including all four
workspace-lifecycle actions and both content-grant actions — are unreadable in the
audit UI, in every language. Nothing is lost from the database; the log simply
stops being legible exactly where an auditor would look hardest.

**Suggested fix:** add the six kinds to `ACTIVITY_KINDS`, six descriptors to
`ACTION_MESSAGES`, and six cases to `formatActivityDetails` (the meta shapes are
documented in the server's mapper table). Longer term, make the drift detectable:
have `toActivityEvent` validate `kind` against `ACTIVITY_KINDS` and surface an
explicit "Unknown action" rather than casting, and add a cross-package test
asserting the admin's list equals `AUDITED_EVENT_KINDS`' output kinds.

---

### 🐞 BUG-activity-admin-02 — The home Recent activity panel shows the raw wire kind where the table shows a localized label · Severity: Medium

**Location:** `packages/activity/admin/src/lib/presentation/components/RecentActivityPanel/index.tsx:113-118`
**Category:** correctness (i18n) / ux-state

**What the code does:**
```tsx
<Badge
    variant="secondary"
    className="shrink-0 font-mono text-[11px] font-normal"
>
    {event.kind}
</Badge>
```
No `formatActivityAction`, no `useIntl` formatting of the kind at all — the panel
imports neither `activityMessages` nor `ActivityActionCell`.

**Why it is wrong:** the plugin ships a shared, localized renderer for exactly this
(`formatActivityAction`, `activityMessages:110-113`) and its own AGENTS.md names it
as the rule ("maps a kind → an 'Action' label … no hardcoded action strings"). The
table honours it (`ActivityActionCell:15`); the home panel — which is the **first
audit surface most users ever see**, on the landing page after sign-in — does not.
The result is that the same event reads "Changed role" on `/activity` and
`user.role_changed` on `/`, deliberately styled `font-mono` as if the machine
token were the intended design. This is the same class as
`🐞 BUG-i18n-admin-08` and the regression `EntryStatusBadge`'s JSDoc says was
already fixed once elsewhere ("the table used to print the raw wire value …
lowercase and untranslated, which stopped being an option",
`packages/content/admin/src/lib/presentation/components/EntryStatusBadge/index.tsx:38-41`).

**Repro:**
1. Sign in as an admin and land on `/`.
2. Compare a row in **Recent activity** with the same event on `/activity`.
→ Observed: `user.signed_in` vs "Signed in". In a non-English admin UI the panel
is English-only regardless.
→ Expected: the same localized label on both surfaces.

**Blast radius:** every admin, on every page load of the dashboard. Cosmetic, but
it is the plugin's own convention violated on its most-viewed surface — and it
compounds `🐞 BUG-activity-admin-01`, since the panel shows raw kinds for **all**
twenty, not just the six.

**Suggested fix:** call `formatActivityAction(intl, event.kind)` in the badge (or
reuse `ActivityActionCell` outright) and drop the `font-mono` class.

---

### 🐞 BUG-activity-admin-03 — A URL param the server rejects puts the page in a permanent error state whose only corrective control is not rendered · Severity: Medium

**Location:** `packages/activity/admin/src/lib/presentation/pages/ActivityLogPage/index.tsx:107-112, 269-306`; `packages/utils/admin/src/lib/useTableUrlState/index.ts:9-12, 74`
**Category:** ux-state

**What the code does:**
```typescript
const pageSize = readInt(searchParams.get('pageSize'), defaultPageSize);
```
`readInt` accepts **any** integer ≥ 1, so `?pageSize=1000` is forwarded verbatim
into `params` and onto the wire. The server's DTO caps it:
```typescript
@Max(MAX_PAGE_SIZE)   // 100
pageSize?: number;
```
(`packages/activity/server/src/lib/activity/dto/list-activity-query.dto.ts:172`,
`activity.constants.ts:5`), so the `ValidationPipe` answers **400**. The page then
takes the `isError` branch — and that branch replaces the whole data region:
```tsx
) : isError ? (
    <Alert variant="destructive" role="alert" …>… <Button onClick={() => refetch()}>Retry</Button>
) : events.length === 0 ? (
    <ActivityEmpty … onClear={clearFilters} />
) : (
    <div aria-busy={…}><ActivityTable …/><ActivityPagination …/></div>
)}
```

**Why it is wrong:** the three controls that could fix the URL are unevenly
placed. The search box and the **Filters** panel are rendered *above* the ladder
(`:209-259`), so a bad `?actorEmail=` or `?filter=` is recoverable — press Reset.
But **rows-per-page lives inside `ActivityPagination`, which is inside the data
branch the error replaced**, and `clearFilters` (which does not touch `pageSize`
anyway) lives inside `ActivityEmpty`. So the only offered action is **Retry**,
which re-issues the identical rejected request and can never succeed. The user's
sole escape is to hand-edit the address bar — and because every write uses
`{ replace: true }` (`useTableUrlState:91`), the browser **Back** button does not
restore the previous good URL either.

**Repro:**
1. Open `/activity`, then edit the address bar to `/activity?pageSize=1000`.
→ Observed: "Couldn't load activity. Please try again." with a Retry that fails
identically every time; no rows-per-page control anywhere on the page; Back leaves
`/activity` rather than dropping the param.
→ Expected: either the client clamps `pageSize` to a legal option before
requesting, or the error state offers a "reset the view" action.

**Blast radius:** anyone who hand-edits or is sent a malformed link — including a
stale bookmark if the server's cap is ever lowered. No data at risk; the page is
simply stuck. The same shape applies to any future param the server tightens.

**Suggested fix:** validate `pageSize` against `PAGE_SIZE_OPTIONS` in
`ActivityLogPage` before building `params` (falling back to the default), and give
the error state a "Reset filters and view" action that clears every owned param.

---

### 🐞 BUG-activity-admin-04 — The anti-corruption mapper does not validate `at`, and an invalid date crashes the entire home route · Severity: Low

**Location:** `packages/activity/admin/src/lib/infrastructure/activityMapper/index.ts:28-40`; `packages/activity/admin/src/lib/presentation/components/RecentActivityPanel/index.tsx:121-124`; host at `packages/shell/admin/src/lib/pages/HomePage/index.tsx:71-77`
**Category:** correctness / robustness

**What the code does:**
```typescript
export function toActivityEvent(dto: ActivityEventResponse): ActivityEvent {
    return { …, at: new Date(dto.at) };
}
```
and downstream:
```tsx
<time className="…" dateTime={event.at.toISOString()}>
```
`new Date('garbage')` yields an Invalid Date rather than throwing, and
`Date.prototype.toISOString` **throws `RangeError: Invalid time value`** for a
non-finite time value. That throw happens during `RecentActivityPanel`'s render,
inside `HomePage`'s slot loop:
```tsx
{panels.map(({ id, Component }) => (
    <Component key={id} />
))}
```
There is **no error boundary** anywhere on that path — the only `componentDidCatch`
in the repo is `packages/insights/admin/src/lib/presentation/components/WidgetBoundary/index.tsx`, which the
home page does not use — so React unmounts the whole tree and `/` renders blank.

**Why it is wrong:** this module is, by the package's own AGENTS.md, "the wire→view
**anti-corruption layer**", and it performs no validation of any field: `kind` is
cast (`🐞 BUG-activity-admin-01`), `at` is constructed unchecked. `.cursor/BUGBOT.md`
warns about the adjacent pattern ("Mapper fallbacks that rewrite data … Surface
missing data; don't paper over it") — here the mapper neither papers over nor
surfaces; it propagates a poisoned value into a call that throws. The table's
`intl.formatDate` is more forgiving (react-intl catches format errors), which is
why the crash lands on the dashboard rather than on `/activity` — a difference in
blast radius that is entirely accidental.

**Repro:**
1. Intercept `GET /api/activity` and return one event with `"at": null` (or
   `"at": "not-a-date"`).
2. Load `/`.
→ Observed: the home route renders nothing — greeting, stat tiles and the
workspaces panel all disappear with the crashed activity panel.
→ Expected: at worst, that one panel shows its error state.

**Honest reachability:** the server's `at` is a `timestamp` column serialised by
the ORM and is always a valid ISO string today, so this is **not reachable from
the shipped API** — it is a robustness gap that a schema change, a proxy, or a
mock could trip. Filed Low for that reason, not because the failure is mild.

**Suggested fix:** validate in the mapper (`const at = new Date(dto.at); if
(Number.isNaN(at.getTime())) …`) and decide the policy there — drop the event or
carry a null timestamp — and separately wrap `HOME_SECTION_SLOT` components in a
boundary so one plugin's panel cannot take down the dashboard.

---

### 🐞 BUG-activity-admin-05 — The server's sort is unreachable from the UI, and the code comments claim a control that does not exist · Severity: Low

**Location:** `packages/activity/admin/src/lib/infrastructure/activityKeys/index.ts:11-14`; `packages/activity/admin/src/lib/presentation/pages/ActivityLogPage/index.tsx:107-112, 182-187`; `packages/activity/admin/src/lib/presentation/components/ActivityTable/index.tsx:48-64`
**Category:** correctness (dead surface) / doc drift

**What the code does:**
```typescript
/** Sort column; the server defaults to `at`. */
sort?: 'at' | 'kind';
/** Sort direction; the server defaults to `desc`. */
order?: 'asc' | 'desc';
```
but the page builds:
```typescript
const params: ActivityListParams = {
    actorEmail: emailParam || undefined,
    filter: filterParam || undefined,
    page,
    pageSize
};
```
`sort` and `order` are **never set by anything** — `grep -rn "sort" packages/activity/admin/src`
finds them only in the type and in a comment. No `<th>` contains a button and none
carries `aria-sort`.

**Why it is wrong:** the server implements and tests sorting
(`apps/server-e2e/src/server/activity/activity.spec.ts:227` — "sorts by time,
newest first by default and oldest first on asc"), and the admin declares the
parameters as if it used them. Three pieces of documentation assert a UI that is
not there:
- `clearFilters`'s comment — "while **preserving the user's sort/order**/page-size
  choices" (`ActivityLogPage:182-183`) — describes preserving state the page cannot
  hold;
- the package AGENTS.md describes "a filter toolbar (**action/kind select** +
  actor-email search)" — `ActivityToolbar` has no select of any kind, only the
  search box and the page-supplied Filters button;
- the same AGENTS.md says `types/activityKinds` "drives the kind filter", but
  `ACTIVITY_KINDS` (the runtime array) is **used nowhere** — only the derived type
  is — and the Kind filter field is `FIELD_TYPE.String`, a free-text box
  (`activityFilterFields:32`). The e2e has to type `user.suspended` by hand
  (`activity-filter.spec.ts:47`).

**Repro:**
1. Click the **When** header. → Observed: nothing. → Expected (per the docs): a
   sort toggle.
2. Open the filter panel, pick **Kind**. → Observed: a free-text input.
   → Expected (per the docs): a select of the known kinds.
3. `grep -rn "ACTIVITY_KINDS" packages apps` → only its own declaration.

**Blast radius:** no user-visible breakage, but the audit log's most obvious
affordance (sort by time, oldest-first) is missing while the code claims it, and
the one enumerable filter is free text — so `user.suspend` (a typo) silently
matches nothing and looks like "no such activity".

**Suggested fix:** either wire sortable **When**/**Action** headers (real `<button>`
inside the `<th>` plus `aria-sort`, feeding `sort`/`order` through `updateParams`
with `resetPage: false`) and make Kind a `FIELD_TYPE.Enum` over `ACTIVITY_KINDS`,
or delete the unused params, correct the comment, and update AGENTS.md.

---

### 🐞 BUG-activity-admin-06 — The page tells the reader the audit log is workspace-scoped; it is deployment-wide · Severity: Low · 🔒

**Location:** `packages/activity/admin/src/lib/presentation/pages/ActivityLogPage/index.tsx:49-53, 204-206`; `packages/activity/admin/src/lib/presentation/components/ActivityEmpty/index.tsx:31-34`
**Category:** correctness (copy) / ux-state

**What the code does:**
```typescript
subtitle: {
    id: 'activity.page.subtitle',
    defaultMessage: '{count, plural, one {# event} other {# events}} across the workspace.'
}
```
and the empty state: "Actions across the workspace will appear here."

**Why it is wrong:** the audit table has **no `workspace_id` column** at all
(`packages/activity/server/src/lib/schema/activity-events.ts`, and
`docs/testing/activity-server.md` EC-26: "No, and deliberately so … the read is
admin-only and admins are global, so there is no tenant boundary to breach"). The
page sends no workspace context and reads none — this plugin does not even import
`useCurrentWorkspace`. Every figure and every row is deployment-wide. The copy
therefore misstates the scope of the number it is printing, on the one page whose
purpose is to be authoritative about what happened. The same confusion is already
recognised as a hazard on the server side, where the copilot tool's description
has to spell out that it answers about the whole deployment.

**Repro:**
1. Create two workspaces, act in both.
2. Open `/activity` with workspace A selected in the shell.
→ Observed: "142 events across the workspace." — a total that includes every event
in workspace B and every workspace-less event (sign-ins, user invites).
→ Expected: "142 events across this deployment.", or an explicit note that the log
is not workspace-scoped.

**Blast radius:** admins only (nobody else can see the page), but it is the kind of
misstatement that matters in an audit context — someone reading "across the
workspace" may conclude an action did **not** happen in another workspace because
it is absent from a filtered view they believe is scoped.

**Suggested fix:** reword both strings to say deployment/system-wide, and consider
a one-line note under the header stating the log spans all workspaces.

---

**Tally:** 6 🐞 — 0 Critical, 0 High, 3 Medium, 3 Low (one 🔒; none opens `Unverified —`).
**♿ tally:** 9 — 0 Supports · 7 Partially Supports · 0 Does Not Support · 1 Not Applicable ·
1 Unverified (`A11Y-09`, the dark-theme contrast measurement).
**Edge cases:** `39 EC entries · 0 deleted in verification`.

**Checked and cleared:** the UI's permission gating **matches the server's**
exactly — four independent client gates all read `activity:read`, all disable the
query rather than merely hiding a button, and `activity:read` is admin-only, so a
non-admin cannot read another user's activity from any surface (EC-23); loading,
error and empty are three genuinely distinct branches on **both** the page and the
home panel, with the error carrying `role="alert"` and a retry — the BUGBOT
"error masquerading as empty" pattern does not apply here; the filtered and
unfiltered empty states have distinct copy and only the filtered one offers Clear;
the result count **is** announced in a polite live region after a filter change,
and the two `role="status"` regions can never coexist; focus **is** restored to the
Filters toggle when the panel collapses and the closed panel is `inert`; the page
clamp exists and is correctly guarded on `data` so a deep-linked `?page=N` survives
the pending fetch; `aria-busy` marks the container while placeholder data is on
screen; the plugin has no mutations and invalidates nothing, so there is no
over-invalidation and no stale-page-after-mutation surface; there is exactly one
`apiClient` call site and every failure is normalised to `ApiError`, so the ADR-0003
gateway seam holds; no `dangerouslySetInnerHTML` exists anywhere, so `meta` and
`subjectId` are escaped as React text; `motion-reduce:` is honoured on both
animations; and the audit cache surviving a sign-out is a defence-in-depth note
only, not a privilege leak, because the data is global and admin-only (EC-25).

## 7. Recommended E2E Tests

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | `apps/admin-e2e` POM + `page.route` mock | extend `src/activity/audit-log.spec.ts` | seed one event of **each** kind the server can write (all twenty, from the server mapper's table): every Action badge is a localized label, never a `domain.action` string; and each mapped kind's Details line matches | 🐞 BUG-activity-admin-01, F13 ⚠️, F14 ⚠️ |
| 2 | `apps/admin-e2e` | extend `src/activity/audit-log.spec.ts` | add a `failing` option to `mockActivity`, then assert the `role="alert"` error with **Retry** (not the empty state), that Retry re-issues the request, and that a 400 from `?pageSize=1000` is not presented as a retryable transient | 🐞 BUG-activity-admin-03, F20 ❌, F24 ⚠️ |
| 3 | `apps/admin-e2e` | `src/activity/pagination.spec.ts` (new) | seed 60 events: the pager renders, "1–25 of 60" and "Page 1 of 3" are correct, Next/Previous disable at the ends, `?page=` round-trips, rows-per-page resets to page 1, and a deep-linked `?page=99` clamps to the last page | F17 ❌, F18 ❌, F9 ⚠️ |
| 4 | `apps/admin-e2e` | extend `src/activity/audit-log.spec.ts` (keyboard describe) | after **Clear filters**, focus is not on `<body>`; after collapsing the filter panel, focus is on the toggle (regression guard for the behaviour that already works); Escape closes the panel | ♿ A11Y-activity-admin-02, ♿ A11Y-activity-admin-01 |
| 5 | `apps/admin-e2e` | extend `src/activity/audit-log.spec.ts` | read the sr-only `role="status"` text: it states the result count after a filter, **and changes when the page changes** | ♿ A11Y-activity-admin-01, F26 ❌ |
| 6 | `apps/admin-e2e` | extend `src/home/dashboard.spec.ts` | the Recent activity panel's rows: the actor, the **localized** action label (not `user.signed_in`), at most 6 rows, the empty branch, the error branch, and that the panel renders nothing for a user without `activity:read` | 🐞 BUG-activity-admin-02, F3 ⚠️ |
| 7 | `apps/admin-e2e` | parameterise the existing axe describe in `src/activity/audit-log.spec.ts` | run all five states in **both** themes (`data-theme="dark"` and light) | ♿ A11Y-activity-admin-09 |
| 8 | `apps/admin-e2e` | extend `src/activity/audit-log.spec.ts` | count `getByRole('row')` and assert it equals the number of seeded events + 1 header — currently ~2× | ♿ A11Y-activity-admin-04 |
| 9 | `apps/admin-e2e` | extend `src/activity/audit-log.spec.ts` | the four column headers by name and `scope`; the Subject cell's type + id; the "Unknown" actor branch (non-null id, null email) | F10 ⚠️, F15 ⚠️, F16 ❌ |
| 10 | `apps/admin-e2e` | extend `src/activity/activity-filter.spec.ts` | with the panel **closed** and rules applied, the `QueryBuilderSummary` chips render and removing one updates the URL and the table | F7 ❌ |
| 11 | `apps/admin-e2e` | extend `src/activity/audit-log.spec.ts` | assert that **no** `GET /api/activity` request is issued for a user without `activity:read` (route spy, count 0) — the gate is currently only asserted visually | F22 ✅→ deepen, EC-23 |
| 12 | `apps/admin-e2e` | extend `src/users/user-detail.spec.ts` | a non-admin (no `activity:read`) sees no Activity tab **and** forcing `/users/:id/activity` issues no request | EC-23 ⚠️ |
| 13 | package unit (`*.spec.ts` beside the source) | `src/lib/infrastructure/activityMapper/index.spec.ts` (new) | `toActivityEvent` on: a null actor, a null email with an id, `meta: null`, an **unknown kind**, and a malformed `at` — pinning the policy rather than the current unchecked cast | 🐞 BUG-activity-admin-04, 🐞 BUG-activity-admin-01, F24 ⚠️ |
| 14 | `apps/admin-e2e` | extend `src/activity/audit-log.spec.ts` | the unfiltered empty state's copy ("No activity yet") with **no** Clear button, distinct from the filtered one | F21 ⚠️ |
