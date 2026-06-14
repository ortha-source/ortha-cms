# @ortha-cms/workspaces-admin

The **workspaces feature plugin** for the Ortha CMS admin UI. It owns the
Workspaces management experience: the private `/workspaces` route (a searchable,
status-filterable grid of workspace cards), the full-page **create wizard** at
`/workspaces/new`, and its toolbar nav entry. It replaced the placeholder the
shell shipped while the feature was pending.

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
  private `/workspaces` (list) and `/workspaces/new` (create wizard) routes plus
  the `Layers` nav item (`order: 20`, before Users), contributed to the shell's
  `NAVBAR_START_SLOT`.
- `useWorkspaces` / `workspacesKey` — TanStack Query list hook + its key.
- `useCreateWorkspace` — create mutation with optimistic insert at the top;
  takes `{ body, creator }` (the `creator` seeds the stub's owner).
- `Workspace` / `WorkspaceMember` / `WorkspaceStatus` — the data model.

## Create wizard (`/workspaces/new`)

- A full-page, 3-step wizard (Basics → Members → Content), **not** a dialog. The
  page (`pages/CreateWorkspacePage`) owns navigation + submission; all form state
  lives in `hooks/useWizard` (the single source of truth) so it survives moving
  between steps. The active step is mirrored to `?step=` and clamped.
- The generic wizard **chrome lives in the design-system** — `Stepper` (the
  progress rail), `WizardStepCard` (the animated step card), and `WizardFooter`
  (back/skip/primary). The page configures them with its steps + intl labels; the
  workspace-specific step bodies (Basics/Members/Content) stay here.
- Supporting hooks: `useSlug` (auto-fill + regenerate + availability),
  `useResourceSelection` (controlled `specific`/`all` model), `useBasicsSchema`
  (localized Zod). Generic helpers (`slugify`, `useDebouncedValue`) come from
  `@ortha-cms/utils-admin`.
- Step entrance motion is the `wizard-step-in` keyframe shipped by the
  design-system stylesheet — **transform only** (opacity stays 1), disabled under
  `prefers-reduced-motion`, replayed via `key={step}` on the `WizardStepCard`.

## Architecture

- **Wired to the real API — one hook per query.** Each `lib/api/<useThing>/`
  hook owns its own request (via the shared `apiClient`, same-origin,
  cookie-authed), response type, and mapper — there is no shared "client" module:
  `useWorkspaces` (`GET /api/workspaces`, + the `toWorkspace`/`WorkspaceView`
  mapper it exports for reuse), `useCreateWorkspace` (`POST /api/workspaces`),
  `useSlugAvailability` (`GET /api/workspaces/slug-available`), `useUsersSearch`
  (`GET /api/users?q=`), and `useContentTypes` (`GET /api/content-types`). The
  mappers derive presentation-only member `initials`/`color` on the client, since
  the server stores neither. Generic helpers (`slugify`, `useDebouncedValue`)
  live in `@ortha-cms/utils-admin`, not here.
- **Membership is a pure link; there is no per-member role.** The server ignores
  any role on a member — a user's permissions come from their single global
  role. The Members step adds people (existing or invite-by-email) with no role
  control; the owner is derived from the session, never the body.
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
- **Single-consumer components co-locate under their one consumer**; only
  shared (≥2 consumers) or barrel-exported pieces live at the top of
  `components/`. So `WorkspaceToolbar` + `WorkspacesEmpty` sit under
  `pages/WorkspacesPage/`, the whole `CreateWorkspaceWizard/` subtree
  (Basics/Members/Content step bodies and their parts) under
  `pages/CreateWorkspacePage/`, and `StatusChip` + `MemberStack/` (with
  `MemberListPopover/` nested inside it) under `components/WorkspaceCard/`. The
  shared pieces — `WorkspaceAvatar`, `WorkspaceCard`, `WorkspacesSkeleton` —
  stay at the top of `components/`.
- User-facing strings go through `react-intl` (`defineMessages` + `useIntl`),
  co-located in the component file; ids namespaced `workspaces.<area>.<key>`
- Simple forms use TanStack Form + a `use<Name>Schema` Zod hook. The **create
  wizard is the exception**: its cross-step state lives in `useWizard` (controlled
  fields) and validates with the `useBasicsSchema` Zod hook directly, so state
  isn't lost when a step unmounts.
- non-api hooks live in `src/lib/hooks/<useThing>/`; api hooks in `src/lib/api/`
- UI is built only from `@ortha-cms/design-system` components, not bespoke markup

## Commands

- `npm exec nx typecheck @ortha-cms/workspaces-admin`
- `npm exec nx lint @ortha-cms/workspaces-admin`
