# @ortha-cms/users-admin — Test Artifact

> **Unit:** `packages/users/admin` · **Package:** `@ortha-cms/users-admin` · **Kind:** admin plugin
> **Source of truth:** `packages/users/admin/AGENTS.md`
> **Findings verified:** 2026-08-11 — 14 confirmed · 0 deleted · 4 corrected · 0 unverified
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

The member-management UI: the Members roster at `/users`, the three-step invite wizard at
`/users/invite`, the eight-tab user detail page at `/users/:id/*`, the sidebar
`AccountMenu`, and the app-wide `ThemeSync`.

It also owns two things that are *about* identity but live here: the **Logout** affordance
(it calls `identity-admin`'s `useLogoutMutation`) and the **Preferences** tab (theme,
`GET`/`PUT /api/preferences`, an identity-server endpoint).

It does **NOT** own:

- Any authorization decision. `useHasPermission` hides affordances; the server guard is the
  boundary (`.cursor/BUGBOT.md` §Admin, "Permission gating only in the UI").
- The auth kit itself (`AuthProvider` / `RequireAuth` / `useAuth`) — `identity-admin`.
- The activity table rendered in the Activity tab — that is `activity-admin`'s
  `useActivityLog`, called with `?subjectId=`.
- Workspace CRUD — it only **links** members to workspaces via
  `POST`/`DELETE /api/workspaces/:id/members`.

### Entry points

| Route | Component | Gated on |
| --- | --- | --- |
| `/users` | `pages/MembersPage` | `users:read` (else a no-access state, and **no fetch**) |
| `/users/invite` | `pages/InviteMemberPage` | `users:create` |
| `/users/:id` | `components/UserDetailRouter` → `UserDetailLayout` | `users:read` |
| `/users/:id/general` | `pages/UserGeneralPage` | `users:read` (edit needs `users:update`) |
| `/users/:id/roles` | `pages/UserRolesPage` | `users:update` to apply |
| `/users/:id/workspaces` | `pages/UserWorkspacesPage` | `users:read` |
| `/users/:id/sessions` | `pages/UserSessionsPage` | `users:update` (tab hidden otherwise) |
| `/users/:id/activity` | `pages/UserActivityPage` | `activity:read` (tab hidden otherwise) |
| `/users/:id/access` | `pages/UserAccessPage` | `users:update` (tab hidden otherwise) |
| `/users/:id/preferences` | `pages/UserPreferencesPage` | **self only** (`UserDetailTabs/index.tsx:132`) |

**Slot contributions:** `SIDEBAR_NAV_SLOT` (Members, `group: 'directory'`) and
`SIDEBAR_FOOTER_SLOT` (`AccountMenu`) — see `presentation/usersPlugin/index.tsx`.

**Data layer** — one gateway with eleven methods
(`infrastructure/httpMemberGateway/index.ts`): list, get, invite, resendInvite,
revokeInvite, update, setStatus, addWorkspace, removeWorkspace, listSessions,
revokeSession, listWorkspaceOptions. Plus `preferencesGateway` for the theme. These two
files are the only `apiClient` users in the plugin.

### Runtime prerequisites

- API running with `identity`, `users`, `workspaces` and (for the Activity tab) `activity`
  plugins registered.
- Signed in. **Almost every write here is admin-only** — `users:create` / `users:update` /
  `users:delete` belong to `admin` alone; `users:read` is held by every role.
- Seed data: ≥ 12 members spanning `pending` / `active` / `disabled`, at least two admins
  (so the last-admin guardrails can be exercised in both directions), at least two
  workspaces, and one member with two live sessions.
- For the Preferences tab: you must be viewing **your own** profile.

### How to exercise it manually

```bash
docker compose up -d && npx nx run server:db:migrate && npm run dev
open http://localhost:4200/users
```

Invite: `/users/invite`. Detail: click any row, or `/users/<id>/general`.
Your own profile: sidebar Account menu → "My profile".

### Dependencies that must be healthy

`@ortha-cms/identity-admin` (`useHasPermission`, `useAuth`, `useLogoutMutation`),
`@ortha-cms/shell-admin` (`PageTopBar`, the slots), `@ortha-cms/design-system`
(`Table`, `Dialog`, `ConfirmDialog`, `DropdownMenu`, `RadioGroup`, `Pagination`, `toast`,
`useAppearance`), `@ortha-cms/query-builder-admin` (`QueryBuilderDrawer`),
`@ortha-cms/utils-admin` (`apiClient`, `useTableUrlState`, `toApiError`, `HTTP_STATUS`,
`initialsOf`, `avatarColorForId`), `@ortha-cms/activity-admin` (the Activity tab).

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | Members roster: avatar, name, email, role chip, status pill, workspaces, joined, row menu | `presentation/components/MembersTable/index.tsx:57-146` | ✅ E2E |
| F2 | Row click → detail; the name is a real link for keyboard users | `MembersTable/index.tsx:92,103-111` | ✅ E2E |
| F3 | Debounced search, deep-linked to `?search=` | `pages/MembersPage/index.tsx:93-96`, `components/MembersToolbar` | ✅ E2E |
| F4 | Query-builder filter drawer, deep-linked to `?filter=` | `MembersPage/index.tsx:99-104,138-143`, `presentation/membersFilterFields` | ✅ E2E |
| F5 | Pagination + selectable page size, deep-linked | `components/MembersPagination`, `MembersPage/index.tsx:268-278` | ✅ E2E |
| F6 | Page clamped to `pageCount` after a mutation or a narrowing filter | `MembersPage/index.tsx:129-136` | ⚠️ PARTIAL |
| F7 | Four distinct states: skeleton / error+retry / empty / table | `MembersPage/index.tsx:242-281` | ✅ E2E |
| F8 | Empty state distinguishes "filtered to nothing" from "no members" | `components/MembersEmpty`, `MembersPage/index.tsx:169-170,259-264` | ✅ E2E |
| F9 | No-access state without `users:read`, and **no request is made** | `MembersPage/index.tsx:113-115,146-166` | ✅ E2E |
| F10 | Result count announced in a polite live region | `MembersPage/index.tsx:237-241` | ❌ NONE |
| F11 | Row menu mirrors the detail tabs, permission-gated per group | `MembersTable/MemberRowActions/index.tsx:307-390` | ✅ E2E |
| F12 | Status quick actions: Resend/Revoke (pending), Disable (active), Enable (disabled) | `MemberRowActions/index.tsx:181-283` | ✅ E2E |
| F13 | Disable is inert with a tooltip for yourself / the last admin | `MemberRowActions/index.tsx:224-237`, `GuardedMenuItem` | ⚠️ PARTIAL |
| F14 | Resend → reveal-once `InviteLinkDialog` with the rotated link | `MemberRowActions/index.tsx:186-192,394-403`, `components/InviteLinkDialog` | ✅ E2E |
| F15 | Three-step invite wizard (details → workspaces → sent) | `pages/InviteMemberPage`, `application/useInviteMemberFlow/index.ts:68-104` | ✅ E2E |
| F16 | "All workspaces" mode + workspace search in the wizard | `pages/InviteMemberPage` | ✅ E2E |
| F17 | Continue is blocked for an invalid email (no request) | `useInviteMemberFlow/index.ts:77`, `domain/value-objects/email` | ✅ E2E |
| F18 | Invite result: link built from `window.location.origin` | `infrastructure/inviteLink/index.ts:20-24` | ✅ E2E |
| F19 | 409 → "email taken"; anything else → generic | `useInviteMemberFlow/index.ts:97-101` | ⚠️ PARTIAL |
| F20 | User detail hero + stats strip + tab nav | `components/UserDetailLayout/*` | ✅ E2E |
| F21 | Tabs gated: Sessions/Access on `users:update`, Activity on `activity:read`, Preferences self-only | `UserDetailLayout/UserDetailTabs/index.tsx:106-138` | ✅ E2E |
| F22 | General tab — edit display name | `pages/UserGeneralPage` | ✅ E2E |
| F23 | Role tab — radio-card picker, confirm step, extra warning for Admin | `pages/UserRolesPage/index.tsx:77-170`, `components/RolePicker` | ⚠️ PARTIAL |
| F24 | Role tab locks for the last admin, with the reason shown | `UserRolesPage/index.tsx:88-90,116-122` | ❌ NONE |
| F25 | Workspaces tab — add/remove memberships | `pages/UserWorkspacesPage`, `components/AddToWorkspacesDialog`, `components/WorkspaceMembershipCard` | ❌ NONE |
| F26 | Sessions tab — list + confirmed revoke | `pages/UserSessionsPage/index.tsx:66-158`, `components/SessionCard` | ✅ E2E |
| F27 | Activity tab — the member's own audit trail | `pages/UserActivityPage` | ✅ E2E |
| F28 | Access tab — disable / enable sign-in | `pages/UserAccessPage` | ⚠️ PARTIAL |
| F29 | Preferences tab — theme radio cards, optimistic apply + rollback | `pages/UserPreferencesPage/index.tsx:122-258` | ✅ E2E |
| F30 | `ThemeSync` — hydrate the saved theme app-wide on load | `components/ThemeSync`, `application/useUpdateTheme` | ✅ E2E |
| F31 | `AccountMenu` — signed-in identity, My profile, Logout | `components/AccountMenu/index.tsx:45-107` | ✅ E2E |
| F32 | `toMember` mapper — initials, avatar colour, role coercion, date parsing | `infrastructure/memberMapper/index.ts:73-90` | ❌ NONE |
| F33 | `MemberEntity` client-side guardrails (`canBeRemoved`, `canChangeRole`) | `domain/member/index.ts` | ❌ NONE |
| F34 | Mutations invalidate `membersKeys.all`; resend opts out | `application/useMembersMutation/index.ts:14-31` | ⚠️ PARTIAL |
| F35 | Sessions query `staleTime: 0`, invalidated per-member on revoke | `application/useUserSessions/index.ts:13-20`, `useRevokeSession/index.ts:18-22` | ✅ E2E |

