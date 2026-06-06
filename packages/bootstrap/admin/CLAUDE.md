# @ortha-cms/bootstrap-admin

The admin-side **host** for the Ortha CMS. Turns a list of plugins into a
running React SPA. Owns the mount + router shell that must exist exactly once;
contains no features.

## Package

- Name: `@ortha-cms/bootstrap-admin`
- Import: `import { createAdmin, type AdminPlugin } from '@ortha-cms/bootstrap-admin'`
- Admin-only. Consumed from source; the admin app's Vite transpiles it directly.
- Lives at `packages/bootstrap/admin` (grouped layout); npm name stays
  hyphenated.

## Conventions

- Uses `type` for type contracts (not `interface`)
- All exported symbols have JSDoc comments
- No `.js` extensions in TypeScript imports
- JSX enabled (`react-jsx`), DOM types available
- Types go in `src/lib/types/`; the bootstrap entry in `src/lib/`
- Always import types with the `type` keyword

## Key exports

- `createAdmin(options)` — mounts the React root, wraps it in `BrowserRouter`,
  splits routes into public siblings + a single guarded private group, and
  renders a catch-all redirect
- `AdminPlugin` — the plugin contract: `{ name, routes?, provider?, layout? }`
- `RouteItem` — a contributed route: `{ path, element, public? }`
- `CreateAdminOptions` — `{ plugins, rootElement?, locale?, signInPath? }`
- `RequireAuth` — gate component the host mounts as the private group's parent;
  redirects to `signInPath` while unauthenticated
- `useAuth` / `AuthProviderContext` — the auth-state slot: a source plugin
  (identity) publishes `AuthState` via `AuthProviderContext`; the host reads it
  with `useAuth`. `AuthState` / `AuthUser` are the types

## Architecture

- **Mount + shell.** `createAdmin` is the single place the SPA is created
  (`createRoot` + `<StrictMode>` + `<QueryClientProvider>` + `<IntlProvider>` +
  `<BrowserRouter>`).
- **Plugin assembly.** It flattens every plugin's `routes`, then splits them by
  the `public` flag: public routes mount as top-level siblings, while every
  other route mounts under one pathless parent route guarded by `RequireAuth`.
  That parent renders the authenticated shell — the first plugin-provided
  `layout`, or a bare `<Outlet/>` — so all private pages share one auth check and
  one chrome. The `*` catch-all (→ `/`) lives inside the private group.
- **Auth gating, not auth.** The host owns the public/private *structure* and the
  `RequireAuth` gate, but not how "current user" is known. A source plugin
  (identity) supplies that via the `provider` slot, publishing `AuthState`
  through `AuthProviderContext` — mirroring the server, where `bootstrap-server`
  is generic and the identity plugin registers the `APP_GUARD`.
- **Data.** The `QueryClient` and the axios `apiClient` live in
  [`@ortha-cms/utils-admin`](../../utils/admin/CLAUDE.md), a shared leaf library.
  The host only imports `queryClient` to mount `<QueryClientProvider>`; plugins
  import `apiClient`/`queryClient` from there directly. Keeping these out of the
  host means a plugin never depends on the composition root just to make a
  request — the host stays purely the app shell.
- **i18n.** The host owns the single `react-intl` `IntlProvider` (`locale`
  defaults to `en`; messages resolve from each descriptor's `defaultMessage`).
  Plugins author strings with `defineMessages` + `useIntl` and **co-locate
  their descriptors in the component file** (a module-level
  `const messages = defineMessages({ … })`), not a shared `messages.ts`. IDs
  are namespaced (`<plugin>.<area>.<key>`) to stay globally unique.
- The host renders no chrome of its own yet — with no plugins it serves a blank
  shell. Global styles are imported by the **app** (`main.tsx`), not the host.

## Usage

```typescript
// apps/admin/src/main.tsx
import { createAdmin } from '@ortha-cms/bootstrap-admin';
import './styles.css';

createAdmin({
    plugins: [
        // { name: 'users', routes: [{ path: '/users/*', element: <Users /> }] }
    ]
});
```

## Not owned here (deferred until a plugin needs it)

- The auth-state *source* (`/api/auth/me`, login/logout) — the host owns the
  gate (`RequireAuth`) and the `AuthProviderContext` slot; identity fills it
- The authenticated shell/chrome — contributed via a plugin's `layout`
  (see `@ortha-cms/shell-admin`); the host only mounts it
- Nav items, slot system
- Providers beyond the router, `IntlProvider`, and `QueryClientProvider`
  (e.g. Toaster) — add when a plugin requires them
- Actual pages — those live in feature plugins

## Commands

- `npm exec nx typecheck @ortha-cms/bootstrap-admin`
- `npm exec nx build @ortha-cms/bootstrap-admin`
