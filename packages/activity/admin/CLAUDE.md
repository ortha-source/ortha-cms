# @ortha-cms/activity-admin

The audit-log **admin plugin**: the global **Activity Log** page at `/activity`
and its toolbar nav entry. Mirrors the Members page patterns.

## What it owns

- The private `/activity` route (lazy + `<Suspense>`), rendered in the shell's
  authenticated layout.
- A `NAVBAR_START_SLOT` entry (`order: 35`, after Members) carrying
  `permission: 'activity:read'`, so the entry is **hidden** for users who lack
  it (the shell's `NavbarNavButton` honors the new optional `permission` field).
  The page itself also gates on `useHasPermission('activity:read')`.

## The page

`ActivityLogPage` — `Container`/`ContainerHeader`, a filter toolbar (action/kind
select + actor-email search), the **When · Actor · Action · Subject** table with
**expandable rows** (a leading toggle reveals a details panel — subject, actor,
exact time, raw metadata — animated via a grid-rows `0fr↔1fr` transition,
`inert` when collapsed, reduced-motion aware), pagination, and a loading
**skeleton** (`ActivityLogSkeleton`, used for both the lazy fallback and
`isPending`) plus empty/error/no-access states. The **URL query string is the
source of truth** for every filter and page (deep-linkable); `page` is clamped
to `pageCount` after a filter narrows the result.

## Conventions

- Per-hook data layer: `api/useActivityLog/` (its own request fn + envelope
  type), shared `utils/activityKeys` + `utils/toActivityEvent` (wire→model).
- `utils/activityKinds` restates the kind strings locally (the admin can't
  import the server plugins), driving the kind filter; `utils/activityMessages`
  maps a kind → an "Action" label and `meta` → a "Details" string — **no
  hardcoded action strings**, no central contract package.
- Co-located `defineMessages` (ids `activity.<area>.<key>`); `type` over
  `interface`; design-system primitives only; a11y per the `accessibility` skill.

## Commands

- `npx nx typecheck @ortha-cms/activity-admin` / `npx nx lint @ortha-cms/activity-admin`
- `npx nx e2e admin-e2e -- --project=chromium` — exercises `/activity` in a browser.
