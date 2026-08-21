# @orthacms/workspaces-admin — Test Artifact

> **Unit:** `packages/workspaces/admin` · **Package:** `@orthacms/workspaces-admin` · **Kind:** admin plugin
> **Source of truth:** `packages/workspaces/admin/AGENTS.md`
> **Findings verified:** 2026-08-11 — 17 confirmed · 1 deleted · 3 corrected · 1 unverified
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns** the Workspaces management experience: the `/workspaces` list (search +
status filter + table), the full-page 3-step create wizard at `/workspaces/new`,
the **workspace shell** at `/workspaces/:id/*` (which takes over the app
sidebar's contextual region), the tabbed workspace settings at
`/workspaces/:id/settings/*`, and the three slots feature plugins mount into
(`WORKSPACE_NAV_SLOT`, `WORKSPACE_SECTION_SLOT`, `WORKSPACE_ROUTE_SLOT`).

**Does NOT own:** the sidebar chrome itself (`shell/admin` — this plugin only
contributes into `SIDEBAR_NAV_SLOT` / `SIDEBAR_SECTION_SLOT` /
`HOME_SECTION_SLOT` / `COMMAND_SLOT`), authentication or the permission set
(`identity/admin`'s `useHasPermission`), the Content Library / Media / Insights
pages (they contribute themselves into this plugin's workspace slots), or any
business rule — the server is the source of truth (ADR-0003's frontend
guidance). It is deliberately **thin**: no client aggregates, no repositories.

- **Entry points**

    **Routes** (`src/lib/presentation/workspacesPlugin/index.tsx:82-110`, all lazy + `Suspense`):

    | Path | Component | Gate |
    | --- | --- | --- |
    | `/workspaces` | `pages/WorkspacesPage` | shell's `RequireAuth` |
    | `/workspaces/new` | `pages/CreateWorkspacePage` | redirects to `/workspaces` without `workspaces:create` (`CreateWorkspacePage/index.tsx:170-173`) |
    | `/workspaces/:id/*` | `components/WorkspaceShell` | unresolved `:id` → no-access screen |
    | `/workspaces/:id/settings/*` | `pages/WorkspaceSettingsPage` (via `WORKSPACE_NAV_SLOT` order 100) | `danger` sub-route redirects without update/delete |

    **Slots filled:** `SIDEBAR_NAV_SLOT` (the `Layers` "Workspaces" entry,
    `group:'directory'`, `order:10`), `SIDEBAR_SECTION_SLOT` (`WorkspacesNavSection`
    quick-list, `order:10`), `COMMAND_SLOT` (`WorkspaceCommands`),
    `HOME_SECTION_SLOT` (`WorkspaceStats` + `WorkspacesHomePanel`).
    **Slots defined:** `WORKSPACE_NAV_SLOT`, `WORKSPACE_SECTION_SLOT`,
    `WORKSPACE_ROUTE_SLOT` (`src/lib/presentation/slots/workspaceSlots/index.ts`).

    **Exports:** `WorkspacesPlugin`, `useWorkspaces` / `workspacesKey`,
    `useCreateWorkspace`, `useCurrentWorkspace`, the three slot symbols and their
    item types, and the `Workspace` / `WorkspaceMember` / `WorkspaceStatus` view
    types.

    **API calls** (all through `infrastructure/httpWorkspaceGateway`, the sole
    `apiClient` user): `GET /api/workspaces`, `POST /api/workspaces`,
    `GET /api/workspaces/slug-available`, `GET /api/content-types`,
    `GET /api/users?q=`, `PATCH /api/workspaces/:id`,
    `POST /api/workspaces/:id/archive|unarchive`, `DELETE /api/workspaces/:id`,
    `POST|DELETE /api/workspaces/:id/members`,
    `POST|DELETE /api/workspaces/:id/content`,
    `GET /api/workspaces/:id/content/:slug/entry-count`,
    `GET /api/workspaces/:id/entry-count`.

- **Runtime prerequisites**
    - The server stack up (`docker compose up -d`, `npm run dev`) — Vite proxies
      `/api` → `:3000`.
    - A signed-in session; the admin renders nothing here without one.
    - Permissions drive almost every affordance: `workspaces:read` (list),
      `workspaces:create` (New workspace + wizard), `workspaces:update` (all
      settings edits + archive), `workspaces:delete` (delete + the entry-count
      pre-check).
    - Membership: the list is server-scoped, so a user with zero memberships
      sees an empty list, not an error.
    - For e2e, no server is needed — `apps/admin-e2e` mocks `/api` with
      `page.route` (`apps/admin-e2e/src/support/api/workspaces.ts`).

- **How to exercise it manually**

    ```bash
    docker compose up -d && npm run dev
    # open http://localhost:4200, log in, then:
    #   /workspaces            → the table
    #   /workspaces/new        → the wizard (also ?step=2 / ?step=3)
    #   /workspaces/<id>       → redirects to the default section (Content Library)
    #   /workspaces/<id>/settings/general|members|content|danger
    ```

    Run the e2e suites (no server needed):

    ```bash
    npx nx e2e admin-e2e -- --project=chromium src/workspaces
    ```

- **Dependencies that must be healthy**
    - `@orthacms/shell-admin` — `useSidebarContent`, `PageTopBar`, the slots.
      Register `WorkspacesPlugin()` **after** `ShellPlugin()`.
    - `@orthacms/identity-admin` — `useAuth`, `useHasPermission`.
    - `@orthacms/design-system` — `Table`, `Dialog`/`ConfirmDialog`, `Popover`,
      `Stepper`/`WizardStepCard`/`WizardFooter`, `Field`/`FieldLabel`/`FieldError`,
      `toast`.
    - `@orthacms/utils-admin` — `apiClient`, `queryClient`, `createSlot`,
      `slugify`, `useDebouncedValue`, `ApiError`, `initialsOf`.
    - `@orthacms/workspaces-server` — the API contract above.

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | Workspaces table (name/description, member count, type count, status) | `src/lib/presentation/components/WorkspacesTable/index.tsx:57` | ✅ E2E |
| F2 | Free-text search over name + description | `src/lib/presentation/pages/WorkspacesPage/index.tsx:56-63` | ✅ E2E |
| F3 | Status filter chips All/Active/Archived with per-status counts | `src/lib/presentation/components/WorkspaceToolbar/index.tsx:100-121` | ✅ E2E |
| F4 | Live "{shown} of {total}" count | `WorkspaceToolbar/index.tsx:123-125` | ✅ E2E |
| F5 | Default view is `Active` (archived hidden) | `WorkspaceToolbar/index.tsx:16` | ✅ E2E |
| F6 | Two distinct empty states (no matches vs. no workspaces) | `WorkspacesEmpty` via `WorkspacesPage/index.tsx:172-183` | ✅ E2E |
| F7 | Clear-filters resets to `All`, not the default `Active` | `WorkspacesPage/index.tsx:112-115` | ⚠️ PARTIAL |
| F8 | Loading skeleton distinct from empty and error | `WorkspacesSkeleton/index.tsx:49` | ✅ E2E |
| F9 | Load error renders its own `role="alert"` + Retry, never the empty state | `WorkspacesPage/index.tsx:155-171` | ❌ NONE |
| F10 | Row click and the name link both open the workspace | `WorkspacesTable/index.tsx:84-112` | ✅ E2E |
| F11 | "New workspace" button gated on `workspaces:create` | `WorkspacesPage/index.tsx:134-139` | ✅ E2E |
| F12 | `/workspaces/new` deep link redirects without the permission | `CreateWorkspacePage/index.tsx:170-173` | ✅ E2E |
| F13 | Wizard step state survives Back/Next; `?step=` mirrored + clamped | `presentation/hooks/useWizard/index.ts:91-124` | ⚠️ PARTIAL |
| F14 | Stepper rail: click a reached step to jump | `useWizard/index.ts:117-124` (`maxReached`) | ❌ NONE |
| F15 | Slug auto-fills from name until edited; regenerate restores auto-fill | `presentation/hooks/useSlug/index.ts:32-43` | ❌ NONE |
| F16 | Live slug availability (debounced 300 ms) | `application/useSlugAvailability/index.ts:16-31` | ⚠️ PARTIAL |
| F17 | Continue is gated on basics validity **and** slug availability | `CreateWorkspacePage/index.tsx:175-176,305` | ✅ E2E |
| F18 | Accent-colour picker (radiogroup of 7 swatches) | `components/ColorSwatchRow/index.tsx:41-70` | ✅ E2E |
| F19 | Members step: directory typeahead + invite-by-email | `CreateWorkspaceWizard/MembersStep/MemberTypeahead/index.tsx:87-155` | ❌ NONE |
| F20 | Content step: All vs Specific mode tiles; per-kind selections | `CreateWorkspaceWizard/ContentStep/index.tsx` | ❌ NONE |
| F21 | "Skip & create" submits with empty content without mutating state | `CreateWorkspacePage/index.tsx:184-193` | ❌ NONE |
| F22 | Create: optimistic insert at the top, rollback on error | `application/useCreateWorkspace/index.ts:28-57` | ⚠️ PARTIAL |
| F23 | Create flow: `Slug` VO guard → POST → toast → navigate to `/workspaces` | `application/useCreateWorkspaceFlow/index.ts:53-81` | ✅ E2E |
| F24 | Workspace shell resolves `:id` against the membership-scoped list | `components/WorkspaceShell/index.tsx:95` | ✅ E2E |
| F25 | No-access screen for an unresolved `:id` (indistinguishable from 404) | `WorkspaceShell/index.tsx:123-138` | ✅ E2E |
| F26 | Shell load-error screen | `WorkspaceShell/index.tsx:109-117` | ❌ NONE |
| F27 | Shell injects `WorkspaceNav` into the app sidebar, clears on unmount | `WorkspaceShell/index.tsx:100-103` | ⚠️ PARTIAL |
| F28 | Base `/workspaces/:id` redirects to the lowest-`order` route | `WorkspaceShell/index.tsx:141-147,162-167` | ✅ E2E |
| F29 | Unknown sub-path falls back to the default route | `WorkspaceShell/index.tsx:172-177` | ❌ NONE |
| F30 | Workspace switcher popover (jump + "New workspace") | `WorkspaceNav/WorkspaceSwitcher/index.tsx:72-165` | ❌ NONE |
| F31 | Workspace nav rows: relative `to`, active via `useMatch`, `aria-current` | `WorkspaceNav/WorkspaceNavButton/index.tsx:18-46` | ❌ NONE |
| F32 | "Tools" group hidden entirely when every entry is gated out | `WorkspaceNav/index.tsx:57-62,86` | ❌ NONE |
| F33 | Settings tab bar (General/Members/Content/Danger) | `components/WorkspaceSettingsTabs/index.tsx:94-105` | ✅ E2E |
| F34 | Danger tab + route only exist with update-or-delete permission | `pages/WorkspaceSettingsPage/index.tsx:44,112-125` | ✅ E2E |
| F35 | General: edit name / description / colour; Save enables only when dirty | `components/WorkspaceGeneralSettings/index.tsx:122-147,304-310` | ✅ E2E |
| F36 | General re-keys on external change so a refetch re-baselines the form | `WorkspaceSettingsPage/index.tsx:88` | ❌ NONE |
| F37 | Slug shown read-only; workspace id shown copyable | `WorkspaceGeneralSettings/index.tsx:274-289`, `WorkspaceIdField` | ✅ E2E |
| F38 | Members: directory typeahead assigns an existing user | `WorkspaceMembersSettings/MemberDirectorySearch/index.tsx:69-135` | ✅ E2E |
| F39 | Members: remove any member behind a `ConfirmDialog` | `WorkspaceMembersSettings/MemberListRow/index.tsx` | ✅ E2E |
| F40 | Content: granted types grouped Collections / Pages | `WorkspaceContentSettings/GrantedContentGroup/index.tsx` | ✅ E2E |
| F41 | Content: per-kind "Add collections" / "Add pages" multi-select dialogs | `WorkspaceContentSettings/AddContentDialog/index.tsx` | ✅ E2E |
| F42 | Content: revoke dialog blocks while the type still has entries | `WorkspaceContentSettings/RemoveContentDialog/index.tsx` + `BlockingConfirmDialog` | ✅ E2E |
| F43 | Content: 409 on revoke degrades to a warning toast | `WorkspaceContentSettings/index.tsx:203-206` | ❌ NONE |
| F44 | Danger: archive behind a confirm; unarchive applies directly | `WorkspaceDangerSettings/index.tsx` (archive branch) | ✅ E2E |
| F45 | Danger: delete dialog blocks until the workspace holds no entries | `WorkspaceDangerSettings/DeleteWorkspaceDialog/index.tsx` | ✅ E2E |
| F46 | Danger: delete → toast → navigate back to `/workspaces` | `WorkspaceDangerSettings/index.tsx:154-158` | ✅ E2E |
| F47 | Read-only mode for a viewer (fields disabled, actions hidden) | `WorkspaceGeneralSettings/index.tsx:204,248,326-332` | ✅ E2E |
| F48 | Sidebar quick-list of workspaces | `components/WorkspacesNavSection/index.tsx` | ❌ NONE |
| F49 | Command-palette entries: jump into any active workspace | `components/WorkspaceCommands/index.tsx` | ⚠️ PARTIAL |
| F50 | Home stat tiles + workspaces panel | `components/WorkspaceStats/index.tsx`, `WorkspacesHomePanel/index.tsx` | ⚠️ PARTIAL |
| F51 | Every mutation invalidates only `workspacesKey` | `application/use*/index.ts` | ❌ NONE |
| F52 | `useCurrentWorkspace()` throws outside a shell route | `presentation/currentWorkspace/index.tsx` | ❌ NONE |

## 3. Manual Test Plan

Common preconditions: signed in; the seeded account belongs to ≥ 2 workspaces,
at least one `Archived`. Roles referenced: `ADMIN` (all `workspaces:*`),
`CONTRIB` (no `workspaces:*` writes), `VIEWER` (read only).
Every block ends with a **Keyboard-only path** and a **Screen-reader
expectation**; both are required by §4A.

### F1 — Workspaces table

**Preconditions:** signed in as `ADMIN` with 6 workspaces (4 active, 2 archived).

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Navigate to `/workspaces` | Page `<h1>` "Workspaces"; table with a `Workspace` / `Members` / `Content types` / `Status` header row |
| 2 | Read the rows | 4 rows (Active only, the default filter); the count reads "4 of 6" |
| 3 | Read one row | Avatar monogram, name as a link, description clamped to 3 lines, "N members", "N types", a status chip |
| 4 | Click anywhere in a row | Navigates to `/workspaces/<id>`, which redirects to `/workspaces/<id>/content` |
| 5 | Click the name link specifically | Same destination, exactly one navigation (the link calls `stopPropagation`) |

**Keyboard-only path:** Tab from the "New workspace" button → the search box →
the three status chips (one stop, arrows move between them) → the first row's
**name link**. The table row itself is **not** a tab stop: `<TableRow onClick>`
carries no `tabIndex` or `role` (`WorkspacesTable/index.tsx:84-93`), so the
name link is the only keyboard route into a workspace. Enter on the link
navigates.
**Screen-reader expectation:** the table announces as "Workspaces, table, 5
rows, 4 columns" (`aria-label` at `WorkspacesTable/index.tsx:63`); each header
cell is a `<th scope="col">`; each row reads name-link, "3 members", "2 types",
"Active".

### F2 — Search

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Type `market` into "Search workspaces" | Only workspaces whose **name or description** contains it survive; the count updates to "1 of 6" |
| 2 | Type `MARKET` | Same result — the match is case-insensitive and trimmed (`WorkspacesPage/index.tsx:57`) |
| 3 | Type `   ` (spaces only) | Every row returns — an all-whitespace needle is treated as empty |
| 4 | Type `nonexistent-xyz` | The "No workspaces match" empty state with a "Clear filters" action |

**Keyboard-only path:** the search box is `type="search"`, so Escape clears it
in Chrome/Safari but not Firefox — do not rely on it. Tab out and back; the
value persists (component state, not URL).
**Screen-reader expectation:** the input's name is "Search workspaces"
(`aria-label`, `WorkspaceToolbar/index.tsx:95`). **The result count is not
announced** — see `♿ A11Y-workspaces-admin-01`.

### F3 / F5 — Status filter

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Read the chips | `All 6` · `Active 4` · `Archived 2`; `Active` is pre-selected |
| 2 | Click `Archived` | Only archived rows, visually muted (`bg-muted/30`); count "2 of 6" |
| 3 | Click `Archived` again | Stays selected — the empty Radix value is ignored (`WorkspaceToolbar/index.tsx:104-108`) |
| 4 | Click `All` | All 6 rows |

**Keyboard-only path:** Tab lands once on the group; ←/→ move between chips and
select on move (`aria-checked` flips). Verified by
`apps/admin-e2e/src/workspaces/keyboard.spec.ts:42-61`.
**Screen-reader expectation:** "Filter by status, radio group"; each chip reads
its status label only — the count badge is `aria-hidden`
(`WorkspaceToolbar/index.tsx:116`), which is deliberate but means the counts are
**never** available to a screen-reader user. See `♿ A11Y-workspaces-admin-02`.

### F6 / F7 / F9 — The three list states

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Sign in as a user in **no** workspace | The "no workspaces yet / create your first" variant (`filtered={false}`) |
| 2 | With workspaces, search for nonsense | The "No workspaces match / Clear filters" variant |
| 3 | Click "Clear filters" | Search empties **and** the status resets to `All` (not `Active`) — so archived-only accounts don't stay stuck |
| 4 | Force `GET /api/workspaces` to 500 (devtools request blocking) | A destructive `role="alert"` banner "Couldn't load workspaces. Please try again." + a Retry button — **never** the empty state |
| 5 | Click Retry | The query refetches |

**Keyboard-only path:** Retry and "Clear filters" are real buttons in the
content flow, reachable by Tab.
**Screen-reader expectation:** the error banner is `role="alert"`, so it is
announced on appearance. The **empty** state is not — swapping table → empty on
a search is silent.

### F11 / F12 — Create permission gating

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | As `ADMIN` on `/workspaces` | "New workspace" button visible in the header actions |
| 2 | As `VIEWER` | Button absent (not disabled) |
| 3 | As `VIEWER`, deep-link `/workspaces/new` | Immediately replaced with `/workspaces`; the list heading renders |
| 4 | As `VIEWER`, `POST /api/workspaces` by hand | `403` — the UI gate is not the boundary |

**Keyboard-only path:** step 3's redirect uses `<Navigate replace>`; focus is
**not** moved, so a keyboard user is left at `<body>` on a different page.
**Screen-reader expectation:** no announcement of the redirect — see
`♿ A11Y-workspaces-admin-03`.

### F13 / F14 — Wizard navigation and state

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Go to `/workspaces/new` | Step 1 "Basics"; the rail shows 3 steps with Members and Content marked "Optional"; URL has no `?step=` yet |
| 2 | Fill name `QA space`; watch the slug | Slug auto-fills `qa-space` |
| 3 | Click "Continue to members" | URL becomes `?step=2`; the card swaps to "Members" |
| 4 | Click "Back" | `?step=1`; the name and slug are still filled |
| 5 | Click step 3 in the rail | Jumps to Content (allowed because `maxReached` ≥ 3) |
| 6 | Reload the page on `?step=3` | Step 3 renders but **all form state is gone** — `useWizard` state is in-memory only |
| 7 | Deep-link `/workspaces/new?step=3` in a fresh tab | Step 3 renders with an empty name/slug and an enabled "Create workspace" button — see `🐞 BUG-workspaces-admin-02` |
| 8 | `?step=99` / `?step=abc` | Clamped to 3 / 1 respectively (`useWizard/index.ts:30-31`) |

**Keyboard-only path:** Tab reaches the rail step buttons, then the card's
fields, then Back/Skip/Primary in the footer. **On every step change the card is
remounted (`key={wizard.step}`, `CreateWorkspacePage/index.tsx:274`) and focus
is dropped to `<body>`** — the next Tab restarts from the top of the document.
**Screen-reader expectation:** nothing is announced when the step changes; the
new card's heading is not focused and there is no live region — see
`♿ A11Y-workspaces-admin-04`.

### F15 / F16 / F17 — Slug, availability, and the continue gate

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Type name `My Space` | Slug shows `my-space`, status "Available" after ~300 ms |
| 2 | Edit the slug to `custom` | `slugEdited` latches; further name edits no longer touch the slug |
| 3 | Click the regenerate action | Slug re-derives from the name and auto-fill resumes |
| 4 | Type a slug that already exists | Status "Taken"; Continue stays disabled |
| 5 | Type `Invalid Slug` | Status "Invalid" + the field error "Use lowercase letters, numbers, and hyphens only." |
| 6 | Clear the name | Continue disabled |
| 7 | Block `GET /api/workspaces/slug-available` (force a 500) | Status reports **"Available"** and Continue enables — see `🐞 BUG-workspaces-admin-01` |
| 8 | Enter a 101-character name | The input stops at 100 (`maxLength`), even though the server accepts 120 — see `🐞 BUG-workspaces-admin-03` |

**Keyboard-only path:** Tab: name → slug → regenerate → description → colour
swatches (7 separate stops) → Continue.
**Screen-reader expectation:** the slug status transitions
(Checking → Available/Taken) are rendered as plain text and are **not**
announced; the field error is a `FieldError` (`role="alert"`) and is.

### F18 — Accent-colour picker

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Click the green swatch | Green gains a ring + a check glyph; the monogram preview turns green |
| 2 | Read the DOM | `role="radiogroup"` with seven `role="radio"` buttons, each `aria-label="…green"` and `aria-checked` |

**Keyboard-only path:** Tab enters the group and **each of the seven swatches is
its own tab stop**; ←/→ do nothing. Space/Enter selects the focused swatch
(asserted at `apps/admin-e2e/src/workspaces/keyboard.spec.ts:84-99`).
**Screen-reader expectation:** announced as a radio group, so a user will press
arrows and nothing will happen — see `♿ A11Y-workspaces-admin-05`.

### F19 — Members step typeahead

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | On step 2, type `gra` | A popover lists matching directory users (name + email) |
| 2 | Click one | Added to the member list below; the query clears; the popover closes |
| 3 | Type the same user's email again | They are excluded from the results (`excludeIds`) |
| 4 | Type `newperson@example.com` (not in the directory) | An "Invite {email}" row appears |
| 5 | Click it | Added with `invited: true`; the server provisions a pending account on submit |
| 6 | Type `not-an-email` | No invite row (the email shape is checked client-side) |
| 7 | Remove a member from the list | Row disappears |

**Keyboard-only path:** Tab into the search input, type, then Tab again to enter
the popover and reach the result buttons; Escape closes the popover.
**Screen-reader expectation:** **the search input has no accessible name at all**
— only a placeholder (`MemberTypeahead/index.tsx:99-104`). Nothing announces
that N results appeared. See `♿ A11Y-workspaces-admin-06` and
`♿ A11Y-workspaces-admin-07`.

### F20 / F21 — Content step

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | On step 3, read the mode tiles | "All content" is preselected |
| 2 | Choose "Specific" | Two sections appear — Collections and Pages — each with an all/specific selector |
| 3 | Select two collections and no pages | The rail summary reads "2 collections · 0 pages" |
| 4 | Block `GET /api/content-types` | With mode `specific`, the Create button is disabled (`contentBlocked`, `CreateWorkspacePage/index.tsx:177-179`) |
| 5 | Switch back to "All content" with the same failure | Create **enables** — "all" is resolved server-side, so a failed catalogue load doesn't block it |
| 6 | Click "Skip & create" | Submits with `contentMode:'specific'` and both selections empty → a workspace with **no** content grants |

**Keyboard-only path:** mode tiles and the per-kind selectors are reachable by
Tab; Skip and Create are the last two stops.
**Screen-reader expectation:** the rail summary text changes silently.

### F22 / F23 — Create submission

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Complete the wizard and click "Create workspace" | Button shows a spinner + "Creating…"; the new workspace appears **immediately** at the top of the list behind the wizard (optimistic insert) |
| 2 | On success | Toast `Workspace "QA space" created.`; navigate to `/workspaces`; the count increments |
| 3 | Force the POST to 500 | Optimistic row rolls back; toast "Could not create workspace. Please try again."; **the wizard stays on step 3 with state intact** |
| 4 | Force the POST to 409 (duplicate slug, e.g. by creating the same slug in another tab first) | The same generic message — see `🐞 BUG-workspaces-admin-04` |
| 5 | Double-click Create | The button is `disabled` while `flow.submitting`, so only one POST fires |

**Keyboard-only path:** Enter on the focused Create button. On failure focus
stays on the button (it is re-enabled), which is correct.
**Screen-reader expectation:** success and failure both go through
`toast` (sonner's live region), so both are announced.

### F24 / F25 / F26 — The workspace shell

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open `/workspaces/<id you belong to>` | Redirects to the default section; the app sidebar is replaced by the workspace nav |
| 2 | Open `/workspaces/<a UUID you don't belong to>` | The no-access screen: lock icon, "You don't have access to this workspace", body text, and a "Back to workspaces" button. **No** sidebar nav is injected |
| 3 | Open `/workspaces/definitely-not-an-id` | The **same** no-access screen — existence is not disclosed |
| 4 | Force `GET /api/workspaces` to 500 and open any shell URL | The "Couldn't load workspaces" screen, distinct from no-access |
| 5 | Navigate away from the shell | The sidebar reverts to the global nav |

**Keyboard-only path:** on the no-access screen the only stop is "Back to
workspaces"; focus is not moved there automatically.
**Screen-reader expectation:** both screens are `role="alert"`
(`WorkspaceShell/index.tsx:64`), so the swap is announced — this is the one
place in the plugin that does it correctly.

### F27 / F30 / F31 / F32 — Workspace nav & switcher

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Inside a workspace, read the sidebar | "Home" back link, the switcher (avatar + name + "Workspace"), the Content section, then a "Tools" group with Media / Insights / Settings |
| 2 | Open the switcher | A popover: "SWITCH WORKSPACE" heading, one row per workspace (avatar, name, "N members · Active"), a check on the current one, and "New workspace" if permitted |
| 3 | Pick another workspace | Popover closes, navigates to its base, sidebar rebuilds |
| 4 | Click Settings | The row gets `aria-current="page"` and stays highlighted on sub-routes (`useMatch(to/*)`) |
| 5 | Sign in as a role holding none of the nav permissions | The whole "Tools" group is absent — no empty labelled group |
| 6 | **Rename the workspace** on the General tab, then look at the sidebar | The switcher still shows the **old** name — see `🐞 BUG-workspaces-admin-05` |

**Keyboard-only path:** Tab: Home link → sidebar trigger → switcher button →
section rows → Tools rows. Enter opens the switcher; Tab moves through the
listed workspaces; Escape closes and restores focus to the trigger (Radix).
**Screen-reader expectation:** the trigger's name is "Switch workspace, current:
{name}" — good. The popover itself is a `role="dialog"` with **no accessible
name**, and the current workspace is marked only by a background tint and an
unlabelled check glyph — see `♿ A11Y-workspaces-admin-08`.

### F33 / F34 — Settings tabs

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open `/workspaces/<id>/settings` | Redirects to `.../settings/general`; a `<h1>` "Settings"; subtitle "Manage settings for {name}." |
| 2 | Read the tab bar | General · Members · Content · Danger zone (the last only with update or delete) |
| 3 | As `VIEWER`, deep-link `.../settings/danger` | Redirected to `.../general` |
| 4 | Deep-link `.../settings/nonsense` | Redirected to `.../general` |
| 5 | On an archived workspace | An "Archived" badge sits beside the `<h1>` |

**Keyboard-only path:** the tabs are `NavLink`s inside a `TabNav` — Tab moves
through each one (a link list, not an ARIA tablist), Enter follows.
**Screen-reader expectation:** "Workspace settings sections, navigation";
the active tab is a `NavLink`, so React Router sets `aria-current="page"`.
Switching tabs does **not** move focus into the new panel.

### F35 / F36 / F37 / F47 — General settings

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Land on General | Name and Description prefilled; the slug shown read-only and **disabled**; the workspace id shown `readOnly` but **enabled** |
| 2 | Read the Save button before touching anything | Disabled (nothing is dirty) |
| 3 | Change the name | Save enables |
| 4 | Change only the colour | Save enables (`colorDirty`) |
| 5 | Save | Toast "Workspace details saved."; Save disables again immediately (the form re-baselines before the refetch) |
| 6 | Click Save twice fast | Only one PATCH (`isSubmitting` disables it) |
| 7 | Clear the name and blur | Field error "Workspace name is required." with `aria-invalid` |
| 8 | Have another admin rename the workspace, then refetch | The form re-baselines to the new value (the `key` on line 88 remounts it), discarding your unsaved edit **without warning** |
| 9 | Copy the workspace id | Clipboard holds the UUID; a confirmation toast appears. On an insecure origin, an error toast tells you to select it manually |
| 10 | As `VIEWER` | Name/Description disabled, Save hidden, footer reads "You have read-only access…" |

**Keyboard-only path:** Tab: name → description → 7 colour swatches → **slug is
skipped entirely** (disabled inputs are not focusable) → workspace id (focusable,
selectable with ⌘A/Ctrl+A) → copy button → Save.
**Screen-reader expectation:** every field is labelled through
`Field`/`FieldLabel` with `htmlFor` (`WorkspaceGeneralSettings/index.tsx:189,232`);
errors are `FieldError` (`role="alert"`). The slug value is unreachable — see
`♿ A11Y-workspaces-admin-09`.

### F38 / F39 — Members settings

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open the Members tab | The roster lists every member (avatar, name, email) |
| 2 | Type into "Search directory" | A popover lists non-member users; existing members are excluded |
| 3 | Pick one | `POST /api/workspaces/:id/members`; the roster grows; the list query invalidates |
| 4 | Click Remove on a member | A `ConfirmDialog` names them; confirming removes them |
| 5 | Remove **yourself** while other members remain | Succeeds; the workspace disappears from your list and the shell falls to the no-access screen on the next render |
| 6 | Remove yourself as the **only** member | The API 204s and the workspace becomes unreachable — see `🐞 BUG-workspaces-server-01` in `workspaces-server.md`; verify what the admin does next |
| 7 | Force the search request to fail | A `role="alert"` "couldn't load" inside the popover (`MemberDirectorySearch/index.tsx:103`) |
| 8 | As `VIEWER` | The search input is hidden and Remove buttons are absent |

**Keyboard-only path:** search input → Tab into the popover → result buttons.
The Remove button per row, then the dialog's Cancel/Confirm (Radix traps focus
and restores it to the trigger on Escape).
**Screen-reader expectation:** the search input **does** have an `aria-label`
here (`MemberDirectorySearch/index.tsx:87`), unlike the wizard's. After removing
a member, focus lands back on the (now-destroyed) row's trigger — verify where
it actually goes; see `♿ A11Y-workspaces-admin-10`.

### F40 / F41 / F42 / F43 — Content settings

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open the Content tab | Two titled groups: **Collections** and **Pages**, each row showing title + description |
| 2 | Click "Add collections" | A dialog listing only ungranted **collections**, searchable, multi-select |
| 3 | Select two and confirm | Both appear in the Collections group; the "Add" dialog's list shrinks accordingly |
| 4 | Click Remove on an **empty** type | The dialog opens, reads "Checking for existing content…", then enables Remove |
| 5 | Click Remove on a type **with entries** | The dialog shows "still has N entries…" and Remove stays **disabled** |
| 6 | Break `GET .../entry-count` | The dialog blocks with "Couldn't check for existing content, so deletion is blocked." — it fails **closed** |
| 7 | Create an entry in another tab between the check and the confirm | The `DELETE` 409s and degrades to a **warning** toast (`isConflict`), not an error |
| 8 | As `VIEWER` | Both "Add …" buttons hidden |

**Keyboard-only path:** each group's rows, then the Add buttons; inside the
dialog Tab cycles search → options → Cancel/Confirm, Escape cancels.
**Screen-reader expectation:** the blocking warning inside the dialog is an
`Alert role="alert"` (`BlockingConfirmDialog/index.tsx:92,96`), so it announces
when the count resolves. Two `role="alert"` nodes can co-exist in that dialog
(loading-error and blocked) — the `admin-e2e` gotcha the accessibility skill
warns about (`.agents/skills/accessibility/SKILL.md:46-47`).

### F44 / F45 / F46 — Danger zone

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open the Danger tab as `ADMIN` | Two rows: Archive and Delete, in a destructive-bordered card with an `<h2>` "Danger zone" |
| 2 | Click Archive | A `ConfirmDialog` titled with the workspace name; confirming archives it and the settings header gains the "Archived" badge |
| 3 | Click Unarchive | Applies **directly**, no confirm (deliberate — low risk) |
| 4 | Click Delete with content present | The dialog blocks with the entry count; Delete disabled |
| 5 | Delete an empty workspace | Toast "…deleted"; navigates to `/workspaces`; the row is gone |
| 6 | Force the DELETE to 409 | Warning toast (`isConflict`), dialog closes |
| 7 | As a user with `workspaces:update` but not `:delete` | Archive row visible, Delete row absent, but the Danger **tab** still shows (`showDanger = canUpdate || canDelete`) |
| 8 | Browser Back immediately after a successful delete | Returns to the shell for a workspace that no longer exists → the no-access screen |

**Keyboard-only path:** Archive/Delete buttons are real buttons; the dialogs
trap focus and Escape cancels.
**Screen-reader expectation:** the dialog has a `DialogTitle` naming the
workspace (3.3.4 Error Prevention satisfied by explicit confirmation). Result
toasts announce.

### F48 / F49 / F50 — Slot contributions

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Look at the global sidebar | A "Workspaces" nav entry (violet `Layers`) and, below it, a quick-list of workspaces |
| 2 | Open the command palette | Entries for each **active** workspace; selecting one navigates into it |
| 3 | Open the home dashboard | Workspace stat tiles + a workspaces panel |
| 4 | Break `GET /api/workspaces` | The home panel and stats render `role="alert"` error states (`WorkspaceStats/index.tsx:46`, `WorkspacesHomePanel/index.tsx:86`), not empty ones |

**Keyboard-only path:** quick-list rows are links (`aria-current="page"` on the
active one, `WorkspacesNavSection/index.tsx:46`).
**Screen-reader expectation:** covered by the shell's own suites.

### F51 / F52 — Cache and context invariants

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Watch the network on any settings mutation | Exactly one refetch of `GET /api/workspaces`; no other query key is invalidated |
| 2 | Render any component using `useCurrentWorkspace()` outside `/workspaces/:id/*` | Throws with a clear message rather than returning `undefined` |

## 4. Edge Cases & Negative Paths

**Empty / zero**

- **EC-01 — A user in zero workspaces.** `❌ NONE` Expected: `/workspaces` shows the "create your first" empty state, the sidebar quick-list is empty, home stats read 0. Not asserted anywhere.
- **EC-02 — A workspace with zero members.** `❌ NONE` Expected: the table shows "0 members" via the plural rule. Reachable via `🐞 BUG-workspaces-server-01`.
- **EC-03 — A workspace with zero content grants.** `❌ NONE` Expected: "0 types"; the Content settings tab shows two empty groups; the Content Library nav section is empty.
- **EC-04 — Empty description.** `⚠️ PARTIAL` Expected: the `<p>` renders empty and the row keeps its height. The mapper maps a missing description to `''` (`infrastructure/workspaceMapper`).
- **EC-05 — Search string of only whitespace.** `❌ NONE` Expected: treated as empty (`.trim()`, `WorkspacesPage/index.tsx:57`), so every row returns.
- **EC-06 — `WORKSPACE_ROUTE_SLOT` empty (no feature plugins registered).** `❌ NONE` Suspected: `defaultRoute` is `undefined`, `defaultPath` is `undefined`, both `<Navigate>` routes are skipped, and `/workspaces/:id` renders an **empty content area** with a sidebar — a blank page with no message. See `🐞 BUG-workspaces-admin-06`.

**Boundary**

- **EC-07 — Name of exactly 100 / 101 characters.** `❌ NONE` The input's `maxLength` is 100 and the Zod schema's `.max(100)` matches; the server allows 120. See `🐞 BUG-workspaces-admin-03`.
- **EC-08 — Description of 500 / 501 characters.** `❌ NONE` Same asymmetry (server: 2000).
- **EC-09 — Slug of 120 / 121 characters.** `❌ NONE` `Slug.isValid` caps at 120 (`domain/slug/index.ts:9`), matching the server exactly. The **name** and **description** do not.
- **EC-10 — `?step=0`, `?step=4`, `?step=-1`, `?step=abc`, `?step=1&step=2`.** `❌ NONE` Expected: clamp to 1/3/1/1 and (for the repeated param) whatever `URLSearchParams.get` returns first. `clampStep` handles `NaN` explicitly (`useWizard/index.ts:30-31`).
- **EC-11 — A workspace list of 500 entries.** `❌ NONE` Expected: the table renders all of them — there is **no pagination and no virtualisation** on this page. `matchesSearch` runs over the whole array per keystroke inside a `useMemo`. Acceptable at realistic scale; note it, don't file it.

**Size & encoding**

- **EC-12 — Workspace name containing `<script>alert(1)</script>`.** `❌ NONE` Expected: rendered as literal text (React escapes) in the table, the switcher, the settings subtitle, and inside the confirm-dialog titles that interpolate `{name}`.
- **EC-13 — Emoji / CJK / RTL name.** `❌ NONE` Expected: `initialsOf` produces something sensible for the monogram; RTL text inside an LTR row may render with mixed direction. No `dir="auto"` anywhere.
- **EC-14 — A name of 100 identical characters with no spaces.** `❌ NONE` Expected: `truncate` clips the link (`WorkspacesTable/index.tsx:106`); the description uses `line-clamp-3 break-words`.
- **EC-15 — Invited email with uppercase / surrounding spaces.** `❌ NONE` The client lowercases before adding (`MemberTypeahead/index.tsx:76`); the server lowercases again. Consistent.

**Permission matrix**

| Surface | viewer | contributor | admin |
| --- | --- | --- | --- |
| `/workspaces` list | visible ✅ | visible ❌ | visible ✅ |
| "New workspace" button | hidden ✅ | hidden ❌ | visible ✅ |
| `/workspaces/new` deep link | redirect ✅ | redirect ❌ | wizard ✅ |
| Settings General fields | disabled ✅ | disabled ❌ | editable ✅ |
| Settings Save button | hidden ✅ | hidden ❌ | visible ✅ |
| Members search / Remove | hidden ✅ | hidden ❌ | visible ✅ |
| Content "Add …" buttons | hidden ✅ | hidden ❌ | visible ✅ |
| Danger **tab** | hidden ✅ | hidden ❌ | visible ✅ |
| Danger Archive row | hidden ❌ | hidden ❌ | visible ✅ |
| Danger Delete row | hidden ❌ | hidden ❌ | visible ✅ |

- **EC-16 — A user with `workspaces:update` but not `:delete`.** `❌ NONE` Expected: the Danger **tab** appears (`showDanger = canUpdate || canDelete`, `WorkspaceSettingsPage/index.tsx:44`) with only the Archive row. Verify the card doesn't look broken with one row and no separator.
- **EC-17 — A user with `:delete` but not `:update`.** `❌ NONE` The mirror case: Delete row only, no Archive.
- **EC-18 — Permission changes mid-session (an admin demotes you).** `❌ NONE` Expected: the buttons persist until the auth query refetches. The server refuses regardless — the UI gate is not the boundary (BUGBOT: "Permission gating only in the UI").

**Tenant isolation**

- **EC-19 — Deep-link another tenant's workspace id.** `✅ E2E` `apps/admin-e2e/src/workspaces/workspaces.spec.ts:124-149` — no-access screen, no sidebar nav, "Back to workspaces" returns to the list.
- **EC-20 — No client-side membership filter is applied on top of the server's.** `✅` Verified: `useWorkspaces` returns the raw list and `WorkspacesPage` filters only on status + search (`WorkspacesPage/index.tsx:86-94`). AGENTS.md forbids a second filter (`packages/workspaces/admin/AGENTS.md`, "Access is scoped to membership") and the code obeys.
- **EC-21 — A workspace you were just removed from, while you have it open.** `❌ NONE` Expected: the next `workspacesKey` refetch drops it, `current` becomes `undefined`, and the shell swaps to the no-access screen mid-session. Worth asserting — it is the only in-session revocation path.
- **EC-22 — The switcher lists only your workspaces.** `❌ NONE` It renders `useWorkspaces()`, so yes by construction. Not asserted.

**Concurrency & state after mutation**

- **EC-23 — Two admins editing General simultaneously.** `❌ NONE` Expected/actual: **last write wins, and the loser's unsaved edits are silently discarded** — the `key` on `WorkspaceSettingsPage/index.tsx:88` remounts the form when the refetched name/description/colour differ, wiping the in-progress edit with no warning. The `key` fixes a real staleness problem but creates a data-loss-of-keystrokes one.
- **EC-24 — Double-submit on Create / Save / Delete.** `⚠️ PARTIAL` All three disable on `isPending`/`isSubmitting` (`CreateWorkspacePage/index.tsx:403`, `WorkspaceGeneralSettings/index.tsx:306`, `WorkspaceDangerSettings` `disabled={remove.isPending}`). Only the Save-when-dirty case is asserted (`settings.spec.ts:114`).
- **EC-25 — Optimistic create followed by a failed POST.** `⚠️ PARTIAL` `onError` restores the previous list (`useCreateWorkspace/index.ts:53-57`) and `onSettled` refetches. The rollback path is not asserted.
- **EC-26 — Delete the workspace you are currently inside.** `✅ E2E` `settings.spec.ts:224-238` — navigates back to `/workspaces`.
- **EC-27 — Browser Back after a successful delete.** `❌ NONE` Expected: the shell for the dead id → no-access screen. Currently untested.
- **EC-28 — Filters surviving a refetch.** `❌ NONE` `search` and `status` are component state, not URL state, so a mutation-triggered refetch preserves them but a **reload** loses them. Deliberate? Not documented.
- **EC-29 — Over-invalidation.** `✅` Every mutation hook invalidates only `workspacesKey`. Verified by reading all nine `application/use*` hooks. Matches BUGBOT's rule.
- **EC-30 — Pager stranded on an empty page after a delete.** **Not applicable** — this list has no pagination. The classic bug cannot occur here.

**Failure & partiality**

- **EC-31 — `GET /api/workspaces` fails.** `❌ NONE` Handled in **four** places, each with its own error state: the list page (`role="alert"` + Retry), the shell (error screen), the home stats and the home panel. None is asserted. This is the surface most likely to regress into BUGBOT's "error masquerading as empty".
- **EC-32 — `GET /api/content-types` fails during the wizard.** `⚠️ PARTIAL` With mode `specific` the Create button is blocked; with `all` it is not. Sensible, untested.
- **EC-33 — `GET .../entry-count` fails on the delete/revoke dialog.** `❌ NONE` Fails **closed** — the action is blocked with an explicit message. Good behaviour, no test.
- **EC-34 — `GET /api/workspaces/slug-available` fails.** `❌ NONE` Fails **open** — see `🐞 BUG-workspaces-admin-01`. The inconsistency with EC-33 is the tell.
- **EC-35 — Clipboard write denied (insecure origin).** `⚠️ PARTIAL` Falls back to an error toast (`settings.spec.ts:74-111` asserts the success path only).
- **EC-36 — Network drop mid-PATCH.** `❌ NONE` Expected: error toast, form stays dirty, Save re-enabled.

**Idempotency & replay**

- **EC-37 — Re-adding an existing member.** `❌ NONE` They are excluded from the typeahead, so the UI prevents it; the API is idempotent anyway.
- **EC-38 — Re-granting a granted content type.** `❌ NONE` Excluded from the Add dialog's list.
- **EC-39 — Refresh after submitting the wizard.** `❌ NONE` The navigation to `/workspaces` already happened, so a refresh re-lists. No double-create risk.
- **EC-40 — Reload mid-wizard.** `❌ NONE` All wizard state is lost; only `?step=` survives. See EC-10 / `🐞 BUG-workspaces-admin-02`.

**UI-specific**

- **EC-41 — Loading / error / empty are three distinct states on the list.** `⚠️ PARTIAL` They genuinely are (`WorkspacesPage/index.tsx:153-186`); only loading and empty are asserted.
- **EC-42 — Focus after a dialog closes.** `❌ NONE` Radix restores focus to the trigger — except when the trigger was destroyed by the action (removing a member, deleting a workspace). Untested.
- **EC-43 — i18n coverage for every branch.** `⚠️ PARTIAL` Every user-visible string in the package goes through `defineMessages` — verified by grep; no bare English literals in JSX. The only non-translated strings are the `aria-hidden` count badges and the swatch colour names interpolated into `aria-label` (`ColorSwatchRow/index.tsx:54-56`), which stay English in every locale.
- **EC-44 — `prefers-reduced-motion`.** `⚠️ PARTIAL` The wizard step animation is transform-only and disabled under the media query — but that is the **design-system's** stylesheet, not this package's, so this unit inherits it rather than owning it.

### 4A. Accessibility & Section 508 Conformance

**Standards.** Revised Section 508 (36 CFR Part 1194, Appendices A–C)
incorporates WCAG 2.0 A + AA by reference — **E205.4** for electronic content
and **504.2** for authoring tools. This repo's `accessibility` skill targets
WCAG **2.1** AA (`.agents/skills/accessibility/SKILL.md:10`), so every finding
below is stated at 2.1 AA with the 508 provision cited alongside. Chapter 5
software provisions assessed: **502.2/502.3** (AT interoperability — name, role,
state, value exposed *and updated*), **503.2** (platform preferences —
reduced motion, forced colours), **504** (authoring tools).

**Automated coverage is not conformance.** This unit's only a11y automation is
two axe runs: `apps/admin-e2e/src/workspaces/a11y.spec.ts` (six scans) and
`apps/admin-e2e/src/workspaces/settings.spec.ts:304` (one scan of the default
General tab). Axe covers a minority of the success criteria and proves nothing
about focus order, focus restoration, announcement timing, keyboard traps, or
whether an accessible name is *meaningful*. Concretely, **no scan covers**: the
wizard's Members step, the wizard's Content step, any open dialog
(`ConfirmDialog`, `DeleteWorkspaceDialog`, `AddContentDialog`,
`RemoveContentDialog`), the workspace switcher popover, either typeahead
popover, the workspace shell nav, the Members/Content/Danger settings tabs, or
the list's error state. `♿ A11Y-workspaces-admin-06` below is an
**axe-detectable** violation living in exactly one of those unscanned states.

**508 Chapter 5 — 504 Authoring Tools.** This plugin is not itself the content
editor, so 504.2/504.3 largely defer to `content/admin`. Two things do land
here: the workspace `description` field offers no structured-markup or
language-of-parts channel (cross-referenced to
`♿ A11Y-workspaces-server-01`), and the content-**grant** UI decides which
content types an author can reach at all — a workspace granted no types
produces an authoring surface with nothing in it (EC-03/EC-06). **504.4
(templates):** Not Applicable — content-type defaults are defined in
`content/server`.

| Provision | Verdict | Basis |
| --- | --- | --- |
| 1.1.1 Non-text Content (A) / 508 E205.4 | **Supports** | Decorative lucide icons carry `aria-hidden` (`WorkspaceNav/index.tsx:72,96`, `WorkspaceSettingsTabs/index.tsx:99`); the monogram avatar is text, not an image |
| 1.3.1 Info & Relationships (A) | **Partially Supports** | Real `<table>`/`<th scope="col">`, `Field`/`FieldLabel` on the settings form — but see ♿-06 (unlabelled input) |
| 1.3.2 Meaningful Sequence (A) | **Supports** | DOM order matches visual order; no positive `tabindex` anywhere in the package |
| 1.3.5 Identify Input Purpose (AA) | **Not Applicable** | No field collects information *about the user*; `autoComplete="off"` on the two directory searches is correct |
| 1.4.1 Use of Color (A) | **Partially Supports** | Status is a chip with text; archived rows add a muted tint *on top of* the chip. But the switcher's "current workspace" is tint + unlabelled check only — ♿-08 |
| 1.4.3 / 1.4.11 Contrast (AA) | **Partially Supports** | `muted-foreground` was deliberately darkened to clear AA and axe enforces `color-contrast` on the scanned states (`.agents/skills/accessibility/SKILL.md:116-119`). Unverified in this unit: the seven avatar swatches' white check glyph (`ColorSwatchRow/index.tsx:66`) against `amber`/`teal` at 3:1, and every unscanned state above. Neither theme is scanned separately by these suites |
| 1.4.4 Resize Text (AA) | **Not verified** | No zoom test exists |
| 1.4.10 Reflow (AA) | **Not verified** | The wizard is a `lg:grid-cols-[244px_1fr]` that collapses below `lg`, and the toolbar `flex-wrap`s — plausible, untested at 320 px / 400 % |
| 1.4.12 Text Spacing (AA) | **Not verified** | `truncate` / `line-clamp-3` are the risk (`WorkspacesTable/index.tsx:106,113`) |
| 1.4.13 Content on Hover or Focus (AA) | **Partially Supports** | Sidebar nav rows use a Radix `tooltip` prop (`WorkspaceNavButton/index.tsx:39`) — dismissible and hoverable via Radix, but not asserted |
| 2.1.1 Keyboard (A) | **Partially Supports** | Every action has a keyboard route — but see ♿-05 (radiogroup arrows) and ♿-09 (unreachable slug value) |
| 2.1.2 No Keyboard Trap (A) | **Supports** | All overlays are Radix `Dialog`/`Popover`; Escape closes each |
| 2.4.1 Bypass Blocks (A) | **Supports** | Corrected 2026-08-11. The skip link is the first focusable element and `<main id="main-content" tabIndex={-1}>` is its target (`packages/shell/admin/…/AppShell/index.tsx:49-56`). ♿-11 withdrawn — it had quoted stale skill prose instead of reading the source. Untested, though: see §7 |
| 2.4.2 Page Titled (AA→A) | **Does Not Support** | ♿-12 |
| 2.4.3 Focus Order (A) | **Does Not Support** | ♿-03, ♿-04 |
| 2.4.6 Headings and Labels (AA) | **Partially Supports** | One `<h1>` per page (`ContainerHeader` on the list/wizard, an explicit `<h1>` at `WorkspaceSettingsPage/index.tsx:52`), `<h2>` on each settings card. But ♿-06 |
| 2.4.7 Focus Visible (AA) | **Supports** | `focus-visible:ring-*` on every hand-rolled control (`WorkspaceNav/index.tsx:70`, `ColorSwatchRow/index.tsx:60`, both typeahead result buttons); no `outline:none` without a replacement |
| 3.1.1 Language of Page (A) | **Not Applicable here** | Owned by `bootstrap-admin`'s `<html lang>` |
| 3.1.2 Language of Parts (AA) | **Does Not Support** | A workspace name/description in another language carries no `lang` — cross-ref `♿ A11Y-workspaces-server-01` |
| 3.2.1 On Focus (A) | **Supports** | Nothing changes context on focus |
| 3.2.2 On Input (A) | **Partially Supports** | Typing in either typeahead auto-opens a popover without warning; the status chips select on arrow-key move (standard radio behaviour, acceptable) |
| 3.3.1 Error Identification (A) | **Supports** | `FieldError` is `role="alert"` and `aria-invalid` is set (`WorkspaceGeneralSettings/index.tsx:205,249`) |
| 3.3.2 Labels or Instructions (A) | **Does Not Support** | ♿-06 |
| 3.3.3 Error Suggestion (AA) | **Partially Supports** | Field-level messages are specific; the create failure toast is not — cross-ref `🐞 BUG-workspaces-admin-04` |
| 3.3.4 Error Prevention (AA) | **Supports** | Archive, member removal, content revoke and delete are all behind explicit confirmation; delete and revoke additionally **block** until the pre-check clears |
| 4.1.2 Name, Role, Value (A) / 508 502.2 | **Partially Supports** | ♿-05, ♿-06, ♿-08 |
| 4.1.3 Status Messages (AA) / 508 502.3 | **Does Not Support** | ♿-01, ♿-02, ♿-04, ♿-07 |
| 508 503.2 Platform preferences | **Partially Supports** | Reduced motion is honoured via the design-system keyframe; **forced-colors / Windows High Contrast is unhandled** — the status chip, the archived-row tint and the switcher's `bg-accent` current-marker all lose their meaning under forced colours (see ♿-08) |

#### ♿ A11Y-workspaces-admin-01 — The filtered result count is never announced

- **WCAG:** `4.1.3 Status Messages (AA)` · **508:** `E205.4 / 502.3` · **Verdict:** **Does Not Support**
- **Location:** `packages/workspaces/admin/src/lib/presentation/components/WorkspaceToolbar/index.tsx:123-125`
  (`<span className="ml-auto text-sm text-muted-foreground">{shown} of {total}</span>`)
- **Repro:** 1) `/workspaces`. 2) Type `market` in the search box. 3) The table
  silently drops from 4 rows to 1 and the span changes from "4 of 6" to "1 of 6".