## 3. Manual Test Plan

Base `http://localhost:4200`, signed in as an **admin** unless a step says otherwise.

### F1 / F2 — The roster

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Go to `/users` | `<h1>` "Members", subtitle "{n} people who can sign in to this workspace." |
| 2 | Inspect a row | avatar with initials, name, email beneath, role chip, status pill, workspace stack, joined date, kebab |
| 3 | Click anywhere on a row body | navigates to `/users/<id>` |
| 4 | Click the member's **name** | same destination, and the row's own click does not double-fire (`stopPropagation`) |
| 5 | Click inside the actions cell | the menu opens and you do **not** navigate |

**Keyboard-only path:** Tab reaches the member **name link** (the row itself is not a tab
stop — see ♿ A11Y-users-admin-01) → Enter navigates. Tab again reaches the row's kebab
button → Enter/Space opens the menu → ↓/↑ move between items → Enter activates → **Esc**
closes and returns focus to the kebab.
**Screen reader:** the table announces via `aria-label="Members"`
(`MembersTable/index.tsx:63`); each header cell is `scope="col"`; the actions column
header is `sr-only` "Actions".

### F3 / F4 / F5 / F6 — Search, filter, pagination

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Type `grac` into the search box | after the debounce the URL gains `?search=grac` and the table narrows |
| 2 | Reload the page | the search survives (the URL is the source of truth) |
| 3 | Open **Filters**, add `role is admin`, Apply | the URL gains `?filter=…`; the trigger reads "Filters (1)" |
| 4 | Copy the URL into a new tab | the drawer rehydrates the same rule |
| 5 | Press **Reset** in the drawer | the filter clears and the full roster returns |
| 6 | Set the page size to 5 and go to page 3 | `?page=3&pageSize=5` |
| 7 | With 11 members on page 3 (1 row), revoke that member's invite | the page **clamps to 2** and refetches — the user is not stranded on an empty page |
| 8 | Deep-link `?page=4` when only 2 pages exist | after the first response lands, the page clamps to 2 (guarded on `data`, so a deep link is not reset to 1 before the fetch) |
| 9 | Deep-link `?page=2` on a fresh load with 30 members | you stay on page 2 |

### F7 / F8 / F9 / F10 — Page states

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Throttle the network and load `/users` | a skeleton table, **not** an empty state |
| 2 | Force `GET /api/users` to 500 | a destructive `Alert` "Couldn't load members. Please try again." with a **Retry** button — not the empty state |
| 3 | Press Retry with the API restored | the table renders |
| 4 | Search for a term matching nobody | the **filtered** empty state, with a "Clear filters" action |
| 5 | Point at an empty database | the **unfiltered** empty state, with an "Invite" action if you hold `users:create` |
| 6 | Sign in as a role without `users:read` | the no-access state, and **zero** requests to `/api/users` in the Network tab |
| 7 | Search and watch a screen reader | "{n} members found." is announced politely (`role="status" aria-live="polite"`, `sr-only`) |

### F11 / F12 / F13 — The row menu

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open the kebab on an **active** member | groups: Account (General / Role / Workspaces), Audit (Sessions / Activity), Access (Sign-in access), then Disable |
| 2 | Open it as a role without `users:update` | the Audit and Access groups are absent; no Disable |
| 3 | Open it without `activity:read` | no Activity item |
| 4 | Open it on a **pending** invite | Resend invite + Revoke invite (the latter styled destructive) |
| 5 | Open it on a **disabled** member | Enable |
| 6 | Open the kebab on **your own** row | Disable is present but inert; hovering/focusing shows "You cannot disable your own account." |
| 7 | Same on the sole active admin | Disable is inert with "The last remaining admin cannot be disabled. Promote another member to admin first." |
| 8 | Click **Disable** on someone else | **the account is disabled immediately, with no confirmation** — a success toast "Disabled {name}" appears → 🐞 BUG-users-admin-02 |
| 9 | Click **Revoke invite** | **the pending account is deleted immediately, with no confirmation** — toast "Revoked the invite for {email}" → 🐞 BUG-users-admin-02 |
| 10 | Force the mutation to fail | toast "Something went wrong. Please try again." |

**Keyboard-only path:** Tab to the kebab → Enter → the menu opens with focus on the first
item → ↓/↑ traverse, skipping separators and labels → Enter activates → Esc closes,
focus returns to the kebab. On an inert item, Enter does nothing and the tooltip is
reachable by focus (Radix's real `disabled` is deliberately avoided so the tooltip still
works — `MemberRowActions/index.tsx:409-412`).
**Screen reader:** the kebab announces "Actions for {name}, button" — a genuinely unique,
meaningful name (`MemberRowActions/index.tsx:300-302`).

### F14 — Resend and the reveal-once link

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Row menu on a pending invite → **Resend invite** | a modal opens: "Send this link to {email}" |
| 2 | Read the body | "The previous invite link stopped working the moment this one was created…It's shown once — copy it before you close this." |
| 3 | Inspect the link field | a `readOnly` `<input>` holding the full URL; focusing it **selects** the whole value |
| 4 | Press **Copy link** | a success toast "Invite link copied to clipboard"; the icon flips to a tick |
| 5 | Deny clipboard permission (or use an insecure origin) and retry | an error toast "Couldn't reach the clipboard. Select the link and copy it manually." |
| 6 | Press **Done**, then reopen the row menu | the link is **gone forever** — it lives only in component state |
| 7 | Press **Esc** instead of Done | same — the link is discarded with no warning → 🐞 BUG-users-admin-03 |
| 8 | Open the old link (before the resend) in a private window | the dead-link card |

**Keyboard-only path:** Enter on "Resend invite" → focus moves into the dialog → Tab
reaches the link input (selects on focus, so Ctrl/Cmd+C works) → Tab → Copy link → Tab →
Done → Enter closes → focus returns to the kebab.

### F15 / F16 / F17 / F18 / F19 — The invite wizard

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `/users` → **Invite member** | `/users/invite`, step 1 (details) |
| 2 | Enter an invalid email | **Continue is disabled**; no request |
| 3 | Enter a valid email + role, Continue | step 2 (workspaces) |
| 4 | Choose "All workspaces" | every workspace is selected |
| 5 | Search the workspace list | it narrows |
| 6 | Submit | step 3 (sent) with the link panel |
| 7 | Read the warning | "This link is shown once and works once. Anyone who opens it becomes {email} — send it the way you'd send a password, not in a public channel." |
| 8 | Confirm the origin of the built link | `window.location.origin` + `/identity/accept-invite?token=…` |
| 9 | Invite an email that already exists | an inline alert reading "taken", not the generic one |
| 10 | Force a 500 | the generic alert; you can go back, fix, and retry |
| 11 | Navigate away from step 3 without copying | the link is lost with no warning |

### F20 / F21 — Detail layout and tab gating

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open `/users/<id>` | the hero (avatar, name, email, status), a stats strip, the tab row, and the General tab |
| 2 | Count the tabs as an admin viewing someone else | General, Role, Workspaces, Sessions, Activity, Sign-in access — **six** |
| 3 | As a role with `users:read` only | General, Role, Workspaces — **three** |
| 4 | Without `activity:read` | no Activity tab |
| 5 | Viewing **your own** profile | a seventh tab, **Preferences** |
| 6 | Viewing someone else | no Preferences tab |
| 7 | Deep-link `/users/<someone else>/preferences` | redirected away |
| 8 | Deep-link `/users/<id>/sessions` without `users:update` | redirected away — no dead link |
| 9 | On a `disabled` member, look at the Sign-in access tab | it carries a destructive "Disabled" badge |

**Keyboard-only path:** the tabs are `NavLink`s inside a `TabNav`, i.e. **links, not an
ARIA tablist** — Tab moves through them one at a time and Enter navigates. Arrow keys do
**not** move between them. See ♿ A11Y-users-admin-04 for why that is acceptable but should
be verified rather than assumed.

### F22 / F23 / F24 — General and Role tabs

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | General tab → change the display name → Save | `PATCH /api/users/:id`; the hero and the roster both update |
| 2 | Role tab | three radio cards (Admin / Contributor / Viewer), each with a description; the saved one carries a "Current" badge |
| 3 | Read the note | "Role changes take effect on their next request; existing sessions may keep the old permissions briefly." |
| 4 | Select a different role | **Apply role** enables; **Reset** enables |
| 5 | Press Reset | the selection returns to the saved role; both buttons disable |
| 6 | Press Apply role | a confirm dialog "Change {name}'s role?" |
| 7 | Select **Admin** and press Apply | the dialog body is the escalation warning: "Admins have full access — they can manage members, roles, workspaces, and content. Continue?" |
| 8 | Confirm | `PATCH` fires; toast "Updated {name}'s role." |
| 9 | Cancel | nothing is sent |
| 10 | Open the Role tab for the **sole active admin** | the picker is disabled and an alert explains "This member is the last remaining admin, so their role can't change. Promote another member to admin first." |
| 11 | Open your **own** Role tab (with another admin present) | the picker is enabled client-side; applying returns a 409 from the server and shows "Couldn't change the role. Please try again." → 🐞 BUG-users-admin-04 |
| 12 | As a role without `users:update` | the footer buttons are absent and the picker is disabled |

