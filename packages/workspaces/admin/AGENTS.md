# @ortha-cms/workspaces-admin

The **workspaces feature plugin** for the Ortha CMS admin UI. It owns the
Workspaces management experience: the private `/workspaces` route (a searchable,
status-filterable grid of workspace cards), the full-page **create wizard** at
`/workspaces/new`, and its toolbar nav entry. It also owns the **workspace
shell** at `/workspaces/:id/*` — the per-workspace layout (left icon rail +
switcher) that opens when a card is clicked.

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
- **Workspace shell slots** — `WORKSPACE_SIDEBAR_SLOT` (the rail's section nav)
  and `WORKSPACE_ROUTE_SLOT` (pages mounted inside the shell), plus the
  `WorkspaceNavItem` / `WorkspaceRoute` item types. A feature plugin that lives
  inside a workspace (Content Library, Media Library, Insights) contributes a
  rail button + a route to these — and **no** top-level route or navbar item.
- `useCurrentWorkspace()` — reads the open workspace from the shell's context
  (no re-fetch); throws if called outside a shell route.

## Workspace shell (`/workspaces/:id/*`)

- `WorkspaceShell` resolves the `:id` param against `useWorkspaces()`, publishes
  it via `CurrentWorkspaceProvider`, and renders the left **rail** beside a
  content area whose nested `<Routes>` are built from `WORKSPACE_ROUTE_SLOT`.
  Landing on the base redirects to the first rail section.
- It is registered as a normal private route, so it renders **under the shell's
  top navbar** (nested chrome, not a full-screen replacement). The 64px rail is
  `sticky top-12` (below the 48px navbar), off-white so it reads as chrome.
- The rail is icon-only with fly-out tooltips (`RailTooltip`): the
  `WorkspaceSwitcher` chip (accent-tinted, opens `WorkspaceSwitcherPopover`) over
  the slot-driven section nav. Creating a workspace lives in the popover footer,
  so the rail has no bottom action. `WorkspaceSidebarButton`'s `to` is
  **relative** to the workspace base; active state (`useMatch`) fills it the
  neutral `--accent` with a solid black (`--foreground`) left marker bar, and
  `useHasPermission` gates it.
- The **only** color in the rail is the workspace accent — on the switcher chip
  and the popover's workspace chips. Active sections are a grayscale fade
  (`--accent`), never the near-black `--primary`.
- Workspaces owns the last-section **Settings** entry (`order: 100`) + its
  `/workspaces/:id/settings` page; the other rail sections come from the feature
  plugins.

## Settings page (`/workspaces/:id/settings/*`)

- A **left-rail** page (`pages/WorkspaceSettingsPage`) mirroring the user-detail
  settings layout: a shared-width `Container`, a header, then a
  `grid md:grid-cols-[14rem_minmax(0,1fr)]` with the sticky
  `components/WorkspaceSettingsRail` (absolute-path `NavLink`s) beside the active
  section, each a **nested route** (`settings/general` · `/members` · `/content`
  · `/danger`; the index redirects to `general`). Mounted at `settings/*` so the
  page owns those child routes (same shape as the content library's `content/*`).
  The rail narrows the content column, so the page isn't full-width.
- The sections: **General** (name / description / avatar color; TanStack Form +
  the `useWorkspaceProfileSchema` Zod hook, the slug shown read-only since it's
  immutable), **Members** (a directory typeahead that assigns **existing** users
  — no invite-by-email, since the add endpoint links a real id — plus a roster
  with the owner pinned (from the server's `member.isOwner`, not roster
  position) and everyone else removable behind a `ConfirmDialog`),
  **Content** (the granted types shown as two titled groups — **Collections** and
  **Pages** (`GrantedContentGroup`, each row its title + description), granted
  through a **separate search + multi-select popup per kind** — two
  `AddContentDialog` instances, "Add collections" / "Add pages", each listing
  only that kind's ungranted types and synced with the grants; revoke through
  `RemoveContentDialog`, which reads
  `GET /workspaces/:id/content/:slug/entry-count` on open and **blocks** the
  Remove button with a warning while the type still has entries, so the server
  `409` is only a safety net), and a **Danger zone**
  (archive/unarchive behind a confirm; permanent delete through
  `DeleteWorkspaceDialog`, which reads `GET /workspaces/:id/entry-count` on open
  and **blocks** Delete with a warning until the workspace holds no content at
  all — the same block-before-you-act pattern as content revoke, with the server
  `409` as the safety net; delete returns to the grid).
- **Permission-gated end to end** via `useHasPermission`: `workspaces:update`
  drives every edit (a viewer sees a read-only page with the controls hidden),
  `workspaces:delete` gates delete; the Danger rail entry **and** its route only
  exist when the user can act on it (the route redirects to `general` otherwise,
  so a deep link can't reach it). The section bodies live in top-level
  `components/Workspace{General,Members,Content,Danger}Settings/` (their
  one-off parts nested inside).
- Each area owns its mutation hook under `lib/api/` — `useUpdateWorkspace`,
  `useSetWorkspaceStatus`, `useDeleteWorkspace`, `useAddWorkspaceMember` /
  `useRemoveWorkspaceMember`, `useAddWorkspaceContent` /
  `useRemoveWorkspaceContent` — all invalidating `workspacesKey` on success so
  the shell (which reads the open workspace from that list) re-resolves — plus
  the read-only `useWorkspaceContentCount` / `useWorkspaceEntryCount` backing the
  revoke and delete pre-checks. The
  avatar-color picker `components/ColorSwatchRow/` is shared by the settings
  General tab and the create wizard's Basics step.

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
  the server stores neither — via the shared `initialsOf`/`asAvatarColor`/
  `avatarColorForId` from `@ortha-cms/utils-admin` (no local `utils/` copies).
  Generic helpers (`slugify`, `useDebouncedValue`) live in
  `@ortha-cms/utils-admin`, not here.
- **Membership is a pure link; there is no per-member role.** The server ignores
  any role on a member — a user's permissions come from their single global
  role. The Members step adds people (existing or invite-by-email) with no role
  control; the owner is derived from the session, never the body, and is
  returned per-member as `isOwner` on the workspace view.
- **Accent color.** Workspace and member avatars are tinted with the shared
  `AvatarColor` palette from `@ortha-cms/design-system` (the `--color-avatar-*`
  tokens in the host's `styles.css`) — the only color in the otherwise-neutral
  admin. New tokens/types live in the design-system, not here.
- **The card opens the workspace; it has no actions menu and shows no role** —
  role is a property of the current user, not the card. Clicking it navigates to
  `/workspaces/:id`, which the shell redirects to the first rail section.

## Conventions

- `type` over `interface`; JSDoc on exports; `import type` for type-only imports
- Every module is a `<name>/index.ts(x)` folder — components in
  `src/lib/components/<Name>/`, pages in `src/lib/pages/<Name>/`, query/mutation
  hooks in `src/lib/api/<useThing>/`, the plugin factory in
  `src/lib/utils/workspacesPlugin/` (`camelCase` for non-components)
- **`pages/` stays flat** — each page is just `pages/<Name>/index.tsx`, no
  child component folders. Every component lives under `components/`. A
  component used only by **another component** nests inside that component's
  folder; a component used by a **page** sits at the top of `components/`. So
  `StatusChip` + `MemberStack/` (with `MemberListPopover/` nested inside it)
  live under `components/WorkspaceCard/`, and the whole
  `components/CreateWorkspaceWizard/` subtree (Basics/Members/Content step
  bodies and their parts) nests under the wizard. The page-only components —
  `WorkspaceToolbar`, `WorkspacesEmpty`, `CreateWorkspaceWizard` — and the
  shared pieces — `WorkspaceAvatar`, `WorkspaceCard`, `WorkspacesSkeleton` —
  all sit at the top of `components/`.
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
