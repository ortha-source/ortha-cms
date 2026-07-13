# @ortha-cms/insights-admin

The **Insights feature plugin** for the Ortha CMS admin UI. Today it ships a
scaffold: a rail button + placeholder page mounted **inside a workspace**; the
real dashboards/analytics land later. No server package yet — it will gain
`@ortha-cms/insights-server` once there are metrics to serve.

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
