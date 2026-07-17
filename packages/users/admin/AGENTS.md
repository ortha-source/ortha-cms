# @ortha-cms/users-admin

The members **admin plugin**: the **Members** page at `/users`, the **Invite
member** page at `/users/invite`, the **user detail** page at `/users/:id`, and
the sidebar nav entry.

## What it owns

- The private `/users`, `/users/invite`, and `/users/:id/*` routes (lazy +
  `<Suspense>`), rendered in the shell's authenticated layout.
- A `SIDEBAR_NAV_SLOT` entry (`group: 'directory'`, `order: 20`). The pages gate
  on the `users:read` permission via `useHasPermission`.
- The sidebar-footer **account menu** (`AccountMenu`), contributed to the
  shell's `SIDEBAR_FOOTER_SLOT`: a full-width row (avatar + name + email) that
  opens a dropdown with **My profile** (→ their own `/users/:id` detail page)
  and **Logout** (identity's `useLogoutMutation`). It reads the current user
  from identity's `useAuth`.

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
the Outlet context (`utils/userDetailContext`), so a tab read is free. Renders
the back link, `UserHero`, `UserStatsStrip`, and the `UserDetailTabs` underline
tab bar (design-system `TabNav`) above the active tab. Six tab pages:
**General** (edit name), **Role** (`RolePicker` +
confirm), **Workspaces** (`WorkspaceMembershipCard` + `AddToWorkspacesDialog`),
**Sessions** (`SessionCard` + revoke), **Activity** (reuses
`@ortha-cms/activity-admin`'s `useActivityLog`, pinned to `subjectId`), and
**Access** (suspend/reactivate). The Audit (Sessions, Activity) and Access tabs
are permission-gated **at the route level** — without `users:update` /
`activity:read` the tab bar hides them and the route redirects to General.

## Conventions

- `pages/` stays **flat** — each page is just `pages/<Page>/index.tsx`, with no
  child component folders. Every component lives under `components/`. A component
  used by exactly one **other component** nests inside that component's folder:
  the row pieces (`MemberRoleChip`, `MemberRowActions`, `MemberStatusBadge`,
  `MemberWorkspaces`) live under `components/MembersTable/`. A component used by a
  **page** sits at the top level of `components/` — `MembersTable`,
  `MembersToolbar`, `MembersPagination`, `MembersEmpty`, `MembersNoAccess`, and
  `EditMemberDialog`. **Shared** pieces also sit at the top of `components/` —
  `MemberAvatar` (used by the table, `MemberWorkspaces`, and the invite page) and
  `MembersSkeleton` (the page's `isPending` body, the invite page, and the lazy
  routes' `Suspense` fallback).
- Per-hook data layer in `api/` (each hook owns its request fn), shared
  `utils/membersKeys`; types in `types/member`. Presentation-only member
  initials/avatar colors come from the shared `initialsOf`/`asAvatarColor`/
  `avatarColorForId` in `@ortha-cms/utils-admin` (no local `utils/` copies).
- Co-located `defineMessages` (ids `users.<area>.<key>`); `type` over
  `interface`; design-system primitives only; a11y per the `accessibility` skill.

## Commands

- `npx nx typecheck @ortha-cms/users-admin` / `npx nx lint @ortha-cms/users-admin`
