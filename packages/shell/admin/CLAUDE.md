# @ortha-cms/shell-admin

The **shell plugin** for the Ortha CMS admin UI — the authenticated app chrome.
It contributes the layout (logo + primary nav) that wraps every private route,
plus the home page at `/`. It is the visible counterpart to the host's auth
gating: the host mounts this plugin's `layout` as the single guarded parent of
all non-`public` routes, so the shell renders only for signed-in users.

## Package

- Name: `@ortha-cms/shell-admin`
- Import: `import { ShellPlugin } from '@ortha-cms/shell-admin'`
- Grouped package (`packages/shell/admin`), admin-only. Consumed from source
  (`exports` → `./src/index.ts`); no build step.

## Key exports

- `ShellPlugin()` — factory returning an `AdminPlugin` with `layout` (the
  `AppShell`) and the private `/` home route. Register it in
  `createAdmin({ plugins })`, after `IdentityPlugin()`.
- `ShellAdminPlugin` — the plugin shape (thin alias of `AdminPlugin`).
- `AppShell` — the authenticated layout; renders nav + `<Outlet/>`.
- `HomePage` — the placeholder home page (a real dashboard lands later).

## Architecture

- **Layout, not guard.** The host (`@ortha-cms/bootstrap-admin`) owns the
  public/private split and the `RequireAuth` gate; this plugin only provides the
  *chrome* via `layout`. The host wraps that layout in `RequireAuth` and nests
  every private route under it, so private pages render inside `AppShell`'s
  `<Outlet/>` and share one auth check.
- **Private by default.** The home route carries no `public` flag, so it is
  gated like any other private route. Public screens (sign-in) come from the
  identity plugin and sit outside the shell.

## Conventions

- `type` over `interface`; JSDoc on exports; `import type` for type-only imports
- Components in `src/lib/components/<Name>/`; pages in `src/lib/pages/<Name>/`;
  the plugin factory in `src/lib/utils/`
- User-facing strings go through `react-intl` (`defineMessages` + `useIntl`),
  co-located in the component file; ids namespaced `shell.<area>.<key>`
- UI is built from `@ortha-cms/design-system` components, not bespoke markup

## Commands

- `npm exec nx typecheck @ortha-cms/shell-admin`
- `npm exec nx lint @ortha-cms/shell-admin`