- **Keyboard-only:** fine — focus stays in the input.
  **Screen reader:** nothing is announced. The user has no way to know the search
  matched, matched nothing, or is still filtering, short of leaving the field and
  exploring the table. The same span is the only feedback for the status chips.
- **Remediation:** wrap the count in `role="status"` (`aria-live="polite"`), or
  render an `sr-only` live region that restates "{n} workspaces shown" on change.

#### ♿ A11Y-workspaces-admin-02 — Status-chip counts are hidden from assistive technology with no equivalent

- **WCAG:** `1.3.1 Info and Relationships (A)` · **508:** `E205.4 / 502.2` · **Verdict:** **Partially Supports**
- **Location:** `packages/workspaces/admin/src/lib/presentation/components/WorkspaceToolbar/index.tsx:114-118`
- **Repro:** inspect a chip: the count badge is `<SegmentedControlCount aria-hidden>`.
- **Keyboard-only:** unaffected. **Screen reader:** the chips announce "All",
  "Active", "Archived" with no counts, so a screen-reader user cannot tell that
  "Archived" would reveal 2 workspaces while a sighted user can. The comment
  says the badge is hidden "so the radio's name stays just the status label" —
  a reasonable goal, but the information is then lost entirely rather than moved.
- **Remediation:** keep the badge `aria-hidden` and extend the radio's
  accessible name instead, e.g. `aria-label="Archived, 2 workspaces"`.

