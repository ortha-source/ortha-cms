# @ortha-cms/workspaces-admin

The **workspaces feature plugin** for the Ortha CMS admin UI. It owns the
Workspaces management experience: the private `/workspaces` route (a searchable,
status-filterable grid of workspace cards with a create flow) and its toolbar
nav entry. It replaced the placeholder the shell shipped while the feature was
pending.

## Package

- Name: `@ortha-cms/workspaces-admin`
- Import: `import { WorkspacesPlugin } from '@ortha-cms/workspaces-admin'`
- Grouped package (`packages/workspaces/admin`), admin-only. Consumed from source
  (`exports` → `./src/index.ts`); no build step.
- Register it in `createAdmin({ plugins })` **after** `ShellPlugin()` — it
  contributes its `/workspaces` route into the shell's gated layout and its nav
  item into the shell's `NAVBAR_START_SLOT` (so it depends on
  `@ortha-cms/shell-admin`).

## Key exports

- `WorkspacesPlugin()` — factory returning an `AdminPlugin`: the lazy-loaded,
  private `/workspaces` route plus the `Layers` nav item (`order: 20`, before
  Users), contributed to the shell's `NAVBAR_START_SLOT`.
- `useWorkspaces` / `workspacesKey` — TanStack Query list hook + its key.
- `useCreateWorkspace` — create mutation with optimistic insert at the top.
- `Workspace` / `WorkspaceMember` / `WorkspaceStatus` — the data model.

## Architecture

- **Reads the real API — no client module.** Following identity-admin's
  `useCurrentUser`, the data layer lives in the hooks themselves: `useWorkspaces`
  owns its `fetchWorkspaces` (a `GET /api/workspaces` call via the shared
  `apiClient`) plus the local wire types and the `WorkspaceView → Workspace`
  mapper (the admin can't import the server package). `status` is admin-only and
  not persisted, so every workspace maps to `Active` (the Active/Archived filter
  still works, Archived is empty for now); member `initials`/`color` aren't
  persisted either and are derived client-side (`utils/initialsOf`,
  `utils/avatarColor`).
- **Create is deferred.** The create flow (`CreateWorkspaceDialog` +
  `useCreateWorkspace`) is built but its entry point is **hidden** — the server
  is read-only (no `POST /api/workspaces`). `useCreateWorkspace` owns the dormant
  `createWorkspace` request (reusing `useWorkspaces`' mapper); see
  `TODO(workspaces-create)` there and in `WorkspacesPage`.
- **Accent color.** Workspace and member avatars are tinted with the shared
  `AvatarColor` palette from `@ortha-cms/design-system` (the `--color-avatar-*`
  tokens in the host's `styles.css`) — the only color in the otherwise-neutral
  admin. New tokens/types live in the design-system, not here.
- **The card opens the workspace; it has no actions menu and shows no role** —
  role is a property of the current user, not the card. There is no
  `/workspaces/:id` detail route yet (see the `TODO(workspaces-detail)` in
  `WorkspaceCard`).

## Conventions

- `type` over `interface`; JSDoc on exports; `import type` for type-only imports
- Every module is a `<name>/index.ts(x)` folder — components in
  `src/lib/components/<Name>/`, pages in `src/lib/pages/<Name>/`, query/mutation
  hooks in `src/lib/api/<useThing>/`, the plugin factory in
  `src/lib/utils/workspacesPlugin/` (`camelCase` for non-components)
- User-facing strings go through `react-intl` (`defineMessages` + `useIntl`),
  co-located in the component file; ids namespaced `workspaces.<area>.<key>`
- Forms use TanStack Form + a `use<Name>Schema` Zod hook for localized validation
- UI is built only from `@ortha-cms/design-system` components, not bespoke markup

## Commands

- `npm exec nx typecheck @ortha-cms/workspaces-admin`
- `npm exec nx lint @ortha-cms/workspaces-admin`
