# @ortha-cms/identity-admin

The identity **plugin** for the Ortha CMS admin UI — the admin-side counterpart
to [`@ortha-cms/identity-server`](../server/CLAUDE.md). It contributes the
identity screens into the admin host. Today it ships the **login UI** at
`/identity/signin`, wired to `POST /api/auth/login` (via `useLoginMutation`);
a successful sign-in navigates to `/`. User/role/access screens and the rest of
auth (current-user gating, logout) land in later tickets (epic #3).

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
- **File naming.** Components are `PascalCase` (`<Name>/index.tsx` or
  `<Name>.tsx`); everything else is `camelCase`, and a hook file is named for its
  hook (`useLoginMutation.ts`, `useLoginSchema.ts`). One concern per file — don't
  split a presentational page from its tiny route container; the page _is_ the
  container (see `LoginPage`)
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
- `IdentityRouter` — the plugin's nested router (auth sub-routes)
- `LoginPage` / `LoginForm` / `AuthLayout` — the login UI pieces
- `LoginCredentials` / `AuthTokens` — auth wire types

## Architecture

- **Plugin, not an app.** Mirrors the server side: exposes `IdentityPlugin()`
  returning the standard
  [`AdminPlugin`](../../bootstrap/admin/src/lib/types/admin-plugin.ts) shape,
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
- **API layer.** `src/lib/api/useLoginMutation.ts` holds the `fetch` request
  (`login`, throwing a typed `LoginError`) and wraps it in a TanStack Query
  `useMutation`. The `QueryClient` is provided by the host, not here. The cookie
  is reached same-origin via the admin dev proxy (`/api` → the API).
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

- Current-user gating (`/api/auth/me`), logout, and route guards — login itself
  is wired; the rest of auth state lands with the host's slot system / epic #3
- User/role/access screens and their data fetching
- Nav items and slot wiring — added with the host's slot system

## Commands

- `npm exec nx typecheck @ortha-cms/identity-admin`
- `npm exec nx lint @ortha-cms/identity-admin`