#### ♿ A11Y-workspaces-admin-03 — Permission redirects move the page without moving focus or announcing

- **WCAG:** `2.4.3 Focus Order (A)`, `4.1.3 Status Messages (AA)` · **508:** `E205.4 / 502.3` · **Verdict:** **Does Not Support**
- **Location:** `packages/workspaces/admin/src/lib/presentation/pages/CreateWorkspacePage/index.tsx:170-173`;
  same pattern at `pages/WorkspaceSettingsPage/index.tsx:122` (danger → general) and `:128-130` (unknown → general)
- **Repro:** 1) Sign in as a viewer. 2) Enter `/workspaces/new` in the address
  bar. 3) You land on `/workspaces`.
- **Keyboard-only:** focus is on `<body>`; the next Tab starts from the very top
  of the document, above the sidebar. **Screen reader:** nothing announces that
  the requested page was refused or that a different page loaded — the user hears
  silence and must explore to discover where they are. This is the SPA analogue
  of a silent redirect.
- **Remediation:** on a gated redirect, move focus to the destination's `<h1>`
  (`tabIndex={-1}` + `focus()`), and post a short `role="status"` message
  explaining the redirect.

#### ♿ A11Y-workspaces-admin-04 — Wizard step changes drop focus and are not announced

- **WCAG:** `2.4.3 Focus Order (A)`, `4.1.3 Status Messages (AA)` · **508:** `E205.4 / 502.3` · **Verdict:** **Does Not Support**
- **Location:** `packages/workspaces/admin/src/lib/presentation/pages/CreateWorkspacePage/index.tsx:274`
  (`<WizardStepCard key={wizard.step}>` — the `key` deliberately remounts the
  card so the entrance animation replays), with the step bodies at `:275`, `:318`, `:365`
