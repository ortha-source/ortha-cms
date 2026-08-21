# @orthacms/activity-admin

The audit-log **admin plugin**: the global **Activity Log** page at `/activity`,
its sidebar nav entry, and the home dashboard's recent-activity panel. Mirrors
the Members page patterns.

## Layout — layered (ADR-0003), read-only — no domain layer

This plugin is **layered (tactical DDD)**, but it is a **read-only projection
viewer**: it has **no mutations** and **no client-side domain rules**, so — per
ADR-0003 ("don't force DDD on CRUD / read-side contexts") — it has **no
`domain/` layer**. Adding empty `domain/` folders here would be a *violation* of
ADR-0003, not compliance. This mirrors `activity/server`, which is likewise a
read-side/CRUD audit context with **no aggregate**. `src/lib` is organized into
three layers plus a shared type kernel:

- **`infrastructure/`** — the `ActivityGateway` **port** + its
  `httpActivityGateway` implementation (the **one place `apiClient` is used** in
  this plugin, normalizing failures to `ApiError` via `toApiError`),
  `activityMapper` (the wire→view anti-corruption layer, formerly
  `utils/toActivityEvent`), and `activityKeys` (the query-key factory +
  `ActivityListParams`).
- **`application/`** — the `useActivityLog` TanStack Query hook. It calls the
  gateway (`httpActivityGateway.list`), never `apiClient`. Its name and
  signature are unchanged (the barrel + `users-admin`'s user-activity tab
  consume it).
- **`presentation/`** — the pages, components, the `activityPlugin` factory,
  `activityFilterFields`, and `activityMessages`. Consumes the view models +
  the hook only; **nothing here imports `apiClient`**.
- **`types/`** — the wire-independent **view-model contract** shared by the
  mapper (infra) and the presentation: `activityEvent` (`ActivityEvent` /
  `ActivityActor` / `ActivityList` / `ActivityMeta`) and `activityKinds` (the
  `ActivityKind` union the admin restates locally, since it can't import the
  server plugins). Kept as a top-level kernel — not under `presentation/` — so
  the infrastructure mapper can produce these types without depending on the
  presentation layer.

## What it owns

- The private `/activity` route (lazy + `<Suspense>`), rendered in the shell's
  authenticated layout.
- A `SIDEBAR_NAV_SLOT` entry (`group: 'overview'`, `order: 20`) carrying
  `permission: 'activity:read'`, so the entry is **hidden** for users who lack
  it (the shell's `SidebarNavButton` honors the optional `permission` field).
  The page itself also gates on `useHasPermission('activity:read')`.
- A `HOME_SECTION_SLOT` panel (`RecentActivityPanel`) — the latest events on the
  home dashboard, reusing `useActivityLog` and gated on `activity:read`.

## The page

`ActivityLogPage` — `Container`/`ContainerHeader`, a filter toolbar (action/kind
select + actor-email search), the **When · Actor · Action · Subject** table with
**expandable rows** (a leading toggle reveals a details panel — subject, actor,
exact time, raw metadata — animated via a grid-rows `0fr↔1fr` transition,
`aria-hidden` + `inert` on the whole detail `<tr>` when collapsed, reduced-motion
aware), pagination, and a loading **skeleton** (`ActivityLogSkeleton`, used for
both the lazy fallback and `isPending`) plus empty/error/no-access states. The
**URL query string is the source of truth** for every filter and page
(deep-linkable); `page` is clamped to `pageCount` after a filter narrows the
result, and `pageSize` is clamped to the largest option the server accepts.

## Three things about this page that are load-bearing

**The log is deployment-wide, not workspace-scoped, and the copy must say so.**
`activity_events` has no workspace column and this page sends no workspace
context — that is deliberate (see `activity/server`'s `AGENTS.md`). The subtitle
and the empty state used to read "across the workspace", which told an admin of
a multi-workspace deployment that the figure was scoped when it never was, on the
page whose whole job is being the record of record. **Do not add a workspace
filter** — there is no column to filter on. Fix the copy, not the query.

**`ACTIVITY_KINDS` must stay in step with the server, and nothing enforces it at
runtime.** The admin restates the kind strings locally because it cannot import
the server plugins. A kind the server writes and this list omits is not a type
error and not a runtime error: the mapper casts `dto.kind as ActivityKind`,
`formatActivityAction` finds no descriptor, and the Action column silently prints
the raw dotted wire token. Six `workspace.*` kinds, `user.activated` and all
seven `media.*` kinds shipped that way. Inside the package `ACTION_MESSAGES` is
typed `Record<ActivityKind, …>`, so a kind added to the list without a label is
a compile error; the cross-repo half is pinned by
`apps/admin-e2e/src/activity/activity-kinds.spec.ts` — **update its
`ALL_KINDS_ACTIVITY` seed when the server gains a kind.** The same applies to
`ACTIVITY_SUBJECT_TYPES`.

**`at` may be an `Invalid Date`, on purpose.** `toActivityEvent` will not
substitute an instant for a timestamp the wire got wrong — inventing one for an
audit row is exactly the silently-rewriting mapper fallback to avoid. The cost is
that `Date.prototype.toISOString` **throws** on the result, and calling it
unguarded in render once blanked the entire SPA (there is no error boundary above
the home slots). Every `<time datetime>` in this plugin therefore goes through
`presentation/activityDateTime`, and every visible date through
`intl.formatDate`, which is total.

## Conventions

- Every module is a `<name>/index.ts(x)` folder, grouped by layer (ADR-0003):
  the gateway/mapper/keys in `infrastructure/`, the query hook in
  `application/`, pages/components/plugin/filter-fields/messages in
  `presentation/`, and the shared view types in `types/` (`camelCase` for
  non-components).
- `presentation/pages/` stays **flat** — only `pages/<Page>/index.tsx`, never
  child component folders. Every component lives under `presentation/components/`.
  A component used only by **another component** nests inside that parent's
  folder (the cells `ActivityActionCell`/`ActivityActorCell`/`ActivitySubjectCell`
  under `components/ActivityTable/`); a component a **page** uses sits at the
  **top level** of `components/` (`ActivityTable`, `ActivityToolbar`,
  `ActivityPagination`, `ActivityEmpty`, `ActivityNoAccess`, and the shared
  `ActivityLogSkeleton`, consumed by both the page's `isPending` body and the
  lazy route's `Suspense` fallback).
- Data flows through the gateway seam: `application/useActivityLog` calls
  `httpActivityGateway` behind the `ActivityGateway` port (the sole `apiClient`
  user), never `apiClient` directly; wire→view mapping lives in
  `infrastructure/activityMapper`.
- `types/activityKinds` restates the kind strings **and** the subject types
  locally (the admin can't import the server plugins);
  `presentation/activityMessages` maps a kind → an "Action" label, a subject type
  → a readable name, and `meta` → a "Details" string — **no hardcoded action
  strings**, no central contract package. Details summaries read **one**
  descriptive field per kind rather than assuming a shared `meta` shape: media's
  payloads differ per kind by design, and the expanded row's Metadata line always
  shows the whole record anyway.
- Co-located `defineMessages` (ids `activity.<area>.<key>`); `type` over
  `interface`; design-system primitives only; a11y per the `accessibility` skill.

## Commands

- `npx nx typecheck @orthacms/activity-admin` / `npx nx lint @orthacms/activity-admin`
- `npx nx e2e admin-e2e -- --project=chromium` — exercises `/activity` in a browser.
