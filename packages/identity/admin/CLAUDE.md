# @ortha-cms/identity-admin

The identity **plugin** for the Ortha CMS admin UI — the admin-side counterpart
to [`@ortha-cms/identity-server`](../server/CLAUDE.md). It contributes the
identity-management screens (users, roles, access) into the admin host. Today it
is a **scaffold**: a single placeholder route. The real screens land in later
tickets (epic #3).

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
- Pages go in `src/lib/pages/`; the plugin factory in `src/lib/utils/`; types in
  `src/lib/types/`
- Always import types with the `type` keyword

## Key exports

- `IdentityPlugin()` — factory returning an `AdminPlugin`; register it in
  `createAdmin({ plugins })`. Named to mirror the server's `IdentityPlugin`
  (the two never share a module — different apps).
- `IdentityAdminPlugin` — the plugin shape (currently a thin alias of
  `AdminPlugin`)
- `IdentityPage` — the placeholder landing page

## Architecture

- **Plugin, not an app.** Mirrors the server side: exposes `IdentityPlugin()`
  returning the standard
  [`AdminPlugin`](../../bootstrap/admin/src/lib/types/admin-plugin.ts) shape,
  assembled by the host in `apps/admin/src/main.tsx`.
- **Routes only, for now.** The plugin contributes a single `/identity` route.
  Nav items, slots, and auth gating arrive with the host's slot system.
- **Design system.** UI is built from `@ortha-cms/design-system` components
  (e.g. `Button`), not bespoke markup.

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

- Actual user/role/access screens, forms, and data fetching
- API client / auth state — added when the login ticket (#8) lands
- Nav items and slot wiring — added with the host's slot system

## Commands

- `npm exec nx typecheck @ortha-cms/identity-admin`
- `npm exec nx lint @ortha-cms/identity-admin`
