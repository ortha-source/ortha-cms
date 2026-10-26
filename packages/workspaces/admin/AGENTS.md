# @orthacms/workspaces-admin

The **workspaces feature plugin** for the Ortha CMS admin UI. It owns the
Workspaces management experience: the private `/workspaces` route (a searchable,
status-filterable, sortable **grid of cards**, one per workspace), the full-page
**create wizard** at `/workspaces/new`, the **ready screen** a new workspace
lands on (`/workspaces/:id/ready`), and its sidebar nav entry + a "Workspaces"
quick-list section.
It also owns the **workspace shell** at `/workspaces/:id/*` — which, when a row
is clicked, **injects a per-workspace nav (`WorkspaceNav`: switcher + Content +
Workspace sections) into the app sidebar** (via `useSidebarContent`) and renders
the section content in the inset.

## Layout — layered (ADR-0003)

This plugin is **layered (tactical DDD)** — the admin-side reference for
ADR-0003. `src/lib` is organized into four layers, not the legacy per-hook
`api/` layout:

- **`domain/`** — pure TS, no React: the `Slug` value object (the single
  client-side slug rule, mirroring the server), shared view types, and UX-invariant
  helpers.
- **`application/`** — the TanStack Query hooks (reads + mutation/use-case hooks).
  Each calls the gateway, never `apiClient`. The create wizard's submit
  orchestration is `useCreateWorkspaceFlow` (validate `Slug` → create →
  `issueInvites` → navigate to the ready screen), so the wizard page is layout +
  fields.
- **`infrastructure/`** — the `WorkspaceGateway` **port** + its `httpWorkspaceGateway`
  implementation (the one place `apiClient` is used) and `workspaceMapper` (the
  wire→view anti-corruption layer, formerly the inline `toWorkspace`).
- **`presentation/`** — pages, components, slots, and the `currentWorkspace`
  provider; consumes view models + hooks only, never wire types or `apiClient`.

The admin stays **thin** — no client aggregates or repositories; the server owns
business truth (ADR-0003 frontend guidance).

## Package

- Name: `@orthacms/workspaces-admin`
- Import: `import { WorkspacesPlugin } from '@orthacms/workspaces-admin'`
- Grouped package (`packages/workspaces/admin`), admin-only. Consumed from source
  (`exports` → `./src/index.ts`); no build step.
- Register it in `createAdmin({ plugins })` **after** `ShellPlugin()` — it
  contributes its `/workspaces` route into the shell's gated layout and its nav
  item into the shell's `SIDEBAR_NAV_SLOT` (so it depends on
  `@orthacms/shell-admin`).

## Key exports

- `WorkspacesPlugin()` — factory returning an `AdminPlugin`: the lazy-loaded,
  private `/workspaces` (list) and `/workspaces/new` (create wizard) routes plus
  the `Layers` nav item (`group: 'directory'`, `order: 10`), the "Workspaces"
  quick-list section, and the home stat tiles, workspaces panel and top-bar
  **New workspace** action (`NewWorkspaceHomeAction`, gated on create) — contributed
  to the shell's `SIDEBAR_NAV_SLOT`, `SIDEBAR_SECTION_SLOT`, and
  `HOME_SECTION_SLOT`.
