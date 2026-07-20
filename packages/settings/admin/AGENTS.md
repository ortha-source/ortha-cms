# @ortha-cms/settings-admin

The admin-side **account settings** plugin. It owns the current user's
self-service settings area — today a single **Preferences** tab where the user
picks the admin colour theme (Light / Dark / System) — and the app-wide theme
hydration that keeps that choice in effect everywhere.

Import as `import { SettingsPlugin } from '@ortha-cms/settings-admin'`.

## What it contributes

- **Route** `/settings/*` (private) → a nested tab router (`SettingsRouter`)
  wrapped in a shared layout (`PageTopBar` + header + `TabNav`). The index
  redirects to `preferences`; unknown sub-paths fall back there. Authored as
  nested routes so more account-settings tabs slot in beside Preferences without
  touching the plugin factory.
- **`SIDEBAR_SECTION_SLOT` item** `settings.themeSync` → the invisible
  `ThemeSync` (renders `null`). It hydrates the signed-in user's saved theme
  from the server into the design-system `AppearanceProvider` on load. It lives
  in a slot because that is the simplest always-mounted, authenticated host for
  its effect.

The **entry point** is the account menu (`@ortha-cms/users-admin`), whose
"Preferences" item links to `/settings/preferences`. This plugin adds no nav
item of its own.

## How theming works (the seam)

- The **`AppearanceProvider`** (design-system, mounted by the host in
  `createAdmin`) is the app-wide source of truth: it toggles the `.dark` class on
  `<html>`, resolves `system` against `prefers-color-scheme`, and persists to
  `localStorage` for an instant, flash-free first paint (a matching bootstrap
  script lives in `apps/admin/index.html`).
- The **server** (`user_preferences` table + `GET`/`PUT /api/preferences` in
  `@ortha-cms/identity-server`) is the durable, cross-device copy.
- `ThemeSync` reconciles the two on load (server → provider); the
  **PreferencesPage** writes both on change — `setTheme` (instant) +
  `useUpdateTheme` (persist), rolling back the visible choice if the save fails.

## Self-service, no RBAC

Every route reads and writes the **current** user's own preferences, keyed off
the session (`@CurrentUser()` server-side), so there is no permission to gate —
everyone owns their own settings.

## Layout

- Plugin factory → `src/lib/settingsPlugin/index.tsx`
- Data hooks → `src/lib/application/*` (each owns its `apiClient` request fn);
  wire types + query key → `src/lib/application/preferences/types.ts`
- Components → `src/lib/components/*` (`SettingsRouter`, `SettingsTabs`,
  `ThemeSync`)
- Pages → `src/lib/pages/*` (`PreferencesPage` + its `ThemePreview`)

## Conventions

- `type` over `interface`; JSDoc on exports; `import type` for type-only imports
- User-facing strings via `react-intl` (`defineMessages` + `useIntl`),
  co-located in the component file; ids namespaced `settings.<area>.<key>`
- UI is built from `@ortha-cms/design-system` components
- Register after `ShellPlugin()` in `createAdmin({ plugins })` so the sidebar
  section slot exists.

## Commands

- `npm exec nx typecheck @ortha-cms/settings-admin`
- `npm exec nx lint @ortha-cms/settings-admin`
