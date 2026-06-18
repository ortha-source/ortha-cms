# @ortha-cms/identity-admin

The identity **plugin** for the Ortha CMS admin UI — the admin-side counterpart
to [`@ortha-cms/identity-server`](../server/CLAUDE.md). It contributes the
identity screens into the admin host. It ships the **login UI** at
`/identity/signin` (wired to `POST /api/auth/login` via `useLoginMutation`) and
**owns the entire admin auth kit**: the auth context (`AuthState`, `useAuth`,
`AuthProviderContext`), the `AuthProvider` that fetches `GET /api/auth/me`
(`useCurrentUser`) and publishes the current user, and the `RequireAuth` route
gate. None of these are contributed to the host via a slot — the host is
auth-agnostic; the **shell** (`@ortha-cms/shell-admin`) imports `AuthProvider` +
`RequireAuth` and composes them into its `layout`. A successful sign-in refreshes
that state and returns the user to where `RequireAuth` sent them (or `/`). The
plugin's only `bootstrap-admin` reference is the `AdminPlugin` *type*.
User/role/access screens and logout land in later tickets (epic #3).

## Package

- Name: `@ortha-cms/identity-admin`
- Import: `import { IdentityPlugin } from '@ortha-cms/identity-admin'`
- Grouped package (`packages/identity/admin`), admin-only. Consumed from source
  like the other workspace packages (`exports` → `./src/index.ts`,
  `customConditions: ["@ortha-cms/source"]`); the admin app's Vite transpiles it
  directly.

## Conventions

- Uses `type` for type contracts (not `interface`) — matches the admin host
- All exported symbols have JSDoc comments
- No `.js` extensions in TypeScript imports
- JSX enabled (`react-jsx`), DOM types available
- Components in `src/lib/components/<Name>/`; pages in `src/lib/pages/<Name>/`;
  the data layer (hooks + request fns) in `src/lib/api/`; the nested router in
  `src/lib/router/`; the plugin factory in `src/lib/utils/`; types in `src/types/`
- **File naming.** Every top-level module lives in its own folder as
  `<name>/index.ts(x)` — components in `PascalCase` (`LoginForm/index.tsx`),
  everything else in `camelCase` named for its export
  (`useLoginMutation/index.ts`, `authContext/index.ts`, `identityPlugin/index.tsx`,
  `types/auth/index.ts`). Tightly co-located sub-modules of a component may stay
  flat beside its `index` (e.g. `LoginForm/useLoginSchema.ts`). One concern per
  file — don't split a presentational page from its tiny route container; the
  page _is_ the container (see `LoginPage`)
- User-facing strings go through `react-intl` (`defineMessages` + `useIntl`);
  the host provides the single `IntlProvider`. **Each component co-locates its
  own descriptors** — a module-level `const messages = defineMessages({ … })`
  at the top of the component file, not a shared `messages.ts`. Keep the
  `id`s namespaced (`identity.<area>.<key>`) so they stay globally unique
  across components
- Forms use `@tanstack/react-form`
- Always import types with the `type` keyword

## Key exports

- `IdentityPlugin()` — factory returning an `AdminPlugin`; register it in
  `createAdmin({ plugins })`. Named to mirror the server's `IdentityPlugin`
  (the two never share a module — different apps).
- `IdentityAdminPlugin` — the plugin shape (currently a thin alias of
  `AdminPlugin`)
- `IdentityRouter` — the plugin's nested router (auth sub-routes); lazy-loads
  `LoginPage` behind a `Suspense` boundary so its chunk loads only at
  `/identity/signin`
- `LoginForm` / `AuthLayout` — the login UI pieces. `LoginPage` is **not**
  re-exported: it is consumed only via the router's dynamic `import()`, and a
  static re-export would defeat the code split
- `AuthProvider` — fetches `/api/auth/me` and publishes auth state; the shell
  wraps it around `RequireAuth` in its `layout`
- `RequireAuth` — the route gate; redirects to `/identity/signin` while
  unauthenticated, preserving the attempted location for return-to. Reusable by
  any plugin that needs to gate its own sub-routes (imported from here, not the
  host)
- `useHasPermission(permission)` — whether the signed-in user holds a permission key
  (from `/auth/me`); fail-closed while loading. Gate permission-aware UI with it
  (e.g. the workspaces "New workspace" button on `workspaces:create`)
- `useAuth` — reads the current `AuthState`; `AuthState` / `AuthUser` are the
  types
- `useLogoutMutation` — `POST /api/auth/logout` then invalidates
  `currentUserKey`, so the gate flips to unauthenticated and redirects to
  sign-in. Used by the toolbar account menu (`users-admin`)
- `LoginCredentials` / `AuthTokens` / `CurrentUser` — auth wire types

## Architecture

- **Plugin, not an app.** Mirrors the server side: exposes `IdentityPlugin()`
  returning the standard
  [`AdminPlugin`](../../bootstrap/admin/src/lib/types/adminPlugin/index.ts) shape,
  assembled by the host in `apps/admin/src/main.tsx`.
- **Nested routing.** The plugin contributes one wildcard route `/identity/*`
  whose element is `IdentityRouter`, a `react-router-dom` `<Routes>` that owns
  the sub-paths (`signin`, with `/identity` → `/identity/signin`). New auth
  pages (signup, invite) are added inside that router, not the host.
- **Presentation vs. container.** `LoginForm` is presentation only: it manages
  field state with TanStack Form and delegates submission to an
  `onSubmit(credentials)` prop, with `isPending`/`error` props driving the button
  and alert — **no `fetch`/mutation lives in the form**. `LoginPage`
  (`pages/LoginPage/index.tsx`) is the route container the router mounts: it runs
  `useLoginMutation`, maps its `isPending`/`error` onto the form, and navigates
  to `/` on success.
- **API layer.** `src/lib/api/useLoginMutation/index.ts` issues the request via the
  shared `apiClient` from
  [`@ortha-cms/utils-admin`](../../utils/admin/CLAUDE.md)
  (`apiClient.post('/auth/login', …)`) and wraps it in a TanStack Query
  `useMutation`. Failures are normalized to that library's `ApiError`
  (`toApiError`); `LoginPage` maps `error.status === HTTP_STATUS.UNAUTHORIZED` to
  the invalid-credentials message. `apiClient`/`queryClient` live in the shared
  library (the host mounts the query provider). The cookie is reached same-origin
  via the admin dev proxy (`/api` → the API).
- **Design system.** UI is built from `@ortha-cms/design-system` components
  (`Card`, `Alert`, `Input`, `Field*`, `Button`, `Logo`), not bespoke markup.

## Usage

```typescript
// apps/admin/src/main.tsx
import { createAdmin } from '@ortha-cms/bootstrap-admin';
import { IdentityPlugin } from '@ortha-cms/identity-admin';
import './styles.css';

createAdmin({
    plugins: [IdentityPlugin()]
});
```

## Not owned here (deferred)

- Mounting the gate — `RequireAuth` lives here, but it is the **shell** that
  composes it (with `AuthProvider`) into the `layout`; the public/private route
  split is the host's
- User/role/access screens and their data fetching
- Nav items and slot wiring — added with the host's slot system

## Commands

- `npm exec nx typecheck @ortha-cms/identity-admin`
- `npm exec nx lint @ortha-cms/identity-admin`