**Keyboard-only path:** Tab into the radio group → ↑/↓ or ←/→ move the selection (native
radio behaviour, one tab stop for the group) → Tab → Reset → Tab → Apply role → Enter →
focus moves into the confirm dialog → Tab between Cancel/Confirm → Esc cancels and returns
focus to Apply.
**Screen reader:** each card announces "Admin, radio button, 1 of 3, not checked" plus its
description; the "Current" badge is read as part of the label.

### F26 — Sessions tab

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open the Sessions tab for a member with two live sessions | two cards with device/user-agent, IP, first-seen and last-seen |
| 2 | Open **your own** Sessions tab | one card is marked as the current device |
| 3 | Press **Revoke** on a card | a confirm dialog "Revoke this session?" / "The device will be signed out immediately and must sign in again." |
| 4 | Read the dialog title | **it does not say which device** → ♿ A11Y-users-admin-02 |
| 5 | Confirm | `DELETE /api/users/:id/sessions/:sid`; toast "Session revoked."; the card disappears |
| 6 | Have that device make a request | `401` |
| 7 | Force the revoke to fail | toast "Couldn't revoke the session. Please try again."; the dialog closes anyway |
| 8 | Throttle the network | two skeleton cards, then the list |
| 9 | Force a 500 on the list | a destructive alert with Retry — **not** an empty state |
| 10 | On a member with no live sessions | "No active sessions." |

### F29 / F30 — Preferences and theme

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Own profile → Preferences | three cards (Light / Dark / System) with live previews; the saved one is selected |
| 2 | Pick Dark | the **whole app** re-themes immediately, then `PUT /api/preferences`; toast "Theme saved." |
| 3 | Pick the theme already in effect | **no** request (`UserPreferencesPage/index.tsx:136-138`) |
| 4 | Force the PUT to fail | the theme rolls back to the previous one; toast "Couldn't save your theme. Please try again." |
| 5 | Arrow rapidly across all three | exactly one toast at a time (a stable toast id replaces in place), and a slow failure for an abandoned choice does **not** yank the UI |
| 6 | Force `GET /api/preferences` to fail | a warning alert "Couldn't load your saved theme, so this may not be the one stored on your account…" and the picker stays usable — a genuinely correct error-vs-default distinction |
| 7 | Choose System | a line beneath reads "Your device is currently set to {light\|dark}." |
| 8 | Reload the app | the saved theme is applied before first paint (`ThemeSync`) |
| 9 | Navigate to a route that overrides the sidebar | the theme persists |

**Keyboard-only path:** Tab into the radio group (one stop) → arrows change the selection,
each firing a save → Tab out.
**Screen reader:** the group announces via `aria-label="Colour theme"`
(`UserPreferencesPage/index.tsx:189`); the visible tick is `aria-hidden`, so the state comes
from the real `RadioGroupItem`, which is `sr-only` but present.

### F31 — Account menu

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Look at the sidebar footer | avatar + display name (falling back to the email) + email |
| 2 | During the auth probe | the widget renders **nothing** rather than an empty row |
| 3 | Open it | "My profile" and "Logout" |
| 4 | My profile | `/users/<your id>` |
| 5 | Logout | `POST /api/auth/logout`, then the redirect to sign-in |
| 6 | Logout while offline | **nothing visible happens** → 🐞 BUG-identity-admin-04 |

## 4. Edge Cases & Negative Paths

### Empty / zero

- **EC-01 — Roster with zero members.** `✅ E2E` (`members.spec.ts:66` covers the filtered
  case) — the unfiltered variant is unasserted.
- **EC-02 — A member with no workspaces.** `❌ NONE` — `MemberWorkspaces` renders an empty
  stack; confirm it does not render a stray separator.
- **EC-03 — A member with `name: null`.** `❌ NONE` — `toMember` substitutes the email
  (`memberMapper/index.ts:74`) and derives initials from it. So a pending invitee shows as
  their email throughout. Deliberate; unasserted.
- **EC-04 — Zero sessions.** `❌ NONE` — "No active sessions."
- **EC-05 — Zero workspaces to assign in the wizard.** `❌ NONE` — the "All workspaces"
  control with an empty list.
- **EC-06 — `permissions: []`.** `❌ NONE` — the no-access state on `/users`, and the
  sidebar entry itself should be hidden by the slot's own gating.

### Boundary

- **EC-07 — Delete the only row on the last page.** `⚠️ PARTIAL` — the clamp exists
  (`MembersPage/index.tsx:129-136`) and is guarded on `data` so a deep-linked `?page=N` is
  not reset before the first fetch. This is the exact `.cursor/BUGBOT.md` "stale page after
  mutation" trap, handled correctly — but **no test drives a mutation that shrinks the list
  while on the last page**.
- **EC-08 — `?page=0` or `?page=-1` in the URL.** `❌ NONE` — `useTableUrlState` parses it;
  the server 400s on `page=0`, which surfaces as the error state rather than a clamp.
- **EC-09 — `?pageSize=999`.** `❌ NONE` — the server 400s → the error state. The UI offers
  only its own options, so this needs a hand-edited URL.
- **EC-10 — Exactly `pageSize` members (one full page).** `❌ NONE` — `pageCount` is 1 and
  the pager should not offer a page 2.

### Size & encoding

- **EC-11 — A 200-character display name.** `❌ NONE` — the table cell is `truncate`
  (`MembersTable/index.tsx:105`), so it clips visually; the full value must remain in the
  accessible name. Check the detail hero too.
- **EC-12 — Emoji / RTL name.** `❌ NONE` — `initialsOf` on an emoji name, and RTL text
  inside an LTR table cell. Verify no layout break and no broken surrogate pair in the
  avatar initials.
- **EC-13 — `<script>alert(1)</script>` as a name.** `❌ NONE` — React escapes it; assert it
  renders as literal text in the table, the hero, the row-menu tooltip, and the toast
  ("Disabled {name}").
- **EC-14 — A very long email in the invite link warning.** `❌ NONE` — the message
  interpolates `{email}`; check it wraps rather than overflowing the dialog.
- **EC-15 — An unbreakable invite URL in the link field.** `✅ handled` — the row is
  `min-w-0` and the input `truncate`, with the reasoning commented at
  `InviteLinkPanel/index.tsx:74-76`. The button is `shrink-0` so the link, not the control,
  gives up space.

### Permission matrix

| Surface | admin | contributor | viewer | authenticated, no grants | unauthenticated |
| --- | --- | --- | --- | --- | --- |
| Sidebar "Members" entry | shown | shown | shown | hidden | n/a |
| `/users` roster | full | read-only | read-only | no-access state, **no fetch** | redirected to sign-in |
| "Invite member" button | shown | hidden | hidden | hidden | n/a |
| `/users/invite` | works | server 403s | server 403s | server 403s | redirected |
| Row menu → Account group | shown | shown | shown | n/a | n/a |
| Row menu → Audit group | shown | hidden | hidden | hidden | n/a |
| Row menu → Access group | shown | hidden | hidden | hidden | n/a |
| Row menu → Disable/Enable | shown | hidden | hidden | hidden | n/a |
| Row menu → Resend/Revoke invite | shown | hidden | hidden | hidden | n/a |
| Detail tabs | 6 (+Preferences on self) | 3 | 3 | 3 | n/a |
| Role tab footer buttons | shown | hidden | hidden | hidden | n/a |
| Sessions tab | shown | hidden (route redirects) | hidden | hidden | n/a |
| Activity tab | shown | hidden | hidden | hidden | n/a |
| Preferences tab | self only | self only | self only | self only | n/a |

- **EC-16 — Hidden ≠ enforced.** `.cursor/BUGBOT.md`: *"`useHasPermission` hides
  affordances for UX; it is **not** security."* Every gate above has a matching server
  guard — `users:update` on PATCH/disable/enable and on the session list/revoke,
  `users:create` on invite/resend, `users:delete` on revoke-invite, `activity:read` on the
  activity read. Verified against `docs/testing/users-server.md` §4 and
  `docs/testing/identity-server.md` §4. **One gap:** the admin gates the *session list* on
  `users:update` while the server gates it on `users:read`
  (`packages/identity/server/.../user-sessions.controller.ts:68`), so a `viewer` who calls
  the API directly gets data the UI would never show them — cross-referenced as
  🐞 BUG-identity-server-04.
- **EC-17 — Deep-link a gated tab.** `✅ E2E` (`user-detail.spec.ts:159`) — hidden and
  redirected, so a read-only admin never sees a dead link.
- **EC-18 — Deep-link someone else's Preferences.** `✅ E2E` (`preferences.spec.ts:56`).

### Tenant isolation

Not applicable — the member directory is deployment-wide by design. The relevant
cross-account concern is the post-logout cache, owned by `identity-admin`
(🐞 BUG-identity-admin-01) and visible **here** first, because `useMembers` uses
`placeholderData: keepPreviousData` (`useMembers/index.ts:25`) and so deliberately keeps
the previous rows on screen through a refetch.

### Concurrency

- **EC-19 — Double-click Disable in the row menu.** `❌ NONE` — the menu closes on select,
  so a second click needs the menu reopened; the second call would 409 (already disabled)
  and surface the generic failure toast.
- **EC-20 — Double-click Resend.** `❌ NONE` — each click rotates again. The dialog shows
  whichever response settles last, which may not be the surviving token. Cross-referenced
  as 🐞 BUG-users-server-03.
