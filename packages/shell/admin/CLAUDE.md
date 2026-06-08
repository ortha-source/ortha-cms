# @ortha-cms/shell-admin

The **shell plugin** for the Ortha CMS admin UI — the authenticated app chrome.
It contributes the layout (logo + primary nav) that wraps every private route,
plus the home page at `/`. It **owns the gating wiring**: its `layout` composes
identity's `AuthProvider` (auth-state source) around `RequireAuth` (the gate)
around `AppShell`. The host mounts that `layout` as the single parent of all
non-`public` routes but stays auth-agnostic — so the shell is what makes private
routes render only for signed-in users.

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

- **Layout *and* gate.** The host (`@ortha-cms/bootstrap-admin`) owns only the
  public/private split and mounts the `layout` as the parent of private routes —
  it is auth-agnostic. This plugin makes the layout gated by composing identity's
  pieces: `<AuthProvider><RequireAuth><AppShell/></RequireAuth></AuthProvider>`.
  So `AuthProvider` (the `/auth/me` source) and `RequireAuth` (the gate) wrap the
  private subtree; private pages render in `AppShell`'s `<Outlet/>` behind one
  check. This is why the shell **depends on `@ortha-cms/identity-admin`**.
- **Private by default.** The home route carries no `public` flag, so it mounts
  under the gated layout. Public screens (sign-in) come from the identity plugin
  and sit outside the shell.

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
