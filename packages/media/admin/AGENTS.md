# @ortha-cms/media-admin

The **Media Library feature plugin** for the Ortha CMS admin UI. Today it ships
a scaffold: a rail button + placeholder page mounted **inside a workspace**; the
real asset browser/upload experience lands later. No server package yet — it
will gain `@ortha-cms/media-server` once there are assets to serve.

## Package

- Name: `@ortha-cms/media-admin`
- Import: `import { MediaPlugin } from '@ortha-cms/media-admin'`
- Grouped package (`packages/media/admin`), admin-only. Consumed from source
  (`exports` → `./src/index.ts`); no build step.
- Register it in `createAdmin({ plugins })` **after** `WorkspacesPlugin()` — it
  contributes only to the workspace shell's slots
  (`WORKSPACE_SIDEBAR_SLOT` + `WORKSPACE_ROUTE_SLOT`), so it depends on
  `@ortha-cms/workspaces-admin`.

## Lives strictly inside a workspace

This plugin contributes **no top-level route and no top-toolbar nav item**. It
adds an `Image` rail button (`order: 20`) and a `media/*` route to the workspace
shell — so it only ever renders under `/workspaces/:id/media`. The page reads
the open workspace via `useCurrentWorkspace()` from
`@ortha-cms/workspaces-admin`.

## Conventions

Follows the workspaces-admin conventions: `type` over `interface`; JSDoc on
exports; `<name>/index.ts(x)` folders (pages in `src/lib/pages/<Name>/`, the
factory in `src/lib/utils/mediaPlugin/`); co-located `react-intl` messages
namespaced `media.<area>.<key>`; UI from `@ortha-cms/design-system` only.

## Commands

- `npm exec nx typecheck @ortha-cms/media-admin`
- `npm exec nx lint @ortha-cms/media-admin`