- **EC-21 — Two admins demote each other simultaneously.** Server-side, the advisory lock
  serialises them; client-side one sees a 409 toast. `❌ NONE` end-to-end.
- **EC-22 — Apply a role while another tab disables the same member.** `❌ NONE` — the
  second write 409s; the UI shows the generic failure toast, which does not explain that
  the member is now disabled.
- **EC-23 — Rapid theme arrowing.** `✅ handled` — a `latest` ref means only the newest
  choice owns the rollback, with the reasoning commented at
  `UserPreferencesPage/index.tsx:128-132`. `✅ E2E` adjacent (`preferences.spec.ts:85`).

### State after mutation

- **EC-24 — Every member mutation invalidates `['members']`.** `⚠️ PARTIAL` —
  `membersKeys.all` is `['members']` (`membersKeys/index.ts:20`), which is a **prefix** of
  `['members','list',params]`, `['members','detail',id]` **and**
  `['members','detail',id,'sessions']`. So disabling a member refetches every cached list
  page, every cached detail, and every cached session list. See 🐞 BUG-users-admin-05.
- **EC-25 — Resend opts out of invalidation.** `✅ correct` — it changes no list-visible
  field (`useMembersMutation/index.ts:15-16`, `useResendInvite`). Good discrimination.
- **EC-26 — Revoke a session invalidates only that member's sessions key.** `✅ correct`
  (`useRevokeSession/index.ts:18-22`) — appropriately narrow.
- **EC-27 — Revoke the invite of the member whose detail page you are on.** `❌ NONE` — the
  row is deleted server-side; the next `GET /api/users/:id` 404s. Verify the detail page
  shows a not-found state rather than a blank shell.
- **EC-28 — Filters survive a refetch.** `✅ E2E` (`members-filter.spec.ts:67`) — the URL is
  the source of truth, so an invalidation cannot drop them.

### Failure & partiality

- **EC-29 — `GET /api/users` 500.** `✅ E2E`-adjacent — a distinct error state with Retry
  (`MembersPage/index.tsx:245-258`), correctly **not** the empty state.
- **EC-30 — `GET /api/users/:id/sessions` 500.** `❌ NONE` — same pattern, correctly
  implemented (`UserSessionsPage/index.tsx:112-124`).
- **EC-31 — `GET /api/preferences` 500.** `✅ E2E`-adjacent — a dedicated warning, with the
  reasoning commented at `UserPreferencesPage/index.tsx:174-177`. This is the reference
  implementation for error-vs-default in the repo.
- **EC-32 — `GET /api/workspaces` 500 in the invite wizard.** `❌ NONE` — check the
  workspace step does not present an empty list as "no workspaces exist".
- **EC-33 — Clipboard denied on the invite link.** `✅ handled` — caught, with an error
  toast telling the admin to select and copy manually
  (`InviteLinkPanel/index.tsx:64-69`). Note `api-tokens-admin` does **not** do this
  (🐞 BUG-api-tokens-admin-01), so this file is the correct pattern.
- **EC-34 — Network drop mid-invite.** `❌ NONE` — `useInviteMemberFlow` swallows the
  rejection and sets `errorReason: 'failed'`; the user can go back and retry. The pending
  member may or may not have been created — a retry then 409s "taken", which is confusing
  but safe.

### Idempotency & replay

- **EC-35 — Browser Back after revoking an invite.** `❌ NONE` — you return to the roster,
  which refetches. The deleted row is gone.
- **EC-36 — Refresh after the invite wizard's step 3.** `❌ NONE` — **the link is lost.** It
  exists only in `useInviteMemberFlow`'s `sent` state (`useInviteMemberFlow/index.ts:70`)
  and is not re-fetchable. See 🐞 BUG-users-admin-03.
- **EC-37 — Replay Apply role with the same value.** `❌ NONE` — `dirty` is false so Apply
  is disabled. Correct.

---

### 4A. Accessibility & Section 508 Conformance

**Standards tested against.** Revised Section 508 (36 CFR Part 1194, Appendices A–C)
incorporates WCAG 2.0 A + AA by reference (E205.4 electronic content, 504.2 authoring
tools). This repo's `accessibility` skill targets **WCAG 2.1 AA**, so findings are tested
to 2.1 AA with the 508 provision cited alongside. Chapter 5 provisions assessed:
**502.2/502.3** (AT interoperability), **503.2** (user preferences), **503.4**, **504**.

**Do not trust axe.** This unit has the repo's best automated a11y coverage —
`apps/admin-e2e/src/users/a11y.spec.ts` scans seven states (table `:18`, skeleton `:24`,
invite details step `:37`, invite workspaces step `:44`, **open row menu** `:59`, empty
`:66`, no-access `:73`), `members-filter.spec.ts:81` scans the open filter drawer with a
rule, and `preferences.spec.ts:112,124` scans the theme picker in **both** light and dark.
That is genuinely strong. It still proves nothing about focus restoration after a
destructive action, whether a confirmation dialog's name identifies its target, whether a
row-level control's name is *meaningful*, announcement timing, or reflow. Every finding
below is in a category axe cannot reach — which is why all ten scans pass today.

Three states are notably **not** scanned: the **confirm dialogs** (role change, revoke
session), the **reveal-once invite link dialog**, and the **user detail page** in any tab.

---

#### ♿ A11Y-users-admin-01 — Destructive row actions fire immediately with no confirmation

**SC:** 3.3.4 Error Prevention (Legal, Financial, Data) (AA)
**508:** E205.4 / 502.3.14
**Verdict:** **Does Not Support**
**Location:** `packages/users/admin/src/lib/presentation/components/MembersTable/MemberRowActions/index.tsx:201-220`
(Revoke invite), `:233-257` (Disable)

```tsx
<DropdownMenuItem key="revoke" className="text-destructive …"
    onSelect={() => revokeInvite.mutate(member.id, { onSuccess: … })}>
```

Selecting the item calls the mutation directly. **Revoke invite deletes the pending user
row** (cascading its token and memberships); **Disable** locks a person out of the product
and revokes all their live sessions. Neither is reversible from the UI, and neither has an
undo.

**Repro:** open any pending member's kebab and press Enter on "Revoke invite". The account
is gone before you release the key.

**Keyboard-only experience:** worst case. Arrowing through a menu is a scanning motion;
"Revoke invite" is the **last** item and sits directly below "Resend invite", so one extra
`↓` before `Enter` destroys the account instead of rotating its link. A mouse user at least
has to travel to the item.
**Screen-reader experience:** the item announces "Revoke invite, menu item" with no
indication that it is destructive or immediate (the destructive styling is colour-only —
`className="text-destructive"` — which is also a **1.4.1 Use of Color (A)** concern). The
first feedback is a success toast after the fact.

The same codebase gets this right three times over: the Role tab wraps a *non*-destructive
role change in a `ConfirmDialog` (`UserRolesPage/index.tsx:156-171`), the Sessions tab
confirms a revoke (`UserSessionsPage/index.tsx:143-156`), and `api-tokens-admin` confirms a
token revoke (`ApiTokensTable/index.tsx:276-296`). The two genuinely destructive member
actions are the only ones that do not.

**Remediation:** wrap both in the existing `ConfirmDialog`, with the member's name and
email in the description, matching the Role tab's pattern. Cross-reference
🐞 BUG-users-admin-02.

---

#### ♿ A11Y-users-admin-02 — Confirmation dialogs do not name what they are about to destroy

**SC:** 2.4.6 Headings and Labels (AA), 3.3.4 Error Prevention (AA), 4.1.2 Name/Role/Value (A)
**508:** E205.4 / 502.3.1
**Verdict:** **Partially Supports**
**Location:** `packages/users/admin/src/lib/presentation/pages/UserSessionsPage/index.tsx:38-46,151-152`

```ts
confirmTitle: { defaultMessage: 'Revoke this session?' },
confirmBody:  { defaultMessage: 'The device will be signed out immediately and must sign in again.' },
```

The dialog is opened from a *specific* `SessionCard` (`onRevoke={setRevoking}` passes the
session), and the component holds it in `revoking` — but neither the title nor the body
interpolates anything about it. On a member with four sessions, all four Revoke buttons
open a dialog reading exactly the same words.

**Repro:** open the Sessions tab for a member with three sessions. Using only a screen
reader, press Revoke on the second card and confirm you can tell which device you are about
to kill.

**Keyboard-only experience:** focus enters the dialog and the originating card is no longer
visible in the reading position — the user must remember which of three identical-looking
buttons they pressed.
**Screen-reader experience:** Radix uses `DialogTitle` as the dialog's accessible name, so
the user hears "Revoke this session?, dialog" — with no device, no IP, no last-seen time.
For a destructive, irreversible action this is precisely the 3.3.4 failure mode.

The Role tab does this correctly — "Change {name}'s role?" — and `api-tokens-admin`
interpolates the token name into its **description**
(`ApiTokensTable/index.tsx:284-286`), though not its title.

**Remediation:** interpolate the session's user-agent (or a friendly device label) and
last-seen time into the title or description, as the Role tab does with `{name}`.

---

#### ♿ A11Y-users-admin-03 — After a destructive action the row disappears and focus is dumped on `<body>`

**SC:** 2.4.3 Focus Order (A), 4.1.3 Status Messages (AA)
**508:** E205.4 / 502.3.14
**Verdict:** **Does Not Support**
**Location:** `MemberRowActions/index.tsx:186-220` (resend/revoke), `:233-282` (disable/enable),
`UserSessionsPage/index.tsx:83-95` (revoke session)

