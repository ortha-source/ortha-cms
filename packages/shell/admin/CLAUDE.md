# @ortha-cms/shell-admin

The **shell plugin** for the Ortha CMS admin UI — the authenticated app chrome.
It contributes the layout (a top toolbar: logo + slot-driven nav) that wraps
every private route, the home page at `/`, and placeholder Workspaces/Users
pages. It **owns the gating wiring**: its `layout` composes identity's
`AuthProvider` (auth-state source) around `RequireAuth` (the gate) around
`AppShell`. The host mounts that `layout` as the single parent of all
non-`public` routes but stays auth-agnostic — so the shell is what makes private
routes render only for signed-in users.

It also **owns the toolbar's `NAVBAR_START_SLOT`** — a `createSlot` extension point
(primitive from `@ortha-cms/utils-admin`). `AppShell` reads it (sorted by
`order`) to render nav buttons; any plugin contributes entries via its `slots`,
so new nav items appear without editing the shell. The shell currently
contributes Home/Workspaces/Users itself; as feature plugins land they
contribute their own and the placeholders here are removed.

## Package

- Name: `@ortha-cms/shell-admin`
- Import: `import { ShellPlugin } from '@ortha-cms/shell-admin'`
- Grouped package (`packages/shell/admin`), admin-only. Consumed from source
  (`exports` → `./src/index.ts`); no build step.

## Key exports

- `ShellPlugin()` — factory returning an `AdminPlugin` with `layout` (the
  `AppShell`), the private `/`, `/workspaces`, `/users` routes, and the toolbar
  nav-item `slots`. Register it in `createAdmin({ plugins })`, after
  `IdentityPlugin()`.
- `ShellAdminPlugin` — the plugin shape (thin alias of `AdminPlugin`).
- `AppShell` — the authenticated layout; renders the top toolbar + `<Outlet/>`.
- `HomePage` — greets the signed-in user and links to the two primary
  destinations as cards.
- `WorkspacesPage` / `UsersPage` — placeholder pages until their feature plugins
  land.
- `NAVBAR_START_SLOT` / `NavbarItem` — the leading (start-side) toolbar nav slot
  and its item type; exported so other plugins can contribute nav entries. Named
  for placement; a trailing `NAVBAR_END_SLOT` (`'shell.navbar.end'`) for
  account/actions is added when first needed.

## Architecture

- **Layout *and* gate.** The host (`@ortha-cms/bootstrap-admin`) owns only the
  public/private split and mounts the `layout` as the parent of private routes —
  it is auth-agnostic. This plugin makes the layout gated by composing identity's
  pieces: `<AuthProvider><RequireAuth><AppShell/></RequireAuth></AuthProvider>`.
  So `AuthProvider` (the `/auth/me` source) and `RequireAuth` (the gate) wrap the
  private subtree; private pages render in `AppShell`'s `<Outlet/>` behind one
  check. This is why the shell **depends on `@ortha-cms/identity-admin`**.
- **Private by default.** The routes carry no `public` flag, so they mount under
  the gated layout. Public screens (sign-in) come from the identity plugin and
  sit outside the shell.
- **Slot-driven toolbar.** `AppShell` renders `NAVBAR_START_SLOT.getItems()` sorted
  by `order`; the shell contributes its own items via `slots`. The host wires
  all plugins' contributions before render, so the toolbar is open to extension
  without the shell knowing which plugins exist. Tooltips on the icon buttons use
  the design-system `Tooltip` (the host mounts the `TooltipProvider`).

## Conventions

- `type` over `interface`; JSDoc on exports; `import type` for type-only imports
- Every module is a `<name>/index.ts(x)` folder — components in
  `src/lib/components/<Name>/`, pages in `src/lib/pages/<Name>/`, the plugin
  factory in `src/lib/utils/shellPlugin/` (`camelCase` for non-components)
- User-facing strings go through `react-intl` (`defineMessages` + `useIntl`),
  co-located in the component file; ids namespaced `shell.<area>.<key>`
- UI is built from `@ortha-cms/design-system` components, not bespoke markup

## Commands

- `npm exec nx typecheck @ortha-cms/shell-admin`
- `npm exec nx lint @ortha-cms/shell-admin`
