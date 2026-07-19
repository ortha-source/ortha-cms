# @ortha-cms/insights-admin

The **Insights feature plugin** for the Ortha CMS admin UI. Today it ships a
scaffold: a rail button + placeholder page mounted **inside a workspace**; the
real dashboards/analytics land later. No server package yet — it will gain
`@ortha-cms/insights-server` once there are metrics to serve.

## Layout — born layered (ADR-0003)

This is a static scaffold today (a page + the plugin factory), so it has **no**
layer folders yet — deliberately, per ADR-0003 (don't force empty layers onto a
placeholder). When real dashboards land, it is **born layered**: on the admin
side copy `packages/users/admin` (gateway port + mapper ACL + query hooks — a
dashboard has no client domain rules, so no `domain/` layer, just infrastructure
+ presentation). When `@ortha-cms/insights-server` is created it is naturally a
**read-side/CQRS** context — **projection subscribers** on the outbox dispatcher
(folding `entry.*`/`member.*`/`workspace.*` domain events into count/timeline
tables) + thin query services, **no aggregates** (mirror how `activity` consumes
the outbox). Correctness lives in the pure fold functions, unit-tested.

## Package

- Name: `@ortha-cms/insights-admin`
- Import: `import { InsightsPlugin } from '@ortha-cms/insights-admin'`
- Grouped package (`packages/insights/admin`), admin-only. Consumed from source
  (`exports` → `./src/index.ts`); no build step.
- Register it in `createAdmin({ plugins })` **after** `WorkspacesPlugin()` — it
  contributes only to the workspace shell's slots
  (`WORKSPACE_NAV_SLOT` + `WORKSPACE_ROUTE_SLOT`), so it depends on
  `@ortha-cms/workspaces-admin`.

## Lives strictly inside a workspace

This plugin contributes **no top-level route and no global nav item**. It adds a
`BarChart3` "Workspace" nav entry (`order: 30`) and an `insights/*` route to the
workspace shell — so it only ever renders under `/workspaces/:id/insights`. The
page reads the open workspace via `useCurrentWorkspace()` from
`@ortha-cms/workspaces-admin`.

## Conventions

Follows the workspaces-admin conventions: `type` over `interface`; JSDoc on
exports; `<name>/index.ts(x)` folders (pages in `src/lib/pages/<Name>/`, the
factory in `src/lib/utils/insightsPlugin/`); co-located `react-intl` messages
namespaced `insights.<area>.<key>`; UI from `@ortha-cms/design-system` only.

## Commands

- `npm exec nx typecheck @ortha-cms/insights-admin`
- `npm exec nx lint @ortha-cms/insights-admin`