Every one of these mutations invalidates a query, the list re-renders without the row (or
with it moved), and **nothing sets focus**. Radix restores focus to the dropdown trigger on
close — but the trigger is inside the row that has just been removed, so it is unmounted
and focus falls to `<body>`.

**Repro:** with a keyboard only, revoke a pending invite from the row menu. Press Tab.

**Keyboard-only experience:** the next Tab restarts from the top of the document — past the
skip link, the sidebar, the top bar, the search box and the filter button — before reaching
the table again. On a roster of any size this is a full re-traversal after every action.
**Screen-reader experience:** the success toast does announce (sonner mounts a live region
in `createAdmin`), so the user learns *that* something happened — but the reading cursor is
reset and they have lost their place entirely. This is the "focus dumped to `<body>`" bug
the orchestrator's brief names, in its textbook form.

The Sessions tab has the same shape: the card unmounts, the `ConfirmDialog` closes, and
Radix tries to restore focus to a Revoke button that no longer exists.

**Remediation:** after a row-removing mutation, move focus to a stable anchor — the next
row's kebab, or the table's container with `tabIndex={-1}`, or the page `<h1>`.

---

#### ♿ A11Y-users-admin-04 — The user-detail "tabs" are links, not an ARIA tablist; correct, but the naming invites the wrong expectation

**SC:** 4.1.2 Name/Role/Value (A), 2.1.1 Keyboard (A), 2.4.3 Focus Order (A)
**508:** E205.4 / 502.3.1 / 502.3.7 (Actions on Objects)
**Verdict:** **Supports** — with a caveat worth pinning
**Location:** `packages/users/admin/src/lib/presentation/components/UserDetailLayout/UserDetailTabs/index.tsx:57-67,90`

```tsx
<TabNav aria-label={intl.formatMessage(messages.nav)}>
    <TabNavLink asChild><NavLink to={to}>…</NavLink></TabNavLink>
```

These are **`NavLink`s inside a labelled navigation landmark**, not `role="tab"` elements.
That is the right choice: each tab is a real route with its own URL, so it must be
linkable, bookmarkable and back-button-able — and the WAI-ARIA tabs pattern (arrow-key
roving tabindex, `aria-selected`, `aria-controls`) would be **wrong** here, because it
implies in-page panel switching rather than navigation. The `accessibility` skill's
non-negotiable #1 ("Semantic HTML first… a wrong/extra ARIA role is worse than none")
supports this reading.

Consequences to verify rather than assume:
- Arrow keys do **not** move between tabs. Each is an individual Tab stop. With seven tabs
  that is seven stops before the panel content — acceptable, but it should be a deliberate,
  tested decision.
- The active tab's state comes from `NavLink`'s `aria-current="page"` (React Router's
  default). **Verified 2026-08-11 — it survives.** `TabNavLink` renders through Radix
  `Slot` when `asChild` is set, so it merges its props onto the `NavLink` rather than
  replacing it, and its own class list keys the active underline off
  `aria-[current=page]:border-foreground`
  (`packages/design-system/src/lib/components/ui/tab-nav.tsx:41,48`). The attribute is
  therefore both present and load-bearing for the styling, so it cannot be dropped without
  visibly breaking the tabs. Verdict stays **Supports**.
- The nav landmark is labelled "User detail sections" (`:40`), which is meaningful.

**Repro:** open `/users/<id>/general` with a screen reader, Tab through the tab row, and
confirm the current tab announces "current page".

**Remediation:** none, provided `aria-current` survives. Add an e2e assertion for it so a
design-system refactor cannot silently remove it.

---

#### ♿ A11Y-users-admin-05 — The clickable table row is not keyboard-operable and has no role, but an equivalent link exists

**SC:** 2.1.1 Keyboard (A), 4.1.2 Name/Role/Value (A), 1.3.1 Info and Relationships (A)
**508:** E205.4 / 502.3.7
**Verdict:** **Supports** — by the equivalent-path rule
**Location:** `packages/users/admin/src/lib/presentation/components/MembersTable/index.tsx:90-94,103-111`

```tsx
<TableRow onClick={() => navigate(`/users/${member.id}`)} className="cursor-pointer">
```

A `<tr>` with a click handler, no `role`, no `tabIndex`, no key handler. Taken alone that
is a 2.1.1 failure. It is **not**, because the member's name inside the row is a real
`<Link>` to the same destination (`:103-108`), with `stopPropagation` so the two do not
double-fire. The component's own JSDoc states the intent: *"the name is a real link for
keyboard users"* (`:54`).

**Keyboard-only experience:** the row is skipped; the name link is the tab stop and Enter
navigates. Fully operable.
**Screen-reader experience:** the row announces as a normal table row; the link announces
as "Grace Hopper, link". No phantom "clickable" affordance is advertised, which is the
right outcome — a `role="button"` on a `<tr>` would break the table semantics and is
exactly the "wrong/extra ARIA role" the skill warns against.

Residual risk: a **mouse-free but sighted** user relying on `:hover` sees `cursor-pointer`
on the whole row, implying the row is the control. Minor.

**Remediation:** none required. Do not "fix" this by adding `tabIndex` and a role to the
`<tr>` — that would create a duplicate tab stop and worse semantics.

---

#### ♿ A11Y-users-admin-06 — The result-count live region is present and correct

**SC:** 4.1.3 Status Messages (AA)
**508:** E205.4 / 502.3.14
**Verdict:** **Supports**
**Location:** `packages/users/admin/src/lib/presentation/pages/MembersPage/index.tsx:235-241`

```tsx
{!isPending && !isError && (
    <p role="status" aria-live="polite" className="sr-only">
        {intl.formatMessage(messages.results, { count: total })}
    </p>
)}
```

A visually-hidden polite region announcing "{n} members found." after a search or filter
changes the table with no navigation — exactly what 4.1.3 requires, with a comment citing
the criterion. It is correctly suppressed during loading and error, so it cannot announce
a stale count.

Recorded as a **Supports** finding deliberately: it is the pattern the other three admin
units should copy, and `activity-admin` does (`ActivityLogPage`), while
`api-tokens-admin` does **not** (♿ A11Y-api-tokens-admin-04).

**Residual gap:** it has **no test** (F10 ❌). An axe scan cannot verify that a live region
*fires at the right moment*; only a Playwright assertion on the region's text after a
search can.

**Remediation:** none. Add coverage.

---

#### ♿ A11Y-users-admin-07 — Destructive intent is conveyed by colour alone in the row menu

**SC:** 1.4.1 Use of Color (A), 1.4.3 Contrast (Minimum) (AA)
**508:** E205.4
**Verdict:** **Partially Supports**
**Location:** `MemberRowActions/index.tsx:204` (`className="text-destructive focus:text-destructive"`)

"Revoke invite" is distinguished from its neighbours **only** by red text. There is no
icon-plus-text distinction (every item has an icon), no separator label, and no wording
that marks it as irreversible. A user with a colour-vision deficiency, or in forced-colors
mode where the token is overridden, sees a menu of visually identical items one of which
deletes an account.

**Repro:** enable Windows High Contrast (or a greyscale filter) and open a pending
member's row menu.

**Keyboard-only experience:** unchanged — the item is reachable and operable.
**Screen-reader experience:** no difference is conveyed at all; "Revoke invite, menu item"
is all a user hears, identical in form to "Resend invite, menu item".

This compounds ♿ A11Y-users-admin-01: an item that is destructive, unconfirmed, and
distinguished only by colour.

**Remediation:** the confirmation step from A11Y-01 resolves most of this. Additionally,
put the destructive item in its own group with a visible label, or word it explicitly
("Delete this invite permanently"). Also assess **503.2 forced-colors**: verify the
destructive token survives a `forced-colors: active` media query.

---

#### ♿ A11Y-users-admin-08 — Theme change animates and re-themes instantly, with `prefers-reduced-motion` unverified

**SC:** 2.3.3 Animation from Interactions (AAA — advisory), 3.2.2 On Input (A), 1.4.3 (AA)
**508:** E205.4 / **503.2 (User Preferences)**
**Verdict:** **Partially Supports** — unverified
**Location:** `packages/users/admin/src/lib/presentation/pages/UserPreferencesPage/index.tsx:135-163`,
`ThemePreview.tsx`, `components/MembersSkeleton`

Selecting a theme calls `setTheme(next)` **immediately** (`:143`), re-theming the entire
application while focus is still inside the radio group. Under 3.2.2 On Input this is a
change of *appearance*, not of *context* (no focus move, no navigation, no new content), so
it does not fail — but it is a large, unannounced visual change triggered by an arrow key,
and a user arrowing across the three options triggers it three times in a second.

Two things to verify rather than assume:
- Whether the design-system root applies a CSS transition on the theme swap. If it does, it
  must be gated on `prefers-reduced-motion` (503.2). The activity plugin demonstrates the
  idiom the repo already uses — `motion-reduce:transition-none`
  (`packages/activity/admin/.../ActivityRow/index.tsx:89,114`).
- The `MembersSkeleton` / `MembersTableSkeleton` use Tailwind `animate-pulse` with no
  `motion-reduce:` variant, same as the auth skeletons (♿ A11Y-identity-admin-06).

**Positive note:** the rapid-selection handling is genuinely well done — a stable toast id
prevents a column of stacked announcements (`:112`, with the reasoning about keyboard
arrowing spelled out), and a `latest` ref stops a slow failure from yanking the UI off a
newer choice (`:128-132`). The group carries a real label, "Colour theme" (`:189`), which
is exactly what the brief asks for.

**Repro:** set OS "Reduce motion", open Preferences, arrow across the three options.

