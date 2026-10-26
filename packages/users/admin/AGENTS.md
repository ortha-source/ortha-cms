# @orthacms/users-admin

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
  **UX invariants** the admin mirrors from server facts —
  `canChangeRole(viewerId)` and `canBeRemoved(viewerId)` return `{ ok, reason }`
  so a control disables itself with a reason instead of failing on submit. Both
  take the **viewer's id**: the server refuses self-actions (you cannot disable
  your own account, or change your own role), and a guard that doesn't know who
  is asking can only mirror half the rules — which is how the Role tab used to
  invite a click that could never succeed and then report a generic "please try
  again". `canChangeRole` additionally vetoes a member whose `role` is `null`
  (see below).
- **`application/`** — the TanStack Query hooks (reads + mutations). Each calls
  the gateway, never `apiClient`. The invite wizard's submit orchestration is
  `useInviteMemberFlow` (validate `Email` → invite → toast → navigate), so the
  invite page is layout + fields; `useMembersMutation` is the shared mutation
  shell (normalize + invalidate `membersKeys.all`).
- **`infrastructure/`** — the `MemberGateway` **port** + its `httpMemberGateway`
  implementation (the one place `apiClient` is used), `memberMapper` (the
  wire→view anti-corruption layer, formerly `utils/toMember`, keeping the
  presentation-only `initials`/`color` enrichment), and `membersKeys`.
    - **The mapper does not invent a role.** A key outside the three assignable
      system roles maps to `role: null`, not to a guessed `viewer` — the server's
      `Role.create` accepts any non-empty key, so a custom role is a shape this
      admin must expect. Everything downstream renders `roleName` (the server's own
      label) when `role` is `null` and refuses to offer a change, so the UI never
      asserts a privilege level someone does not hold.
    - **`membersKeys.sessions(id)` is rooted at `member-sessions`, not under the
      member's detail key.** TanStack matches by prefix, so nesting it would make
      every member mutation invalidate every cached session list — which no member
      mutation can affect, and which runs at `staleTime: 0` so it refetches
      immediately. The separate root is what keeps the broad `membersKeys.all`
      invalidation honest. `membersKeys/index.spec.ts` pins the scoping.
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
- Home's top-bar **Invite member** action (`InviteMemberHomeAction`, a
  `HOME_SECTION_SLOT` item in the `action` region, gated on `users:create`).
- The sidebar-footer **account menu** (`AccountMenu`), contributed to the
  shell's `SIDEBAR_FOOTER_SLOT`: a full-width row (avatar + name + email) that
  opens a dropdown with **My profile** (→ their own `/users/:id` detail page)
  and **Logout** (identity's `useLogoutMutation`). It reads the current user
  from identity's `useAuth`. The plugin contributes an invisible `ThemeSync`
  into the **same footer slot**: it pulls the signed-in user's saved theme from
  `GET /api/preferences` into the design-system `AppearanceProvider`, so the
  choice takes effect app-wide on load. It must live in the footer, not
  `SIDEBAR_SECTION_SLOT` — the section slot belongs to `GlobalSidebar`, which a
  route can replace wholesale via `useSidebarContent` (the workspace shell
  does), so a hydrator mounted there would never run for a user who deep-links
  into a workspace. The footer is the region the shell keeps mounted in both
  contexts. **`PanelLayoutSync`** sits beside it for the same reason: it
  hydrates the shell's panel layout (the resizable panels' widths and collapsed
  states) from the same `GET /api/preferences`, and saves the user's changes —
  collected for 600ms, sent as one `PUT { layout }` naming only the panels that
  changed (the server merges per panel). A failed save is silent and its panels
  ride along with the next one; what is still pending on unmount is sent then.

## The pages

`MembersPage` — `Container`/`ContainerHeader` ("N people can sign in · M
invites waiting", from the list's directory-wide `counts`), the toolbar
(`MembersToolbar`: the **quick filters** `MembersQuickFilters` — Everyone /
Admins / Invited / Disabled, `?show=` in the URL, mapped to the list's `role` /
`status` params by `presentation/membersQuickFilter` — then search and the
query-builder popover), the **Member · Role · Workspaces · Status · Last
active** table plus an actions column, pagination, a loading skeleton and
empty/no-access states. "Last active" is the server's `lastActiveAt` (newest
session use), worded by `presentation/recencyLabel` over the pure
`domain/recency` buckets ("12 min ago", "Yesterday", "Sep 30"); an invite says
when it was sent. Each row is a shortcut to the member's page.

**The row menu follows the member's status** (`MemberRowActions`): active —
Open profile, Change role…, Workspaces…, Password reset link, Sign out
everywhere, Suspend…; invited — Resend invite, Copy invite link, Revoke
invite… (plus an inline **Resend** button on the row); suspended — Open
profile, Workspaces…, Reactivate. A guarded item (yourself, the last admin, a
custom role) stays focusable but `aria-disabled`, with the reason **written
inside the menu** and set as its description — never a hover-only tooltip.
The member page's `⋯` is the same component (`variant="detail"`) minus what
the page already shows.