- **Repro:** 1) `/workspaces/new`. 2) Fill the basics. 3) Press Enter on
  "Continue to members".
- **Keyboard-only:** the focused button is unmounted along with the card, so
  focus falls back to `<body>`. The next Tab starts at the top of the document —
  the user must traverse the whole sidebar and page header again for **every**
  step, three times per workspace. **Screen reader:** the heading changes from
  "Basics" to "Members" with no announcement, no focus move, and no live region;
  the `Stepper` rail updates visually only. There is no `.focus()` call anywhere
  in the package — `grep -rn '\.focus()' packages/workspaces/admin/src` returns
  nothing.
- **Remediation:** after a step change, move focus to the new `CardTitle`
  (`tabIndex={-1}`) and expose the rail's progress as text
  ("Step 2 of 3: Members") in a `role="status"` region.

#### ♿ A11Y-workspaces-admin-05 — The colour picker claims `radiogroup` but implements seven tab stops and no arrow keys

- **WCAG:** `4.1.2 Name, Role, Value (A)`, `2.1.1 Keyboard (A)` · **508:** `502.2` · **Verdict:** **Partially Supports**
- **Location:** `packages/workspaces/admin/src/lib/presentation/components/ColorSwatchRow/index.tsx:41-69`
- **Repro:** 1) Open `/workspaces/new` or the General settings tab. 2) Tab until
  the first swatch is focused. 3) Press → or ↓.