**Remediation:** add a `prefers-reduced-motion` Playwright assertion to
`apps/admin-e2e/src/users/preferences.spec.ts`; add `motion-reduce:animate-none` to the
skeletons.

---

#### ♿ A11Y-users-admin-09 — Reflow and dark-theme contrast are untested for the roster, dialogs and detail page

**SC:** 1.4.10 Reflow (AA), 1.4.4 Resize Text (AA), 1.4.3 (AA), 1.4.11 Non-text Contrast (AA)
**508:** E205.4
**Verdict:** **Partially Supports** — unverified
**Location:** `MembersTable/index.tsx:62` (`overflow-hidden rounded-xl border`),
`components/MembersTable/MemberWorkspaces`, `UserDetailLayout/UserStatsStrip`

The members table has six columns inside an `overflow-hidden` container. At a 320 px
viewport or 400 % zoom, `overflow-hidden` **clips** rather than scrolls, so the Joined and
Actions columns — including every row's kebab — may become unreachable. The
`accessibility` skill requires wide content to scroll inside its own container.

Dark-theme coverage exists but only for the Preferences tab
(`preferences.spec.ts:124`); the roster, the row menu, the dialogs and the detail page have
never been scanned in dark.

**Repro:** set a 320 px viewport on `/users`; check for a horizontal scrollbar on the table
container (not the body) and confirm the kebab is reachable. Then run the existing
`users/a11y.spec.ts` states with `data-theme="dark"`.

**Keyboard-only experience:** if the kebab is clipped, every per-row action is unreachable
at that viewport — which would escalate this to Does Not Support.
**Screen-reader experience:** unaffected (the DOM is intact).

**Remediation:** give the table wrapper `overflow-x: auto`; extend the dark-theme scan to
the roster and the detail page; add a 320 px reflow assertion.

---

**a11y verdict tally: 9 findings · 3 Supports · 4 Partially Supports · 2 Does Not Support ·
0 Not Applicable.**

**WCAG 2.2 (advisory only — 508 references 2.0):** 2.4.11 Focus Not Obscured (Minimum) — the
sticky `PageTopBar` may overlay a focused element when tabbing back up a long roster;
worth a look. 2.5.8 Target Size (Minimum) — the row kebab is `size-8` (32 px), which clears
the 24 px minimum. **Supports**.

## 5. E2E Coverage Map

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F1 Roster | `apps/admin-e2e/src/users/members.spec.ts:31,48` | names, emails, status pills; the count in the header subtitle | ✅ E2E |
| F2 Row → detail | `apps/admin-e2e/src/users/user-detail.spec.ts:40` | opens when the row is clicked | ⚠️ PARTIAL — the **name link** path (the keyboard route) is unasserted |
| F3 Search | `members.spec.ts:58`, `keyboard.spec.ts:16` | filters by a term; filters as you type from the keyboard | ✅ E2E |
| F4 Filter drawer | `apps/admin-e2e/src/users/members-filter.spec.ts:18,28,54,67,93` | opens, filters by status + deep-links, condition count on the trigger, restores from a deep link, Reset restores the roster | ✅ E2E |
| F5 Pagination | `members.spec.ts:162` | paginates with a selectable page size | ✅ E2E |
| F6 Page clamp | — | — | ⚠️ PARTIAL — **the clamp is implemented but nothing drives a mutation that shrinks the list while on the last page**, which is the BUGBOT trap it exists for |
| F7 States | `members.spec.ts:66`, `a11y.spec.ts:24` | empty state on a no-match search; the loading skeleton renders | ⚠️ PARTIAL — **the error+Retry state has no test at all** |
| F8 Filtered vs unfiltered empty | `members.spec.ts:66` | the filtered variant | ⚠️ PARTIAL — the unfiltered variant is unasserted |
| F9 No-access | `members.spec.ts:242`, `a11y.spec.ts:73` | shows a no-access state without `users:read`; axe-clean | ✅ E2E — but **nothing asserts that no request is made** |
| F10 Result-count live region | — | — | ❌ NONE |
| F11 Row menu | `members.spec.ts:192,222` | mirrors the detail sections; hides write controls without the permission | ✅ E2E |
| F12 Status actions | `members.spec.ts:181,205` | pending shows Resend/Revoke; disabled shows Enable not Disable | ✅ E2E |
| F13 Guarded Disable | — | — | ⚠️ PARTIAL — the **inert-with-tooltip** state (self / last admin) is unasserted, and it is the safety rail |
| F14 Resend + reveal | `members.spec.ts:253` | "hands over the rotated link when an invite is resent" | ✅ E2E |
| F15 Invite wizard | `members.spec.ts:74` | invites through the three-step wizard | ✅ E2E |
| F16 All-workspaces + search | `members.spec.ts:105,125` | assigns all via the "All workspaces" mode; searches the assignment step | ✅ E2E |
| F17 Invalid-email gate | `members.spec.ts:147` | keeps Continue disabled and sends **no request** | ✅ E2E |
| F18 Link origin | `members.spec.ts:253` (indirect) | the built link is asserted, so a path drift fails loudly | ✅ E2E |
| F19 409 vs generic | — | — | ⚠️ PARTIAL — neither branch is asserted |
| F20 Detail layout | `user-detail.spec.ts:30` | hero + General tab by default | ✅ E2E |
| F21 Tab gating | `user-detail.spec.ts:51,65,159`, `preferences.spec.ts:40,56` | opens a specific tab from the row menu; navigates via the rail; hides audit/access without `users:update`; Preferences only on your own profile; a deep link to someone else's redirects | ✅ E2E |
| F22 Rename | `user-detail.spec.ts:78` | PATCH fires and the name updates | ✅ E2E |
| F23 Role tab | — | — | ⚠️ PARTIAL — `members.spec.ts:215` asserts the roster renders the role as a **read-only chip**; the picker, the confirm step and the Admin-escalation warning are all untested |
| F24 Last-admin lock | — | — | ❌ NONE |
| F25 Workspaces tab | — | — | ❌ NONE |
| F26 Sessions tab | `user-detail.spec.ts:92` | revokes a session from the tab | ⚠️ PARTIAL — no confirm-dialog, error-state, empty-state or `current`-flag assertion |
| F27 Activity tab | `user-detail.spec.ts:110,133` | renders the timeline with per-action entries; shows workspace membership events | ✅ E2E |
| F28 Access tab | — | — | ⚠️ PARTIAL — reachable via `user-detail.spec.ts:51`, but no disable/enable assertion |
| F29 Preferences | `apps/admin-e2e/src/users/preferences.spec.ts:68,85,99,142` | applies and saves; does not re-save the theme already in effect; hydrates app-wide on load; survives a sidebar-overriding route | ✅ E2E — the **rollback-on-failure** path is unasserted |
| F30 ThemeSync | `preferences.spec.ts:99,142` | app-wide hydration | ✅ E2E |
| F31 Account menu | `apps/admin-e2e/src/users/account-menu.spec.ts:32,44,57` | shows the signed-in account; My profile opens the detail page; Logout calls the endpoint | ⚠️ PARTIAL — no redirect, cache or failure assertion |
| F32 `toMember` mapper | — | — | ❌ NONE — including the role-coercion fallback |
| F33 `MemberEntity` guardrails | — | — | ❌ NONE |
| F34 Invalidation scope | — | — | ⚠️ PARTIAL — behaviourally invisible; needs a request-count assertion |
| F35 Sessions cache | `user-detail.spec.ts:92` | the revoked row drops off | ✅ E2E |
| **a11y — roster & wizard** | `apps/admin-e2e/src/users/a11y.spec.ts:18,24,37,44,59,66,73` | axe on the table, skeleton, both wizard steps, the **open row menu**, empty and no-access states | ⚠️ PARTIAL — light theme only; no dialogs, no detail page, no post-action focus |
| **a11y — filter drawer** | `members-filter.spec.ts:81` | axe on the open drawer with a rule applied | ✅ E2E for that state |
| **a11y — preferences** | `preferences.spec.ts:112,124` | axe on the theme picker in **light and dark** | ✅ E2E — the only dark-theme scan in the repo |
| **keyboard** | `apps/admin-e2e/src/users/keyboard.spec.ts:16,25,39` | search filters as you type; the invite wizard opens from the keyboard; the row menu opens from the keyboard | ⚠️ PARTIAL — nothing on Esc, focus restoration, or focus after a row is removed |

**Coverage tally: 35 features · 17 ✅ · 13 ⚠️ · 5 ❌**
**a11y coverage: 10 axe states (2 in dark) + 3 keyboard tests; no coverage of dialogs,
focus restoration, reflow, or reduced motion.**

## 6. 🐞 Potential Bugs

### 🐞 BUG-users-admin-01 — Disabling a member and deleting a pending invite both fire with no confirmation and no undo · Severity: High

**Location:** `packages/users/admin/src/lib/presentation/components/MembersTable/MemberRowActions/index.tsx:201-220`
(Revoke invite), `:233-257` (Disable)
**Category:** ux-state / data-loss

**What the code does:**

```tsx
destructiveItem = canRevoke ? (
    <DropdownMenuItem key="revoke" className="text-destructive focus:text-destructive"
        onSelect={() => revokeInvite.mutate(member.id, {
            onSuccess: () => toast.success(intl.formatMessage(messages.revoked, { email: member.email })),
            onError: failed
        })}>
```

One `onSelect` → one mutation. `DELETE /api/users/:id/invites` **deletes the user row**
server-side, cascading its invite token and every workspace membership
(`packages/users/server/.../revoke-invite.use-case.ts:41`). `POST /:id/disable` locks the
person out and revokes all their live sessions in the same transaction.