- `useWorkspaces` / `workspacesKey` — TanStack Query list hook + its key.
- `useCreateWorkspace` — create mutation with optimistic insert at the top;
  takes `{ body, creator }` (the `creator` seeds the stub's first member).
- `Workspace` / `WorkspaceMember` / `WorkspaceStatus` — the data model.
- **Workspace shell slots** — `WORKSPACE_NAV_SLOT` (the "Workspace" section's
  labeled nav rows), `WORKSPACE_SECTION_SLOT` (custom sidebar sections, e.g. the
  Content Library's content-type list; an item's optional `takeover(pathname)`
  makes it the sidebar's only content where it returns true — the copilot's
  Agents view swaps the content tree for its chat list that way),
  `WORKSPACE_ROUTE_SLOT` (pages mounted
  inside the shell; `WorkspaceRoute.order` picks the default landing), and
  `WORKSPACE_SETTINGS_TAB_SLOT` (a section on the **settings** page — see
  below), plus the `WorkspaceNavItem` / `WorkspaceSectionItem` /
  `WorkspaceRoute` / `WorkspaceSettingsTab` item types. A
  feature plugin that lives inside a workspace (Content Library, Media Library,
  Insights) contributes a route + either a nav entry or a section to these — and
  **no** top-level route or global nav item.
- `useCurrentWorkspace()` — reads the open workspace from the shell's context
  (no re-fetch); throws if called outside a shell route.

## Access is scoped to membership

`GET /api/workspaces` returns **only the workspaces the signed-in user is a
member of** (the server enforces this; see `workspaces-server`'s AGENTS.md).
Every surface here renders from that one `useWorkspaces()` list — the sidebar
quick-list, the `WorkspaceSwitcher`, the command palette, the home stat tiles +
panel, the workspaces table, and the Content Library's nav section — so none of
them can show a workspace the user doesn't belong to. **Don't add a client-side
membership filter**: the list is already the user's own, and filtering again
would silently hide workspaces the server did grant.

The one way to reach a foreign workspace is a deep link, and `WorkspaceShell`
handles it: the `:id` doesn't resolve against the list, so instead of the
workspace it renders a **no-access** state (`role="alert"`, "You don't have
access to this workspace" + a "Back to workspaces" link) and injects no sidebar
nav. It deliberately does **not** distinguish "not a member" from "doesn't
exist", mirroring the API's flat 403.

## Workspace shell (`/workspaces/:id/*`)

- `WorkspaceShell` resolves the `:id` param against `useWorkspaces()` (the
  membership-scoped list, so an unresolved id _is_ the no-access case),
  publishes it via `CurrentWorkspaceProvider`, and **injects `WorkspaceNav` into
  the app sidebar** via `useSidebarContent(() => <WorkspaceNav workspace={current}/>,
[current.id])`, clearing it on unmount. Its own render is just the content
  area whose nested `<Routes>` are built from `WORKSPACE_ROUTE_SLOT`; landing on
  the base redirects to the lowest-`order` route (the Content Library).
- `WorkspaceNav` (rendered in the app sidebar, so **above**
  `CurrentWorkspaceProvider` — it takes `workspace` as a prop) is: a "← Ortha CMS
  CMS" back link + a full-width `WorkspaceSwitcher` (design-system `Popover`
  listing workspaces + "New workspace"), then the `WORKSPACE_SECTION_SLOT`
  sections (the Content Library's content-type nav), then the "Workspace"
  section (`WORKSPACE_NAV_SLOT` — Media, Insights, Settings) as labeled rows.
  Nav rows use `SidebarMenuButton`, resolve their **relative** `to` against the
  active `:id`, derive active state via `useMatch`, and gate on
  `useHasPermission`.
- The workspace accent tints the switcher avatar; the persistent account footer
  (from the shell) stays below.
- Workspaces owns the last **Settings** entry (`WORKSPACE_NAV_SLOT`, `order:
100`) + its `/workspaces/:id/settings` page; the Content and Media/Insights
  sections come from the feature plugins.

## Settings page (`/workspaces/:id/settings/*`)

- A **side-nav** page (`pages/WorkspaceSettingsPage`) in the webhook editor's
  shape: `components/WorkspaceSettingsNav` (a 184px column of absolute-path
  `NavLink`s — General, Content types and Members with their counts, the
  contributed sections, then a ruled-off red Danger zone; a scrolling row above
  the column below `lg`) beside one 720px column. Each section is a **nested
  route** (`settings/general` · `/content` · `/members` · `/danger`; the index
  redirects to `general`), and the column opens on that section's `<h1>` and
  one-line subtitle (`useSectionHeader`; a contributed section supplies its own
  through the slot's `descriptionId`). Mounted at `settings/*` so the page owns
  those child routes (same shape as the content library's `content/*`). Inside
  a section, framed blocks are `SettingsSection` (an `<h2>` and a sentence over
  the fields).
- The sections:
    - **General** — **Identity** (the avatar color with a preview tile, name,
      description; TanStack Form + the `useWorkspaceProfileSchema` Zod hook, a
      "Changed" badge on an edited field), **Address and API** (the slug,
      locked, and a **copyable workspace id** — `WorkspaceIdField`, an
      `InputGroup` with a copy button, since the id is what the public content
      API's `X-Workspace-Id` header takes; both `readOnly`, not `disabled`, so
      they can be selected and copied by keyboard; clipboard failure falls back
      to an error toast telling the user to select the id manually) and
      **Sharing** (below). **Save is in the top bar** (`PageActionsPortal`), the
      way the entry editor's is: "● Unsaved changes · Discard · Save changes"
      while the form holds edits, a disabled Save when it doesn't; the button
      submits the `<form>` through its `form` attribute.
    - **Content types** — every grant in **one list**, grouped by source
      (`GrantedContentGroup`, a labelled `role="group"`): this workspace's own
      (collections, then pages; "N collections · M pages"), then one group per
      shared workspace ("From {workspace}" + Shared, "Read-only here"). Each
      own row says how many entries the type holds here
      (`useWorkspaceContentCount(…, 'summary')`). A search narrows the list;
      **one** `AddContentDialog` grants both kinds, with an All · Collections ·
      Pages filter. Revoke through `RemoveContentDialog`, which reads
      `GET /workspaces/:id/content/:slug/entry-count` on open (its own `check`
      key, never the row's answer) and **blocks** Remove while the type still
      has entries, so the server `409` is only a safety net.
    - **Members** — a directory typeahead that assigns **existing** users (no
      invite-by-email, since the add endpoint links a real id) over the roster,
      one framed list with "You" on the signed-in person; a member is removed
      behind a `ConfirmDialog`. Roles are not shown: a role is global, and the
      membership wire carries none. Access is purely permission-based — but the
      **last** member cannot go: the server answers 409 `LastMemberError`, and
      the toast says what would help.
    - **Danger zone** — archive/unarchive and permanent delete
      through `DeleteWorkspaceDialog`, as rows of one red-ruled card. Archive
      opens the same `ArchiveWorkspaceDialog` the cards' ⋯ menu does (below);
      unarchive applies directly. While the
      workspace still holds entries the Delete row **says so on the page**
      (`useWorkspaceEntryCount(…, 'summary')`: how many, and a link to
      Content); the dialog still reads `GET /workspaces/:id/entry-count` itself
      and **blocks** Delete until the workspace holds no content, with the
      server `409` as the safety net; delete returns to the list.
- **Permission-gated end to end** via `useHasPermission`: `workspaces:update`
  drives every edit (a viewer sees a read-only page with the controls hidden),
  `workspaces:delete` gates delete; the Danger tab entry **and** its route only
  exist when the user can act on it (the route redirects to `general` otherwise,
  so a deep link can't reach it). The section bodies live in top-level
  `components/Workspace{General,Members,Content,Danger}Settings/` (their
  one-off parts nested inside).
- **A plugin adds a settings section through `WORKSPACE_SETTINGS_TAB_SLOT`.**
  A contribution names a `path`, a label (`labelId` + `defaultLabel`), an
  `icon`, an `order`, optionally a description (`descriptionId` +
  `defaultDescription`, shown under the section's `<h1>`) and the `element` to
  render; `WorkspaceSettingsNav` links
  to it and `WorkspaceSettingsPage` mounts it as a nested route.
  `@orthacms/protection-admin` is the first contributor. Three rules worth
  knowing:
    - **Contributed sections sit between Members and Danger zone**, and `order`
      sorts them only against each other. Danger zone is last because it is
      where a workspace is destroyed; a plugin that could sort past it would put
      a routine setting beyond the point everything else treats as the end.
    - **A tab's `permission` hides the entry, and the route stays mounted.**
      `SettingsNavLink` does the check, as a component rather than a
      `useHasPermission` inside the parent's `.map` — slot items are frozen at
      boot so the list cannot actually move, but writing it the other way makes
      the next contributor's change a rules-of-hooks bug rather than an
      addition. The route is left mounted deliberately: a deep link reaching a
      section that explains the refusal beats a redirect somewhere nobody asked
      for.
    - **An empty slot changes nothing**, and `WorkspaceSettingsNav`' spec pins
      it — that is the state the seam spends almost all of its life in, and
      nothing else would record that the default was a decision.
- **Sharing** (`components/WorkspaceSharingSettings`, mounted by the page on the
  General route as a **sibling** of `WorkspaceGeneralSettings` — outside that
  component's re-key, so a profile save can't remount it mid-toggle). One
  "Shared workspace" switch: a shared workspace's **published** records can be
  linked from (and viewed read-only in) any workspace granted the same content
  type. The switch applies on its own — no Save — through
  `useSetWorkspaceSharing`, which PATCHes `{ isShared }` **alone** and writes the
  returned workspace into the `workspacesKey` list (`setQueryData`, falling
  back to invalidating that one key when nothing is cached) rather than
  refetching the list for one boolean. Turning it **off** confirms first
  (`ConfirmDialog`, focus put back on the switch by `onCloseAutoFocus`, since
  Radix's own restore lands on `<body>` when the dialog opens from a change
  handler); on is additive and applies directly. Disabled while pending and
  without `workspaces:update`. `Workspace.isShared` is mapped `?? false`, so an
  older server reads as not shared. The sidebar reads it back: the switcher's
  sub-line says **Shared workspace** (and its `aria-label` says so too), the
  popover rows carry a **Shared** badge — and `WorkspaceShell`'s
  `useSidebarContent` deps name `isShared`, or the switcher would keep the old
  label for the session. Pinned by `apps/admin-e2e/src/workspaces/sharing.spec.ts`.
- **Per-source content grants.** A type is granted as the workspace's **own**
  records (`Workspace.content`) and/or **from a shared workspace**
  (`Workspace.sharedContent`, one row per type and source, mapped `?? []`;
  its `available` flag reads absent as available). The Content types section lists a shared grant as its own row, under a
  "From {workspace}" group with a **Shared** badge, and an **Unavailable** one
  on the row while the source no longer shares; the Add dialog groups what
  `GET /workspaces/:id/shared-sources` (`useSharedSources`, fetched only with
  `workspaces:update`) offers under "From {workspace}", minus grants already
  held from that source, and post `{ slug, sourceWorkspaceId }`. Removal picks
  the DELETE by row: a shared row sends `?source=<id>` behind a plain
  `RemoveSharedContentDialog` (no entry-count pre-check — its records live at
  the source), an own row the unchanged blocking dialog with no query. Grant
  mutations invalidate `workspacesKey` **and** (unawaited)
  `workspaceContentAccessKey(id)` — the root the Content Library builds its
  per-workspace content-type list under, exported from the barrel; the sharing
  toggle invalidates `workspaceContentAccessRoot`, since it changes what other
  workspaces reach. The create wizard's "Specific content" mode lists the same
  shared types (`SharedContentSection`) and sends them as
  `content.sharedContent`; "All content" stays own types only. There is no
  workspace yet to ask `shared-sources` about, so the wizard derives its
  sources from the membership-scoped list (`useSharedSourceCandidates`: active,
  shared workspaces and their own grants) — a shared workspace the creator
  isn't a member of is grantable later from settings. Pinned by
  `apps/admin-e2e/src/workspaces/shared-grants.spec.ts`.
- Each area owns its mutation hook under `lib/application/` — `useUpdateWorkspace`,
  `useSetWorkspaceStatus`, `useDeleteWorkspace`, `useAddWorkspaceMember` /
  `useRemoveWorkspaceMember`, `useAddWorkspaceContent` /
  `useRemoveWorkspaceContent` (each calling `httpWorkspaceGateway`, not
  `apiClient`) — all invalidating `workspacesKey` on success so
  the shell (which reads the open workspace from that list) re-resolves — plus
  the read-only `useWorkspaceContentCount` / `useWorkspaceEntryCount` backing the
  revoke and delete pre-checks. The
  avatar-color picker `components/ColorSwatchRow/` is shared by the settings
  General tab and the create wizard's Basics step.

## Create wizard (`/workspaces/new`)

- A full-page, 3-step wizard — **Basics → Content → People** — beside a live
  **preview** column, **not** a dialog. The page (`pages/CreateWorkspacePage`)
  owns navigation + submission; all form state lives in `hooks/useWizard` (the
  single source of truth) so it survives moving between steps. The active step
  is mirrored to `?step=` and clamped, and falls back to Basics while the basics
  are invalid (a deep link or reload can't reach a live Create).
- **Progress** is `CreateWorkspaceWizard/WizardProgress`, a horizontal line
  (✓ Basics — 2 Content — 3 People; `aria-current="step"`, a reached step is a
  button back). The design-system `Stepper` rail is vertical and stays as it is;
  `WizardStepCard` still frames the step (keyed on it, so the entrance replays
  and focus moves to the step's `<h2>` — an `sr-only` "Basics" on step 1).
- **Basics** (`IdentityFields`): the name (the only required field), the
  **Address** — the slug shown as `/workspaces/<slug>` in an `InputGroup` with
  its availability badge inline (`SlugField`; a failed check is the
  `role="alert"` Unknown state, workspaces I-33) — the **Colour** (the shared
  `ColorSwatchRow` at `size="sm"` with a `label`), and the description with its
  "n / 2000" counter. Footer: Cancel · Continue.
- **Content** (`ContentStep`): two answers first — **Everything** (every type
  the catalogue holds, as own grants; resolved at create, so the copy says
  "this site defines", not "and new ones as they are added") or **Pick content
  types**, which opens **one** framed list (`ContentPicker`): Collections, Pages
  and "From shared workspaces", each a labelled `role="group"` under a header
  row with "N of M". Each own type says how many records it already holds in
  your workspaces ("842 records elsewhere", summed from `recordCountByType`
  over the membership-scoped list) or carries a **new** badge when none of your
  workspaces is granted it. Shared rows read "{Type} from {Workspace}" and are
  sent as `content.sharedContent`; there is no workspace yet to ask
  `shared-sources` about, so the sources come from `useSharedSourceCandidates`
  (active, shared workspaces in the list and their own grants).
- **People** (`PeopleStep`): members and invites in **one** box — the
  directory typeahead (`MemberTypeahead`, an ARIA combobox: a name lists
  accounts with their global role; an email offers "Invite … by email") over
  one list: the creator as "You" (no role, no owner — I-07), each added
  account with its role badge, each invite saying what will happen. Footer:
  Back · Skip — just me · Create workspace.
- **The preview** (`WizardPreview`) is the card the workspace becomes on
  Basics (`CardPreview`), then a compact summary of the content ("4 content
  types · 1 shared" + tags) and the people ("· 3 people" + faces and invite
  chips). It repeats the form, so it is `aria-hidden` and holds nothing
  focusable.
- **Invitations.** The create provisions a pending account per invited
  address but sends nothing; `application/issueInvites` then calls the users
  plugin's `POST /users/:id/invites/resend` for each pending invitee (one at a
  time), when the creator holds `users:create`. Best effort: a failure or a
  missing permission reports the invite `pending`, never rolls back the
  workspace. The raw token a mail-less host returns is **dropped** — Members can
  reveal the link again.
- **The ready screen** (`pages/WorkspaceReadyPage`, `/workspaces/:id/ready`,
  outside the workspace shell because its static `ready` segment outranks the
  shell's splat): "{name} is ready", a summary ("4 content types · 2 members ·
  1 invite sent to …", the invite part from the router state the flow passes —
  `WorkspaceReadyState` — and from the pending members after a reload), then
  **Next steps** (`NextStepRow`): write the first record (a "New record" link
  into the first granted collection), invite more people (settings → Members),
  share its published records (settings → General); then "Open {name}" and
  "Back to workspaces". An id outside the list reads as missing, like the
  shell's no-access state.

## Architecture

- **Wired to the real API through a gateway seam.** Every request goes through
  `infrastructure/httpWorkspaceGateway` (the sole `apiClient` user; same-origin,
  cookie-authed) behind the `WorkspaceGateway` port; `application/` hooks
  (`useWorkspaces` → `GET /api/workspaces`, `useCreateWorkspace` →
  `POST /api/workspaces`, `useSlugAvailability`, `useUsersSearch` → `GET /api/users?search=&pageSize=10`,
  `useContentTypes` → `GET /api/content-types`, plus the settings mutations) call
  the gateway, not `apiClient`. Wire→view mapping lives in
  `infrastructure/workspaceMapper` (`toWorkspace`/`toMember`) — the anti-corruption
  layer, deriving presentation-only member `initials`/`color` on the client (the
  server stores neither) via the shared `initialsOf`/`asAvatarColor`/
  `avatarColorForId` from `@orthacms/utils-admin`. Generic helpers (`slugify`,
  `useDebouncedValue`) live in `@orthacms/utils-admin`, not here.
- **Membership is a pure link; there is no per-member role and no owner.** The
  server ignores any role on a member — a user's permissions come from their
  single global role. The People step adds people (existing or invite-by-email)
  with no role control — the badge beside an account is its **global** role,
  read from the directory; the creator is just the first member (added from the
  session), shown as "You", with no special status. `WorkspaceMember.pending`
  (the account's directory status) is what tells an invite from a teammate.
- **Accent color.** Workspace and member avatars are tinted with the shared
  `AvatarColor` palette from `@orthacms/design-system` (the `--color-avatar-*`
  tokens in the host's `styles.css`) — the only color in the otherwise-neutral
  admin. New tokens/types live in the design-system, not here.
- **The list is a grid of cards** (`WorkspaceCards` → `WorkspaceCard`, a
  labelled `<ul>`) that say what is inside: the tile, the name (the card's
  link) with a **Shared** or **Archived** badge, "Edited {when}" (or "Archived
  {when}") from `lastEditedAt` / `archivedAt` (`useSinceLabel`), the
  description, "N records · N content types" (own + shared, a type once) and
  who is in it as faces (`MemberFaces`: four, then "+N", one `role="img"` name
  for the roster), then **Open** / **Settings** — or **Restore** on an archived
  card for whoever holds `workspaces:update`. The ⋯ menu (`WorkspaceCardMenu`)
  repeats Open/Settings and adds **Archive…** / **Restore**. A click anywhere
  else on the card opens it too, for the mouse, without adding a tab stop. It
  shows **no role**. Whoever may create a workspace gets a trailing dashed
  **New workspace** card (not while searching or on Archived). The toolbar is
  sort and filter, nothing more: search, the All/Active/Archived segmented
  filter, and a sort `Select` (Recently edited — the default — Name, Recently
  created; `domain/workspaceSort`). The "{shown} of {total}" count is a polite
  `sr-only` status only. The header is the shared `ContainerHeader`, with
  **New workspace** in the top bar.
- **Archiving says what it does** (`ArchiveWorkspaceDialog`, shared by the
  cards and the Danger zone): on open it reads
  `GET /workspaces/:id/archive-impact` (`useArchiveImpact`, never cached) and
  lists what stays — records, members — and how many workspaces linking its
  shared records will see them as unavailable, then "Restore it any time from
  Workspaces → Archived". Archiving is reversible and deletes nothing, so an
  unreadable count does **not** block the button (unlike the delete dialog);
  the dialog says so. The copy deliberately does **not** claim records become
  read-only: archiving is an interface state (see the dossier, §06). Restore
  applies directly.

## Conventions

- `type` over `interface`; JSDoc on exports; `import type` for type-only imports
- Every module is a `<name>/index.ts(x)` folder, grouped by layer (ADR-0003):
  components in `src/lib/presentation/components/<Name>/`, pages in
  `src/lib/presentation/pages/<Name>/`, query/mutation/use-case hooks in
  `src/lib/application/<useThing>/`, the gateway + mapper in
  `src/lib/infrastructure/`, value objects in `src/lib/domain/`, the plugin
  factory in `src/lib/presentation/workspacesPlugin/` (`camelCase` for
  non-components)
- **`pages/` stays flat** — each page is just `pages/<Name>/index.tsx`, no
  child component folders. Every component lives under `components/`. A
  component used only by **another component** nests inside that component's
  folder; a component used by a **page** sits at the top of `components/`. So
  the whole `components/CreateWorkspaceWizard/` subtree (Basics/Content/People
  step bodies, the progress line, the preview and their parts) nests under the
  wizard, and `WorkspaceNavButton` / `WorkspaceSwitcher` nest under
  `components/WorkspaceNav/`. The page-level components — `WorkspaceCards`,
  `WorkspaceToolbar`, `WorkspacesEmpty`, `CreateWorkspaceWizard`,
  `NextStepRow` — and the shared pieces — `WorkspaceAvatar`, `MemberFaces`,
  `ArchiveWorkspaceDialog`, `StatusChip`, `WorkspacesSkeleton`, `WorkspaceNav`,
  `WorkspacesNavSection`, `WorkspaceStats`, `WorkspacesHomePanel` — all sit at
  the top of `components/`.
- User-facing strings go through `react-intl` (`defineMessages` + `useIntl`),
  co-located in the component file; ids namespaced `workspaces.<area>.<key>`
- Simple forms use TanStack Form + a `use<Name>Schema` Zod hook. The **create
  wizard is the exception**: its cross-step state lives in `useWizard` (controlled
  fields) and validates with the `useBasicsSchema` Zod hook directly, so state
  isn't lost when a step unmounts.
- presentational/stateful UI hooks live in `src/lib/presentation/hooks/<useThing>/`;
  data hooks (queries/mutations/use-cases) in `src/lib/application/<useThing>/`
- UI is built only from `@orthacms/design-system` components, not bespoke markup

## Commands

- `npm exec nx typecheck @orthacms/workspaces-admin`
- `npm exec nx lint @orthacms/workspaces-admin`
