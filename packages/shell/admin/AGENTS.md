# @ortha-cms/shell-admin

The **shell plugin** for the Ortha CMS admin UI — the authenticated app chrome.
It contributes the layout (a **left sidebar** — `AppSidebar` — beside a `<main>`
inset) that wraps every private route, plus the home page at `/`. The sidebar is
**collapsible (offcanvas)**: an in-header trigger hides it; when collapsed (or on
mobile, where it's an overlay drawer) a floating `SidebarToggle` (fixed top-left,
no layout space) reveals it (`⌘B` also toggles). Padded `Container` pages clear
the button in their margin; the flush Content Library adds a small left gutter
when collapsed. It
**owns the gating wiring**: its `layout` composes identity's
`AuthProvider` (auth-state source) around `RequireAuth` (the gate) around
`AppShell`. The host mounts that `layout` as the single parent of all
non-`public` routes but stays auth-agnostic — so the shell is what makes private
routes render only for signed-in users.

It **owns the sidebar's slots** — all `createSlot` extension points (primitive
from `@ortha-cms/utils-admin`):

- `SIDEBAR_NAV_SLOT` — the primary nav, grouped Overview / Directory (each
  `SidebarItem` carries a `group` + `icon`). The shell contributes Home; feature
  plugins contribute the rest (Activity, Workspaces, Members).
- `SIDEBAR_SECTION_SLOT` — data-driven sections below the nav (the Workspaces
  quick-list, from `workspaces-admin`).
- `SIDEBAR_FOOTER_SLOT` — persistent footer widgets (the account menu, from
  `users-admin`).
- `HOME_SECTION_SLOT` — the home dashboard's stat tiles + panels.

`AppSidebar` reads each sorted by `order`, so new nav/sections appear without
editing the shell. There is **no top toolbar** — the old `NAVBAR_*` slots and
navbar were replaced by this sidebar.

**Dynamic contextual region.** The sidebar's middle swaps by route: `AppSidebar`
renders the global nav by default, but a descendant can take it over via
`useSidebarContent(render, deps)` (backed by `SidebarContentProvider`, which
`AppShell` mounts around the outlet). The workspace shell uses this to inject its
per-workspace nav. The footer stays persistent across both contexts.

## Package

- Name: `@ortha-cms/shell-admin`
- Import: `import { ShellPlugin } from '@ortha-cms/shell-admin'`
- Grouped package (`packages/shell/admin`), admin-only. Consumed from source
  (`exports` → `./src/index.ts`); no build step.

## Key exports

- `ShellPlugin()` — factory returning an `AdminPlugin` with `layout` (the
  `AppShell`), the private `/` route, and the sidebar nav-item `slots`. Register
  it in `createAdmin({ plugins })`, after `IdentityPlugin()`.
- `ShellAdminPlugin` — the plugin shape (thin alias of `AdminPlugin`).
- `AppShell` — the authenticated layout; renders `AppSidebar` + `<main>`
  `<Outlet/>` inside `SidebarProvider` + `SidebarContentProvider`.
- `SidebarSearch` — the sidebar's search-trigger UI (reused by the workspace
  nav; the global command palette is not yet wired).
- `HomePage` — greets the signed-in user and renders the dashboard from
  `HOME_SECTION_SLOT`.
- `SIDEBAR_NAV_SLOT` / `SidebarItem` (`{ labelId, defaultLabel, to, end?, group,
  order, icon, permission? }`) — the primary nav slot; `group` is
  `'overview' | 'directory'`.
- `SIDEBAR_SECTION_SLOT` / `SidebarSectionItem` (`{ id, order, Component }`) —
  data-driven sections below the nav.
- `SIDEBAR_FOOTER_SLOT` / `SidebarFooterItem` (`{ id, order, Component }`) — the
  persistent footer (account menu).
- `HOME_SECTION_SLOT` / `HomeSectionItem` (`{ id, region: 'stat' | 'panel',
  order, Component }`) — the home dashboard's tiles + panels.
- `useSidebarContent(render, deps)` / `SidebarContentProvider` — the mechanism a
  route uses to take over the sidebar's contextual region.

## Architecture

- **Layout _and_ gate.** The host (`@ortha-cms/bootstrap-admin`) owns only the
  public/private split and mounts the `layout` as the parent of private routes —
  it is auth-agnostic. This plugin makes the layout gated by composing identity's
  pieces: `<AuthProvider><RequireAuth><AppShell/></RequireAuth></AuthProvider>`.
  So `AuthProvider` (the `/auth/me` source) and `RequireAuth` (the gate) wrap the
  private subtree; private pages render in `AppShell`'s `<Outlet/>` behind one
  check. This is why the shell **depends on `@ortha-cms/identity-admin`**.
- **Private by default.** The routes carry no `public` flag, so they mount under
  the gated layout. Public screens (sign-in) come from the identity plugin and
  sit outside the shell.
- **Slot-driven sidebar.** `AppSidebar` renders `SIDEBAR_NAV_SLOT.getItems()`
  (grouped Overview / Directory), then `SIDEBAR_SECTION_SLOT`, then the
  persistent `SIDEBAR_FOOTER_SLOT` — each sorted by `order`. The shell
  contributes its own Home item; the host wires all plugins' contributions
  before render, so the sidebar is open to extension without the shell knowing
  which plugins exist. Built on the design-system `Sidebar` primitive.
- **Dynamic region + dashboard.** `SidebarContentProvider` (mounted in
  `AppShell` around the outlet) lets a descendant route replace the sidebar's
  contextual region via `useSidebarContent` — the workspace shell injects its
  per-workspace nav there. `HomePage` assembles the dashboard from
  `HOME_SECTION_SLOT` (stat tiles + panels) the same way.

## Conventions

- `type` over `interface`; JSDoc on exports; `import type` for type-only imports
- Every module is a `<name>/index.ts(x)` folder — components in
  `src/lib/components/<Name>/`, pages in `src/lib/pages/<Name>/`, the plugin
  factory in `src/lib/utils/shellPlugin/` (`camelCase` for non-components). A
  single-consumer, non-exported component co-locates under its consumer:
  `GlobalSidebar`, `SidebarNavButton`, and `SidebarSearch` live under
  `components/AppSidebar/` (only `AppSidebar` uses them), not in `components/`.
- User-facing strings go through `react-intl` (`defineMessages` + `useIntl`),
  co-located in the component file; ids namespaced `shell.<area>.<key>`
- UI is built from `@ortha-cms/design-system` components, not bespoke markup

## Commands

- `npm exec nx typecheck @ortha-cms/shell-admin`
- `npm exec nx lint @ortha-cms/shell-admin`