**Why it is wrong:** the same codebase confirms three *less* consequential actions. The
Role tab wraps a reversible role change in a `ConfirmDialog` with an escalation warning
(`UserRolesPage/index.tsx:156-171`). The Sessions tab confirms revoking a single session
(`UserSessionsPage/index.tsx:143-156`). `api-tokens-admin` confirms revoking a token
(`ApiTokensTable/index.tsx:276-296`). The two irreversible member actions are the only
unconfirmed ones — the pattern is established and these are the omissions.

The menu geometry makes it worse: "Resend invite" and "Revoke invite" are adjacent, in that
order, on a pending member's menu (`:182-220`). One extra `↓` before `Enter` turns
"rotate this person's link" into "delete this person's account".

**Repro:**
1. Invite `grace@example.com` with two workspace assignments.
2. On the roster row, open the kebab and select **Revoke invite**.
→ Observed: `204`, the row vanishes, a success toast appears. `select * from users where
email='grace@example.com'` → gone; her `tokens` and `memberships` rows are gone too. There
is no undo and no way to recover the assignments. / Expected: a confirmation naming Grace
and stating that her pending account and workspace assignments will be deleted.

**Blast radius:** an admin scanning a roster with the keyboard can destroy a pending
account in two keystrokes, or lock a colleague out of the product in two keystrokes, with
the only feedback arriving after the fact. Disable at least is reversible (Enable); revoke
is not — the invite must be re-created and re-delivered, and any pre-assigned workspaces
re-chosen.

**Suggested fix:** wrap both in the existing `ConfirmDialog`, interpolating the member's
name and email, exactly as `UserRolesPage` does. Cross-reference ♿ A11Y-users-admin-01 and
♿ A11Y-users-admin-07. Do NOT implement.

---

### 🐞 BUG-users-admin-02 — A reveal-once invite link is discarded on Esc or an overlay click, with no warning · Severity: Medium

**Location:** `packages/users/admin/src/lib/presentation/components/InviteLinkDialog/index.tsx:47-76`,
`components/MembersTable/MemberRowActions/index.tsx:394-403`
**Category:** data-loss

**What the code does:**

```tsx
<InviteLinkDialog link={rotatedLink} email={member.email} open={rotatedLink !== null}
    onOpenChange={(open) => { if (!open) { setRotatedLink(null); } }} />
```

`Dialog`'s `onOpenChange(false)` fires for **Esc**, an overlay click, and the close button
just as it does for the "Done" button. All four paths null the link. It exists only in this
component's state and is never re-fetchable — the server returns the raw token exactly once
(`packages/users/server/.../resend-invite.use-case.ts:66`).

**Why it is wrong:** the dialog's own copy states the stakes — "It's shown once — copy it
before you close this" — and then provides three ways to close it that a user reaches by
reflex, with no guard on any of them. Worse, the resend has **already rotated the token**,
so the invitee's previous link is dead
(`packages/users/server/.../invite-token.service.ts:60-70`). Losing this dialog does not
return you to the status quo; it leaves the invitee with a dead link and the admin with no
live one. The only recovery is to resend *again*, which rotates *again* — so a nervous
double-Esc can loop indefinitely.

The same shape exists in the invite wizard's step 3
(`useInviteMemberFlow/index.ts:70`, `sent` state): navigating away or refreshing loses the
link with no prompt.

**Repro:**
1. Row menu on a pending member → **Resend invite**.
2. Press **Esc**.
→ Observed: the dialog closes, the link is gone, the invitee's old link is already dead,
and nothing in the UI says so. / Expected: a confirmation on close before the link is
copied ("You haven't copied the link yet — it can't be shown again"), or persist it until
explicitly dismissed.

**Blast radius:** every resend, which is the primary recovery path in a product with no
mailer. Compounds 🐞 BUG-users-server-03 (rotation is unconditionally destructive) and
🐞 BUG-identity-admin-03 (a server blip tells the invitee to ask for a resend).

**Suggested fix:** track whether Copy was pressed and, if not, intercept `onOpenChange` with
a confirmation; or keep the link in a dismissible panel on the roster until acknowledged.
Do NOT implement.

---

### 🐞 BUG-users-admin-03 — Every member mutation invalidates the entire members cache, including detail and session queries · Severity: Low

**Location:** `packages/users/admin/src/lib/application/useMembersMutation/index.ts:25-29`,
`packages/users/admin/src/lib/infrastructure/membersKeys/index.ts:18-27`
**Category:** perf

**What the code does:**

```ts
onSuccess: invalidate
    ? () => { queryClient.invalidateQueries({ queryKey: membersKeys.all }); }
    : undefined
```

`membersKeys.all` is `['members']`. TanStack Query matches by **prefix**, and the key
factory nests everything under it:

```ts
all:      ['members'],
list:     (p)  => ['members', 'list', p],
detail:   (id) => ['members', 'detail', id],
sessions: (id) => ['members', 'detail', id, 'sessions'],
```

So a single disable/enable/update/invite/revoke marks every cached list page, every cached
member detail, **and every cached session list** stale, refetching all of them that have
active observers.

**Why it is wrong:** `.cursor/BUGBOT.md` names it — *"**Over-invalidation.** Invalidate only
the affected query keys, not the whole cache, on mutation — broad invalidation causes
refetch storms and flicker."* The list invalidation is justified (a changed row may land on
any page, as the comment says). The **sessions** invalidation is not: renaming a member
cannot change anyone's session list, and `GET /users/:id/sessions` is configured
`staleTime: 0` (`useUserSessions/index.ts:17`), so it refetches on any invalidation without
even a cache window to absorb it.

The package already demonstrates the right discrimination twice: `useRevokeSession`
invalidates only `membersKeys.sessions(userId)` (`useRevokeSession/index.ts:18-22`), and
resend opts out entirely with `invalidate: false` (`useMembersMutation/index.ts:15-16`).

**Repro:**
1. Open `/users/<A>/sessions` in one tab so `['members','detail',A,'sessions']` is cached
   and observed.
2. In another tab, rename member **B** on the General tab.
3. Watch the first tab's Network panel.
→ Observed: `GET /api/users/<A>/sessions` refetches, plus every cached list page. /
Expected: only the list pages refetch.

**Blast radius:** small in practice — member mutations are infrequent and admin-driven, and
the mutations already return the updated row so nothing renders wrong. The cost is
unnecessary requests and a visible flicker on the sessions list. Filed as Low because it is
the named anti-pattern with a concrete, if minor, consequence.

**Suggested fix:** either give sessions its own root key (`['member-sessions', id]`) so the
prefix no longer catches it, or narrow the invalidation to `['members','list']` and
`setQueryData` the returned row into `['members','detail',id]`. Do NOT implement.

---

### 🐞 BUG-users-admin-04 — Your own Role tab lets you press Apply, then fails with a generic error · Severity: Low

**Location:** `packages/users/admin/src/lib/presentation/pages/UserRolesPage/index.tsx:86-88,147-152`
**Category:** ux-state

**What the code does:**

```ts
const roleChange = MemberEntity.of(member).canChangeRole();
const locked = !canManage || !roleChange.ok;
```

`canChangeRole()` mirrors only the **last-admin** guardrail. It does not know who the
acting user is, so it cannot mirror the server's **self-action** guard
(`packages/users/server/.../update-member.use-case.ts:66-68`, which 409s
"You cannot change your own role"). The picker is therefore enabled on your own profile,
Apply is enabled, the confirm dialog appears, and the PATCH returns 409 — which
`onError` renders as the generic "Couldn't change the role. Please try again."

**Why it is wrong:** the failure message tells the user to retry an operation that can never
succeed. The sibling guard is handled properly: `MemberRowActions` **does** mirror the
self-disable rule, because `canBeRemoved(user?.id)` takes the acting user's id
(`MemberRowActions/index.tsx:224`) and renders an inert item with the exact reason
("You cannot disable your own account."). `canChangeRole()` takes no argument and so cannot
do the same.

**Repro:**
1. Sign in as an admin with at least one **other** active admin present (so the last-admin
   lock does not engage).
2. Open your own profile → Role tab. Select a different role. Press Apply role. Confirm.
→ Observed: 409, toast "Couldn't change the role. Please try again." The picker stays on
your unsaved selection. / Expected: the picker locked with "You cannot change your own
role", matching the Disable affordance.

**Blast radius:** one confusing round-trip per admin who tries it. No data is at risk — the
server correctly refuses. Filed because the inconsistency between the two self-action
guards in the same package is the kind of gap that grows.

**Suggested fix:** give `canChangeRole` the acting user's id, as `canBeRemoved` already
takes, and surface the same inline reason. Do NOT implement.

---

### 🐞 BUG-users-admin-05 — The role mapper silently rewrites an unknown role key to `viewer` · Severity: Low

**Location:** `packages/users/admin/src/lib/infrastructure/memberMapper/index.ts:81-83,101-103`
**Category:** correctness

**What the code does:**

```ts
// An unknown role key (a future custom role) falls back to `viewer`
// for the inline select; the label still shows the server's name.
role: isMemberRole(dto.role.key) ? dto.role.key : 'viewer',
roleName: dto.role.name,
```

**Why it is wrong:** this is verbatim the pattern `.cursor/BUGBOT.md` names, with its exact
example — *"**Mapper fallbacks that rewrite data.** A `?? defaultValue` in a response mapper
can silently invent data (e.g. coercing `null` role to `viewer`). Surface missing data;
don't paper over it."*

