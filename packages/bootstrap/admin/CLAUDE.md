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
  and renders plugin-contributed routes plus a catch-all redirect
- `AdminPlugin` — the plugin contract: `{ name, routes? }`
- `RouteItem` — a contributed route: `{ path, element }`
- `CreateAdminOptions` — `{ plugins, rootElement?, locale? }`

## Architecture

- **Mount + shell.** `createAdmin` is the single place the SPA is created
  (`createRoot` + `<StrictMode>` + `<QueryClientProvider>` + `<IntlProvider>` +
  `<BrowserRouter>`).
- **Plugin assembly.** It flattens every plugin's `routes` into one `<Routes>`
  tree, then adds a `*` catch-all that redirects to `/`.
- **Data.** The host owns the single TanStack Query `QueryClient`. Plugins fetch
  server state with `useQuery`/`useMutation` (e.g. identity's
  `useLoginMutation`) and never construct a client of their own.
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

- Auth guards / current-user gating, nav items, slot system
- Providers beyond the router, `IntlProvider`, and `QueryClientProvider`
  (e.g. Toaster) — add when a plugin requires them
- Actual pages — those live in feature plugins

## Commands

- `npm exec nx typecheck @ortha-cms/bootstrap-admin`
- `npm exec nx build @ortha-cms/bootstrap-admin`
