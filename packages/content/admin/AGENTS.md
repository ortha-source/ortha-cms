# @ortha-cms/content-admin

The **Content Library feature plugin** for the Ortha CMS admin UI. It is the
admin counterpart to `@ortha-cms/content-server` (which owns the content
registry, schema, and `CONTENT_CATALOG`). It mounts **inside a workspace** at
`/workspaces/:id/content/*` and ships the library's **landing + navigation
shell**: a second sidebar listing the workspace's content types, a ⌘K search
palette, and pin-to-favorite. The per-type entry list/editor is a later
milestone — selecting a type today shows a placeholder header + "entries coming
soon".

## Layout (the second sidebar)

`ContentLibraryPage` owns a two-pane layout inside the shell's content area
(beside the 56px workspace rail): a sticky **`ContentSidebar`** on the left and
an outlet driven by nested routes on the right (`index` → `ContentWelcome`,
`:typeName` → `ContentTypeView`). The sidebar splits types via
`groupContentTypes` into **collapsible** groups — **Favorites** (shown only when
something is pinned), **Collections** (`kind: 'collection'`), **Pages**
(`kind: 'single'`) — built on the design-system `Collapsible`. Each row links to
its type and carries a pin toggle. The **`ContentSearchDialog`** is a
`CommandDialog` (cmdk) palette opened from the sidebar's search trigger or the
global ⌘K / Ctrl+K shortcut (owned by the page).

## Data + favorites

- `useContentTypes` (`src/lib/api/useContentTypes/`) reads the registry's source
  of truth, **`GET /api/content-schema`** — **not** the workspace wizard's
  `/api/content-types` mock. Gated on `content:read` (the rail item carries the
  same `permission`).
- **Scoped to the workspace.** The schema list is global, so the page filters it
  to the open workspace's granted content slugs — `Workspace.content` from
  `@ortha-cms/workspaces-admin` (surfaced by `GET /api/workspaces`, sourced from
  the `workspace_content` grants written by the create wizard). Only related
  collections/pages show; an ungranted `:typeName` renders the not-found state.
- `useContentFavorites` (`src/lib/hooks/useContentFavorites/`) persists pinned
  type-names in `localStorage`, **keyed per workspace** (`ortha:content:
favorites:<workspaceId>`), with guarded reads/writes. There is no favorites
  server yet — that is the planned migration point.
- The design-system `command` + `collapsible` primitives this plugin relies on
  were added there via the shadcn skill (consumed from `@ortha-cms/design-system`).

## Package

- Name: `@ortha-cms/content-admin`
- Import: `import { ContentPlugin } from '@ortha-cms/content-admin'`
- Grouped package (`packages/content/admin`), admin-only. Consumed from source
  (`exports` → `./src/index.ts`); no build step.
- Register it in `createAdmin({ plugins })` **after** `WorkspacesPlugin()` — it
  contributes only to the workspace shell's slots
  (`WORKSPACE_SIDEBAR_SLOT` + `WORKSPACE_ROUTE_SLOT`), which `WorkspacesPlugin`
  owns, so it depends on `@ortha-cms/workspaces-admin`.

## Lives strictly inside a workspace

This plugin contributes **no top-level route and no top-toolbar nav item**. It
adds a `Library` rail button (`order: 10`, first) and a `content/*` route to the
workspace shell — so it only ever renders under `/workspaces/:id/content`. The
page reads the open workspace via `useCurrentWorkspace()` from
`@ortha-cms/workspaces-admin`.

## Conventions

Follows the workspaces-admin conventions: `type` over `interface`; JSDoc on
exports; `<name>/index.ts(x)` folders (pages in `src/lib/pages/<Name>/`, the
factory in `src/lib/utils/contentPlugin/`); co-located `react-intl` messages
namespaced `content.<area>.<key>`; UI from `@ortha-cms/design-system` only.

## Commands

- `npm exec nx typecheck @ortha-cms/content-admin`
- `npm exec nx lint @ortha-cms/content-admin`
