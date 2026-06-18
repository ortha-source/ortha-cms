# apps/admin

The admin **UI** — a React 19 + Vite SPA. This app is a thin entry point: it
holds almost no logic. It assembles the product by handing a list of **admin
plugins** to the `@ortha-cms/bootstrap-admin` host.

## What's here

- `src/main.tsx` — the **plugin registry**. Adding a feature to the admin means
  registering its `AdminPlugin` here. This is the file you edit most.
- Vite config, HTML entry, app-level wiring. No domain logic.

## How it fits

- The host (`createAdmin({ plugins })`) mounts the React root, router, and
  providers (TanStack Query, `IntlProvider`), then mounts each plugin's routes,
  layout, and slot contributions.
- Workspace packages resolve **from source** — Vite transpiles plugin/design-
  system source directly; no build step to consume them.

## Working here

- Authoring or changing an admin plugin is governed by the **`admin-plugin`**
  skill (module layout, lazy routes, per-hook TanStack Query data layer,
  `useHasPermission` gating, co-located `react-intl` messages).
- UI must meet WCAG 2.1 AA — see the **`accessibility`** skill.
- E2E coverage lives in `apps/admin-e2e` (Playwright POM, `/api` mocked) — see
  the **`admin-e2e`** skill.
- Common front-end traps: `.cursor/BUGBOT.md` (Admin section).

See [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) for the full picture.
