# @ortha-cms/users-admin

The members **admin plugin**: the **Members** page at `/users`, the **Invite
member** page at `/users/invite`, the **user detail** page at `/users/:id`, and
the sidebar nav entry.

## Layout — layered (ADR-0003)

This plugin is **layered (tactical DDD)**, mirroring the `workspaces/admin`
pilot. `src/lib` is organized into four layers, not the legacy per-hook `api/` +
`utils/` layout:

- **`domain/`** — pure TS, no React: shared view types (`types/member`,
  `types/session`, `types/workspaceOption`), the `Email` value object
  (`value-objects/email`, the single client-side email rule for instant invite
  validation), and the `MemberEntity` client entity (`member/`) exposing the
  **UX invariants** the admin mirrors from server facts — `canChangeRole()` and
  `canBeRemoved(viewerId)` return `{ ok, reason }` so a control disables itself
  with a reason (sole admin / self) instead of failing on submit.
- **`application/`** — the TanStack Query hooks (reads + mutations). Each calls
  the gateway, never `apiClient`. The invite wizard's submit orchestration is
  `useInviteMemberFlow` (validate `Email` → invite → toast → navigate), so the
  invite page is layout + fields; `useMembersMutation` is the shared mutation
  shell (normalize + invalidate `membersKeys.all`).
- **`infrastructure/`** — the `MemberGateway` **port** + its `httpMemberGateway`
  implementation (the one place `apiClient` is used), `memberMapper` (the
  wire→view anti-corruption layer, formerly `utils/toMember`, keeping the
  presentation-only `initials`/`color` enrichment), and `membersKeys`.
- **`presentation/`** — pages, components, the `usersPlugin` factory, the
  `userDetailContext` Outlet provider, and `membersFilterFields`; consumes view
  models + hooks + the `MemberEntity` only, never wire types or `apiClient`.

The admin stays **thin** — no client aggregates or repositories; the server owns
business truth. `MemberEntity` wraps the plain `Member` view model on demand (so
React Query's structural sharing keeps working) rather than replacing it.

## What it owns

- The private `/users`, `/users/invite`, and `/users/:id/*` routes (lazy +
  `<Suspense>`), rendered in the shell's authenticated layout.
- A `SIDEBAR_NAV_SLOT` entry (`group: 'directory'`, `order: 20`). The pages gate
  on the `users:read` permission via `useHasPermission`.
- The sidebar-footer **account menu** (`AccountMenu`), contributed to the
  shell's `SIDEBAR_FOOTER_SLOT`: a full-width row (avatar + name + email) that
  opens a dropdown with **My profile** (→ their own `/users/:id` detail page),
  **Preferences** (→ their own `/users/:id/preferences` theme tab), and
  **Logout** (identity's `useLogoutMutation`). It reads the current user
  from identity's `useAuth`. The plugin also contributes an invisible
  `ThemeSync` into the shell's `SIDEBAR_SECTION_SLOT`: it pulls the signed-in
  user's saved theme from `GET /api/preferences` into the design-system
  `AppearanceProvider`, so the choice takes effect app-wide on load.

## The pages

`MembersPage` — `Container`/`ContainerHeader`, a search toolbar, the
**Member · Role · Status · Workspaces** table, pagination, a loading
**skeleton** (`MembersTableSkeleton`), and empty/no-access states. Each row is a
shortcut to the member's detail page (the name is a real link for keyboard
users); the row's kebab menu mirrors the detail tab bar — an **Account**
group (General/Role/Workspaces) plus permission-gated **Audit**
(Sessions/Activity) and **Access** (Sign-in access) groups that navigate
straight to a tab — followed by the status quick actions (Resend/Revoke invite,
Disable/Enable). Editing name/role now lives on the detail page, not an inline
dialog. `InviteMemberPage` — the invite form (role + workspaces), gated the same
way.

`UserDetailLayout` (`/users/:id/*`, via `UserDetailRouter`'s nested `<Routes>`)
— fetches one member once (`useUserDetail`) and shares it with every tab through
the Outlet context (`presentation/userDetailContext`), so a tab read is free. Renders
the back link, `UserHero`, `UserStatsStrip`, and the `UserDetailTabs` underline
tab bar (design-system `TabNav`) above the active tab. Six tab pages:
**General** (edit name), **Role** (`RolePicker` +
confirm), **Workspaces** (`WorkspaceMembershipCard` + `AddToWorkspacesDialog`),
**Sessions** (`SessionCard` + revoke), **Activity** (reuses
`@ortha-cms/activity-admin`'s `useActivityLog`, pinned to `subjectId`),
**Access** (suspend/reactivate), and **Preferences** (`UserPreferencesPage` —
the colour-theme picker Light/Dark/System over `/api/preferences`, applied
optimistically through the design-system `AppearanceProvider`). The Audit
(Sessions, Activity) and Access tabs are permission-gated **at the route
level** — without `users:update` / `activity:read` the tab bar hides them and
the route redirects to General. **Preferences is self-only** — it carries the
current user's own app settings, so it is gated on `useAuth().user.id ===
member.id` (hidden and route-redirected on anyone else's profile).

## Conventions

- Every module is a `<name>/index.ts(x)` folder, grouped by layer (ADR-0003):
  components in `presentation/components/<Name>/`, pages in
  `presentation/pages/<Name>/`, query/mutation/use-case hooks in
  `application/<useThing>/`, the gateway/mapper/keys in `infrastructure/`, value
  objects + entity + view types in `domain/` (`camelCase` for non-components).
- `pages/` stays **flat** — each page is just `presentation/pages/<Page>/index.tsx`,
  with no child component folders. Every component lives under
  `presentation/components/`. A component used by exactly one **other component**
  nests inside that component's folder: the row pieces (`MemberRoleChip`,
  `MemberRowActions`, `MemberStatusBadge`, `MemberWorkspaces`) live under
  `components/MembersTable/`. A component used by a **page** sits at the top level
  of `components/` — `MembersTable`, `MembersToolbar`, `MembersPagination`,
  `MembersEmpty`, `MembersNoAccess`. **Shared** pieces also sit at the top of
  `components/` — `MemberAvatar` (used by the table, `MemberWorkspaces`, and the
  invite page) and `MembersSkeleton` (the page's `isPending` body, the invite
  page, and the lazy routes' `Suspense` fallback).
- Data flows through the gateway seam: `application/` hooks call
  `httpMemberGateway` behind the `MemberGateway` port (the sole `apiClient`
  user), never `apiClient` directly; wire→view mapping lives in
  `infrastructure/memberMapper`. Presentation-only member initials/avatar colors
  come from the shared `initialsOf`/`asAvatarColor`/`avatarColorForId` in
  `@ortha-cms/utils-admin` (no local copies).
- Co-located `defineMessages` (ids `users.<area>.<key>`); `type` over
  `interface`; design-system primitives only; a11y per the `accessibility` skill.

## Commands

- `npx nx typecheck @ortha-cms/users-admin` / `npx nx lint @ortha-cms/users-admin`
