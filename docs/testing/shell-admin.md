# @ortha-cms/shell-admin — Test Artifact

> **Unit:** `packages/shell/admin` · **Package:** `@ortha-cms/shell-admin` · **Kind:** admin plugin (the app shell)
> **Source of truth:** `packages/shell/admin/AGENTS.md`
> **Findings verified:** 2026-08-11 — 14 confirmed · 1 deleted · 1 corrected · 2 unverified
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns:** the authenticated app chrome. Concretely — the `layout` that wraps every
private route and *makes it private* (`AuthProvider` → `RequireAuth` → `AppShell`),
the collapsible left sidebar, the Home page at `/`, the ⌘K command palette, the
`PageTopBar` breadcrumb bar, and the two page-fillable chrome regions (the top
bar's trailing actions and the right panel). It **defines four extension slots**
plus a fifth for the palette, and fills exactly one item into one of them (the
Home nav entry).

**Does NOT own:** authentication itself (`@ortha-cms/identity-admin` supplies
`AuthProvider`, `RequireAuth`, `useHasPermission` and the sign-in screen); the
public/private route split (that is `@ortha-cms/bootstrap-admin`); any feature
page; the sidebar primitives (`@ortha-cms/design-system`); the per-workspace
sidebar (`@ortha-cms/workspaces-admin` injects it via `useSidebarContent`); the
Home dashboard's *content* (every tile and panel arrives through
`HOME_SECTION_SLOT` from `workspaces-admin` and `activity-admin`).

- **Entry points** — `packages/shell/admin/src/index.ts:1-42`.
    - Plugin factory: `ShellPlugin()` → `{ name:'shell', layout, routes:[{path:'/', element:<HomePage/>}], slots:[SIDEBAR_NAV_SLOT ← Home] }` (`packages/shell/admin/src/lib/utils/shellPlugin/index.tsx:37-66`).
    - **Slots defined:** `SIDEBAR_NAV_SLOT` (`shell.sidebar.nav`), `SIDEBAR_SECTION_SLOT` (`shell.sidebar.section`), `SIDEBAR_FOOTER_SLOT` (`shell.sidebar.footer`) — `packages/shell/admin/src/lib/slots/sidebarSlots/index.ts:54, 77, 102`; `HOME_SECTION_SLOT` (`shell.home.section`) — `packages/shell/admin/src/lib/slots/homeSlots/index.ts:34`; `COMMAND_SLOT` (`shell.command`) — `packages/shell/admin/src/lib/slots/commandSlots/index.ts:32`.
    - **Slots filled:** one `SidebarItem` (Home, `group:'overview'`, `order:10`).
    - **Contexts/ports exported:** `useSidebarContent` / `SidebarContentProvider`, `PageActionsPortal`, `RightPanelPortal`, `useRightPanel`, `PageActions`, `PageTopBar`, `SidebarSearch`, `AppShell`, `HomePage`.
    - **Routes:** exactly one — `/` (private, no `public` flag).
    - No HTTP routes of its own; it issues no requests. `useAuth()` reads
      identity's `/api/auth/me` state, and contributed slot components issue their
      own.
- **Runtime prerequisites** — a signed-in session (everything is behind
  `RequireAuth`); at least one plugin registered *after* `IdentityPlugin()` and
  `ShellPlugin()` for the sidebar to have anything but Home in it; `localStorage`
  for the right-panel state (`ortha:right-panel`). No env vars, no feature flags.