- **Keyboard-only:** nothing happens on arrow keys; instead Tab steps through
  all seven swatches individually, so a keyboard user crossing the form passes
  seven stops where the ARIA contract promises one.
  **Screen reader:** announced as "Colour, radio group … slate, radio button, 1
  of 7". Screen readers switch to forms/browse behaviour on that role and their
  users reach for arrows — which do nothing. The role is a promise the widget
  does not keep; per the accessibility skill, "a wrong/extra ARIA role is worse
  than none" (`.agents/skills/accessibility/SKILL.md:26`).
- **Remediation:** implement roving `tabIndex` with ←/→/↑/↓ handling (or swap to
  the design-system `RadioGroup`, which Radix already wires).

#### ♿ A11Y-workspaces-admin-06 — The wizard's member search input has no accessible name

- **WCAG:** `3.3.2 Labels or Instructions (A)`, `1.3.1 (A)`, `4.1.2 (A)` · **508:** `E205.4 / 502.2` · **Verdict:** **Does Not Support**
- **Location:** `packages/workspaces/admin/src/lib/presentation/components/CreateWorkspaceWizard/MembersStep/MemberTypeahead/index.tsx:99-104`

    ```tsx
    <InputGroupInput
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={intl.formatMessage(messages.placeholder)}
        autoComplete="off"
    />
    ```

    No `aria-label`, no `<label htmlFor>`, no `aria-labelledby` — only a
    placeholder. Its sibling on the settings page does it correctly
    (`WorkspaceMembersSettings/MemberDirectorySearch/index.tsx:87`:
    `aria-label={intl.formatMessage(messages.placeholder)}`), which is what makes
    this an oversight rather than a decision.
