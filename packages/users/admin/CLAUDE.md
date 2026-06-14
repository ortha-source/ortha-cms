# @ortha-cms/users-admin

The members **admin plugin**: the **Members** page at `/users`, the **Invite
member** page at `/users/invite`, and the toolbar nav entry.

## What it owns

- The private `/users` and `/users/invite` routes (lazy + `<Suspense>`),
  rendered in the shell's authenticated layout.
- A `NAVBAR_START_SLOT` entry (`order: 30`, after Workspaces). The pages gate on
  the `users:read` permission via `useHasPermission`.

## The pages

`MembersPage` — `Container`/`ContainerHeader`, a search toolbar, the
**Member · Role · Status · Workspaces** table with per-row actions, pagination,
an inline edit dialog, and a loading **skeleton** (`MembersTableSkeleton`) plus
empty/no-access states. `InviteMemberPage` — the invite form (role +
workspaces), gated the same way.

## Conventions

- Single-consumer components co-locate **under their consumer**: a piece used by
  exactly one page/parent (and not barrel-exported) lives inside that consumer's
  folder, cascading by depth. The whole `MembersTable` and its row pieces
  (`MemberRoleChip`, `MemberRowActions`, `MemberStatusBadge`, `MemberWorkspaces`)
  plus `MembersToolbar`, `MembersPagination`, `MembersEmpty`, `MembersNoAccess`,
  and `EditMemberDialog` live under `pages/MembersPage/` (the row pieces nested
  under `…/MembersTable/`). Only **shared** pieces stay in `components/` — here
  `MemberAvatar` (used by the table, `MemberWorkspaces`, and the invite page) and
  `MembersSkeleton` (the page's `isPending` body, the invite page, and the lazy
  routes' `Suspense` fallback).
- Per-hook data layer in `api/` (each hook owns its request fn), shared
  `utils/membersKeys`; types in `types/member`.
- Co-located `defineMessages` (ids `users.<area>.<key>`); `type` over
  `interface`; design-system primitives only; a11y per the `accessibility` skill.

## Commands

- `npx nx typecheck @ortha-cms/users-admin` / `npx nx lint @ortha-cms/users-admin`