- **How to exercise it manually**

    ```bash
    docker compose up -d
    npm run dev
    ```

    Open `http://localhost:4200`. A signed-out user is redirected to
    `/identity/signin` — that redirect *is* the shell's gate working. After
    signing in you land on `/` (Home). The surfaces to drive:
    - the sidebar: Home / Activity / Workspaces / Members, grouped **Overview**
      and **Directory**
    - the sidebar header: the brand, the search trigger ("Search" + `⌘K`), and
      the collapse trigger
    - the sidebar footer: the account menu (from `users-admin`)
    - the Home dashboard: three stat tiles + two panels
    - `⌘K` / `Ctrl+K` anywhere: the command palette
    - `⌘B` / `Ctrl+B`: collapse/expand the sidebar
    - a page with a right panel: `/workspaces/:id/content/<collection>/<entryId>`
      (the entry editor's Properties panel)
- **Dependencies that must be healthy** — `@ortha-cms/identity-admin`
  (`AuthProvider`, `RequireAuth`, `useAuth`, `useHasPermission`, `AuthStatus`),
  `@ortha-cms/design-system` (`Sidebar*`, `TopBar*`, `Command*`, `Container`,
  `Logo`, `Kbd`, `Button`, `useIsMobile`), `@ortha-cms/utils-admin`
  (`createSlot`, `byOrder`), `react-router-dom`, `react-intl`. If
  `bootstrap-admin` stops mounting `layout` as the parent of private routes, the
  whole gate disappears. **Verified correct today:**
  `packages/bootstrap/admin/src/lib/createAdmin/index.tsx:83-97` nests every
  non-`public` route inside `<Route element={layout}>`, and
  `apps/admin-e2e/src/auth/private-routes.spec.ts:22-40` pins two of those paths.
  The residual exposure is coverage, not code — see §7 item 2.

---

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | `ShellPlugin()` returns layout + `/` route + the Home nav item | `packages/shell/admin/src/lib/utils/shellPlugin/index.tsx:37-66` | ✅ E2E |
| F2 | The gate: `AuthProvider` → `RequireAuth` → `AppShell` wraps every private route | `packages/shell/admin/src/lib/utils/shellPlugin/index.tsx:40-46` | ✅ E2E |
| F3 | `AppShell` composition: skip link, sidebar, `<main id="main-content">`, right panel, floating toggle | `packages/shell/admin/src/lib/components/AppShell/index.tsx:42-67` | ⚠️ PARTIAL |
| F4 | Skip link — first focusable, jumps to `<main>` | `packages/shell/admin/src/lib/components/AppShell/index.tsx:49-54` | ❌ NONE |
| F5 | `SIDEBAR_NAV_SLOT` contract — `{labelId, defaultLabel, to, end?, group, order, icon, iconColor?, permission?}` | `packages/shell/admin/src/lib/slots/sidebarSlots/index.ts:17-54` | ✅ E2E |
| F6 | Nav grouping (Overview → Directory) + `order` sorting; a group with no visible items renders nothing | `packages/shell/admin/src/lib/components/AppSidebar/GlobalSidebar/index.tsx:86-111` | ⚠️ PARTIAL |
| F7 | Per-item permission gating in `SidebarNavButton` (`useHasPermission`) | `packages/shell/admin/src/lib/components/AppSidebar/SidebarNavButton/index.tsx:28-33` | ⚠️ PARTIAL |
| F8 | Group-level permission pre-check so an empty group's heading never renders | `packages/shell/admin/src/lib/components/AppSidebar/GlobalSidebar/index.tsx:66-70` | ❌ NONE |
| F9 | Active-route detection + `aria-current="page"` + accent icon colour | `packages/shell/admin/src/lib/components/AppSidebar/SidebarNavButton/index.tsx:20-21, 40-42` | ⚠️ PARTIAL |
| F10 | `SIDEBAR_SECTION_SLOT` — data-driven sections below the nav | `packages/shell/admin/src/lib/slots/sidebarSlots/index.ts:63-79`; rendered at `GlobalSidebar/index.tsx:113-115` | ⚠️ PARTIAL |
| F11 | `SIDEBAR_FOOTER_SLOT` — persistent footer, rendered in both global and workspace contexts | `packages/shell/admin/src/lib/slots/sidebarSlots/index.ts:88-103`; rendered at `AppSidebar/index.tsx:41-47` | ✅ E2E |
| F12 | Sidebar contextual-region takeover — `useSidebarContent(render, deps)` / `SidebarContentProvider` | `packages/shell/admin/src/lib/utils/sidebarContent/index.tsx:27-82`; consumed at `AppSidebar/index.tsx:35, 40` | ⚠️ PARTIAL |
| F13 | `SidebarSearch` trigger + ⌘K/Ctrl+K `CommandDialog` | `packages/shell/admin/src/lib/components/AppSidebar/SidebarSearch/index.tsx:68-155` | ✅ E2E |
| F14 | Palette "Go to" results from `SIDEBAR_NAV_SLOT`, permission-gated per item | `packages/shell/admin/src/lib/components/AppSidebar/SidebarSearch/SidebarCommandItem/index.tsx:19-39` | ⚠️ PARTIAL |
| F15 | `COMMAND_SLOT` — plugin-contributed palette sections receiving `{ close }` | `packages/shell/admin/src/lib/slots/commandSlots/index.ts:18-32`; rendered at `SidebarSearch/index.tsx:133-135` | ✅ E2E |
| F16 | Palette footer legend (↑↓ / ↵ / esc) | `packages/shell/admin/src/lib/components/AppSidebar/SidebarSearch/index.tsx:137-151` | ❌ NONE |
| F17 | `SidebarToggle` — floating reveal button, hidden when a `TopBar` is on the page (`:has()`) | `packages/shell/admin/src/lib/components/AppShell/SidebarToggle/index.tsx:14-24` | ❌ NONE |
| F18 | `HOME_SECTION_SLOT` contract — `{id, region:'stat'|'panel', order, Component}` | `packages/shell/admin/src/lib/slots/homeSlots/index.ts:18-35` | ✅ E2E |
| F19 | `HomePage` — time-of-day greeting, stat row, two-column panel grid | `packages/shell/admin/src/lib/pages/HomePage/index.tsx:41-79` | ✅ E2E |
| F20 | `PageTopBar` — icon tile + breadcrumb + `PageActions`; last crumb is the current page; sub-`sm` collapse | `packages/shell/admin/src/lib/components/PageTopBar/index.tsx:40-105` | ⚠️ PARTIAL |
| F21 | `PageActions` — the actions host + the collapsed right panel's reopen button | `packages/shell/admin/src/lib/components/PageActions/index.tsx:30-56` | ❌ NONE |
| F22 | `PageActionsPortal` — a page pushes controls into the bar from inside its own tree | `packages/shell/admin/src/lib/utils/pageChrome/index.tsx:194-197` | ⚠️ PARTIAL |
| F23 | `RightPanelPortal` — fills the panel and ref-count-registers it with a title | `packages/shell/admin/src/lib/utils/pageChrome/index.tsx:208-221` | ❌ NONE |
| F24 | `AppRightPanel` — zero-width + `inert` with nothing registered; column on desktop, overlay on mobile; animates only on toggle | `packages/shell/admin/src/lib/components/AppRightPanel/index.tsx:48-131` | ❌ NONE |
| F25 | Right-panel open/collapsed persistence (`ortha:right-panel`), forced collapsed on a small screen | `packages/shell/admin/src/lib/utils/pageChrome/index.tsx:66-74, 112-122` | ❌ NONE |
| F26 | `useRightPanel()` returns `null` outside a provider (bar in isolation shows no panel controls) | `packages/shell/admin/src/lib/utils/pageChrome/index.tsx:178-183` | ❌ NONE |

---

## 3. Manual Test Plan

All blocks assume `npm run dev`. Where a role matters it is stated. Each block
ends with a **Keyboard-only path** and a **Screen-reader expectation**.

### F1 — `ShellPlugin()` wiring

**Preconditions:** signed out.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Navigate to `http://localhost:4200/` | Redirected to `/identity/signin` |
| 2 | Sign in as `admin@example.com` | Lands on `/`; the sidebar is present with a **Home** entry under **Overview** |
| 3 | Inspect the Home nav row | It is a `<a href="/">` inside `li[data-sidebar="menu-item"]`, icon `HomeIcon`, `aria-current="page"` |
| 4 | Register `ShellPlugin()` *before* `IdentityPlugin()` in `apps/admin/src/main.tsx` and reload | The gate still works (the layout composes identity's components directly), but AGENTS documents the ordering; confirm nothing crashes |

**Keyboard-only path:** Tab from the address bar → "Skip to main content" →
sidebar search → Home → Activity → … → account menu → main scrollport.
**Screen-reader expectation:** on landing, the page title and the `<h1>`
"Good morning, Amara Okafor" are announced; the sidebar is inside a navigation
landmark named "Primary".

### F2 — The private-route gate

**Preconditions:** none.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Signed out, go to `/` | Redirect to `/identity/signin`. Asserted at `apps/admin-e2e/src/auth/private-routes.spec.ts:22-31` |
| 2 | Signed out, go to `/this-route-does-not-exist` | Also redirected — the catch-all sits **inside** the guarded group. Asserted at `apps/admin-e2e/src/auth/private-routes.spec.ts:33-40` |
| 3 | Sign in, then let the session expire (`mockUnauthorized`) and navigate | Bounced back to sign-in |
| 4 | While `/api/auth/me` is in flight | The branded `AppLoader` fills the screen — no flash of the shell, no flash of the sign-in form |

**Keyboard-only path:** the redirect must land focus somewhere sensible on the
sign-in page — verify focus is not left on a detached node.
**Screen-reader expectation:** the boot loader announces "Loading…" once
(`role="status"`, `packages/design-system/src/lib/components/ui/app-loader.tsx:30-44`).

### F3 / F4 — `AppShell` composition and the skip link

**Preconditions:** signed in, on `/`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Inspect the DOM | Exactly **one** `<main>` — `SidebarInset` renders it, and `AppShell` gives it `id="main-content" tabIndex={-1}` (`AppShell/index.tsx:56`) |
| 2 | Load the page and press `Tab` once | The first focusable element is the skip link; it becomes visible (`sr-only focus:not-sr-only`, `AppShell/index.tsx:51`) |
| 3 | Press `Enter` on it | The URL gains `#main-content`. **Verify focus actually moved** — a bare hash link moves focus only because the target has `tabIndex={-1}`, which it does |
| 4 | Press `Tab` again after activating the skip link | The next stop must be inside `<main>`, not back at the sidebar |
| 5 | Count landmarks with a screen reader's landmark list | `banner`? none. `navigation` "Primary" (the sidebar's `<nav>`), `main`, `complementary` (the right panel `<aside>`, only when a panel is registered) |

**Keyboard-only path:** exactly as above — this *is* the keyboard path.
**Screen-reader expectation:** "Skip to main content, link" as the very first
item; after activation the next announcement comes from inside `main`.

### F5 / F6 — `SIDEBAR_NAV_SLOT` and grouping

**Preconditions:** signed in as **admin** (all permissions).

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Read the sidebar | Two groups in fixed order: **Overview** then **Directory** (`GlobalSidebar/index.tsx:40-46`) |
| 2 | Within each group | Entries ascend by `order` — `byOrder` copies before sorting (`packages/utils/admin/src/lib/byOrder/index.ts:6-8`) |
| 3 | Register a plugin contributing `{group:'overview', order:5, to:'/thing'}` | It appears **above** Home without editing the shell |
| 4 | Register two items with the same `order` | Registration order decides — `Array.prototype.sort` is stable. Deterministic but undocumented at the slot level |
| 5 | Register two items with the same `to` | **Suspected defect:** `key={item.to}` (`GlobalSidebar/index.tsx:103`) collides; React warns. See `🐞 BUG-shell-admin-04` |
| 6 | Contribute an item with `group:'settings'` (not a valid `SidebarGroupId`) | **Suspected defect:** it silently vanishes — `GROUPS` is a closed list and there is no catch-all. Contrast `insights-admin`, which routes an orphan widget into a "More" band on purpose. See `🐞 BUG-shell-admin-03` |

**Keyboard-only path:** Tab through the nav; each row is a link, `Enter` follows.
**Screen-reader expectation:** "Primary, navigation" → "Overview" (a `div`, so
announced as text, not a heading) → "Home, current page, link".

### F7 / F8 / F9 — permission gating and active state

**Preconditions:** you need three sessions. With the mocked harness, adjust
`mockSignedIn(page, { permissions: [...] })`; against a real server, sign in as an
admin, a contributor and a viewer.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | As **admin** | Every nav entry is present |
| 2 | As a role without `users:read` | The **Members** entry is absent from the DOM entirely — not hidden with CSS (`SidebarNavButton/index.tsx:31-33` returns `null`) |
| 3 | Confirm it is also absent from the tab order | Tab past Directory: focus goes straight from Workspaces to the footer |
| 4 | Open `⌘K` as the same user | The **Members** result is likewise absent (`SidebarCommandItem/index.tsx:29-31`) |
| 5 | As a user with **no** permissions at all in the Directory group | The **Directory** heading itself does not render (`GlobalSidebar/index.tsx:91-93`) — no header over nothing |
| 6 | Type `/users` in the address bar as that same user | The route still mounts; the *page* must 403/redirect. The sidebar gate is UX only — `.cursor/BUGBOT.md:41-43` |
| 7 | Navigate to `/users/u_grace` (a sub-path) | **Members** stays active — `useMatch('/users/*')` because `end` is unset (`SidebarNavButton/index.tsx:20`) |
| 8 | Navigate to `/workspaces` | **Home** is *not* active, because its item sets `end:true` |

**Keyboard-only path:** as step 3 — the absence must be a real absence.
**Screen-reader expectation:** the active row announces "current page"; the
`iconColor` accent is applied only while active and carries no meaning of its own
(`1.4.1` satisfied because `aria-current` is the real signal).

### F10 / F11 — section and footer slots

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Look below the nav | The Workspaces quick-list section (from `workspaces-admin`) |
| 2 | Look at the bottom | The account menu, above a top border (`AppSidebar/index.tsx:42`) |
| 3 | Open a workspace so the per-workspace nav takes over the contextual region | The footer **stays** — it is rendered by `AppSidebar`, outside the override (`AppSidebar/index.tsx:40-47`) |
| 4 | Register zero footer items | No `SidebarFooter` element at all (`AppSidebar/index.tsx:41`) — no empty bordered strip |
| 5 | Make a contributed footer component throw on render | **Suspected defect:** the entire authenticated app unmounts to a blank page. See `🐞 BUG-shell-admin-01` |
| 6 | Register two sections with the same `id` | **Suspected defect:** duplicate React key. See `🐞 BUG-shell-admin-04` |

**Keyboard-only path:** the footer's account button is the last stop before
`<main>`; `Enter` opens its menu, `Esc` closes it and focus returns to the button.
**Screen-reader expectation:** the account menu button carries the user's name.

### F12 — sidebar contextual-region takeover

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | From Home, open a workspace | The sidebar's middle swaps to the per-workspace nav; the footer persists |
| 2 | Navigate back to `/` | The global nav returns — `useSidebarContent`'s cleanup sets the content to `null` on unmount (`sidebarContent/index.tsx:75-76`) |
| 3 | Move between two workspaces | The nav re-renders once per `deps` change, not per render |
| 4 | Call `useSidebarContent` outside `SidebarContentProvider` | Throws a named error (`sidebarContent/index.tsx:68-72`) — a clear failure, not a silent no-op |
| 5 | Call it from two components at once | **Suspected defect:** last writer wins and the first component's cleanup on unmount clears the *other* one's content. See `🐞 BUG-shell-admin-05` |
| 6 | Pass a `render` closure whose captured value changed but whose `deps` did not | The stale node stays — documented (`sidebarContent/index.tsx:54-57`), and the reason `deps` is required |

**Keyboard-only path:** after the region swaps, Tab order must still start at the
sidebar search and end at the footer — verify the swap does not strand focus.
**Screen-reader expectation:** the `<nav aria-label="Primary">` belongs to
`GlobalSidebar`; when the workspace nav takes over, **verify it supplies its own
landmark name** — otherwise the region silently loses its label.

### F13 / F14 / F15 / F16 — the command palette

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Click the sidebar's search trigger | The palette opens; the search input has focus |
| 2 | Press `⌘K` from anywhere on the page | Same. Asserted (for the content palette) at `apps/admin-e2e/src/content/content-library.spec.ts:138-147` |
| 3 | Press `⌘K` while the palette is already open | It **closes** — the handler toggles (`SidebarSearch/index.tsx:78`) |
| 4 | Type `member` and press `Enter` | Navigates to `/users`. Asserted at `apps/admin-e2e/src/shell/command-palette.spec.ts:44-52` |
| 5 | Read the groups | "Go to" (nav destinations) then plugin sections — active workspaces, then each workspace's content types. Asserted at `command-palette.spec.ts:28-42` |
| 6 | Type nonsense | The localized "No results." from `CommandEmpty` |
| 7 | Press `⌘K` with the caret inside a text field (e.g. the Members search box) | **Suspected defect:** the palette opens and `preventDefault()` swallows the keystroke, regardless of where focus is (`SidebarSearch/index.tsx:74-83`). Lower impact than `⌘B` but the same class — see `🐞 BUG-shell-admin-02` |
| 8 | Open a workspace so `GlobalSidebar` unmounts, then press `⌘K` | The *global* palette is gone; the workspace shell supplies its own (documented at `SidebarSearch/index.tsx:64-66`). Confirm exactly one palette responds — a double-bind would open two dialogs |
| 9 | Read the footer legend | `↑ ↓ to navigate`, `↵ to open`, `esc to close` — localized, `Kbd` glyphs |

**Keyboard-only path:** `⌘K` → type → `ArrowDown`/`ArrowUp` → `Enter` → the
palette closes and the route changes. `Esc` closes without navigating and focus
must return to the search trigger.
**Screen-reader expectation:** the dialog announces its `sr-only` title
("Search") and description ("Jump to a section."). As the list filters, cmdk
should update `aria-activedescendant` on the input — **verify**, because that is
the only thing that makes arrow navigation audible.

### F17 — the floating `SidebarToggle`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | On Home (no `TopBar`), collapse the sidebar | A small floating button appears fixed at top-left |
| 2 | Navigate to `/users` (which renders a `PageTopBar`) with the sidebar still collapsed | The floating button **disappears**; the reveal trigger is inline in the bar instead. The mechanism is CSS `:has()` — `[main:has([data-slot=top-bar])~&]:hidden` (`SidebarToggle/index.tsx:22`) |
| 3 | Expand the sidebar on desktop | The floating button unmounts (`SidebarToggle/index.tsx:17-19`) |
| 4 | Narrow to <768px | It shows even when "expanded", because the sidebar is an overlay drawer there |
| 5 | Test in a browser without `:has()` support | **Suspected defect:** step 2's hiding is CSS-only, so an unsupporting browser shows two reveal controls at once. Baseline `:has()` is broadly available; recorded as a graceful-degradation note, not a live defect |

**Keyboard-only path:** the floating button is a real `<button>` and takes Tab
focus; verify it is not *also* focusable while visually hidden by the `:has()`
rule (`display:none` removes it from the tab order — confirm the utility compiles
to `display:none`, not `visibility` or opacity).
**Screen-reader expectation:** "Toggle Sidebar, button" — hard-coded English from
the design system (`♿ A11Y-design-system-01`).

### F18 / F19 — `HOME_SECTION_SLOT` and the Home page

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Land on `/` | `<h1>` reads "Good morning/afternoon/evening, <name>" plus the subtitle. Asserted at `apps/admin-e2e/src/home/dashboard.spec.ts:23-34` |
| 2 | Check the stat row | Three tiles — Active workspaces, Members, Content types — all contributed by `workspaces-admin` |
| 3 | Check the panels | Workspaces and Recent activity, two columns at `lg`. Each has a "View all" link; exactly two exist (`dashboard.spec.ts:36-46`) |
| 4 | Sign in as a user with `name` unset | The greeting falls back to the email (`HomePage/index.tsx:55`) |
| 5 | Sign in as a user with neither | The greeting renders "Good morning, " with a trailing comma and nothing after it |
| 6 | Keep the tab open across 12:00 local | **Suspected defect:** the greeting is computed once at render (`HomePage/index.tsx:44`) and never re-evaluates — a tab open since 11:00 still says "Good morning" at 15:00. Cosmetic |
| 7 | Register zero `HOME_SECTION_SLOT` items | Only the greeting renders — **no empty state** (`HomePage/index.tsx:63-77`). A fresh install with no feature plugins shows a bare greeting with no explanation |
| 8 | Make a contributed panel throw | **Suspected defect:** the whole Home page unmounts. See `🐞 BUG-shell-admin-01` |
| 9 | Register two sections with the same `id` | Duplicate React key — `🐞 BUG-shell-admin-04` |

**Keyboard-only path:** Tab from `<main>` reaches the stat tiles (non-interactive,
skipped) then each panel's links. `2.4.3` holds because the DOM order is
stat-row then panel-grid.
**Screen-reader expectation:** one `<h1>`; each panel supplies its own heading —
verify there is no heading-level skip between the `<h1>` and the panels' headings
(`1.3.1`).

### F20 — `PageTopBar`

**Preconditions:** any page except Home, e.g. `/users`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Read the bar | A coloured icon tile (`aria-hidden`) then a breadcrumb, then the actions region |
| 2 | Inspect the breadcrumb | `<nav aria-label="Breadcrumb">` (localized, `PageTopBar/index.tsx:64`); the last crumb is `BreadcrumbPage`, earlier ones are links when `to` is given, plain `<span>` otherwise |
| 3 | Narrow below `sm` (640px) | Only the last crumb survives; earlier crumbs and separators are `hidden` (`PageTopBar/index.tsx:71-84`) so the actions region keeps its space |
| 4 | Give two crumbs the same `key` | Duplicate key — `PageTopBarCrumb.key` is caller-supplied with no uniqueness check |
| 5 | Pass a very long last crumb | It truncates with `truncate`, so the actions never get pushed off (`PageTopBar/index.tsx:87`) |
| 6 | Verify the bar's DOM position | Portaled into `div[data-slot="sidebar-inset-bar"]` above the scrollport (`packages/design-system/src/lib/components/ui/top-bar.tsx:56-57`) |

**Keyboard-only path:** Tab reaches the inline sidebar trigger (when collapsed),
then each linked crumb, then the page actions.
**Screen-reader expectation:** "Breadcrumb, navigation, list, 3 items" and the
last item announced as the current page. Note that a crumb without `to` is a bare
`<span>` inside a `BreadcrumbItem` — verify it does not announce as a link.

### F21 / F22 — `PageActions` and `PageActionsPortal`

**Preconditions:** an entry editor page (`/workspaces/:id/content/<collection>/<id>`).

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open the editor | Save/Publish buttons sit at the right end of the top bar |
| 2 | Inspect their React context | They are portaled (`pageChrome/index.tsx:196`), so they still resolve the page's form state, the open workspace, and `useHasPermission` |
| 3 | Mount a page whose `PageActionsPortal` renders before its `TopBar` | Nothing renders for one commit, then the actions appear (`pageChrome/index.tsx:196`) |
| 4 | Compose a bar manually and place `PageActions` **before** the breadcrumb | Everything after it is pushed off the bar's end — `TopBarActions` is `ml-auto` |
| 5 | Mount two pages each with a `PageActionsPortal` (a transition) | Both portal into the **same** host simultaneously during the overlap, so two sets of buttons appear for a frame. No ref-counting here, unlike the right panel |

**Keyboard-only path:** Tab order in the bar is trigger → crumbs → actions →
panel-reopen button. Because the bar is portaled *above* the scrollport, the
actions come **before** page content in the tab order, which is correct.
**Screen-reader expectation:** the actions are plain buttons in a `<div>`; no
group semantics. Acceptable.

### F23 / F24 / F25 / F26 — the right panel

**Preconditions:** the entry editor, which registers a Properties panel.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open a page with **no** panel | The `<aside id="app-right-panel">` exists but is `w-0` and `inert` (`AppRightPanel/index.tsx:70, 89`); no toggle anywhere |
| 2 | Open the entry editor | The column appears at `22rem` with a header aligned to the top bar (`h-12` + border) |
| 3 | Click the header's collapse button | The column narrows to zero **with** a 300ms transition (only because `animate` is armed by `toggle`, `pageChrome/index.tsx:136-139`); a reopen button appears in the top bar |
| 4 | Reload the page | It stays collapsed — persisted as `ortha:right-panel = 'collapsed'` |
| 5 | Reload at <768px width | It starts collapsed **regardless** of the stored preference (`pageChrome/index.tsx:69`), and the desktop preference is untouched |
| 6 | On mobile, open it | It overlays from the right over a scrim; tapping the scrim closes it |
| 7 | Collapse it, then navigate to another page and back | It stays collapsed; the filler's state was never unmounted because the host stays mounted (`AppRightPanel/index.tsx:124-127`) |
| 8 | Collapse it **from the keyboard** | **Suspected defect:** the button you activated is now inside an `inert` subtree; focus falls to `<body>`. See `🐞 BUG-shell-admin-07` |
| 9 | On mobile with the panel open, press `Esc` | **Suspected defect:** nothing happens — the overlay has no `Esc` handler and no focus trap. See `🐞 BUG-shell-admin-07` |
| 10 | Register two panels (two `RightPanelPortal`s mounted) | The newest title wins (`pageChrome/index.tsx:146`) but **both** sets of children render into the one host, stacked |
| 11 | Change a registered panel's `title` prop | The effect re-runs, unregistering the old title and registering the new (`pageChrome/index.tsx:218`) |
| 12 | Resize from mobile to desktop without reloading | `readOpen()` ran once at mount, so the mobile-forced collapse persists until reload |

**Keyboard-only path:** with the panel open, Tab from the page content should
reach the panel's collapse button and then its contents; collapsed, the reopen
button in the top bar. Step 8 breaks this.
**Screen-reader expectation:** the panel is a `complementary` landmark named by
its title, but **only while shown** (`aria-label={shown ? panel?.title : undefined}`,
`AppRightPanel/index.tsx:69`). The toggle pair correctly carries
`aria-controls="app-right-panel"` and `aria-expanded` on both halves
(`AppRightPanel/index.tsx:114-115`, `PageActions/index.tsx:45-46`) — a genuinely
good bit of wiring.

---

## 4. Edge Cases & Negative Paths

**Empty / zero**

- **EC-01 — Zero nav items in a group.** `❌ NONE` The group heading and body are
  both omitted (`GlobalSidebar/index.tsx:91-93`). Correct.
- **EC-02 — Zero footer items.** `❌ NONE` No `SidebarFooter` wrapper at all.
  Correct.
- **EC-03 — Zero `HOME_SECTION_SLOT` items.** `❌ NONE` The greeting renders alone,
  with no empty state and no hint that anything is missing
  (`HomePage/index.tsx:63-77`).
- **EC-04 — Zero `COMMAND_SLOT` sections.** `❌ NONE` Only "Go to" renders. Fine.
- **EC-05 — A user with no `name` and no `email`.** `❌ NONE` The greeting renders
  "Good morning, " (`HomePage/index.tsx:55`). Cosmetic.
- **EC-06 — `crumbs=[]` passed to `PageTopBar`.** `❌ NONE` `last = -1`, so no crumb
  is the current page; an empty `<ol>` renders inside a labelled nav.

**Boundary**

- **EC-07 — A nav item with `to:'/'` and `end` unset.** `❌ NONE`
  `useMatch('//*')` — a malformed pattern. Home sets `end:true` so this is not hit
  today, but nothing stops a contributor.
- **EC-08 — Two nav items whose `to` values are prefixes of each other**
  (`/users` and `/users/invite`). `❌ NONE` Both match on `/users/invite`; two rows
  show `aria-current="page"` at once. `4.1.2`/`1.3.1` smell.
- **EC-09 — `order` equal across contributions.** `❌ NONE` Stable sort ⇒
  registration order. Deterministic but the slot contract does not say so.
- **EC-10 — Viewport exactly 768px.** `❌ NONE` `useIsMobile` says desktop;
  `pageChrome`'s `MOBILE_QUERY` is `(max-width: 767px)` ⇒ also desktop. The two
  agree, which is the point of exporting one breakpoint.

**Size & encoding**

- **EC-11 — A 200-character nav label.** `❌ NONE` `SidebarMenuButton` applies
  `[&>span:last-child]:truncate`, so it truncates. The tooltip (only shown when
  collapsed) would carry the full text.
- **EC-12 — A label containing `<script>`.** `❌ NONE` React escapes it; labels go
  through `intl.formatMessage`, which does not interpret HTML unless rich-text
  tags are supplied.
- **EC-13 — RTL locale.** `❌ NONE` The shell hard-codes a **left** sidebar
  (`Sidebar collapsible="offcanvas"` defaults `side="left"`) and the skip link
  positions at `focus:left-4`. Nothing flips for `dir="rtl"`.
- **EC-14 — A workspace name with an emoji in the palette.** `❌ NONE` cmdk matches
  on the item's `value`; emoji do not break matching but do affect the
  `SidebarCommandItem`'s `value={label}` keying (see `🐞 BUG-shell-admin-04`).

**Permission matrix**

- **EC-15 — `admin`.** `⚠️ PARTIAL` Every nav entry and palette result present.
  Exercised indirectly by every signed-in spec.
- **EC-16 — `contributor` / `viewer`.** `❌ NONE` No spec drives a non-admin
  session through the shell. The gate is `permissions.includes(key)` — exact
  string equality, with **no wildcard support** in either
  `useHasPermission` (`packages/identity/admin/src/lib/presentation/auth/authContext/index.ts:63-69`)
  or the group pre-check (`GlobalSidebar/index.tsx:69-70`). Verified: the two
  implementations agree exactly, so the "heading over nothing" bug the AGENTS
  warns about cannot occur from a mismatch. **Checked and cleared.**
- **EC-17 — Unauthenticated.** `✅ E2E` Redirected before the shell renders
  (`apps/admin-e2e/src/auth/private-routes.spec.ts:22-40`).
- **EC-18 — Authenticated but not a member of the workspace in the URL.** `❌ NONE`
  Out of this unit's scope — the workspace shell and the server guard own it. The
  *shell* would still render its chrome around whatever the page decides to show.
- **EC-19 — 🔒 Route-existence leakage.** `⚠️ PARTIAL` A permission-gated nav item
  is genuinely removed from the DOM, so a user without `users:read` is not told
  that `/users` exists **via the sidebar**. But `permission` is optional
  (`sidebarSlots/index.ts:39-45`) and defaults to "visible to every signed-in
  user" — a plugin that forgets it advertises its route to everyone. The
  mitigating factor is that this is a UX signal only; the server guard is the
  boundary (`.cursor/BUGBOT.md:41-43`). Worth an explicit spec.

**Tenant isolation**

- **EC-20 — Not applicable at this layer.** The shell holds no workspace-scoped
  state; `useSidebarContent` hands it a node rendered by the workspace shell,
  which resolves the workspace itself.

**Concurrency**

- **EC-21 — Two components calling `useSidebarContent`.** `❌ NONE`
  → `🐞 BUG-shell-admin-05`.
- **EC-22 — Two `RightPanelPortal`s.** `⚠️ PARTIAL` Ref-counted by title
  (`pageChrome/index.tsx:124-134`), so `present` never flickers false during a
  remount — but both fillers render into the one host.
- **EC-23 — `⌘K` and `⌘B` pressed together.** `❌ NONE` Both window listeners fire;
  the palette opens *and* the sidebar toggles, which unmounts `GlobalSidebar` and
  therefore `SidebarSearch` — the dialog it just opened. Untested; likely leaves
  the app scroll-locked.

**State after mutation**

- **EC-24 — Collapse the sidebar, navigate, come back.** `❌ NONE` State is held in
  `SidebarProvider`, which lives inside `AppShell` and is not remounted by route
  changes — so it persists across navigation but not across reload
  (`🐞 BUG-design-system-07`).
- **EC-25 — Collapse the right panel, navigate, come back.** `❌ NONE` Persisted in
  `localStorage`; correct.
- **EC-26 — A slot component that throws *after* first render** (e.g. on a
  refetch). `❌ NONE` Same blast radius as `🐞 BUG-shell-admin-01`.

**Failure & partiality**

- **EC-27 — `/api/auth/me` 500s.** `⚠️ PARTIAL` `RequireAuth` owns this; the shell
  never renders. Verify it does not render the boot loader forever.
- **EC-28 — A contributed sidebar section whose query fails.** `❌ NONE` The
  section decides. If it throws instead of rendering an error state, the whole
  shell goes down (`🐞 BUG-shell-admin-01`).
- **EC-29 — `localStorage` unavailable.** `⚠️ PARTIAL` `readOpen` and the persist
  effect are both `try/catch`ed (`pageChrome/index.tsx:66-74, 112-122`). Good.

**Idempotency & replay**

- **EC-30 — Activating the skip link twice.** `❌ NONE` Idempotent.
- **EC-31 — Browser Back after the palette navigates.** `❌ NONE` The palette
  closed via `setOpen(false)` before `navigate`, so Back returns to the previous
  route with the palette shut. Verify no scroll-lock is left behind.

**UI-specific: loading / error / empty**

- **EC-32 — The shell itself has no loading state** — it renders only after
  `RequireAuth` resolves. Correct division of labour.
- **EC-33 — No error boundary anywhere in the shell.** `❌ NONE` This is the
  headline finding: the shell renders **eight** foreign components
  (`SIDEBAR_SECTION_SLOT` ×n, `SIDEBAR_FOOTER_SLOT` ×n, `HOME_SECTION_SLOT` ×n,
  `COMMAND_SLOT` ×n, plus the whole `useSidebarContent` override) with no
  `WidgetBoundary` equivalent. → `🐞 BUG-shell-admin-01`.

---

### 4A. Accessibility & Section 508 Conformance

**Standards tested against:** WCAG 2.1 AA (the repo's `accessibility` skill
target), with the Revised Section 508 provision cited alongside. 508 E205.4
incorporates WCAG 2.0 A+AA for content; 502.2/502.3 and 503.2 are the Chapter 5
software provisions; 504.2 applies (this is an authoring tool's chrome).

**Why axe is not enough here.** This unit's entire job is *structure* — landmarks,
skip links, focus order across a collapsing region, the tab order of a portaled
bar — and axe checks almost none of it. Worse, the shell has **no a11y spec of
its own**: `apps/admin-e2e/src/shell/` contains exactly one file
(`command-palette.spec.ts`) and it is not an axe scan. The shell is scanned only
incidentally, as the chrome around `auth/a11y.spec.ts:101-105`'s home-page scan.
A clean axe run on Home says nothing about the collapsed sidebar, the open right
panel, the mobile overlay, or the palette's `aria-activedescendant`.

#### ♿ A11Y-shell-admin-01 — Focus is dropped when the sidebar or the right panel is collapsed from the keyboard

**WCAG:** `2.4.3 Focus Order (A)`, `3.2.2 On Input (A)`, `4.1.3 Status Messages (AA)` · **508:** `E205.4 / 502.3.12 (Focus Cursor)` · **Verdict: Does Not Support**

**Location:** `packages/shell/admin/src/lib/components/AppRightPanel/index.tsx:70, 109-122`; `packages/shell/admin/src/lib/components/AppSidebar/GlobalSidebar/index.tsx:80` with `packages/design-system/src/lib/components/ui/sidebar.tsx:282-283`

Both collapse controls live **inside** the region they hide. `AppRightPanel`
sets `inert={!shown}` on the `<aside>` that contains its own collapse button;
`Sidebar` sets `inert` on the container that holds the in-header trigger. The
moment the state flips, the element that has focus is inside an inert subtree and
the browser blurs it to `<body>`.

**Keyboard-only user:** presses `Enter` on "Hide Properties", the panel closes,
and the next `Tab` starts from the top of the document — every nav link and
breadcrumb again before reaching the page. There is no way back to the reopen
button except traversing the whole chrome.
**Screen-reader user:** the same, plus silence — nothing announces that the panel
collapsed. The `aria-expanded` pair is correct on both buttons, but nobody is
focused on either at the moment it changes.
**Remediation:** in `toggle`, after the state flips, move focus to the control
that replaced the one being hidden — the top bar's reopen button when collapsing,
the panel's collapse button when reopening. Cross-reference
`🐞 BUG-shell-admin-07` and `🐞 BUG-design-system-01`.

#### ♿ A11Y-shell-admin-02 — The mobile right-panel overlay has no focus trap, no `Esc`, and a scrim that is a button hidden from assistive tech

**WCAG:** `2.1.2 No Keyboard Trap (A)` (inverse — content behind stays reachable), `2.4.3 Focus Order (A)`, `1.3.1 Info and Relationships (A)` · **508:** `E205.4 / 502.3.12` · **Verdict: Does Not Support**

**Location:** `packages/shell/admin/src/lib/components/AppRightPanel/index.tsx:57-66, 67-92`

On a phone the panel becomes a fixed overlay at `z-40` over a scrim at `z-30`.
It is **not** a Radix Dialog: there is no `role="dialog"`, no `aria-modal`, no
focus containment, and no `Esc` handler. The scrim is a `<button type="button"
tabIndex={-1} aria-hidden>` — a control with a real behaviour (dismiss) that is
deliberately unreachable by keyboard and invisible to screen readers, with no
keyboard equivalent provided.

**Keyboard-only user:** opens the panel on a narrow viewport, tabs, and walks
straight out of the overlay into the page underneath — which is still fully
interactive but visually covered. `Esc` does nothing. The only way to close it is
to tab back to the panel's own collapse button, which may be behind the scrim
visually.
**Screen-reader user:** the page content behind the overlay is still in the
accessibility tree and reads normally, giving no indication that a panel is
covering the screen.
**Remediation:** on mobile, render the panel through the design system's `Sheet`
(which is a Radix Dialog and brings the trap, `Esc`, and `aria-modal` for free),
or at minimum add an `Esc` handler and `inert` the inset while the overlay is up.

#### ♿ A11Y-shell-admin-03 — The skip link's target and the sole `<main>` are correct, but nothing verifies focus actually moves

**WCAG:** `2.4.1 Bypass Blocks (A)` · **508:** `E205.4 / 502.3.1` · **Verdict: Supports — unverified**

**Location:** `packages/shell/admin/src/lib/components/AppShell/index.tsx:49-58`

The implementation is right: the link is the **first** focusable element in the
tree, it is `sr-only` until focused and then fully visible with a ring, its
target `<main id="main-content">` carries `tabIndex={-1}` so a hash navigation
genuinely moves focus rather than only scrolling, and there is exactly one
`<main>` (rendered by `SidebarInset`). The message is localized
(`shell.appShell.skipToContent`).

The gap is coverage: **no spec anywhere presses `Tab` on a loaded private page and
asserts the skip link is focused, activates it, and asserts
`document.activeElement` is `#main-content`**. `2.4.1` is exactly the criterion
axe cannot evaluate (its `bypass` rule only checks that *a* mechanism exists in
the markup, not that it works).

**Remediation:** add the assertion, not code.

#### ♿ A11Y-shell-admin-04 — Sidebar group headings are styled text, not headings, and the workspace nav's landmark may be unnamed

**WCAG:** `1.3.1 Info and Relationships (A)`, `2.4.6 Headings and Labels (AA)` · **508:** `E205.4 / 502.3.1, 502.3.9` · **Verdict: Partially Supports**

**Location:** `packages/shell/admin/src/lib/components/AppSidebar/GlobalSidebar/index.tsx:85, 96-98`; `packages/design-system/src/lib/components/ui/sidebar.tsx:503-522`

`SidebarGroupLabel` renders a `<div>`. "Overview" and "Directory" are therefore
plain text with no programmatic relationship to the `<ul>` beneath them: a
screen-reader user navigating by heading skips them, and navigating linearly
hears "Overview" as a stray word between link groups. The correct markup for a
nav with named sub-groups is either `<h2>`+`aria-labelledby` on a nested `<nav>`,
or `role="group"` with `aria-label`.

Separately, the single `<nav aria-label="Primary">` (`GlobalSidebar/index.tsx:85`)
belongs to `GlobalSidebar` only. When a route takes the region over via
`useSidebarContent`, the injected node supplies its own markup — if the workspace
nav omits a landmark name, the sidebar silently loses its label on every
workspace page. Not verified here (the node comes from `workspaces-admin`), but
the *contract* does not require one.

**Keyboard-only user:** unaffected. **Screen-reader user:** cannot jump between
nav groups, and on workspace pages may find an unnamed navigation landmark.
**Remediation:** pass `asChild` and render an `<h2 className="sr-only">`-equivalent,
or wrap each group in `role="group" aria-label={…}`; and document in
`sidebarSlots`/`useSidebarContent` that an override must carry its own labelled
landmark.

#### ♿ A11Y-shell-admin-05 — The command palette's arrow-key navigation is not verified to be announced

**WCAG:** `4.1.2 Name, Role, Value (A)`, `2.1.1 Keyboard (A)` · **508:** `E205.4 / 502.3.6, 502.3.13` · **Verdict: Partially Supports — unverified**

**Location:** `packages/shell/admin/src/lib/components/AppSidebar/SidebarSearch/index.tsx:111-136`; items at `SidebarCommandItem/index.tsx:35`

cmdk normally keeps DOM focus in the input and tracks the highlighted row with
`aria-activedescendant`. The repo *knows* this pattern matters — the query
builder's `FieldPicker` documents it at length
(`packages/query-builder/admin/AGENTS.md:106-117`: "an arrow-key highlight with
no `aria-activedescendant` is a purely visual state assistive tech never hears").
But nothing asserts it for the shell's palette. `command-palette.spec.ts:28-65`
clicks results with the mouse; it never presses an arrow key.

Related: `SidebarCommandItem` sets `value={label}`
(`SidebarCommandItem/index.tsx:35`), so two nav destinations with the same
translated label are one cmdk item — a `4.1.2` ambiguity as well as a functional
one (`🐞 BUG-shell-admin-04`).

**Remediation:** assert `aria-activedescendant` moves with `ArrowDown` and that
the referenced row is `aria-selected="true"`; and key cmdk items by `to`.

#### ♿ A11Y-shell-admin-06 — `⌘K` and `⌘B` are captured globally, including inside text fields, with no documented way to escape them

**WCAG:** `2.1.4 Character Key Shortcuts (A)` (advisory — the shortcuts use a modifier, so 2.1.4 does not strictly apply), `3.2.2 On Input (A)` · **508:** `E205.4 / 502.3.14` · **Verdict: Partially Supports**

**Location:** `packages/shell/admin/src/lib/components/AppSidebar/SidebarSearch/index.tsx:74-83`; `packages/design-system/src/lib/components/ui/sidebar.tsx:112-125`

Because both shortcuts require Meta/Ctrl, `2.1.4` (which targets single-character
shortcuts) is satisfied. The `3.2.2` concern is real though: pressing `⌘B` while
editing rich text produces a change of context (the sidebar collapses) in
response to input into a *different* control, and `preventDefault()` destroys the
keystroke the user intended. Cross-reference `🐞 BUG-design-system-01` and
`🐞 BUG-shell-admin-02`.

**Remediation:** ignore the shortcut when `event.target` is editable, and
document the bindings somewhere reachable (the palette footer legend already
teaches ↑↓/↵/esc; ⌘K and ⌘B deserve the same).

#### ♿ A11Y-shell-admin-07 — A permission-gated nav item is genuinely absent, which is right; but the default is "visible to everyone"

**WCAG:** n/a (this is a security-adjacent finding surfaced during the a11y pass) · **508:** `E205.4` · **Verdict: Supports**

**Location:** `packages/shell/admin/src/lib/components/AppSidebar/SidebarNavButton/index.tsx:30-33`; `SidebarCommandItem/index.tsx:28-31`

Explicitly checked and **cleared** for the a11y question the brief raised: a
gated item returns `null`, so it is not in the DOM, not in the accessibility
tree, and not in the tab order. It is not "visually hidden but still tabbable".
The hook is called unconditionally before the early return, so hook order is
stable. Recorded here so the check is on the record.

#### Advisory (WCAG 2.2 — not referenced by 508)

- **2.4.11 Focus Not Obscured (Minimum, AA).** The portaled `TopBar` sits above
  the scrollport; an element focused at the very top of the scroll region can be
  covered by it.
- **2.5.8 Target Size (Minimum, AA).** `SidebarToggle` and the panel toggles are
  `size-7`/`size-8` (28–32px).

---

## 5. E2E Coverage Map

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F1 ShellPlugin route | `apps/admin-e2e/src/auth/routing.spec.ts` (signed-in rendering) + `src/home/dashboard.spec.ts:23-34` | `/` renders the Home page for a signed-in user | ✅ E2E |
| F2 Gate — signed out from `/` | `apps/admin-e2e/src/auth/private-routes.spec.ts:22-31` | redirect to `/identity/signin`, sign-in heading visible | ✅ E2E |
| F2 Gate — signed out from an unknown path | `apps/admin-e2e/src/auth/private-routes.spec.ts:33-40` | the catch-all is inside the guarded group, so it also redirects | ✅ E2E |
| F3 AppShell chrome | `apps/admin-e2e/src/auth/a11y.spec.ts:101-105` | axe-clean on the home page (light theme, sidebar expanded, no panel) | ⚠️ PARTIAL — one state of six; the collapsed sidebar, the open panel, the mobile overlay and the open palette are never scanned |
| F4 Skip link | — | — | ❌ NONE — never focused, never activated, focus destination never asserted |
| F5/F6 Nav slot + grouping | `apps/admin-e2e/src/shell/command-palette.spec.ts:35` | "Members" (a `SIDEBAR_NAV_SLOT` item) is offered in the palette | ⚠️ PARTIAL — proves the slot is read; asserts nothing about group order, `order` sorting, or the sidebar's own rendering |
| F7 Per-item permission gate | — | — | ⚠️ PARTIAL — `mockSignedIn` grants a full permission set in every spec; no spec drives a restricted role through the sidebar |
| F8 Group-level pre-check | — | — | ❌ NONE |
| F9 Active state / `aria-current` | — | — | ⚠️ PARTIAL — `aria-current` is asserted for `TabNav`-style tabs elsewhere, never for a sidebar row |
| F11 Footer slot | `apps/admin-e2e/src/users/account-menu.spec.ts` | the account menu (the only `SIDEBAR_FOOTER_SLOT` item) opens and its items work | ✅ E2E |
| F12 Contextual takeover | `apps/admin-e2e/src/content/content-library.spec.ts` (workspace nav present) | the per-workspace sidebar renders on a workspace route | ⚠️ PARTIAL — never asserts the global nav **returns** on leaving, which is the cleanup path |
| F13 Palette open/close | `apps/admin-e2e/src/content/content-library.spec.ts:138-147` | `⌘K` opens, input focused, `Esc` closes | ✅ E2E — but this is the **content** palette, not `SidebarSearch`. The shell's own palette is only ever opened via `homePage.openCommandPalette()` |
| F13/F15 Palette contents | `apps/admin-e2e/src/shell/command-palette.spec.ts:28-42` | nav destinations, workspaces, and content types all appear — proving `COMMAND_SLOT` is rendered | ✅ E2E |
| F13 Palette navigation | `apps/admin-e2e/src/shell/command-palette.spec.ts:44-65` | filtering by text then clicking navigates to `/users` and to a content type URL | ✅ E2E — mouse only; no arrow-key/`Enter` path |
| F14 Palette permission gate | — | — | ⚠️ PARTIAL — same gap as F7 |
| F16 Palette footer legend | — | — | ❌ NONE |
| F17 SidebarToggle | — | — | ❌ NONE — no spec collapses the sidebar at all |
| F18/F19 Home slot + page | `apps/admin-e2e/src/home/dashboard.spec.ts:23-34` | greeting contains the user's name; three named stat tiles; both panels visible | ✅ E2E |
| F19 Panel links | `apps/admin-e2e/src/home/dashboard.spec.ts:36-46` | exactly two "View all" links | ✅ E2E — a good use of `toHaveCount` rather than a vacuous `toBeVisible` |
| F20 PageTopBar | breadcrumb assertions inside `content/`, `users/`, `workspaces/` page objects | the bar renders with the right crumb text | ⚠️ PARTIAL — the sub-`sm` crumb collapse and the portal-into-the-inset behaviour are untested |
| F21/F22 PageActions(+Portal) | `apps/admin-e2e/src/content/entry-read-only.spec.ts` etc. drive Save/Publish, which live in the portal | the buttons work | ⚠️ PARTIAL — implicit; nothing asserts they render **inside** the bar's actions host |
| F23/F24/F25/F26 Right panel | — | — | ❌ NONE — the entire right-panel feature (registration, collapse, persistence, mobile overlay, `inert`, `aria-controls` pairing) has **zero** coverage |

**Coverage tally:** `26 features · 8 ✅ · 10 ⚠️ · 8 ❌`

---

## 6. 🐞 Potential Bugs

### 🐞 BUG-shell-admin-01 — A throw in any slot-contributed component unmounts the entire authenticated app · Severity: Medium

**Location:** `packages/shell/admin/src/lib/components/AppSidebar/index.tsx:41-47`; `packages/shell/admin/src/lib/components/AppSidebar/GlobalSidebar/index.tsx:113-115`; `packages/shell/admin/src/lib/pages/HomePage/index.tsx:63-77`; `packages/shell/admin/src/lib/components/AppSidebar/SidebarSearch/index.tsx:133-135`
**Category:** ux-state / correctness

**What the code does:**

```tsx
{footerItems.map(({ id, Component }) => (
    <Component key={id} />
))}
…
{sections.map(({ id, Component }) => (
    <Component key={id} />
))}
…
{stats.map(({ id, Component }) => (
    <Component key={id} />
))}
```

Four slots, four bare `.map()` renders, no error boundary anywhere in
`packages/shell/admin/src` (verified — the only `class` component in the whole
admin's shell/insights surface is `WidgetBoundary`, and it lives in
`insights-admin`).

**Why it is wrong:** these components come from **other packages** — the shell
has no visibility into what they render. The sidebar footer and the sidebar
sections are rendered *above* the router outlet, so a render-phase throw in any
of them propagates to the root and React unmounts the whole tree: a blank white
page with no chrome, no navigation, and no way to recover but a reload — which
re-renders the same throw.

The repo already states the correct pattern, for exactly this reason:
"Each widget is mounted inside its own `WidgetBoundary` so a throw from one
contributing package can't take the others down — these components come from
packages the Insights plugin has no visibility into"
(`packages/insights/admin/src/lib/presentation/components/InsightsSectionBand/index.tsx:35-37`,
and `packages/insights/admin/AGENTS.md:158-162`). The shell renders *more*
foreign components than Insights does, in a position where the blast radius is
larger, and has none.

**Repro:**
1. In `packages/workspaces/admin`, make the `SIDEBAR_SECTION_SLOT` component
   throw on first render (e.g. read a property of an undefined query result — the
   exact shape BUGBOT's "mapper fallbacks" entry describes).
2. Sign in.
3. → Observed: a blank page. Neither the sidebar nor the routed page renders;
   the console shows the throw.
   Expected: the broken section shows a small inline failure; everything else
   works.

**Blast radius:** every signed-in user, on every page, for any render bug in any
of the 15 admin plugins that fill a shell slot. It converts a one-widget bug into
a total outage. **Severity is Medium, not High:** the mechanism is confirmed
line-for-line, but the harm is availability — no data is lost, corrupted or
exposed, and no authorization decision changes. It is still the highest-value fix
in this unit.
**Suggested fix:** wrap each slot render in a boundary equivalent to
`WidgetBoundary`, keyed by the item's `id`, with a compact inline fallback. Move
the boundary into a shared place (`utils-admin`) so both packages use one.

### 🐞 BUG-shell-admin-02 — The `⌘K` palette shortcut fires from inside text inputs · Severity: Medium

**Location:** `packages/shell/admin/src/lib/components/AppSidebar/SidebarSearch/index.tsx:74-83`
**Category:** correctness / ux-state

**What the code does:**

```ts
const onKeyDown = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
    }
};
window.addEventListener('keydown', onKeyDown);
```

No `event.target` check. `⌘K`/`Ctrl+K` is a common in-field binding (kill-to-end-of-line
in readline-style inputs on macOS; "insert link" in most rich-text editors).

**Why it is wrong:** it is the same defect class as `🐞 BUG-design-system-01`, at
lower severity because `⌘K`-in-a-field is a less universal expectation than
`⌘B`-for-bold. But the specific collision with a WYSIWYG "insert link" toolbar is
real — the admin ships one (`apps/admin-e2e/src/content/wysiwyg-fields.spec.ts`).

**Repro:**
1. Open a content entry with a WYSIWYG body, select some text, press `⌘K` to
   create a link.
2. → Observed: the global palette opens over the editor and the selection is
   lost. Expected: the editor's link dialog.

**Blast radius:** content authors using the rich-text editor.
**Suggested fix:** ignore the shortcut when
`event.target` is `INPUT`/`TEXTAREA`/`isContentEditable`, or scope the listener to
the shell's root element rather than `window`.

### 🐞 BUG-shell-admin-03 — A nav item contributed to an unknown `group` is silently dropped · Severity: Medium

**Location:** `packages/shell/admin/src/lib/components/AppSidebar/GlobalSidebar/index.tsx:39-46, 86-93`; type at `packages/shell/admin/src/lib/slots/sidebarSlots/index.ts:10`
**Category:** correctness

**What the code does:**

```tsx
const GROUPS = [
    { id: 'overview', label: messages.overview },
    { id: 'directory', label: messages.directory }
];
…
{GROUPS.map((group) => {
    const groupItems = items.filter((item) => item.group === group.id && isVisible(item));
    if (groupItems.length === 0) return null;
    …
})}
```

Items whose `group` matches neither id are filtered out of both groups and never
rendered anywhere. Nothing warns, in dev or otherwise.

**Why it is wrong:** `SidebarGroupId` is a TypeScript union, so *within* the
monorepo a bad value is a compile error — but the whole point of the slot is that
**npm-installed plugins** contribute to it, and a plugin compiled against an
older `@ortha-cms/shell-admin` (or written in JS) can hand over any string. The
sibling extension point in this repo made the opposite decision deliberately:
"Nothing is silently dropped. A widget naming a section nobody registered does
*not* vanish — it lands in a trailing catch-all band. A missing card with no
error anywhere is the worst failure mode a plugin system can have"
(`packages/insights/admin/AGENTS.md:66-70`). The shell has the same problem and
no catch-all.

**Repro:**
1. Contribute `{ labelId:'x.nav', defaultLabel:'X', to:'/x', group:'settings' as any, order:10, icon: Cog }`.
2. Sign in.
3. → Observed: nothing in the sidebar, nothing in the console, and the route at
   `/x` still exists but is unreachable through the UI.
   Expected: the entry appears somewhere, or a dev warning names it.

**Blast radius:** third-party plugin authors, whose contribution disappears with
no diagnostic. Low probability in-repo, high cost when it happens.
**Suggested fix:** either add a trailing catch-all group (matching Insights), or
`console.warn` in dev naming the item and the unknown group.

### 🐞 BUG-shell-admin-04 — Slot items are keyed by non-unique values and slots have no de-duplication or unregistration · Severity: Medium

**Location:** `packages/shell/admin/src/lib/components/AppSidebar/GlobalSidebar/index.tsx:103` (`key={item.to}`); `packages/shell/admin/src/lib/components/AppSidebar/SidebarSearch/index.tsx:127` (`key={item.to}`) and `SidebarCommandItem/index.tsx:35` (`value={label}`); the registry at `packages/utils/admin/src/lib/slot/index.ts:31-38`
**Category:** correctness

**What the code does:**

```ts
export function createSlot<T>(name: string): Slot<T> {
    const items: T[] = [];
    return {
        name,
        getItems: () => items,
        _register: (newItems: T[]) => items.push(...newItems)
    };
}
```

Module-level mutable array. `_register` **appends unconditionally** — no
de-duplication by id, no unregister, and `getItems()` returns the *live* array
rather than a copy. On top of that, `GlobalSidebar` and `SidebarSearch` key their
lists by `item.to` (not unique — two plugins can target the same route with
different labels), the footer and section lists key by `id` (contributor-supplied,
unchecked), and `SidebarCommandItem` sets cmdk's `value` to the translated label
(two destinations translating to the same string collapse into one).

**Why it is wrong:** three separate consequences.
(a) Duplicate React keys → warnings and, when the list changes, React reusing the
wrong DOM node — which for a nav row means the wrong entry carrying
`aria-current`.
(b) `getItems()` handing out the live array means any consumer that sorts in
place corrupts the slot for everyone. `byOrder` copies first
(`packages/utils/admin/src/lib/byOrder/index.ts:6-8`) and its JSDoc explains
exactly why — so the hazard is known and the encapsulation is still missing.
(c) Under Vite HMR, re-executing a plugin factory pushes its items again, so a
hot reload duplicates every nav entry. This is a dev-only annoyance but it is
also the fastest way to see (a) fire.

**Repro:**
1. Register two plugins each contributing a `SIDEBAR_NAV_SLOT` item with
   `to: '/users'`.
2. → Observed: React key warning; both rows render; navigating to `/users` marks
   both `aria-current="page"` (see EC-08).
3. Edit any admin source file to trigger HMR. → Observed: the nav list grows.

**Blast radius:** in-repo, only reachable via HMR today. For third-party plugins
it is a live collision risk.
**Suggested fix:** de-duplicate in `_register` by a required `id`, return a copy
from `getItems()`, and key every slot render by that `id` rather than by `to` or
by a translated label.

### 🐞 BUG-shell-admin-05 — Two concurrent `useSidebarContent` callers clobber each other, and the loser's cleanup blanks the winner · Severity: Medium

**Location:** `packages/shell/admin/src/lib/utils/sidebarContent/index.tsx:63-82`
**Category:** ux-state / race

**What the code does:**

```ts
useEffect(() => {
    setContent(render());
    return () => setContent(null);
}, [setContent, ...deps]);
```

A single-slot store with an unconditional `setContent(null)` cleanup and no
ownership token.

**Why it is wrong:** during any route transition where the outgoing page and the
incoming page **both** call `useSidebarContent`, React mounts the new subtree's
effects and runs the old subtree's cleanups in an order that is not guaranteed to
be cleanup-first for sibling trees. If the outgoing cleanup runs last, it sets
the content to `null` after the incoming page set it, and the sidebar falls back
to the **global** nav on a workspace page. The same happens if a nested component
inside a workspace page ever calls the hook: whichever unmounts first clears the
other's region.

The parallel machinery in this same package solved exactly this: the right panel
is **ref-counted** — "Ref-counted, so the overlap while a page remounts can't read
as 'gone'" (`packages/shell/admin/src/lib/utils/pageChrome/index.tsx:98-99`).
`useSidebarContent` has no such protection.

**Repro:**
1. Navigate from `/workspaces/a/content/...` directly to `/workspaces/b/content/...`
   (both call `useSidebarContent`).
2. → Observed (intermittently): the sidebar shows the global nav instead of
   workspace B's nav until a further interaction re-renders it.
   Expected: workspace B's nav.

**Blast radius:** every workspace-to-workspace navigation. Intermittent, which is
why it is easy to dismiss as a glitch.
**Suggested fix:** give each caller a stable token (a `useId()`), store
`{ token, node }`, and have the cleanup clear only if it still owns the slot —
or ref-count it the way `registerPanel` does.

### 🐞 BUG-shell-admin-07 — Collapsing the right panel from the keyboard strands focus, and the mobile overlay is not dismissible by keyboard · Severity: Medium

**Location:** `packages/shell/admin/src/lib/components/AppRightPanel/index.tsx:57-66, 70, 109-122`; `packages/shell/admin/src/lib/utils/pageChrome/index.tsx:136-139`
**Category:** a11y / ux-state

**What the code does:** `toggle()` flips `open`; the `<aside>` becomes
`inert={!shown}` while still containing the button that was just activated. On
mobile the overlay is a plain positioned `<aside>` with a sibling
`<button aria-hidden tabIndex={-1}>` scrim and no `Esc` handler.

**Why it is wrong:** see `♿ A11Y-shell-admin-01` and `♿ A11Y-shell-admin-02` for
the criterion-by-criterion analysis. Filed here as a functional defect too,
because it is not only an assistive-technology issue: on a phone, a user who
opened the panel and reached for the keyboard has no way to close it, and on
desktop the "focus vanished" symptom is reported by sighted keyboard users as
"the page stopped responding to Tab".

**Repro:**
1. Open an entry editor, Tab to the panel's "Hide Properties" button, press `Enter`.
2. → Observed: `document.activeElement === document.body`. Expected: focus on the
   reopen button in the top bar.
3. Narrow to 400px, reopen the panel, press `Esc`. → Observed: nothing.
   Expected: the overlay closes.

**Blast radius:** every keyboard user of any page with a right panel — today the
entry editor, and any page a plugin adds one to.
**Suggested fix:** move focus to the counterpart control inside `toggle`; render
the mobile variant through the design system's `Sheet` so `Esc`, the focus trap
and `aria-modal` come for free.

### 🐞 BUG-shell-admin-08 — `HomePage` renders nothing but a greeting when no plugin contributes a section · Severity: Low

**Location:** `packages/shell/admin/src/lib/pages/HomePage/index.tsx:63-77`
**Category:** ux-state

**What the code does:** both regions are guarded by `length > 0` and there is no
`else`. With zero contributions the page is a heading, a subtitle, and whitespace.

**Why it is wrong:** the subtitle actively promises content — "Here's what's
happening across your workspaces." — over an empty page. The design system ships
an `Empty` scaffold for exactly this, and `InsightsPage` uses the equivalent
pattern (`packages/insights/admin/src/lib/presentation/pages/InsightsPage/index.tsx:84-88`
renders a localized "No insights are available yet…" when `bands.length === 0`).

**Repro:** register only `IdentityPlugin()` and `ShellPlugin()` in
`apps/admin/src/main.tsx`, sign in. → Observed: a greeting over blank space.

**Blast radius:** a minimal install, or a permission-restricted user whose every
contributed panel gates itself out. Low, but it is the first screen after login.
**Suggested fix:** render an `Empty` when both regions are empty.

### 🐞 BUG-shell-admin-09 — The Home greeting is computed once and never updates · Severity: Low

**Location:** `packages/shell/admin/src/lib/pages/HomePage/index.tsx:28-32, 44`
**Category:** correctness

`greetingFor(new Date().getHours())` runs during render, so the greeting is
whatever the hour was when the component last rendered. An admin dashboard left
open across noon keeps saying "Good morning". Purely cosmetic; noted because it
is the kind of thing that reads as a bug in a screenshot.

**Suggested fix:** recompute on an interval, or accept it and remove the
time-of-day variance.

### Checked and cleared (no defect found)

- **Permission-check divergence.** `GlobalSidebar`'s group pre-check
  (`GlobalSidebar/index.tsx:69-70`) and `SidebarNavButton`'s per-row check
  (`SidebarNavButton/index.tsx:30-33`) are byte-for-byte equivalent —
  `useHasPermission` is exactly `auth.user.permissions.includes(permission)`
  (`packages/identity/admin/src/lib/presentation/auth/authContext/index.ts:63-69`).
  No wildcard support in either, so no "heading over nothing" can arise from a
  mismatch. This was the most likely bug in the unit and it is not there.
- **Hooks-before-early-return.** Both `SidebarNavButton` and `SidebarCommandItem`
  call `useHasPermission` unconditionally *before* the `return null`, with a
  comment saying why (`SidebarNavButton/index.tsx:28-30`). Hook order is stable.
- **`byOrder` in-place mutation.** Copies before sorting; every shell call site
  goes through it.
- **`PageActionsPortal`/`RightPanelPortal` context preservation.** `createPortal`
  moves DOM only, so a portaled Save button still resolves the page's form state
  — verified against the reasoning at `pageChrome/index.tsx:76-93`.
- **Right-panel `aria-controls`/`aria-expanded` pairing.** Both the collapse
  button (`AppRightPanel/index.tsx:114-115`) and the reopen button
  (`PageActions/index.tsx:45-46`) point at `RIGHT_PANEL_ID` with the correct
  `aria-expanded` value. Correct, and unusually careful.
- **Right-panel storage guards.** `readOpen` and the persist effect are both
  `try/catch`ed (`pageChrome/index.tsx:66-74, 112-122`).
- **`useSidebarContentOverride` / `useSidebarContent` outside a provider.** Both
  throw a named error rather than failing silently.
- **Skip-link correctness.** First focusable, `sr-only focus:not-sr-only`,
  localized, and the target carries `tabIndex={-1}` so focus really moves. The
  implementation is right; only the coverage is missing
  (`♿ A11Y-shell-admin-03`).

**Tally:** `8 🐞 — 0 Critical · 0 High · 6 Medium · 2 Low (0 🔒)` ·
`♿ 7 findings — 2 Supports · 3 Partially Supports · 2 Does Not Support · 0 Unverified`

(An earlier draft carried a ninth entry, `BUG-shell-admin-06`, claiming the auth gate
rested on an unasserted host-wiring assumption. Verification found the wiring correct and
directly readable at `packages/bootstrap/admin/src/lib/createAdmin/index.tsx:83-97`, with
no code defect — the entry was a test-coverage observation wearing a bug's clothes, so it
was withdrawn and folded into §7 item 2. Ids are **not** renumbered: `-07`, `-08` and
`-09` keep their numbers.)

---

## 7. Recommended E2E Tests

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | `apps/admin-e2e` POM + `page.route` mock | `src/shell/slot-resilience.spec.ts` | With a mocked route forcing a contributed sidebar section / home panel to throw, the rest of the shell still renders and the failure is confined to one card | `🐞 BUG-shell-admin-01`, EC-33 |
| 2 | `apps/admin-e2e` | extend `src/auth/private-routes.spec.ts` | A signed-out user is redirected from **every** private prefix: `/users`, `/workspaces`, `/workspaces/:id/content/...`, `/activity` — not just `/` and an unknown path. The gate is one wiring decision in another package (`createAdmin` nesting private routes under `layout`); today it is correct, and only two paths pin it | F2 ⚠️ (coverage gap, not a defect) |
| 3 | `apps/admin-e2e` | `src/shell/a11y.spec.ts` (new file — the shell has none) | axe-clean in **five** states: sidebar expanded, sidebar collapsed, palette open, right panel open, right panel collapsed | F3 ⚠️, `♿ A11Y-shell-admin-04` |
| 4 | `apps/admin-e2e` | `src/shell/keyboard.spec.ts` | `Tab` once from a fresh load focuses the skip link; `Enter` moves `document.activeElement` to `#main-content`; the next `Tab` stays inside `<main>` | F4 ❌, `♿ A11Y-shell-admin-03` |
| 5 | `apps/admin-e2e` | `src/shell/right-panel.spec.ts` | Registering a panel makes the column and its toggle exist; collapsing swaps the control into the top bar; the state survives a reload; the column is `inert` when absent; **focus lands on the reopen button after collapsing** | F23–F26 ❌, `🐞 BUG-shell-admin-07`, `♿ A11Y-shell-admin-01` |
| 6 | `apps/admin-e2e` | `src/shell/permissions.spec.ts` with `mockSignedIn(page, { permissions: ['workspaces:read'] })` | The Members row is absent from the DOM **and** from the tab order **and** from the palette; the whole Directory heading disappears when its every item is gated out | F7/F8/F14 ⚠️/❌, EC-19 |
| 7 | `apps/admin-e2e` | `src/shell/sidebar-collapse.spec.ts` | `⌘B` collapses; the floating `SidebarToggle` appears on Home and **not** on a page with a `TopBar`; the inline trigger appears in the bar instead; focus is not on `<body>` afterwards | F17 ❌, `🐞 BUG-design-system-01`, `♿ A11Y-shell-admin-01` |
| 8 | `apps/admin-e2e` | extend `src/shell/command-palette.spec.ts` | `ArrowDown` moves `aria-activedescendant` and the referenced row is `aria-selected`; `Enter` navigates; `Esc` returns focus to the search trigger; `⌘K` inside the Members search box does **not** open the palette | `♿ A11Y-shell-admin-05`, `🐞 BUG-shell-admin-02` |
| 9 | `apps/admin-e2e` | `src/shell/sidebar-context.spec.ts` | Entering a workspace swaps the sidebar's middle region; leaving it restores the global nav; navigating workspace→workspace never falls back to the global nav | F12 ⚠️, `🐞 BUG-shell-admin-05` |
| 10 | package unit (`jest`, node env) | `packages/utils/admin/src/lib/slot/index.spec.ts` | `_register` de-duplicates by id; `getItems()` returns a copy a caller cannot corrupt | `🐞 BUG-shell-admin-04` |
| 11 | `apps/admin-e2e` | `src/home/dashboard.spec.ts` — extra case with no contributed sections | An empty state renders instead of a bare greeting | `🐞 BUG-shell-admin-08` |
| 12 | `apps/admin-e2e` (new project, see design-system §7) | the shell's `a11y.spec.ts` under `colorScheme:'dark'` | The sidebar's `bg-sidebar` surfaces and the accent `text-nav-*` icons clear AA in dark mode | `♿ A11Y-design-system-06` |