- **Repro:** 1) `/workspaces/new?step=2`. 2) Inspect the search input's
  accessible name in devtools, or run axe against that state.
- **Keyboard-only:** reachable and usable. **Screen reader:** announced as
  "edit, blank" with no purpose. Once the user types, the placeholder disappears
  and even the visual affordance is gone.
- **This is axe-detectable** and would fail CI — except
  `apps/admin-e2e/src/workspaces/a11y.spec.ts` scans only the **basics** step
  (`:63`, `:68`). The Members step is never scanned, which is precisely the
  "clean axe run ≠ conformance" trap.
- **Remediation:** add `aria-label` (or a visible `FieldLabel`) exactly as the
  settings-page sibling does. It violates the skill's non-negotiable #2 —
  "Never ship a bare `<input>` with only a placeholder"
  (`.agents/skills/accessibility/SKILL.md:29-30`).

#### ♿ A11Y-workspaces-admin-07 — Neither typeahead exposes a combobox relationship or announces its results

- **WCAG:** `4.1.2 Name, Role, Value (A)`, `4.1.3 Status Messages (AA)` · **508:** `502.2 / 502.3` · **Verdict:** **Does Not Support**
- **Location:** `CreateWorkspaceWizard/MembersStep/MemberTypeahead/index.tsx:87-155`
  and `WorkspaceMembersSettings/MemberDirectorySearch/index.tsx:69-135`
- **What is missing:** neither input carries `role="combobox"`,
  `aria-expanded`, `aria-controls` or `aria-activedescendant`; the results are a
  plain `<ul>` of `<button>`s inside a Radix `PopoverContent` (which renders
  `role="dialog"`), and `onOpenAutoFocus` is prevented so focus deliberately
  stays in the input.
- **Repro:** 1) Open either search. 2) Type three characters. 3) Wait for
  results.
- **Keyboard-only:** the results are reachable — but only by Tabbing *out of*
  the input into the popover, which is not the interaction any user expects from
  a search box, and there is no ↓-to-first-result affordance.
  **Screen reader:** the appearance of the popover, the number of results, the
  "Searching…" state, the "no results" state and the "Invite {email}" option are
  **all silent**. A screen-reader user typing an email has no signal that an
  invite option exists at all.
- **Remediation:** adopt the ARIA 1.2 combobox pattern (input
  `role="combobox" aria-expanded aria-controls`, list `role="listbox"`, options
  `role="option"`, ↓/↑ + `aria-activedescendant`), and announce the result count
  in a polite live region. The design-system's `Command` primitive already
  implements this and is used by the shell's palette.

#### ♿ A11Y-workspaces-admin-08 — The switcher popover is unnamed and its "current" marker is visual-only

- **WCAG:** `1.4.1 Use of Color (A)`, `4.1.2 Name, Role, Value (A)` · **508:** `502.2 / 503.2` · **Verdict:** **Partially Supports**
- **Location:** `packages/workspaces/admin/src/lib/presentation/components/WorkspaceNav/WorkspaceSwitcher/index.tsx:99-141`
- **What the code does:** `PopoverContent` receives no `aria-label`, so the
  dialog it renders has no accessible name; the "SWITCH WORKSPACE" heading is a
  `<p>` (`:103`), not a heading element and not referenced by
  `aria-labelledby`. Each workspace row is a plain `<button>`; the current one is
  marked by `bg-accent` (`:117`) plus a bare `<Check>` glyph (`:137`) with no
  text alternative and no `aria-current` / `aria-selected`.
- **Repro:** 1) Enter a workspace. 2) Open the switcher. 3) Tab through the rows.
- **Keyboard-only:** works — Escape closes and Radix restores focus to the
  trigger. **Screen reader:** "dialog" with no name; every workspace row reads
  identically, so the user cannot tell which one they are already in. Under
  Windows High Contrast / forced-colors, `bg-accent` is flattened and the *only*
  remaining cue is the check glyph, which has no name.
- **Remediation:** give `PopoverContent` an `aria-label` (or promote the heading
  to an `<h2 id>` + `aria-labelledby`), and add
  `aria-current="true"` plus `sr-only` "Current workspace" text to the active row.

#### ♿ A11Y-workspaces-admin-09 — The read-only slug is `disabled`, so its value is unreachable by keyboard or screen reader

- **WCAG:** `2.1.1 Keyboard (A)`, `4.1.2 Name, Role, Value (A)` · **508:** `502.2` · **Verdict:** **Partially Supports**
- **Location:** `packages/workspaces/admin/src/lib/presentation/components/WorkspaceGeneralSettings/index.tsx:278-283`

    ```tsx
    <Input id="settings-slug" value={workspace.slug} readOnly disabled />
    ```

- **Why it is wrong:** the sibling field three lines later — `WorkspaceIdField` —
  is deliberately `readOnly` but **not** `disabled`, and the package's own
  AGENTS.md spells out why: *"a disabled input can't be focused, so it could be
  neither selected nor copied by keyboard"*
  (`packages/workspaces/admin/AGENTS.md`, Settings page section). The slug field
  breaks the rule the id field was written to obey. The slug is not decorative:
  it is the workspace's stable public identifier.
- **Repro:** 1) `/workspaces/<id>/settings/general`. 2) Tab through the form.
- **Keyboard-only:** the slug is skipped entirely; it cannot be focused,
  selected or copied. **Screen reader:** most screen readers skip disabled form
  controls in browse mode, so the value is effectively invisible — the user can
  hear the *label* "URL slug" from the surrounding text but never the value.
- **Remediation:** drop `disabled` and keep `readOnly`, matching
  `WorkspaceIdField`.

#### ♿ A11Y-workspaces-admin-10 — Focus destination is undefined after a destructive action removes its own trigger

- **WCAG:** `2.4.3 Focus Order (A)` · **508:** `E205.4` · **Verdict:** **Partially Supports** *(Unverified — behaviour depends on Radix's restore path when the trigger unmounts; not reproduced against a running build)*
- **Location:** `packages/workspaces/admin/src/lib/presentation/components/WorkspaceMembersSettings/MemberListRow/index.tsx` (the Remove trigger)
  and `WorkspaceContentSettings/GrantedContentRow/index.tsx`
- **Repro:** 1) Members tab. 2) Tab to a member's Remove button, Enter.
  3) Confirm in the dialog.
- **Keyboard-only:** Radix normally restores focus to the trigger on close, but
  the trigger's row has just been removed from the DOM by the mutation, so focus
  most likely lands on `<body>`. **Screen reader:** the roster shrinks with no
  announcement of *which* member was removed or how many remain (the success
  toast does announce, which partially mitigates this).
- **What I could not confirm:** whether Radix falls back to the dialog's parent
  or to `<body>` in this exact unmount ordering. Needs a real browser run.
- **Remediation:** on successful removal, explicitly focus the next row's
  Remove button, or the group heading when the list empties.

#### ♿ A11Y-workspaces-admin-11 — WITHDRAWN on verification: the skip link exists and `<main>` has an id

> **Deleted 2026-08-11.** The finding claimed "No skip link, and the shell's `<main>` has no
> id". **Both halves are false in the source.**
> `packages/shell/admin/src/lib/components/AppShell/index.tsx:49-54` renders
> `<a href="#main-content" className="sr-only focus:not-sr-only …">Skip to main content</a>`
> as the **first focusable element** inside `SidebarProvider`, ahead of `<AppSidebar />`;
> `:56` renders `<SidebarInset id={MAIN_CONTENT_ID} tabIndex={-1}>` with
> `MAIN_CONTENT_ID = 'main-content'` (`:18`); and `SidebarInset` is a real `<main>`
> element (`packages/design-system/src/lib/components/ui/sidebar.tsx:379-393`). The link's
> target, the landmark's id and the `tabIndex={-1}` that makes the landmark focusable are
> all present, and the JSDoc at `:38-40` documents the intent.
>
> **Why the original finding was wrong — and it is the instructive part.** Its
> "**Evidence:**" line quoted `.agents/skills/accessibility/SKILL.md:96-99` — *"The app has
> no skip link yet and `AppShell`'s `<main>` has no `id`"* — and treated that prose as
> proof, calling it "a known, documented gap, not a discovery". The skill file is **stale**;
> the shell was fixed and the skill was not updated. The artifact spec's evidence bar exists
> for exactly this: *"Never speculate from a filename or from AGENTS.md prose alone."*
>
> **2.4.1 Bypass Blocks is therefore Supports**, not Does Not Support. The only residual
> item is that no test pins the skip link, so a refactor could remove it silently — that is
> a coverage gap, recorded in §7, not a conformance finding.
>
> **Separately actionable (outside this artifact's edit scope):**
> `.agents/skills/accessibility/SKILL.md:96-99` should be corrected, since it will mislead
> the next agent the same way.

#### ♿ A11Y-workspaces-admin-12 — The document title never changes across routes

- **WCAG:** `2.4.2 Page Titled (A)` · **508:** `E205.4` · **Verdict:** **Does Not Support** *(verified 2026-08-11 — the hedge below is now settled; no longer Unverified)*
- **Location:** none — `grep -rn "document.title\|useDocumentTitle\|<title" packages/workspaces/admin/src` returns nothing.
- **Repro:** 1) Navigate `/workspaces` → `/workspaces/new` → `/workspaces/:id/settings/danger`.
  2) Watch the browser tab.
- **Keyboard-only:** unaffected. **Screen reader:** the tab title is the single
  most-used orientation cue when switching windows or tabs; a static title makes
  four functionally different pages indistinguishable. It also breaks browser
  history and bookmark labels.
- **Confirmed 2026-08-11 — no central per-route title exists.**
  `grep -rn "document.title|useDocumentTitle|<title" packages apps --include=*.ts
  --include=*.tsx --include=*.html` over the whole repo returns exactly three things:
  `apps/admin/index.html:5` (`<title>Admin</title>` — a build-time constant),
  `packages/copilot/admin/src/lib/application/useTabBadge.ts:34,36,76` (which *reads*
  `document.title` and prefixes an unread-count badge onto whatever it already is, then
  restores it), and a comment in `tabBadge.spec.ts`. Neither `bootstrap-admin` nor
  `shell/admin` writes a title. So every route in the product shows "Admin", and the
  copilot badge decorates that one constant string. The verdict stands at **Does Not
  Support**, and it is a whole-app finding rather than one specific to this unit.
- **Remediation:** set a per-route title ("Create workspace · Ortha CMS"), owned
  either by each page or by a shell-level route-title mechanism.

