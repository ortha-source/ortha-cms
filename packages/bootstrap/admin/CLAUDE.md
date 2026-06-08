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
- Types go in `src/lib/types/<name>/index.ts`; the bootstrap entry in
  `src/lib/createAdmin/index.tsx`. Every module is a `<name>/index.ts(x)` folder
  (`camelCase` for non-components)
- Always import types with the `type` keyword

## Key exports

- `createAdmin(options)` — mounts the React root, wraps it in `BrowserRouter`,
  splits routes into public siblings + a single private group under the
  contributed `layout`, and renders a catch-all redirect
- `AdminPlugin` — the plugin contract: `{ name, routes?, layout? }`
- `RouteItem` — a contributed route: `{ path, element, public? }`
- `CreateAdminOptions` — `{ plugins, rootElement?, locale? }`

The host is **auth-agnostic** — it owns no `RequireAuth`, no auth context, no
`signInPath`. Authentication (state + gate) lives entirely in
[`@ortha-cms/identity-admin`](../../identity/admin/CLAUDE.md); the shell composes
identity's `AuthProvider` + `RequireAuth` inside the `layout` it contributes.

## Architecture

- **Mount + shell.** `createAdmin` is the single place the SPA is created
  (`createRoot` + `<StrictMode>` + `<QueryClientProvider>` + `<IntlProvider>` +
  `<TooltipProvider>` + `<BrowserRouter>`).
- **Plugin assembly.** It flattens every plugin's `routes`, then splits them by
  the `public` flag: public routes mount as top-level siblings, while every
  other route mounts under one pathless parent route whose element is the first
  plugin-provided `layout` (or a bare `<Outlet/>`). All private pages render in
  that layout's outlet; the `*` catch-all (→ `/`) lives inside the group.
- **Auth-agnostic by design.** The host attaches no auth meaning to the
  public/private split — it only knows "private routes render under the
  `layout`." Whether the layout *gates* them is the layout's business: the shell
  wraps its chrome in identity's `AuthProvider` + `RequireAuth`. So a `public:false`
  route with no gating `layout` renders **ungated** (fail-open) — the host does
  not guarantee a gate. This keeps the host free of any auth code; the trade is
  that gating is an application choice (the shell opts in), not a host guarantee.
- **Data.** The `QueryClient` and the axios `apiClient` live in
  [`@ortha-cms/utils-admin`](../../utils/admin/CLAUDE.md), a shared leaf library.
  The host only imports `queryClient` to mount `<QueryClientProvider>`; plugins
  import `apiClient`/`queryClient` from there directly. Keeping these out of the
  host means a plugin never depends on the composition root just to make a
  request — the host stays purely the app shell.
- **Slots.** The plugin contract carries an optional `slots` — each a
  `{ slot, items }` contribution to a `createSlot` extension point (the primitive
  lives in `@ortha-cms/utils-admin`). Before render, `createAdmin` wires every
  plugin's contributions into their target slots (`slot._register(items)`). The
  host is **slot-agnostic**: it only wires; it never defines or reads a slot. A
  consuming plugin owns each concrete slot (e.g. the shell owns the toolbar's
  `NAVBAR_START_SLOT` and reads it in its `layout`).
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

- Anything auth — state, gate, and `/api/auth/me` all live in
  `@ortha-cms/identity-admin`; the host never imports them
- The authenticated shell/chrome — contributed via a plugin's `layout`
  (see `@ortha-cms/shell-admin`); the host only mounts it
- Concrete slots & nav items — the host wires `slots` contributions but defines
  none; the shell owns the toolbar's `NAVBAR_START_SLOT` and its nav items
- Providers beyond the router, `IntlProvider`, `QueryClientProvider`, and
  `TooltipProvider` (e.g. Toaster) — add when a plugin requires them
- Actual pages — those live in feature plugins

## Commands

- `npm exec nx typecheck @ortha-cms/bootstrap-admin`
- `npm exec nx build @ortha-cms/bootstrap-admin`