**The invite page** (`InviteMembersPage`, lazy, at `/users/invite`, with
`InviteMembersPageSkeleton` as its fallback) sits in the app's ordinary frame:
a `PageTopBar` reading "Members › Invite people" and a `ContainerHeader`; no
roster renders behind it. Gated on `users:create` (otherwise it returns to
`/users`). The form: addresses as chips (`EmailChipsInput`, split by
`Email.splitList`), one role (`RolePicker`), workspaces as tiles
(`InviteWorkspaceTiles`: a search box over tiles capped at about six rows that
scroll inside a ruled box; a tick filtered or scrolled out of view stays
ticked; a live "N selected" beside the label; + "all workspaces"), and Cancel / a Send that counts
the invites. A malformed address or one that already belongs to a member
(`useExistingEmails`: the ordinary list with an `email in […]` filter) is
flagged on its chip and blocks Send; the server's batch `409 EMAIL_TAKEN`
naming addresses lands in the same place. The page's **second state, on the
same route**, is a link per person (`InviteMembersSent`), each with Copy.
Leaving while any link is uncopied — Done, the breadcrumb, a reload — is held
by the app-wide unsaved-changes guard (`useUnsavedChanges`); **Invite more**
asks inline before resetting the form. With a mailer it is one line ("Emails
sent to 2 people.").

`UserDetailLayout` (`/users/:id/*`, via `UserDetailRouter`) fetches the member
once and shares it through the Outlet context. The header (`UserHero`) is the
page's `<h1>` (via `ContainerHeader`) with status, role, address, member
since and last active on one line, **Change role** (the `ChangeRoleDialog`)
and the `⋯` menu. **Four tabs instead of seven** (`UserDetailTabs`, a
`TabNav` under the header): **Overview** (Profile — name edit, email fixed —
Recent activity, and summary cards for Workspaces — the first five, then "See
all N" — and Sign-in, each with a way into its tab), **Workspaces** (one
compact bordered list, a ~44px `WorkspaceMembershipRow` per workspace with a
ghost Remove, a search past ten, and `AddToWorkspacesDialog`, whose options
keep their description to one truncated line with the full text as `title`), **Sessions & access** (`users:update`: sessions
with per-row Revoke and Sign out everywhere, the password link generated and
shown in place, and Suspend/Reactivate apart as the risky card) and
**Activity** (`activity:read`). **Preferences** remains a fifth tab on your
own page only. The old paths redirect: `general`/`roles` → `overview`,
`sessions` → `access`. Cards are `MemberCard` — named regions with an `<h2>`.

Callouts with a leading icon use `presentation/calloutAlert`'s classes on the
design-system `Alert`: its default absolutely-positioned icon is tuned for an
alert with a title and sits off-centre beside a bare one-line description.

**The role dialog** shows what changes: the role cards, then a "What changes"
table computed by `domain/roleChanges` from the server's grants
(`GET /api/users/roles`), flipped rows highlighted, and a button naming the
outcome ("Make Grace an admin"). The self / last-admin / custom-role guards
lock it with the reason written underneath; a server `409` with
`SELF_ACTION` / `LAST_ADMIN_PROTECTED` lands there too.

## Destructive actions are confirmed, named, and give focus back

Three member actions are confirmed: **Revoke invite** deletes the pending
account outright (cascading its token and workspace assignments), **Suspend**
locks a person out and kills their live sessions, and **Sign out everywhere**
ends every session (the caller's own excepted). Both now go
through the design-system `ConfirmDialog`, naming the member — matching what the
Access tab (Suspend), the Workspaces tab (Remove) and the Role tab already did.
They previously fired straight off `onSelect`, which meant one extra `↓` past
"Resend invite" destroyed an account before the key was released, with the first
feedback arriving in a success toast afterwards (WCAG 3.3.4).

**Focus has to be placed by hand after a row-removing mutation.** Radix restores
focus to whatever opened the overlay, but that trigger is the row's kebab and the
row has just unmounted — so focus falls to `<body>` and a keyboard user restarts
at the top of the document (WCAG 2.4.3). The row menu therefore targets a stable
anchor explicitly: the member's own kebab when the row survives (suspend, resend),
and `MEMBERS_RESULTS_ANCHOR_ID` (`presentation/membersResultsAnchor`,
`tabIndex={-1}`) when it does not. That anchor wraps **all four** result states —
skeleton, error, empty, table — not the table alone: revoking the last row on
screen swaps the table for the empty state, so an anchor living on the table
would unmount at exactly the moment focus needed somewhere to land. The Sessions tab does the same with its card heading. A `requestAnimationFrame`
defers the move so it lands after Radix's own restoration rather than racing it.

**Per-item accessible names carry the target.** Every session's visible label is
just "Revoke", so the `aria-label` names the device and last-seen time, and the
confirm dialog's _title_ does too — a dialog's accessible name is its title, and
"Revoke this session?" on all four cards tells a screen-reader user nothing.

## The invite link hand-off

Outgoing mail is optional (`@orthacms/mail-*`, inert until `MAIL_PROVIDER`
names a backend — ADR-0018). With a provider configured the server emails the
invitation and returns `inviteToken: null`, and `InviteSent` says where it went
instead of drawing a link. Without one — the default — the **admin is the
delivery channel** and the raw token comes back exactly once. Two surfaces exist
for that one moment, both built on `InviteLinkPanel` (read-only link + copy
button + a plain warning that whoever opens it becomes that person):

- the invite page ends on a link per person instead of redirecting — leaving
  before copying would mean resending;
- **Resend invite** and **Copy invite link** open `InviteLinkDialog` with a
  rotated link: only the token's hash is stored, so "copy" can only mean a
  new link, and the old one stops working.

`inviteLinkFor(token)` builds the URL from `window.location.origin` — the admin
is already looking at the app on the origin the invitee should use, so there is
no `publicBaseUrl` to misconfigure and no host header to poison. The mailed
link is built server-side, from the mail plugin's configured `appUrl`; this
one is only ever the copy-it-yourself path.

**Losing the link is guarded, because losing it is not recoverable.** Esc, an
overlay click and the close button all reach `onOpenChange(false)` by reflex, and
a resend has _already_ rotated the token — so a dismissal before copying leaves
the invitee with a dead link and the admin with no live one, fixable only by
resending, which rotates again. `InviteLinkDialog` therefore tracks whether Copy
was pressed (`InviteLinkPanel`'s `onCopied`) and intercepts the first uncopied
dismissal with a warning; once copied it closes freely. The wizard's `InviteSent`
step registers with the app-wide `useUnsavedChanges` guard for the same reason —
that covers links, programmatic navigation and reload (`beforeunload`), which no
component here could intercept on its own.

## The password-reset link hand-off

The Sessions & access tab's Password card mints a single-use reset link for an
**active** member and shows it **in place** with Copy and its lifetime
("Works once, for 1 hour"), guarded by `useUnsavedChanges` until copied; the
row menu's "Password reset link" reveals it through `PasswordResetLinkDialog` /
`PasswordResetLinkPanel` — the same reveal-once shape as the invite pair,
because it is the same situation: with no mail provider configured the admin is
the delivery channel and the raw token is readable exactly once. With one, the
server emails the link, returns `resetToken: null`, and the card toasts where it
went instead of opening the dialog.

Three details are deliberate:

- **The card gates itself on status.** A `pending` member has no password to
  reset (resend their invite) and a `disabled` one cannot sign in, so the button
  locks with the reason rather than letting the server 409 a click that was
  never going to work.
- **The dismissal guard matters more here than for invites.** The server refuses
  a second mint for a minute (`PASSWORD_RESET_RECENTLY_SENT`), so closing the
  dialog without copying is not even immediately recoverable — the dialog
  intercepts the first uncopied dismissal, exactly like `InviteLinkDialog`.
- **The 409 is read, not flattened.** `PASSWORD_RESET_RECENTLY_SENT` carries
  `retryAfterSeconds`, so the toast says how long to wait; anything else falls
  back to the generic conflict message.

`passwordResetLinkFor(token)` builds the URL the same way `inviteLinkFor` does,
and points at identity's `/identity/reset-password` route.

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
  `@orthacms/utils-admin` (no local copies).
- Co-located `defineMessages` (ids `users.<area>.<key>`); `type` over
  `interface`; design-system primitives only; a11y per the `accessibility` skill.

## Tests

Component _behaviour_ lives in `apps/admin-e2e`, which drives a real browser —
`src/users/` covers the roster and its quick filters, the invite page
(`invite-page.spec.ts`), the member page's tabs and summaries, the role dialog
(`roles.spec.ts`), the destructive-action confirmations and the guardrails. The
package's own `vitest` specs (`npx nx test @orthacms/users-admin`) hold the pure
rules (mapper coercion, `MemberEntity` guardrails, query-key scoping, recency
buckets, user-agent naming, the role-change diff, `Email.splitList`, the quick
filter mapping) plus focused component/hook specs for the chip input, the
quick-filter chips, the role dialog and the invite flow (`src/test/domShims.ts`
installs the jsdom shims Radix needs).

## Commands

- `npx nx typecheck @orthacms/users-admin` / `npx nx lint @orthacms/users-admin`
- `npx nx test @orthacms/users-admin` — the unit specs above