## 5. E2E Coverage Map

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F1 Table | `apps/admin-e2e/src/workspaces/workspaces.spec.ts:20` | active rows render behind the shell; count "4 of 6" | ✅ E2E |
| F1 Row detail | `workspaces.spec.ts:91` | member and type counts per row | ✅ E2E |
| F2 Search | `workspaces.spec.ts:33` | narrows the table and updates the count | ✅ E2E — name matches only; the description branch (`WorkspacesPage/index.tsx:61`) is never exercised |
| F3/F5 Status filter | `workspaces.spec.ts:45,62` | switches to Archived, sets `aria-checked`, count updates; All shows 6 | ✅ E2E |
| F6 Empty state | `workspaces.spec.ts:74` | "No workspaces match" then Clear restores 6 of 6 | ✅ E2E |
| F7 Clear resets to All | `workspaces.spec.ts:86-88` | implied by "6 of 6" after clearing | ⚠️ PARTIAL — the specific all-archived-stuck case the comment describes is untested |
| F8 Skeleton | `apps/admin-e2e/src/workspaces/a11y.spec.ts:28` | the skeleton renders (as an axe target) | ⚠️ PARTIAL — presence only, never that it is distinct from empty |
| F9 List error | — | — | ❌ NONE |
| F10 Row opens | `workspaces.spec.ts:102` | click navigates to `/workspaces/ws_marketing/content` | ✅ E2E |
| F11/F12 Create permission | `apps/admin-e2e/src/workspaces/permissions.spec.ts:16,27,38` | button shown with the permission, hidden without, `/workspaces/new` redirects | ✅ E2E |
| F17 Continue gate | `workspaces.spec.ts:180` | Continue stays disabled until the basics are valid | ✅ E2E — **and this is the spec that pins the pattern ♿-05's sibling concern flags**: the disabled-continue behaviour is asserted as intended, in tension with `.agents/skills/accessibility/SKILL.md:34-37` |
| F18 Colour picker | `workspaces.spec.ts:206`, `keyboard.spec.ts:84` | a colour is pickable by mouse and by Tab+Space, `aria-checked` flips | ✅ E2E — **no arrow-key assertion**, which is exactly the gap in ♿-05 |
| F23 Create flow | `workspaces.spec.ts:158` | wizard → list, new card visible, count 5 of 7 | ✅ E2E — success path only; no 409, no 500, no rollback |
| F13 Wizard state | `workspaces.spec.ts:193` | "Back to workspaces" returns to the list | ⚠️ PARTIAL — never asserts state survives Back/Next, nor `?step=` clamping |
| F24/F25 Shell + no-access | `workspaces.spec.ts:124` | no-access screen for a non-member id; "Back to workspaces" works | ✅ E2E |
| F28 Default section | `workspaces.spec.ts:116` | `/workspaces/ws_marketing` → `/content` | ✅ E2E |
| F33 Settings tabs | `apps/admin-e2e/src/workspaces/settings.spec.ts:46` | the section nav and current General values render | ✅ E2E |
| F35 Save when dirty | `settings.spec.ts:114` | Save disabled until edited, then enabled, then saves | ✅ E2E |
| F37 Copy workspace id | `settings.spec.ts:74` | value, `readonly` present, **`toBeEnabled()`**, copy writes the clipboard | ✅ E2E — note it explicitly asserts *not disabled*, the very property the slug field lacks (♿-09) |
| F38/F39 Members | `settings.spec.ts:131` | assigns an unassigned member and removes an existing one | ✅ E2E |
| F40/F41/F42 Content | `settings.spec.ts:160,190` | grants a type, revokes an empty one, blocks a non-empty one | ✅ E2E |
| F44 Archive | `settings.spec.ts:208` | archives from the danger zone; the badge appears | ✅ E2E — unarchive is untested |
| F45/F46 Delete | `settings.spec.ts:224,250` | deletes and returns to `/workspaces`; blocks until content is removed | ✅ E2E |
| F47 Read-only viewer | `settings.spec.ts:273` | Save, member search, add-content buttons and the danger tab all hidden | ✅ E2E |
| F49/F50 Slots | `apps/admin-e2e/src/shell/command-palette.spec.ts`, `apps/admin-e2e/src/home/dashboard.spec.ts` | exercised from the shell's own suites, not this unit's | ⚠️ PARTIAL |
| F14, F15, F19, F20, F21, F26, F29, F30, F31, F32, F36, F43, F48, F51, F52 | — | — | ❌ NONE |
| **a11y — list states** | `a11y.spec.ts:23,28,41,51` | axe on table/skeleton/all-statuses/empty | ⚠️ PARTIAL — axe only; a clean run is not conformance |
| **a11y — wizard** | `a11y.spec.ts:63,68` | axe on the **basics** step and its slug error | ⚠️ PARTIAL — Members and Content steps never scanned; ♿-06 lives there |
| **a11y — settings** | `settings.spec.ts:304` | axe on the settings page as loaded (General tab, no dialog open) | ⚠️ PARTIAL — Members/Content/Danger tabs and every dialog unscanned |
| **keyboard** | `keyboard.spec.ts:18,31,42,69,84` | search focus + filter, row opens on Enter, chip arrow keys, wizard opens on Enter, swatch selectable | ⚠️ PARTIAL — no focus-after-step-change, no focus-after-dialog-close, no focus-after-delete assertion |

**Coverage tally:** `52 features · 24 ✅ · 8 ⚠️ · 20 ❌`

## 6. 🐞 Potential Bugs

### 🐞 BUG-workspaces-admin-01 — A failed slug-availability check reports the slug as **available** · Severity: Medium

**Location:** `packages/workspaces/admin/src/lib/application/useSlugAvailability/index.ts:20-30`
**Category:** ux-state

**What the code does:**

```ts
const query = useQuery({
    queryKey: ['workspaces', 'slug-available', debounced],
    queryFn: () => httpWorkspaceGateway.checkSlugAvailable(debounced),
    enabled, staleTime: 30_000
});

if (!slug) return SlugStatus.Empty;
if (!Slug.isValid(slug)) return SlugStatus.Invalid;
if (slug !== debounced || query.isFetching) return SlugStatus.Checking;
return query.data === false ? SlugStatus.Taken : SlugStatus.Available;
```

There is no `query.isError` branch. When the request fails (offline, 500, or
the endpoint blocked), `query.data` is `undefined`, `isFetching` settles to
`false`, and the final line falls through to `SlugStatus.Available`.

**Why it is wrong:** it is BUGBOT's *"Error masquerading as empty — distinguish
a failed query from a genuinely empty result"* (`.cursor/BUGBOT.md:33-35`) in
its most consequential form: the failure is rendered as the **positive** answer,
which unblocks the wizard's Continue gate (`basicsCanContinue` requires
`status === SlugStatus.Available`, `CreateWorkspacePage/index.tsx:175-176`).
The same package handles the analogous question correctly three files away: the
delete and revoke dialogs *block* when their entry-count pre-check fails
("Couldn't check for existing content, so deletion is blocked",
`DeleteWorkspaceDialog/index.tsx:20-24`). One pre-check fails closed, the other
fails open.

**Repro:**
1. `/workspaces/new`; block `GET /api/workspaces/slug-available` in devtools.
2. Type name `Marketing` (slug auto-fills `marketing`, a slug that already exists).
→ Observed: the field reports Available, Continue enables, the user completes
three steps and the final POST returns `409`, surfaced as the generic
"Could not create workspace. Please try again." (see BUG-04) with no indication
that the slug is the problem.
Expected: a `Checking failed` state that keeps Continue disabled, matching the
delete/revoke dialogs.

**Blast radius:** every wizard user during any availability-endpoint outage or
flaky network. Cost is a completely wasted 3-step flow with a misleading error.

**Suggested fix:** add `if (query.isError) return SlugStatus.Unknown;` (a new
status) and treat it as not-continuable, with copy mirroring the delete dialog's.

### 🐞 BUG-workspaces-admin-02 — Deep-linking `?step=3` bypasses the basics gate and offers a Create button that cannot succeed · Severity: Medium

**Location:** `packages/workspaces/admin/src/lib/presentation/hooks/useWizard/index.ts:92-94,106-109`
and `packages/workspaces/admin/src/lib/presentation/pages/CreateWorkspacePage/index.tsx:365-421`
**Category:** ux-state

**What the code does:**

```ts
const step = clampStep(Number(searchParams.get(STEP_PARAM) ?? MIN_STEP));
const [maxReached, setMaxReached] = useState(step);
…
useEffect(() => { setMaxReached((m) => Math.max(m, step)); }, [step]);
```

The step comes straight from the URL and `maxReached` is seeded from it, so any
step renders on first paint. Step 3's primary button is disabled only on
`flow.submitting || contentBlocked` (`CreateWorkspacePage/index.tsx:402-406`) —
it never consults `wizard.basicsValid`, because on the intended path step 1's
own gate guarantees it.

**Why it is wrong:** the gate is enforced only on the *transition*, never on the
*state*. Reloading the page mid-wizard has the same effect, since all form state
is in-memory (`useState`, `useWizard/index.ts:96-101`) and only `?step=` survives.
The result is a live "Create workspace" button on a wizard with an empty name and
slug. Pressing it throws inside `Slug.create('')`
(`useCreateWorkspaceFlow/index.ts:57`), is swallowed by the bare `catch`
(`:76-78`), and surfaces as the generic failure toast — so the user is told the
server refused when in fact the form was never filled in.

**Repro:**
1. Open `/workspaces/new?step=3` in a fresh tab (or reload while on step 3).
2. The Content step renders; the rail summary reads "Just you" and "All content".
3. Click "Create workspace".
→ Observed: toast "Could not create workspace. Please try again."; nothing is
created; no field is marked invalid and no step indicates what is missing.
Expected: either a redirect back to step 1, or the Create button disabled with
the rail marking Basics incomplete.

**Blast radius:** anyone who reloads, restores a tab, or is deep-linked. Not
destructive, but it is a dead end with a misleading error and no path forward
except noticing the empty step 1 by hand.

**Suggested fix:** clamp the rendered step to `basicsValid ? maxReached : 1`, or
include `!wizard.basicsValid` in the step-3 button's `disabled`.

### 🐞 BUG-workspaces-admin-03 — The admin caps name at 100 and description at 500 while the server allows 120 and 2000, locking longer values out of editing · Severity: Medium

**Location:** `packages/workspaces/admin/src/lib/presentation/hooks/useWorkspaceProfileSchema/index.ts:34-45`,
`packages/workspaces/admin/src/lib/presentation/hooks/useBasicsSchema/index.ts:45-61`,
`packages/workspaces/admin/src/lib/presentation/components/WorkspaceGeneralSettings/index.tsx:31-32`
**Category:** correctness

**What the code does:**

```ts
// useWorkspaceProfileSchema — "Mirrors the server `UpdateWorkspaceDto`
// (name required, ≤100; description ≤500)."
name: z.string().trim().min(1, …).max(100, …),
description: z.string().trim().max(500, …)
```

with `const NAME_MAX = 100; const DESCRIPTION_MAX = 500;` driving the inputs'
`maxLength`.

**Why it is wrong:** the server's limits are **120** and **2000** —
`packages/workspaces/server/src/lib/workspace/application/dto/update-workspace.dto.ts:28,39`
and `create-workspace.dto.ts:145,175`. The docstring's claim to "mirror" the
server DTO is factually wrong for both fields. A stricter client is safe, but
here it is *lossy*: a workspace whose name is 101–120 characters — perfectly
legal, and creatable via the public API, MCP, the copilot, or a seed — makes the
General form **permanently invalid**. `state.canSubmit` is false, so **Save is
disabled forever** and the user cannot change the description or the accent
colour either, without first shortening a name they may not be allowed to change
by policy. The `maxLength={100}` on the input compounds it: the user cannot even
retype the original value.

**Repro:**
1. `POST /api/workspaces` with a 110-character `name` (server accepts, 201).
2. Open `/workspaces/<id>/settings/general`.
3. Change only the accent colour and press Save.
→ Observed: Save is disabled; the name field shows "Name must be at most 100
characters." even though nothing was edited.
Expected: 120/2000 limits matching the server, or a documented product decision
to be stricter — with the settings form still saveable for pre-existing values.

**Blast radius:** any workspace created outside the wizard with a 101–120-char
name or a 501–2000-char description. Locks the whole General tab, not just the
offending field.

**Suggested fix:** align both schemas and both `maxLength`s to 120 / 2000, and
correct the two docstrings. If a stricter product limit is genuinely wanted,
validate it only on *changed* values so existing rows stay editable.

### 🐞 BUG-workspaces-admin-04 — Create failures collapse to one generic message; a duplicate slug reads as a transient error · Severity: Low

**Location:** `packages/workspaces/admin/src/lib/application/useCreateWorkspaceFlow/index.ts:55-78`
**Category:** ux-state

**What the code does:**

```ts
try {
    Slug.create(snapshot.data.slug.trim());
    …
    const created = await createMutation.mutateAsync({ … });
    toast.success(…);
    navigate('/workspaces');
} catch {
    toast.error(intl.formatMessage(messages.error));
}
```

One bare `catch` with no binding, mapping every outcome —
`InvalidSlugError` thrown locally, a `409` duplicate slug, a `403`, a `500`, a
network drop — onto `'Could not create workspace. Please try again.'`.