The consequence chain is real. `MemberRoleChip` renders `member.role`
(`MembersTable/index.tsx:119`), so a member holding a custom role displays as **Viewer** on
the roster. `UserRolesPage` seeds `useState<MemberRole>(member.role)`
(`UserRolesPage/index.tsx:82`) and `RolePicker` puts the "Current" badge on that value, so
the Role tab positively asserts that a custom-role member is a Viewer. An admin acting on
that display has been misinformed about someone's privileges.

**Why it is Low, and I want to be precise about this.** No path in the product currently
creates a role outside the three seeded keys. `seedSystemRoles` writes exactly
`admin` / `contributor` / `viewer` (`packages/identity/server/.../system-roles.ts:76-105`);
`RolesService` exposes only `delete` and refuses `isSystem` rows
(`roles.service.ts:21-40`); there is no create-role endpoint anywhere
(`grep -rn "insert(roles)" packages --include=*.ts` finds only the seeder). So the fallback
is **unreachable today**. It is also not a *demotion* path: `dirty` compares `selected`
against the same coerced `member.role`, so Apply stays disabled until the admin actively
picks something else — at which point they are making a deliberate choice, albeit from a
false starting point.

It is filed rather than cleared because the server's own `Role.create` deliberately accepts
any non-empty key ("a loaded member may hold a custom, non-system role" —
`packages/users/server/.../value-objects/role.ts:23-24`), i.e. the server is explicitly
designed for the case the admin silently mangles.

**Repro (requires a manual DB edit today):**
1. `insert into roles (key, name, is_system) values ('editor', 'Editor', false)`.
2. Point a member's `role_id` at it.
3. Open `/users`.
→ Observed: the row's chip reads **Viewer**; `roleName` ("Editor") is carried but not
rendered by the chip. The Role tab shows Viewer with the "Current" badge. / Expected: the
server's role name, and a picker that refuses to guess.

**Blast radius:** latent. Becomes live the day custom roles ship.

**Suggested fix:** make `role` `MemberRole | null` and render `roleName` with the picker
disabled when it is `null`, rather than inventing a key. Do NOT implement.

---

**Checked and cleared** (examined, no defect found):

- **Page clamping after a mutation.** Implemented at `MembersPage/index.tsx:129-136` and —
  unusually — guarded on `data` so a deep-linked `?page=N>1` is not reset to 1 before the
  first response lands, with the reasoning commented. This is the BUGBOT "stale page after
  mutation" trap handled correctly.
- **Error vs empty.** All four states are distinct on the roster
  (`MembersPage/index.tsx:242-281`), on the sessions tab
  (`UserSessionsPage/index.tsx:107-140`), and — best in the repo — on preferences, where a
  failed read gets its own warning rather than being presented as a stored choice
  (`UserPreferencesPage/index.tsx:174-185`).
- **No fetch without permission.** `useMembers(params, canRead)` passes `enabled`
  (`MembersPage/index.tsx:113-115`), so a user without `users:read` issues no request at all.
  Same for `useUserSessions(member.id, canManage)`.
- **Filters survive a refetch.** The URL is the single source of truth via
  `useTableUrlState`, so an invalidation cannot drop them.
- **`stopPropagation` on the row.** The name link and the actions cell both stop the bubble
  (`MembersTable/index.tsx:107,136`), so opening the menu does not also navigate.
- **Row-menu trigger naming.** `aria-label="Actions for {name}"`
  (`MemberRowActions/index.tsx:300-302`) — unique per row and meaningful, which is exactly
  what the brief asks for and what most row menus get wrong.
- **`modal={false}` on the row menu.** Deliberate, with the reason commented
  (`:290-292`): a modal menu would `aria-hide` the page root, which holds focusable content.
- **Guarded menu item.** Radix's real `disabled` is avoided so the tooltip carrying the
  reason still receives pointer/focus events; `aria-disabled` is set and selection
  suppressed (`:409-412`).
- **Optimistic theme with correct rollback.** A `latest` ref means only the newest selection
  owns the rollback, so a slow failure for an abandoned choice cannot yank the UI
  (`UserPreferencesPage/index.tsx:128-163`).
- **Toast id stability.** One stable id for the theme toast, so keyboard arrowing does not
  stack a column of announcements (`:107-112`).
- **Clipboard failure handling.** Caught, with actionable copy telling the admin to select
  and copy manually (`InviteLinkPanel/index.tsx:64-69`). This is the pattern
  `api-tokens-admin` is missing.
- **Invite link origin.** Built from `window.location.origin` rather than server config
  (`inviteLink/index.ts:20-24`), so there is no `publicBaseUrl` to misconfigure and no host
  header to poison. Well reasoned.
- **Selective invalidation on resend.** `invalidate: false`, because a resend changes no
  list-visible field.
- **`AccountMenu` renders nothing until resolved.** Avoids flashing an empty row during the
  auth probe (`AccountMenu/index.tsx:51-53`).
- **No `apiClient` outside the gateways.** `grep -rn "apiClient" packages/users/admin/src`
  → `httpMemberGateway` and `preferencesGateway` only.
- **i18n completeness.** Every user-visible string is a namespaced `users.*` descriptor,
  including every error branch and every toast. Spot-checked all 14 message blocks.

**Defect tally:** `5 🐞 · 0 Critical · 1 High · 1 Medium · 3 Low · 0 🔒`
**Accessibility tally:** `9 ♿ · 3 Supports · 4 Partially Supports · 2 Does Not Support ·
0 Not Applicable`

## 7. Recommended E2E Tests

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | `apps/admin-e2e` (POM + `page.route`) | extend `users/members.spec.ts` | Disable and Revoke invite each open a confirmation naming the member; cancelling sends no request; confirming sends exactly one | 🐞 BUG-01, ♿ A11Y-01 |
| 2 | `apps/admin-e2e` | `users/focus-after-action.spec.ts` (following `apps/admin-e2e/src/support/a11y.ts`) | after revoking an invite from the row menu, focus is on a stable anchor, not `<body>`; after revoking a session, focus is not lost; Esc closes the row menu and returns focus to the kebab | ♿ A11Y-03, keyboard ⚠️ |
| 3 | `apps/admin-e2e` | `users/invite-link-loss.spec.ts` | pressing Esc on the `InviteLinkDialog` before copying warns rather than discarding; the wizard's step 3 warns before navigation | 🐞 BUG-02, EC-36 |
| 4 | `apps/admin-e2e` | `users/roles.spec.ts` | the picker renders three cards with the Current badge on the saved role; Apply opens a confirm naming the member; choosing Admin shows the escalation body; the last admin's picker is locked with the reason; your **own** Role tab is locked (post-fix) rather than 409-ing | F23/F24 ❌⚠️, 🐞 BUG-04 |
| 5 | `apps/admin-e2e` | extend `users/members.spec.ts` | the roster's error state renders a destructive alert with a working Retry (not the empty state); the no-access state issues **zero** requests to `/api/users` | F7/F9 ⚠️ |
| 6 | `apps/admin-e2e` | `users/page-clamp.spec.ts` | on the last page with one row, disabling/revoking it clamps to the previous page and refetches; a deep-linked `?page=2` on a 2-page roster is **not** reset to 1 | F6 ⚠️, EC-07 |
| 7 | `apps/admin-e2e` | extend `users/a11y.spec.ts` | axe over the **confirm dialogs** (role, revoke session), the **invite link dialog**, and the **user detail page** in each tab — three state families the current seven scans never reach | a11y ⚠️ |
| 8 | `apps/admin-e2e` | extend `users/a11y.spec.ts` | re-run the seven roster/wizard states with `data-theme="dark"`, mirroring `preferences.spec.ts:124` | ♿ A11Y-09 |
| 9 | `apps/admin-e2e` | `users/reflow.spec.ts` | at a 320 px viewport the members table scrolls inside its own container and every row kebab remains reachable; the detail hero does not clip | ♿ A11Y-09 |
| 10 | `apps/admin-e2e` | extend `users/members.spec.ts` | the Disable item is present-but-inert with the correct tooltip for **yourself** and for the **sole active admin**, and selecting it sends no request | F13 ⚠️ |
| 11 | `apps/admin-e2e` | `users/workspaces-tab.spec.ts` | adding and removing a workspace membership from the tab hits the right endpoints and updates the card list | F25 ❌ |
| 12 | `apps/admin-e2e` | extend `users/user-detail.spec.ts` | the sessions list error state renders an alert with Retry; the empty state renders "No active sessions."; your own session is flagged; the confirm dialog names the device (post-fix) | F26 ⚠️, ♿ A11Y-02 |
| 13 | `apps/admin-e2e` | `users/live-region.spec.ts` | after a search, the `role="status"` region text becomes "{n} members found." and does **not** announce during loading or error | F10 ❌, ♿ A11Y-06 |
| 14 | unit (`packages/users/admin`) | `infrastructure/memberMapper/index.spec.ts`, `domain/member/index.spec.ts` | `toMember` on a `null` name, an unknown role key, and a malformed date; `canBeRemoved` / `canChangeRole` across self / last-admin / ordinary | F32/F33 ❌, 🐞 BUG-05 |
| 15 | `apps/admin-e2e` | `users/invalidation-scope.spec.ts` | renaming member B does **not** refetch `GET /api/users/<A>/sessions` (assert via a request counter on the mocked route) | 🐞 BUG-03, F34 ⚠️ |
| 16 | `apps/admin-e2e` | extend `users/preferences.spec.ts` | a failed `PUT /api/preferences` rolls the theme back and toasts; with `prefers-reduced-motion: reduce`, no theme transition or skeleton pulse animates | F29 ⚠️, ♿ A11Y-08 |