**Why it is wrong:** the same package already has the tool for this. The
settings dialogs import `isConflict` and branch on it, downgrading a 409 to a
`toast.warning` with an accurate message
(`WorkspaceContentSettings/index.tsx:203-206`,
`WorkspaceDangerSettings/index.tsx:162-166`); `infrastructure/isConflict/index.ts`
exists precisely to centralise that narrowing. The create flow — the one place a
409 is the *most likely* failure, since slug uniqueness is exactly what the
server enforces — does not use it. "Please try again" is actively wrong advice
for a taken slug: retrying will never succeed. WCAG 3.3.3 Error Suggestion asks
for a suggestion when one is known, and it is.

**Repro:**
1. Two admins open the wizard with slug `marketing`; the first submits successfully.
2. The second submits.
→ Observed: `409` from the server, rendered as "Could not create workspace.
Please try again." with the wizard still on step 3 and no field marked invalid.
Expected: "That slug is already taken — pick another", ideally jumping back to
step 1 with the slug field flagged.

**Blast radius:** every create-time conflict, and every distinguishable error
class. Low harm, high friction.

**Suggested fix:** `catch (error)` and branch on `isConflict(error)` (and on the
locally-thrown `Slug` error) with specific copy, mirroring the settings dialogs.

### 🐞 BUG-workspaces-admin-05 — Renaming a workspace leaves the sidebar switcher showing the old name until you navigate away · Severity: Low

**Location:** `packages/workspaces/admin/src/lib/presentation/components/WorkspaceShell/index.tsx:100-103`
**Category:** ux-state

**What the code does:**

```tsx
useSidebarContent(
    () => (current ? <WorkspaceNav workspace={current} /> : null),
    [current?.id]
);
```

`useSidebarContent` stores the **result** of `render()` — a concrete element —
in provider state, and re-runs only when the deps change
(`packages/shell/admin/src/lib/utils/sidebarContent/index.tsx:74-81`:
`setContent(render()); … }, [setContent, ...deps]`). The dep array is
`[current?.id]`, which does not change when the workspace's `name`, `color`,
`description`, `status` or `members` do.

**Why it is wrong:** the `workspace` **prop** captured in that stored element is
frozen at snapshot time. `useUpdateWorkspace` invalidates `workspacesKey`, the
list refetches, `current` gets the new name — and the effect does not re-run, so
`WorkspaceSwitcher` keeps rendering `current.name` and `current.color` from the
stale object (`WorkspaceSwitcher/index.tsx:80,84-91`). The settings page itself
updates correctly (it reads `useCurrentWorkspace()` live), so the page header
says "Manage settings for **New Name**" while the sidebar two inches to the left
says the old one. The same applies to archiving: the switcher's "N members ·
Active" subtitle keeps saying Active after the workspace is archived
(`WorkspaceSwitcher/index.tsx:130-133`).

**Repro:**
1. Open `/workspaces/<id>/settings/general`.
2. Change the name to "Renamed" and Save (toast confirms).
→ Observed: page subtitle updates to "Manage settings for Renamed"; the sidebar
switcher still reads the old name and the old accent colour. Navigating to
another workspace and back fixes it.
Expected: the sidebar reflects the rename immediately.

**Blast radius:** cosmetic but confusing, and it persists for the rest of the
session on that workspace. Also affects the accent-colour change and archive
from the same page.

**Suggested fix:** widen the deps to the fields the nav actually renders
(`[current?.id, current?.name, current?.color, current?.status]`), or have
`WorkspaceNav` read the workspace from `useWorkspaces()` by id itself rather than
taking it as a frozen prop.

### 🐞 BUG-workspaces-admin-06 — A workspace with no contributed routes renders a blank content area with no message · Severity: Low

**Location:** `packages/workspaces/admin/src/lib/presentation/components/WorkspaceShell/index.tsx:139-178`
**Category:** ux-state

**What the code does:**

```ts
const routes = WORKSPACE_ROUTE_SLOT.getItems();
const defaultRoute = routes.slice().sort(…)[0];
const defaultPath = defaultRoute?.path.split('/')[0];
…
{defaultPath ? <Route index element={<Navigate to={defaultPath} replace />} /> : null}
{routes.map(…)}
{defaultPath ? <Route path="*" element={<Navigate to={defaultPath} replace />} /> : null}
```

When `WORKSPACE_ROUTE_SLOT` is empty, `defaultPath` is `undefined`, both
`<Navigate>` routes are skipped, `routes.map` emits nothing, and the `<Routes>`
matches nothing — rendering an empty `<div className="flex h-full flex-col">`.

**Why it is wrong:** the shell has a considered state for every other failure
(load error, no access) but not for "no sections". The slot is filled by
*other* plugins, so an empty slot is a realistic composition — a host that
registers `WorkspacesPlugin()` without `ContentPlugin()`/`MediaPlugin()`/
`InsightsPlugin()`, or an installation where every route is gated away. The
user gets a sidebar with a switcher, a fully blank main area, and no
explanation. The unknown-sub-path fallback disappears at the same time, so
`/workspaces/:id/whatever` is also blank rather than redirected.

**Repro:**
1. In `apps/admin/src/main.tsx`, register only `IdentityPlugin`, `ShellPlugin`
   and `WorkspacesPlugin`.
2. Open `/workspaces/<id>`.
→ Observed: sidebar renders; the content area is empty; no heading, no message.
Expected: an empty state ("This workspace has no sections yet") in the same
`ShellMessage` shape as the other two states.

**Blast radius:** composition-dependent; invisible in the default app where the
Content Library always registers. Matters for the plugin-host story the project
is built on.

**Suggested fix:** render a third `ShellMessage` when `routes.length === 0`.

### Checked and cleared

- **No client-side membership filter.** `useWorkspaces` returns the server list
  untouched and the page filters only on status + search
  (`WorkspacesPage/index.tsx:86-94`). AGENTS.md explicitly forbids a second
  filter; the code obeys.
- **Error vs empty on the list.** Genuinely three branches
  (`WorkspacesPage/index.tsx:153-186`), with a comment explaining why. The home
  panel and stat tiles do the same (`WorkspacesHomePanel/index.tsx:86`,
  `WorkspaceStats/index.tsx:46`). BUGBOT's "error masquerading as empty" does
  **not** apply here — but it does apply to the slug probe (BUG-01).
- **Over-invalidation.** All nine mutation hooks invalidate only
  `workspacesKey`. No `queryClient.clear()` or key-less invalidation anywhere.
- **Mapper fallbacks that rewrite data.** `infrastructure/workspaceMapper`
  derives `initials` and `color` for presentation only; it does not coerce a
  missing role or status into a default. The one fallback (`description ?? ''`)
  mirrors the server's own view mapping.
- **Pager clamping after a delete.** Not applicable — the list has no
  pagination. Nothing to strand.
- **Double-submit.** Create, Save, Archive and Delete all disable on their
  pending flag.
- **Permission gating is UI-only, correctly.** Every gate is `useHasPermission`,
  and the server independently enforces the same permission on every route (see
  `workspaces-server.md` §2). Nothing here is relied on as a boundary.
- **Deep-link to a foreign workspace.** Handled and asserted
  (`workspaces.spec.ts:124`); the admin deliberately does not distinguish
  "not a member" from "does not exist", matching the API's flat 403.
- **Layering (ADR-0003).** Verified: `domain/` (slug VO, view types, permission
  constants, `resourceSelection`) imports no React and no `apiClient`;
  `httpWorkspaceGateway` is the only file importing `apiClient`
  (`grep -rn "apiClient" packages/workspaces/admin/src` → one hit);
  `presentation/` imports view models and hooks only. This unit lives up to its
  billing as the admin-side ADR-0003 reference.

**Defect tally:** `6 🐞 · 0 Critical · 0 High · 3 Medium · 3 Low · 0 🔒`

**Accessibility tally:** `11 ♿ · 0 Supports · 6 Partially Supports · 5 Does Not Support ·
0 Not Applicable` (was 12; ♿-11 withdrawn on verification — 2.4.1 Bypass Blocks actually
**Supports**. Ids are left stable, so ♿-11 is a retired number.)
(2 of the 12 — ♿-10 and ♿-12 — are marked *Unverified*; the provision table in
§4A additionally records 9 **Supports**, 2 **Not Applicable** and 4 **Not
verified** criteria that produced no finding.)

## 7. Recommended E2E Tests

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | `apps/admin-e2e` POM + `page.route` | `workspaces/a11y.spec.ts` (extend) | axe on the wizard's **Members** and **Content** steps, on the settings Members/Content/Danger tabs, and on each dialog while **open** | ♿-06 (an axe-detectable failure today), the a11y ⚠️ rows |
| 2 | `apps/admin-e2e` | `workspaces/keyboard.spec.ts` (extend) | After "Continue to members", focus is inside the new step card, not `<body>`; a `role="status"` announces "Step 2 of 3" | ♿-04 |
| 3 | `apps/admin-e2e` | `workspaces/workspaces.spec.ts` (new case) | With `slug-available` mocked to 500, the slug field does **not** read Available and Continue stays disabled | 🐞 BUG-workspaces-admin-01, EC-34 |
| 4 | `apps/admin-e2e` | `workspaces/workspaces.spec.ts` (new case) | `/workspaces/new?step=3` in a fresh context either redirects to step 1 or leaves Create disabled | 🐞 BUG-workspaces-admin-02, EC-10, EC-40 |
| 5 | `apps/admin-e2e` | `workspaces/settings.spec.ts` (new case) | A workspace seeded with a 110-char name still allows a colour-only Save | 🐞 BUG-workspaces-admin-03, EC-07 |
| 6 | `apps/admin-e2e` | `workspaces/workspaces.spec.ts` (new case) | A mocked 409 on `POST /api/workspaces` produces slug-specific copy, not the generic retry message | 🐞 BUG-workspaces-admin-04 |
| 7 | `apps/admin-e2e` | `workspaces/settings.spec.ts` (new case) | After saving a rename, the sidebar switcher shows the new name without navigating away | 🐞 BUG-workspaces-admin-05, F27 |
| 8 | `apps/admin-e2e` | `workspaces/workspaces.spec.ts` (new case) | `GET /api/workspaces` → 500 renders the `role="alert"` banner and Retry, and **never** the empty state; same for the shell and the home panel | F9, F26, EC-31 |
| 9 | `apps/admin-e2e` | `workspaces/keyboard.spec.ts` (new case) | ←/→ move selection inside the colour radiogroup and only one swatch is a tab stop | ♿-05 |
| 10 | `apps/admin-e2e` | `workspaces/a11y.spec.ts` (new case) | The wizard's member search has a non-empty accessible name; the settings slug input is focusable | ♿-06, ♿-09 |
| 11 | `apps/admin-e2e` | `workspaces/keyboard.spec.ts` (new case) | After removing the last member row, focus lands on a live element (group heading), not `<body>` | ♿-10, EC-42 |
| 12 | `apps/admin-e2e` | `workspaces/wizard.spec.ts` (new file) | Members typeahead: search, pick, exclude-existing, invite-by-email, remove; Content step: All vs Specific, per-kind counts, "Skip & create" grants nothing | F19, F20, F21 |
| 13 | `apps/admin-e2e` | `workspaces/workspaces.spec.ts` (new case) | Optimistic create rolls the row back on a failed POST | F22, EC-25 |
| 14 | `apps/admin-e2e` | `workspaces/settings.spec.ts` (new case) | Removing yourself from a workspace you have open swaps the shell to the no-access screen | EC-21 |
| 15 | `apps/admin-e2e` | `workspaces/a11y.spec.ts` (new case) | Run the existing scans a second time with `data-theme="dark"` forced | 1.4.3 / 1.4.11 in dark theme |
| 16 | `apps/admin-e2e` | `workspaces/keyboard.spec.ts` (new case) | From a fresh load of `/workspaces/:id/settings/general`, the **first** Tab stop is the "Skip to main content" link, Enter on it moves focus to `#main-content`, and the next Tab lands inside the settings form — pinning the shell behaviour that ♿-11 wrongly reported as absent, so a refactor cannot remove it silently | 2.4.1 (currently Supports but untested) |
