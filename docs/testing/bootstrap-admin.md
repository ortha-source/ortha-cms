# @ortha-cms/bootstrap-admin — Test Artifact

> **Unit:** `packages/bootstrap/admin` · **Package:** `@ortha-cms/bootstrap-admin` · **Kind:** host
> **Source of truth:** `packages/bootstrap/admin/AGENTS.md`
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns.** The one-time mount and shell of the admin SPA — everything in
`createAdmin({ plugins })` (`src/lib/createAdmin/index.tsx:42-107`):

- `ReactDOM.createRoot` on `#root` and the `<StrictMode>` wrapper;
- the provider stack, in this exact nesting order: `AppearanceProvider` →
  `QueryClientProvider` → `IntlProvider` → `TooltipProvider` → `BrowserRouter` →
  `UnsavedChangesGuard` → `<Routes>`, with `<Toaster>` a sibling of `BrowserRouter`;
- **plugin assembly** — flattening `routes`, splitting them by `public`, picking the first
  contributed `layout`, wiring every `slots` contribution before render, and the `*`
  catch-all redirect;
- the app-wide unsaved-changes confirm dialog and its copy
  (`src/lib/UnsavedChangesGuard/index.tsx`);
- the plugin contract types (`src/lib/types/adminPlugin/index.ts`).

**Does NOT own.** Anything auth — no `RequireAuth`, no auth context, no `signInPath`
(`AGENTS.md`: "The host is **auth-agnostic**"). No chrome (the shell contributes it as a
`layout`). No concrete slot. No `apiClient`/`queryClient` *definition* (those live in
`@ortha-cms/utils-admin`; the host only imports `queryClient` to mount the provider). No
global styles (imported by `apps/admin/src/main.tsx:14`). No page, no data hook.

**Entry points**

| Export | Signature | Where |
| --- | --- | --- |
| `createAdmin(options)` | `(CreateAdminOptions) => void` | `src/lib/createAdmin/index.tsx:42` |
| `AdminPlugin` | `{ name, routes?, layout?, slots? }` | `src/lib/types/adminPlugin/index.ts:25` |
| `RouteItem` | `{ path, element, public? }` | `src/lib/types/adminPlugin/index.ts:5` |
| `CreateAdminOptions` | `{ plugins, rootElement?, locale? }` | `src/lib/types/adminPlugin/index.ts:46` |

`UnsavedChangesGuard` is internal (not in `src/index.ts:1-6`).

**Routes the host itself defines**

| Path | Element | Where |
| --- | --- | --- |
| each `public: true` plugin route | top-level sibling | `createAdmin/index.tsx:76-82` |
| each other plugin route | child of the pathless `layout` route | `:84-90` |
| `*` | `<Navigate to="/" replace />`, **inside** the layout group | `:91-96` |

**Runtime prerequisites**

- A DOM element with `id="root"` (`apps/admin/index.html:38`), overridable via
  `rootElement`.
- At least one plugin contributing a `layout` — otherwise private routes render under a bare
  `<Outlet/>` and are **ungated** (`AGENTS.md`: "a `public:false` route with no gating
  `layout` renders **ungated** (fail-open)").
- The API reachable at `/api` (same origin — the Vite dev proxy,
  `apps/admin/vite.config.mts:20-26`).

**How to exercise it manually**

```bash
docker compose up -d && npx nx run server:db:migrate
npm run dev                      # admin on http://localhost:4200
open http://localhost:4200/identity/signin     # a public route
open http://localhost:4200/                     # a private route (redirects if signed out)
open http://localhost:4200/this-does-not-exist  # catch-all → /
npx nx e2e admin-e2e -- --project=chromium src/auth/routing.spec.ts src/auth/private-routes.spec.ts
```

**Dependencies.** `react` 19, `react-dom` 19, `react-router-dom` **pinned 6.30.3**
(`package.json:44` — the `UnsavedChangesGuard` depends on `BrowserRouter`'s history
behaviour), `react-intl` ^7, `@tanstack/react-query` ^5,
`@ortha-cms/design-system` (`AppearanceProvider`, `TooltipProvider`, `Toaster`,
`ConfirmDialog`), `@ortha-cms/utils-admin` (`queryClient`, `UnsavedChangesProvider`,
`SlotContribution`).

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | Mount the React root on `rootElement` (default `'root'`) inside `<StrictMode>` | `createAdmin/index.tsx:63-68` | ✅ E2E |
| F2 | Flatten every plugin's `routes` into one list | `createAdmin/index.tsx:45` | ✅ E2E |
| F3 | Split routes by `public` — public as top-level siblings | `createAdmin/index.tsx:46,76-82` | ✅ E2E |
| F4 | Mount non-public routes under one pathless parent rendering the contributed `layout` | `createAdmin/index.tsx:83-90` | ✅ E2E |
| F5 | Pick the **first** plugin-provided `layout`, falling back to a bare `<Outlet/>` | `createAdmin/index.tsx:59-61` | ⚠️ PARTIAL |
| F6 | `*` catch-all redirects to `/` with `replace`, from **inside** the layout group | `createAdmin/index.tsx:91-96` | ✅ E2E |
| F7 | Wire every plugin's slot contributions before render | `createAdmin/index.tsx:51-55` | ✅ E2E |
| F8 | Provide the single `QueryClientProvider` from `utils-admin`'s `queryClient` | `createAdmin/index.tsx:70` | ✅ E2E |
| F9 | Provide the single `IntlProvider` (`locale` default `'en'`, `defaultLocale="en"`, no catalogue) | `createAdmin/index.tsx:71` | ⚠️ PARTIAL |
| F10 | Provide `AppearanceProvider` (theme) as the outermost provider | `createAdmin/index.tsx:69` | ✅ E2E |
| F11 | Provide `TooltipProvider` with `delayDuration={200}` | `createAdmin/index.tsx:72` | ⚠️ PARTIAL |
| F12 | Mount `<Toaster position="bottom-right">` outside the router | `createAdmin/index.tsx:101` | ⚠️ PARTIAL |
| F13 | Mount the app-wide unsaved-changes guard around `<Routes>` | `createAdmin/index.tsx:74-99` | ⚠️ PARTIAL |
| F14 | Bind the guard's dialog to `ConfirmDialog` with four localized strings and a destructive confirm | `UnsavedChangesGuard/index.tsx:34-54` | ⚠️ PARTIAL |
| F15 | `AdminPlugin` / `RouteItem` / `CreateAdminOptions` contract | `types/adminPlugin/index.ts:5-53` | ⚠️ PARTIAL |

## 3. Manual Test Plan

Every block carries a **keyboard-only path** and a **screen-reader expectation**, per the
project's WCAG 2.1 AA target. SR expectations were written against NVDA/Firefox and
VoiceOver/Safari behaviour for the DOM the code produces.

### F1 — Root mount

**Preconditions:** `npm run dev`, browser at `http://localhost:4200`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Load `/` signed out | The sign-in page renders inside `#root` |
| 2 | DevTools → Elements | `<div id="root">` has children; `<body>` has no other app content |
| 3 | Edit `apps/admin/index.html:38` to `id="app"` and reload | **Blank page**; console shows `createRoot(...): Target container is not a DOM element` — the `as HTMLElement` cast at `createAdmin/index.tsx:64` hides the null. See `🐞 BUG-bootstrap-admin-04` |
| 4 | Restore `id="root"` | Renders again |

**Keyboard path:** `Tab` from the address bar — first stop is the browser's own chrome, then
the first focusable element in `#root`. On a **public** route that is the page's first input;
on a **private** route it is the shell's "Skip to main content" link
(`packages/shell/admin/src/lib/components/AppShell/index.tsx:49-54`).
**Screen reader:** on load the document title is announced as **"Admin"** — on every route,
because nothing updates it. See `♿ A11Y-bootstrap-admin-01`.

### F2 / F3 / F4 — Route assembly and the public/private split

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Signed out, go to `/identity/signin` | The sign-in page renders with **no** sidebar — it is a public sibling, outside the layout |
| 2 | Signed out, go to `/` | Redirected to `/identity/signin` — the layout's gate, not the host |
| 3 | Sign in, go to `/` | The home page renders **inside** the shell (sidebar visible) |
| 4 | Signed in, go to `/users` | Members page inside the same shell — one layout instance, not remounted |
| 5 | Navigate `/users` → `/workspaces` via the sidebar and watch the DOM | The `<main id="main-content">` element is **not** replaced; only its children swap |

**Keyboard path:** from the sidebar, `Tab` to a nav link and press `Enter`. The route
changes.
**Screen reader:** after step 5 nothing is announced — focus remains on the nav link that was
activated, the heading is not read, and the title is unchanged. A screen-reader user has no
signal that the page changed. See `♿ A11Y-bootstrap-admin-02`.

### F5 — First layout wins

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | In `apps/admin/src/main.tsx:17-47`, note `IdentityPlugin()` is registered before `ShellPlugin()` | Identity contributes **no** `layout`, so `find(Boolean)` picks the shell's |
| 2 | Add a temporary plugin with `layout: <div>hijacked<Outlet/></div>` **before** `ShellPlugin()`; sign in and load `/` | The home page renders inside `hijacked` with **no auth gate** — the shell's `RequireAuth` never mounts. No warning is logged. See `🐞 BUG-bootstrap-admin-01` |
| 3 | Remove every `layout` from every plugin; load `/` signed out | The home page renders **ungated** under a bare `<Outlet/>` |

**Keyboard path:** in step 2, `Tab` order starts inside `hijacked` — no skip link exists,
so a keyboard user tabs through whatever that layout renders.
**Screen reader:** no landmark structure at all in step 3 (`<main>` lives in the shell), so
the page is one undifferentiated region.

### F6 — Catch-all

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Signed in, `GET /this-route-does-not-exist` | URL becomes `/` and the home page renders (`apps/admin-e2e/src/auth/routing.spec.ts:23-29`) |
| 2 | Press browser **Back** | You land on the page *before* the bad URL — the bad entry was `replace`d away |
| 3 | Signed out, `/this-route-does-not-exist` | Redirected to `/identity/signin` — the catch-all is inside the gated group (`apps/admin-e2e/src/auth/private-routes.spec.ts:33-42`) |
| 4 | Signed in, mistype a deep link: `/workspaces/<id>/contentt` | Silently lands on `/` — **no** "page not found" message anywhere. See `🐞 BUG-bootstrap-admin-02` |

**Keyboard path:** unaffected — the redirect is automatic.
**Screen reader:** the redirect is silent. Nothing announces "not found" or "navigated to
home"; the user simply finds themselves somewhere else with the same title.

### F7 — Slot wiring

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Sign in; look at the sidebar | Nav entries contributed by workspaces, users, activity and api-tokens are all present |
| 2 | Remove `ActivityPlugin()` from `apps/admin/src/main.tsx:45` and reload | The Activity nav entry disappears; nothing else breaks |
| 3 | Register the same plugin twice in `main.tsx` | Its nav entries appear **twice** — `_register` is a bare `push` with no de-duplication (`packages/utils/admin/src/lib/slot/index.ts:36`). React logs duplicate-key warnings |
| 4 | Add a plugin whose factory throws (`() => { throw new Error('x') }`) | **Blank page** — the throw happens at module scope in `main.tsx`, before `createAdmin` is even called, and there is no boundary. See `🐞 BUG-bootstrap-admin-03` |

**Keyboard path:** step 3's duplicate nav entries both receive focus, so `Tab` visits the
same destination twice.
**Screen reader:** the nav landmark announces the duplicated item count, e.g. "list, 12
items" where 10 were expected.

### F8 — One QueryClient

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open the Members page, then Workspaces, then Members again within 60 s | The second Members visit renders from cache — one shared client |
| 2 | React Query devtools (if enabled) or Network tab | Exactly one client; keys from every plugin coexist |
| 3 | Suspend a query by going offline and clicking a nav item | The page shows an error state, **not** a permanently empty one — see `docs/testing/utils-admin.md` `🐞 BUG-utils-admin-02` for the retry consequences |

### F9 — IntlProvider

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Default boot | Every string renders from its `defaultMessage`; console is clean (`locale === defaultLocale === 'en'`, so react-intl suppresses missing-translation errors) |
| 2 | Change `apps/admin/src/main.tsx` to `createAdmin({ plugins, locale: 'de' })` and reload | Strings are **still English** (no catalogue is passed at `createAdmin/index.tsx:71`), but numbers and dates now format as German, and the console fills with react-intl `MISSING_TRANSLATION` errors — no `onError` is configured |
| 3 | With `locale: 'de'`, inspect `<html>` | Still `lang="en"` (`apps/admin/index.html:2`) — the host never syncs it. See `♿ A11Y-bootstrap-admin-03` |
| 4 | Restore `locale` to default | Console clean again |

**Screen reader:** in step 2/3 the SR pronounces English text with German rules (or vice
versa) because `lang` and the actual content language disagree.

### F10 / F11 — Appearance and tooltips

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Set the OS to dark mode with the app theme on "System"; reload | The app paints dark with **no** flash of light — the pre-paint script at `apps/admin/index.html:11-35` runs before React, and `AppearanceProvider` takes over on mount |
| 2 | Switch the theme in Preferences to Light, reload | Light, no flash; `localStorage['ortha.theme'] === 'light'` |
| 3 | Corrupt `localStorage['ortha.theme']` to `'purple'` and reload | Falls back to `'system'` (`index.html:19-24`) — no crash |
| 4 | Hover a sidebar icon | The tooltip appears after ~200 ms (`createAdmin/index.tsx:72`) |
| 5 | `Tab` to the same control **without** hovering | The tooltip appears on focus |

**Keyboard path:** step 5 is the WCAG 1.4.13 case — the tooltip must be dismissible with
`Esc` and must not disappear when the pointer moves onto it.
**Screen reader:** Radix wires the tooltip as the control's description, so the name plus
tooltip text is announced on focus.

### F12 — Toaster

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Perform any action that toasts (e.g. save a workspace) | A toast appears — check the corner it appears in |
| 2 | Compare with the design system's documented position | `packages/design-system/src/lib/components/ui/sonner.tsx:19` says "pinned to the **top-right**", but `{...props}` is spread last (`:66`), so the host's `position="bottom-right"` (`createAdmin/index.tsx:101`) wins. See `🐞 BUG-bootstrap-admin-05` |
| 3 | Open the copilot dock (`⌘J`) and trigger a toast | Both occupy the bottom-right; check for overlap |
| 4 | Click the toast body | It dismisses (`sonner.tsx:35-37`) |

**Keyboard path:** the toast's close button is focusable; `Tab` reaches it while the toast is
visible, and `Enter` dismisses. There is **no** keyboard equivalent for the click-the-body
shortcut — acceptable, since the close button provides the path.
**Screen reader:** Sonner's live region is mounted at app start (the `<Toaster>` renders on
every render), so it is in the DOM **before** any message is injected — the precondition for
`4.1.3` announcement. The message is announced politely without stealing focus. See
`♿ A11Y-bootstrap-admin-05`.

### F13 / F14 — Unsaved-changes guard

**Preconditions:** signed in; open a content entry and edit a field so the form is dirty.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Click a sidebar link | A dialog appears: title **"Discard your unsaved changes?"**, body "You have edits on this page that haven't been saved. Leaving now loses them.", buttons **"Leave and discard"** (destructive) and **"Keep editing"** (`UnsavedChangesGuard/index.tsx:8-23`) |
| 2 | Press `Esc` / click "Keep editing" | The dialog closes and you stay on the entry; the edits are intact |
| 3 | Click "Leave and discard" | Navigation proceeds to the clicked destination |
| 4 | After step 3, press browser **Back** twice | Verify the history is sane — the confirmed navigation is re-dispatched via a manual `pushState` + synthetic `popstate` (`packages/utils/admin/src/lib/unsavedChanges/index.tsx:150-151`), which does not write React Router's `idx` state. See `docs/testing/utils-admin.md` `🐞 BUG-utils-admin-04` |
| 5 | With the form dirty, press `⌘R` / `F5` | The **browser's native** "Leave site?" prompt appears (custom copy is impossible) |
| 6 | With the form dirty, `⌘`-click a sidebar link | Opens in a new tab with **no** prompt — a modified click discards nothing (`unsavedChanges/index.tsx:118-125`) |
| 7 | With the form dirty, focus the shell's skip link and press `Enter` | **No** prompt — `href` starting with `#` is exempt (`:130`). Correct |
| 8 | Open a second dirty form (e.g. the copilot composer) alongside the entry, confirm leaving the entry, then try to navigate away again | The second form is now **unguarded** — `onConfirm` clears every dirty key (`:189`). See `docs/testing/utils-admin.md` `🐞 BUG-utils-admin-03` |

**Keyboard path:** the dialog traps focus (Radix). `Tab` cycles Cancel → Confirm → close;
`Esc` cancels; on close, focus returns to the anchor that was clicked. Verify the focus
**does** return — the click was `preventDefault`ed, so the anchor never lost focus in the
first place.
**Screen reader:** the dialog is announced as a dialog with its title and description
(`ConfirmDialog` wires `aria-labelledby`/`aria-describedby`). The destructive confirm is
announced by its label "Leave and discard", which states the consequence — satisfying 3.3.4.

### F15 — Contract surface

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `import type { AdminPlugin } from '@ortha-cms/bootstrap-admin'` and construct `{ name: 'x' }` | Type-checks — `routes`, `layout` and `slots` are all optional |
| 2 | Construct a `RouteItem` with no `path` | Type error |
| 3 | Compare the type with `AGENTS.md` "Key exports" | The doc says `{ name, routes?, layout? }` and omits `slots?` — the type (`types/adminPlugin/index.ts:42`) has it. Doc drift |

## 4. Edge Cases & Negative Paths

**Plugin assembly**

- **EC-01 — Empty plugin list.** `❌ NONE` `createAdmin({ plugins: [] })` mounts a router
  with only the `*` route under a bare `<Outlet/>`; every URL redirects to `/` and renders
  nothing. `AGENTS.md` says "with no plugins it serves a blank shell" — accurate.
- **EC-02 — Two plugins contributing the same `path`.** `❌ NONE`
  `key={route.path}` (`createAdmin/index.tsx:78,86`) collides → React duplicate-key warning,
  and React Router silently picks one. No error, no ordering rule.
- **EC-03 — Two plugins contributing a `layout`.** `❌ NONE` `find(Boolean)` takes the first
  and discards the rest **silently** (`:59`). → `🐞 BUG-bootstrap-admin-01`.
- **EC-04 — A plugin marks a sensitive route `public: true`.** `❌ NONE` 🔒 It mounts as a
  top-level sibling, outside the layout and therefore outside the gate. The host attaches no
  meaning to the flag by design (`AGENTS.md`), so nothing catches this — the server guard is
  the real boundary (`.cursor/BUGBOT.md`, "Permission gating only in the UI"), but the page
  itself would render.
- **EC-05 — A plugin factory throws.** `❌ NONE` It throws in `main.tsx` at module scope,
  before `createAdmin`. Blank page. → `🐞 BUG-bootstrap-admin-03`.
- **EC-06 — A route `element` throws on render.** `❌ NONE` No `ErrorBoundary` anywhere in
  the host — a repo-wide grep for `componentDidCatch`/`getDerivedStateFromError` finds
  exactly one, `packages/insights/admin/src/lib/presentation/components/WidgetBoundary/index.tsx:32`,
  scoped to a single insights widget. A throw in any other route unmounts the whole tree.
  → `🐞 BUG-bootstrap-admin-03`.
- **EC-07 — A lazy route's chunk fails to load** (stale deploy, network drop). `❌ NONE`
  Same as EC-06 — no boundary and no `<Suspense>` fallback at the host, so the rejection
  blanks the app.
- **EC-08 — A `slots` contribution with a duplicate item id.** `❌ NONE` Appended, rendered
  twice. Note the insights plugin implements its own last-wins merge by id
  (`apps/admin/src/main.tsx:21-26`) precisely because the slot primitive does not.
- **EC-09 — Slot registration under Vite HMR.** `❌ NONE` A hot update that re-executes
  `main.tsx` calls `_register` again against the same module-level arrays, doubling every
  contribution until a full reload. `createSlot` has no reset.
- **EC-10 — Slot registration and `StrictMode`.** `❌ NONE` Safe — the loop at `:51-55` runs
  *outside* render, so React 19's double-invocation does not double-register.

**Routing**

- **EC-11 — A public route path that also matches a private one.** `❌ NONE` Public routes are
  siblings and are matched by React Router's ranking, not by declaration order, so which wins
  depends on specificity. Not documented.
- **EC-12 — Deep link to a private route while signed out.** `✅ E2E`
  `apps/admin-e2e/src/auth/private-routes.spec.ts:22-31,44-61` — redirected to sign-in and
  returned afterwards.
- **EC-13 — Unknown path while signed out.** `✅ E2E` `private-routes.spec.ts:33-42`.
- **EC-14 — Unknown path while signed in.** `✅ E2E` `routing.spec.ts:23-29`.
- **EC-15 — A genuine 404 has no page.** `❌ NONE` `*` unconditionally redirects to `/`
  (`createAdmin/index.tsx:91-96`), so a mistyped or dead deep link is indistinguishable from
  "go home". → `🐞 BUG-bootstrap-admin-02`.
- **EC-16 — Hard refresh on a deep private URL in production.** `❌ NONE` Requires an SPA
  fallback from whatever serves `dist/`; `vite.config.mts` configures none for a static
  host. `vite preview` supplies one, so this only bites a real deployment.
- **EC-17 — Back button after the catch-all redirect.** `⚠️ PARTIAL` `replace` keeps history
  clean; asserted only indirectly by the URL assertion in `routing.spec.ts:27`.

**Providers**

- **EC-18 — `Toaster` outside `BrowserRouter`.** `❌ NONE` `createAdmin/index.tsx:101` places
  it as a sibling of the router. A toast whose action renders a react-router `<Link>` throws
  `useHref() may be used only in the context of a <Router>`.
- **EC-19 — `locale` other than `'en'`.** `❌ NONE` Accepted by the type
  (`types/adminPlugin/index.ts:51`) but no catalogue is ever passed, so it changes
  number/date formatting without changing any string, and floods the console.
- **EC-20 — `IntlProvider` has no `onError`.** `❌ NONE` Every missing translation logs at
  error level; there is no way for the host to downgrade or collect them.
- **EC-21 — A plugin renders `useIntl()` outside the provider.** `❌ NONE` Only possible for
  the `Toaster` subtree, which is inside `IntlProvider` — so not reachable today.
- **EC-22 — `queryClient` is a module singleton.** `❌ NONE` Correct for a client-only SPA
  (`packages/utils/admin/src/lib/queryClient/index.ts:3-8`), but it means two `createAdmin`
  calls in one page share one cache.

**Unsaved-changes guard** *(mechanism lives in `utils-admin`; host-observable behaviour here)*

- **EC-23 — Confirming a navigation clears every form's dirty state.** `❌ NONE`
  → `docs/testing/utils-admin.md` `🐞 BUG-utils-admin-03`.
- **EC-24 — History bookkeeping after a confirmed navigation.** `❌ NONE`
  → `docs/testing/utils-admin.md` `🐞 BUG-utils-admin-04`.
- **EC-25 — Guard active on a `public` route.** `❌ NONE` `UnsavedChangesGuard` wraps
  **all** routes (`createAdmin/index.tsx:74-99`), including sign-in. Harmless (nothing there
  registers dirtiness) but the blast radius of a bug in it covers unauthenticated pages too.
- **EC-26 — Dialog rendered even when never used.** `❌ NONE` `dialog(...)` is invoked on
  every provider render with `open: false` (`unsavedChanges/index.tsx:179-192`), so a Radix
  dialog instance exists for the whole session.

**State after mutation / stale cache**

- **EC-27 — Signing out then in as a different user.** `❌ NONE` The `queryClient` singleton
  survives; unless identity clears it, the second user can briefly see the first's cached
  lists. The host does not clear the cache on the 401 handler.
- **EC-28 — Slots are boot-frozen.** `❌ NONE` Documented (`ARCHITECTURE.md` §6: "Slots are
  wired once at boot"), so a permission-dependent nav item must gate at render, not at
  registration. A plugin that filtered its `items` by permission at factory time would bake
  in the *first* user's permissions for the session.

### 4A. Accessibility & Section 508 Conformance

**Standards.** Tested to **WCAG 2.1 AA** (the target of `.agents/skills/accessibility/SKILL.md`),
with the corresponding Revised Section 508 provision cited alongside — 36 CFR Part 1194
Appendices A–C incorporate WCAG 2.0 A + AA by reference (**E205.4** for electronic content,
**504.2** for authoring tools). Chapter 5 software provisions assessed where they apply:
**502.2/502.3** (AT interoperability — name, role, state, value, and exposure of
programmatic changes), **503.2** (respect platform/user preferences), **504** (authoring
tools). WCAG 2.2 items are flagged **advisory only**, since 508 references 2.0.

**On automated scanning.** `apps/admin-e2e/src/support/fixtures.ts:110-115` builds axe with
`withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa'])` and
`apps/admin-e2e/src/support/a11y.ts:12-23` asserts zero violations. Two things to record:
(a) **no axe rule is disabled anywhere** — `disableRules`/`exclude` appear nowhere in
`apps/admin-e2e/src`, so there is no invisible non-conformance from suppression, which is
good; (b) axe suites exist for only six areas (auth, content, copilot, insights, users,
workspaces) and none of them scans a **host-level** concern. The harness's own comment says
it best (`a11y.ts:9-10`): "a green result is a regression guard, not a conformance claim."
Nothing axe does can detect this host's actual failures — a static document title, absent
route-change focus management, and an unannounced crash state are all invisible to it.

#### ♿ A11Y-bootstrap-admin-01 — The document title never changes, so every route in the SPA is titled "Admin"

- **WCAG:** `2.4.2 Page Titled (A)` · **508:** `E205.4` (and `502.3.1 Object Information`)
- **Verdict:** **Does Not Support**
- **Location:** `apps/admin/index.html:5` (`<title>Admin</title>`), and the absence of any
  writer — a repo-wide grep for `document.title` finds exactly one hit,
  `packages/copilot/admin/src/lib/application/useTabBadge.ts:34-36`, which *reads* the
  current title as a base and appends an unread-count badge. `createAdmin` sets no title and
  provides no hook for a route to set one.

**Repro:** sign in; visit `/`, `/users`, `/workspaces`, `/workspaces/:id/content/article`,
`/workspaces/:id/agents`; read the browser tab or press `Ctrl+Alt+T` (NVDA "read title") on
each.
**Keyboard-only user:** unaffected directly — but with a dozen tabs open, every Ortha tab is
labelled identically, so returning to the right one requires clicking through.
**Screen-reader user:** on every client-side navigation the title is the only thing most
screen readers will re-announce automatically for a page change, and here it never changes.
Combined with `♿ A11Y-bootstrap-admin-02` (no focus move) the result is that **no page change
in the entire admin is announced**. This is the single highest-impact a11y defect in the
host.
**Remediation:** have `createAdmin` render a title component that sets `document.title` from
the matched route (or expose a `title` on `RouteItem` and set it in a route-change effect),
so each route gets a unique, front-loaded title.

#### ♿ A11Y-bootstrap-admin-02 — Client-side navigation moves neither focus nor announcement

- **WCAG:** `2.4.3 Focus Order (A)`, `4.1.3 Status Messages (AA)` · **508:** `E205.4`, `502.3.9 Modification of Focus Cursor`
- **Verdict:** **Does Not Support**
- **Location:** `packages/bootstrap/admin/src/lib/createAdmin/index.tsx:75-98` — `<Routes>`
  swaps the matched element with no `useEffect` on `location`, no focus call, and no live
  region. Nothing in the shell layout does it either
  (`packages/shell/admin/src/lib/components/AppShell/index.tsx:42-66`).

**Repro:** sign in, `Tab` to a sidebar nav link, press `Enter`, then press `Tab` once more.
**Keyboard-only user:** focus stays on the activated nav link, so the next `Tab` continues
through the *sidebar*, not the new page — reaching the new content means tabbing past the
entire sidebar again on every navigation.
**Screen-reader user:** nothing at all is spoken. The virtual cursor stays where it was, the
title is unchanged (`♿ A11Y-bootstrap-admin-01`), and there is no polite live region
announcing the new view. The user must manually probe (heading navigation, landmark
navigation) to discover that anything happened. This is the archetypal SPA 508 failure.
**Remediation:** on each `location.pathname` change, either move focus to the route's `<h1>`
(or to the `<main tabIndex={-1}>` the shell already provides at `AppShell/index.tsx:56`) or
mount a visually-hidden `aria-live="polite"` route announcer at the host that speaks the new
page's name. Focus-to-heading is preferable because it fixes the keyboard problem too.

#### ♿ A11Y-bootstrap-admin-03 — `<html lang>` is hard-coded to `en` and does not track `createAdmin`'s `locale`

- **WCAG:** `3.1.1 Language of Page (A)` (and `3.1.2 Language of Parts (AA)` once mixed content exists) · **508:** `E205.4`
- **Verdict:** **Partially Supports** — correct today because `locale` defaults to `'en'`
  (`types/adminPlugin/index.ts:51`), broken the moment the option is used.
- **Location:** `apps/admin/index.html:2` (`<html lang="en">`) versus
  `packages/bootstrap/admin/src/lib/createAdmin/index.tsx:43,71` — `locale` is threaded into
  `IntlProvider` and nowhere else. The repo's own a11y guidance calls this out:
  "**Set `<html lang>`** to the active locale (it should track the host `IntlProvider`;
  WCAG 3.1.1)" (`.agents/skills/accessibility/SKILL.md:124-126`).

**Repro:** set `createAdmin({ plugins, locale: 'de' })`, reload, inspect `<html>`.
**Keyboard-only user:** no impact.
**Screen-reader user:** the SR selects its speech synthesizer and pronunciation rules from
`lang`. With `lang="en"` and German content the output is unintelligible; with `lang="en"`
and English content that merely *formats* dates/numbers as German (which is what happens
today, since no catalogue is loaded) the user hears English text with German-formatted
values and no signal of the mismatch.
**Remediation:** in `createAdmin`, set `document.documentElement.lang = locale` before
render, and keep it in sync if the locale ever becomes dynamic.

#### ♿ A11Y-bootstrap-admin-04 — A render crash produces a silent, empty, unfocusable page

- **WCAG:** `4.1.3 Status Messages (AA)`, `1.3.1 Info and Relationships (A)`, `3.3.1 Error Identification (A)` · **508:** `E205.4`, `502.2.2 No Disruption of Accessibility Features`
- **Verdict:** **Does Not Support**
- **Location:** `packages/bootstrap/admin/src/lib/createAdmin/index.tsx:67-107` — the tree is
  mounted with no error boundary. The only boundary in the whole admin is
  `packages/insights/admin/src/lib/presentation/components/WidgetBoundary/index.tsx:32`,
  which is per-widget. Cross-reference `🐞 BUG-bootstrap-admin-03` — this is the a11y face of
  the same defect.

**Repro:** make any route element throw during render (e.g. read a property of an undefined
API response).
**Keyboard-only user:** `#root` becomes empty. There is nothing to `Tab` to and no way back
except editing the URL; the browser's Back button works only if the previous route does not
crash too.
**Screen-reader user:** worse — the content the user was reading vanishes with no
announcement. Most screen readers keep their virtual buffer until the next interaction, so
the user continues reading text that no longer exists, then hits "blank" with no
explanation.
**Remediation:** wrap the routed tree in an error boundary whose fallback renders a real
`<h1>`, an explanation, and a focusable "Reload" control, and move focus to the heading when
it mounts.

#### ♿ A11Y-bootstrap-admin-05 — Toast live region is correctly pre-mounted, but the host relocates toasts to the bottom-right

- **WCAG:** `4.1.3 Status Messages (AA)`, `1.4.13 Content on Hover or Focus (AA)` (advisory: `2.4.11 Focus Not Obscured (AA, WCAG 2.2)`) · **508:** `E205.4`
- **Verdict:** **Supports** for announcement; **Partially Supports** for the visual placement
- **Location:** `packages/bootstrap/admin/src/lib/createAdmin/index.tsx:101` mounts
  `<Toaster position="bottom-right" />` unconditionally, so Sonner's `aria-live` region
  exists in the DOM from first paint — **before** any message is injected, which is the
  precondition for a live region to announce at all. That part is right and worth pinning
  with a test.

The placement is the concern: `packages/design-system/src/lib/components/ui/sonner.tsx:19`
documents the host as "pinned to the **top-right**", and `{...props}` is spread last
(`:66`), so the host's `bottom-right` silently overrides it. The copilot dock also lives
bottom-right (`CONTEXT-MAP.md`, copilot/admin row), so a toast can cover the dock's controls
or vice versa.
**Repro:** open the copilot dock with `⌘J`, then trigger a toast from a save action.
**Keyboard-only user:** if a toast overlays a focusable dock control, focus can land on an
obscured element — the WCAG 2.2 `2.4.11` case, advisory here.
**Screen-reader user:** unaffected; the announcement is positional-independent.
**Remediation:** settle the position in one place (either remove the host's `position` prop
or update the design-system JSDoc), and ensure the toast stack and the dock cannot occupy
the same corner.

#### ♿ A11Y-bootstrap-admin-06 — No `forced-colors` / Windows High Contrast support anywhere in the token layer

- **WCAG:** `1.4.3 Contrast (Minimum) (AA)`, `1.4.11 Non-text Contrast (AA)` · **508:** `503.2 User Preferences`
- **Verdict:** **Partially Supports**
- **Location:** a repo-wide grep for `forced-colors` returns **zero** hits across
  `apps/` and `packages/`. `prefers-reduced-motion` **is** handled —
  `packages/design-system/src/styles.css:74,98` plus `motion-reduce:` utilities in a dozen
  components — so the omission is specifically the forced-colors axis.

**Repro:** enable Windows High Contrast (or Firefox `browser.display.document_color_use=2`)
and load the admin.
**Keyboard-only user:** focus rings drawn with `ring-*` tokens may be replaced by the forced
palette in ways that reduce or eliminate the visible indicator (2.4.7).
**Screen-reader user:** unaffected.
**Remediation:** add a `@media (forced-colors: active)` block to the design-system token
layer that restores borders/focus rings with `Highlight`/`CanvasText` system colors, and add
a forced-colors pass to the a11y suites.

#### ♿ A11Y-bootstrap-admin-07 — Bypass Blocks depends entirely on the contributed layout, and has no test

- **WCAG:** `2.4.1 Bypass Blocks (A)` · **508:** `E205.4`
- **Verdict:** **Supports** on private routes; **Not Applicable** on public routes
- **Location:** the skip link is **not** in the host — it is contributed by the shell at
  `packages/shell/admin/src/lib/components/AppShell/index.tsx:49-56`, targeting
  `<SidebarInset id="main-content" tabIndex={-1}>`. So it exists for every route that renders
  under the shell's `layout`, and vanishes for any private route mounted under a different
  first-registered layout (see `🐞 BUG-bootstrap-admin-01`).

Two gaps worth recording rather than a defect: (1) `packages/utils/admin/src/lib/unsavedChanges/index.tsx:130`
exempts `href` values starting with `#`, so the guard correctly does **not** intercept the
skip link — verified by reading; (2) **no e2e asserts the skip link at all** — a grep of
`apps/admin-e2e/src` for `Skip to main` / `main-content` returns nothing, so the only
bypass-blocks mechanism in the product is unprotected against regression.
**Repro:** sign in, press `Tab` once from a fresh page load, confirm a visible "Skip to main
content" control appears, press `Enter`, then press `Tab` again and confirm the next stop is
inside `<main>` rather than in the sidebar.
**Remediation:** add that exact sequence to `apps/admin-e2e/src/auth/keyboard.spec.ts`.

**Remaining WCAG 2.1 AA checklist at the host layer** (items the host either satisfies or
delegates):

| SC | Verdict at this layer | Note |
| --- | --- | --- |
| 1.1.1 Non-text Content (A) | Not Applicable | The host renders no images |
| 1.3.1 Info & Relationships (A) | Partially Supports | Landmarks come from the shell layout; a host with no layout produces none (EC-03) |
| 1.3.2 Meaningful Sequence (A) | Supports | DOM order is route order; no CSS reordering at this layer |
| 1.3.5 Identify Input Purpose (AA) | Not Applicable | No inputs |
| 1.4.1 Use of Colour (A) | Not Applicable | |
| 1.4.3 / 1.4.11 Contrast (AA) | Partially Supports | Tokens are the design system's; `SKILL.md:114-119` records `muted-foreground` was darkened to clear AA and that axe enforces `color-contrast`. **Both themes** must be re-verified after any token change; the axe suites run in whatever theme the test defaults to, which is not both |
| 1.4.4 Resize Text (AA) / 1.4.10 Reflow (AA) / 1.4.12 Text Spacing (AA) | Partially Supports | Not exercised by any suite; the shell's fixed sidebar + `SidebarInset` scrollport is the risk area at 320 px / 400 % |
| 1.4.13 Content on Hover/Focus (AA) | Supports | `TooltipProvider` (Radix) is dismissible, hoverable and persistent (`createAdmin/index.tsx:72`) |
| 2.1.1 Keyboard (A) | Supports | No host-level custom control |
| 2.1.2 No Keyboard Trap (A) | Supports | The only host overlay is the Radix confirm dialog, which traps and releases correctly |
| 2.4.6 Headings & Labels (AA) | Not Applicable | Delegated to pages |
| 2.4.7 Focus Visible (AA) | **Partially Supports** | See `docs/testing/app-admin.md` `♿ A11Y-app-admin-02` — the app-wide scroll container is focusable with its outline removed |
| 3.2.1 / 3.2.2 On Focus / On Input (A) | Supports at this layer | But the catch-all redirect (`♿`/`🐞 BUG-bootstrap-admin-02`) is an unannounced change of context on *navigation*, not on focus/input, so it falls outside these SC while still being a usability failure |
| 3.3.1–3.3.4 (A/AA) | Supports | The unsaved-changes confirm satisfies 3.3.4 for destructive navigation, with a label that states the consequence |
| 4.1.2 Name, Role, Value (A) | Not Applicable | No host-level custom control |

**508 Chapter 5 — Authoring Tools (504).** The host is part of the authoring path (it mounts
the editor's route tree) but implements none of the authoring behaviour, so:
**504.2** (a mode that lets an author produce conformant content) — **Not Applicable** here;
assessed in `content/admin` and `wysiwyg/admin`. **504.2.1** (accessibility information
preserved across save/reload) — **Not Applicable** here. **504.3** (prompt the author for
accessibility information, e.g. alt text at image-insert time) — **Not Applicable** here;
assessed in `media/admin` / `wysiwyg/admin`. **504.4** (shipped templates produce conformant
content) — **Not Applicable**; the host ships no template. The one authoring-relevant thing
the host *does* own is the unsaved-changes guard, which protects an author's work from being
lost on navigation — a supporting behaviour for 504 rather than a requirement of it, and it
**Partially Supports** because of `docs/testing/utils-admin.md` `🐞 BUG-utils-admin-03`
(confirming one form disarms the others).

## 5. E2E Coverage Map

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F1 mount | every `apps/admin-e2e` spec | The app renders at all | ✅ E2E — implicit but total |
| F2/F3 public route | `apps/admin-e2e/src/auth/routing.spec.ts:12-21` | `/identity` redirects to `/identity/signin` and the sign-in heading renders | ✅ E2E |
| F3/F4 private under layout | `apps/admin-e2e/src/auth/routing.spec.ts:31-40` | `/` renders the home page **and** the shell's nav — i.e. it mounted under the contributed layout | ✅ E2E |
| F4 gate composition | `apps/admin-e2e/src/auth/private-routes.spec.ts:22-31,44-61` | A signed-out user is redirected from `/` to sign-in, and returned to `/` after signing in | ✅ E2E — proves the layout gates, which is the host's fail-open trade-off working as designed |
| F6 catch-all (signed in) | `apps/admin-e2e/src/auth/routing.spec.ts:23-29` | `/this-route-does-not-exist` → URL `/`, home heading visible | ✅ E2E |
| F6 catch-all (signed out) | `apps/admin-e2e/src/auth/private-routes.spec.ts:33-42` | Unknown path → sign-in, proving the `*` sits **inside** the guarded group | ✅ E2E |
| F7 slot wiring | `apps/admin-e2e/src/shell/command-palette.spec.ts`, `home/dashboard.spec.ts`, and every spec asserting `homePage.nav` | Sidebar nav items contributed by several plugins are present | ✅ E2E — the happy path; duplicate ids and ordering are unasserted |
| F8 one QueryClient | `apps/admin-e2e/src/auth/private-routes.spec.ts:74-92` | A 401 on a data request tears down the session and the private shell — exercising the shared client + the `utils-admin` interceptor | ✅ E2E |
| F10 appearance | `apps/admin-e2e/src/users/preferences.spec.ts` | Theme selection applies app-wide | ✅ E2E |
| F5 first-layout-wins | — | — | ⚠️ PARTIAL — the *effect* (home renders in the shell) is asserted; the **selection rule** and its silent-discard behaviour are not |
| F9 IntlProvider | every spec (all copy comes from `defaultMessage`) | Strings render | ⚠️ PARTIAL — the non-`en` locale path is untested and there is no catalogue to test against |
| F11 TooltipProvider | `apps/admin-e2e/src/users/keyboard.spec.ts`, `workspaces/keyboard.spec.ts` | Tooltip-bearing controls are operable | ⚠️ PARTIAL — no assertion on `delayDuration` or on hover-vs-focus |
| F12 Toaster | `apps/admin-e2e/src/workspaces/settings.spec.ts`, `users/members.spec.ts` (toast assertions) | Toasts appear after mutations | ⚠️ PARTIAL — no assertion on **position**, so the `bottom-right`/`top-right` contradiction is invisible |
| F13/F14 unsaved guard | `apps/admin-e2e/src/content/i18n.spec.ts` (the only spec mentioning unsaved changes), `apps/admin-e2e/src/support/pages/AgentsPage.ts` | The dialog appears in one locale-switch flow | ⚠️ PARTIAL — the guard's hardest paths (multiple dirty forms, back/forward after confirming, `beforeunload`, modified clicks) are all untested |
| F15 contract | — | — | ⚠️ PARTIAL — enforced by `tsc` only |
| **a11y — host concerns** | `apps/admin-e2e/src/auth/a11y.spec.ts:17,23,35,48,60,74,89,101,107`; `users/a11y.spec.ts:18-73`; `workspaces/a11y.spec.ts:23-68`; `content/`, `copilot/`, `insights/` a11y specs | axe (`wcag2a/2aa/21a/21aa`, no rules disabled — `fixtures.ts:110-115`) over page states including error banners, skeletons, open menus and empty states — genuinely good state coverage | ⚠️ PARTIAL — **axe cannot see any of this unit's a11y failures.** Page title, route-change focus, `<html lang>` drift, and the crash state are all outside axe's rule set. Six areas have suites; media, shell/home, i18n and wysiwyg have none |
| **a11y — skip link** | — | — | ❌ NONE — a grep of `apps/admin-e2e/src` for `Skip to main` / `main-content` returns nothing |
| **a11y — keyboard** | `apps/admin-e2e/src/auth/keyboard.spec.ts:13,26,45,67`; `users/keyboard.spec.ts:16,25,39`; `workspaces/keyboard.spec.ts:18,31,42,69,84` | First focus stop, keyboard-only completion of login and invite acceptance, source-order reachability, menu/wizard opening, arrow-key chips, Enter-to-open | ✅ E2E for those pages — ❌ NONE for **route-change focus**, which is the host's own behaviour |

**Coverage tally:** `15 features · 8 ✅ · 7 ⚠️ · 0 ❌`
**♿ tally:** `7 findings — 2 Supports · 3 Partially Supports · 2 Does Not Support` (plus 1
Not Applicable verdict recorded for public-route bypass blocks).

## 6. 🐞 Potential Bugs

### 🐞 BUG-bootstrap-admin-01 — The first plugin to contribute a `layout` wins silently, so a plugin registered before the shell replaces the auth gate with no warning · Severity: High · 🔒

**Location:** `packages/bootstrap/admin/src/lib/createAdmin/index.tsx:57-61`
**Category:** permission-bypass

**What the code does:**

```ts
// The single layout that wraps every private route; falls back to a bare
// outlet before any layout plugin (the shell) is registered.
const layout = plugins.map((plugin) => plugin.layout).find(Boolean) ?? (
    <Outlet />
);
```

**Why it is wrong:** every non-public route is mounted as a child of this one element
(`:83-90`), and — by the architecture's own description — that element is where the auth gate
lives: "the shell wraps its chrome in identity's `AuthProvider` + `RequireAuth`"
(`AGENTS.md`). So the value of `layout` decides whether the entire private half of the
application is gated. `find(Boolean)` makes that decision by **registration order**, silently
discards every other contribution, and logs nothing. Two failure modes follow:

1. A plugin listed before `ShellPlugin()` in `apps/admin/src/main.tsx:17-47` that happens to
   contribute a `layout` replaces the gate for the whole app. Today `IdentityPlugin()` is
   registered first (`:18`) and contributes none — the security posture rests on that
   coincidence holding.
2. The fallback is `<Outlet/>`, i.e. **no layout at all**, which `AGENTS.md` explicitly
   documents as fail-open: "a `public:false` route with no gating `layout` renders
   **ungated**". Removing or renaming the shell plugin therefore un-gates every page rather
   than breaking the build.

The server guard is still the real boundary (`.cursor/BUGBOT.md`: "Permission gating only in
the UI … is **not** security"), so this is not by itself a data breach — but it renders the
authenticated application shell to an unauthenticated visitor, and every page then fails
open-ended with 401s rather than redirecting to sign-in.

**Repro:**
1. In `apps/admin/src/main.tsx`, insert before `ShellPlugin()`:
   `{ name: 'x', layout: <div>hijacked<Outlet/></div> }`.
2. Sign out, load `/`.
→ Observed: the home route renders inside `hijacked` with no gate and no console warning.
→ Expected: either a hard error ("two plugins contributed a layout"), or an explicit
`layout` selection in `CreateAdminOptions` rather than an ordering accident.

**Blast radius:** the whole private route tree, decided by the order of a list in an app file.
Low likelihood today, maximal impact if it happens, and no signal when it does.
**Suggested fix:** throw (or `console.error`) when more than one plugin contributes a
`layout`, and consider making the absence of a layout an error rather than a silent bare
`<Outlet/>`.

### 🐞 BUG-bootstrap-admin-02 — Every unmatched URL silently redirects to `/`, so there is no 404 anywhere in the admin · Severity: Medium

**Location:** `packages/bootstrap/admin/src/lib/createAdmin/index.tsx:91-96`
**Category:** ux-state

**What the code does:**

```tsx
<Route
    path="*"
    element={
        <Navigate to="/" replace />
    }
/>
```

**Why it is wrong:** the redirect is unconditional and `replace`s the history entry, so a
mistyped URL, a stale bookmark, a dead link in an email, and a deleted resource's permalink
are all indistinguishable from "the user asked to go home". Nothing tells them the address
was wrong, and because of `replace` the bad URL is not even left in history for them to fix.
It also masks routing bugs during development: a plugin whose route path is misspelled
appears to "work" (it lands on home) rather than 404ing.

This interacts badly with `♿ A11Y-bootstrap-admin-02`: since a route change announces
nothing, a screen-reader user following a dead link is moved to a different page with **no**
feedback at all — not even the silent visual cue of the URL changing.

**Repro:**
1. Sign in.
2. Navigate to `/workspaces/<valid-id>/contentt` (one typo).
→ Observed: URL becomes `/`, the home dashboard renders, no message. → Expected: a "Page not
found" view naming the path, with a link home, and the URL preserved.

**Blast radius:** every wrong URL in the product. Usability and debuggability; no data or
authorization impact.
**Suggested fix:** render a host-provided `NotFound` element at `*` (overridable via
`CreateAdminOptions`), keeping the redirect only for the deliberate "`/` after sign-in" case.

### 🐞 BUG-bootstrap-admin-03 — No error boundary: one throwing route, lazy chunk or plugin factory blanks the entire application · Severity: Medium

**Location:** `packages/bootstrap/admin/src/lib/createAdmin/index.tsx:67-107` (the whole tree is mounted unguarded), and `apps/admin/src/main.tsx:16-47` (plugin factories run at module scope)
**Category:** ux-state

**What the code does:** `root.render(<StrictMode><AppearanceProvider>…<Routes>…</Routes>…)` —
there is no `componentDidCatch` anywhere in the chain. A repo-wide grep for
`getDerivedStateFromError` returns exactly one file,
`packages/insights/admin/src/lib/presentation/components/WidgetBoundary/index.tsx:32`, which
guards a single insights widget and explicitly explains why (`:24`: "a render-phase throw is
exactly what needs catching") — the pattern exists in the codebase and is simply not applied
at the host.

**Why it is wrong:** React 19 unmounts the **entire tree** when an error escapes to the root.
The consequences at this layer are total:

- one bad response shape in one page's mapper blanks the sidebar, the toasts and every other
  plugin's UI;
- a lazy route chunk that 404s after a deploy (a stale `index.html` pointing at hashed
  assets that no longer exist) blanks the app on navigation, with no `<Suspense>` fallback
  and no retry;
- a plugin factory that throws never even reaches `createAdmin`, because `main.tsx` calls
  them inline in the array literal (`apps/admin/src/main.tsx:17-47`).

The user sees a white page with no message, no reload affordance, and — per
`♿ A11Y-bootstrap-admin-04` — no announcement.

**Repro:**
1. Add `throw new Error('boom')` to the render of any routed page component.
2. Navigate to it.
→ Observed: `#root` is emptied; the sidebar, toaster and everything else disappear; console
shows the React error. → Expected: the failing route's region shows a recoverable error, or
at worst a host-level fallback with a heading and a reload button.

**Blast radius:** availability of the entire admin, triggered by a bug in any one of thirteen
plugins.
**Suggested fix:** wrap the routed subtree in an error boundary inside `createAdmin` (with a
focusable, announced fallback), and consider a per-route boundary so one page's crash does
not take the shell with it.

### 🐞 BUG-bootstrap-admin-04 — A missing mount element produces a blank page instead of a clear error, because the lookup is cast rather than checked · Severity: Low

**Location:** `packages/bootstrap/admin/src/lib/createAdmin/index.tsx:63-65`
**Category:** correctness

**What the code does:**

```ts
const root = ReactDOM.createRoot(
    document.getElementById(rootElement) as HTMLElement
);
```

**Why it is wrong:** `getElementById` returns `HTMLElement | null`, and the `as HTMLElement`
assertion tells TypeScript to stop caring. `rootElement` is a caller-supplied option
(`types/adminPlugin/index.ts:49-50`), so a typo there — or an `index.html` whose `<div id>`
was renamed — turns a five-character configuration mistake into `createRoot(...): Target
container is not a DOM element` from deep inside React, with no mention of `createAdmin` or
of the id that was looked up.

**Repro:**
1. `createAdmin({ plugins, rootElement: 'app' })` against
   `apps/admin/index.html:38`'s `<div id="root">`.
→ Observed: blank page; a React-internal error. → Expected:
`Error: createAdmin: no element with id "app" found`.

**Blast radius:** developer time only.
**Suggested fix:** check for `null` and throw a message naming `createAdmin` and the id.

### 🐞 BUG-bootstrap-admin-05 — The host silently overrides the design system's documented toast position · Severity: Low

**Location:** `packages/bootstrap/admin/src/lib/createAdmin/index.tsx:101` versus `packages/design-system/src/lib/components/ui/sonner.tsx:18-25,39-67`
**Category:** correctness

**What the code does:** the host passes a position:

```tsx
<Toaster position="bottom-right" />
```

and the design-system component both hard-codes the opposite and then lets the prop win,
because `{...props}` is spread **after** it:

```tsx
<Sonner theme={resolvedTheme} position="top-right" closeButton … {...props} />
```

while its own JSDoc states: "App-wide toast host, **pinned to the top-right**" (`:19`).

**Why it is wrong:** two files disagree about a documented product behaviour and the code
resolves it silently in favour of the one whose JSDoc says the opposite. Anyone reading
`sonner.tsx` to answer "where do toasts appear?" gets the wrong answer, and any e2e or visual
test written against the documented position would fail for a reason that looks like a bug in
the test. It also puts toasts in the same corner as the copilot dock
(`CONTEXT-MAP.md`: "the **non-modal docked window** (bottom-right …)"), which is a real
overlap — see `♿ A11Y-bootstrap-admin-05`.

**Repro:**
1. Read `packages/design-system/src/lib/components/ui/sonner.tsx:19`.
2. Trigger any toast in the running admin.
→ Observed: bottom-right. → Expected (per the docs): top-right.

**Blast radius:** documentation trust and one layout collision.
**Suggested fix:** pick one. Either drop `position` from the host call and let the design
system own it, or update the `sonner.tsx` JSDoc and move the dock.

**Checked and cleared** (no defect found): the provider **nesting order** is correct —
`AppearanceProvider` outermost so the theme is available to `Toaster`
(`sonner.tsx:28`), `BrowserRouter` inside `IntlProvider` so route elements can translate, and
`UnsavedChangesGuard` inside `BrowserRouter` so its click interception sees router-rendered
anchors (`createAdmin/index.tsx:69-100`); the slot-wiring loop runs **outside** render
(`:51-55`), so `StrictMode`'s double-invocation cannot double-register — a real trap that was
avoided; the public/private split and the placement of `*` **inside** the layout group are
both correct and are the reason a signed-out user hitting an unknown path reaches sign-in
rather than a bare redirect loop (asserted at `apps/admin-e2e/src/auth/private-routes.spec.ts:33-42`);
`<Navigate replace>` is the right choice for the catch-all's history behaviour even though the
destination is wrong; `UnsavedChangesGuard`'s injection of `ConfirmDialog` + `useIntl` keeps
`utils-admin` copy-free exactly as documented, and its `confirmVariant="destructive"` with the
label "Leave and discard" correctly states the consequence for WCAG 3.3.4; and the host
genuinely owns no auth code — a grep for `RequireAuth`/`AuthProvider` in this package returns
nothing, so the auth-agnostic claim in `AGENTS.md` holds.

## 7. Recommended E2E Tests

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | `apps/admin-e2e` (POM + `page.route` mock) | `apps/admin-e2e/src/a11y/route-change.spec.ts` | ♿ After a sidebar navigation: `document.title` differs from the previous route's, and `document.activeElement` is inside `<main id="main-content">` (or a polite live region has announced the new page). Currently fails on both counts | `♿ A11Y-bootstrap-admin-01`, `♿ A11Y-bootstrap-admin-02` |
| 2 | `apps/admin-e2e` | extend `apps/admin-e2e/src/auth/keyboard.spec.ts` | ♿ From a fresh signed-in load, the **first** `Tab` focuses a visible "Skip to main content" control; `Enter` moves focus into `<main>`; the next `Tab` lands on page content, not on a sidebar item | `♿ A11Y-bootstrap-admin-07` (regression guard for the only bypass-blocks mechanism, currently untested) |
| 3 | `apps/admin-e2e` | `apps/admin-e2e/src/shell/error-boundary.spec.ts` | Mock an endpoint to return a shape that makes a page throw; assert the app shows a fallback with a `<h1>`, that the sidebar survives, and that a focusable "Reload" control receives focus. Currently fails (blank page) | `🐞 BUG-bootstrap-admin-03`, `♿ A11Y-bootstrap-admin-04` |
| 4 | Unit (`packages/bootstrap/admin/src/lib/createAdmin/__test__/layout-selection.spec.tsx`, vitest + Testing Library) | layout selection | Two plugins contributing a `layout` produce an error (or at minimum a `console.error`); zero layouts renders private routes under a bare `<Outlet/>` — pinning the documented fail-open so a change is deliberate | `🐞 BUG-bootstrap-admin-01`, EC-03 |
| 5 | `apps/admin-e2e` | `apps/admin-e2e/src/auth/not-found.spec.ts` | A mistyped deep link renders a "Page not found" view **and preserves the URL**, rather than redirecting to `/`. Currently fails | `🐞 BUG-bootstrap-admin-02`, EC-15 |
| 6 | `apps/admin-e2e` | `apps/admin-e2e/src/content/unsaved-changes.spec.ts` | Dirty a form, then: (a) a sidebar link prompts; (b) "Keep editing" stays put with edits intact; (c) "Leave and discard" navigates; (d) after (c), **Back** and **Forward** both work; (e) a `⌘`-click does not prompt; (f) the skip link does not prompt. (d) is expected to fail | F13, F14, EC-24 |
| 7 | `apps/admin-e2e` | `apps/admin-e2e/src/content/unsaved-changes-multi.spec.ts` | With two dirty forms mounted, confirming a navigation away from one leaves the **other** still guarded. Currently fails | `docs/testing/utils-admin.md` `🐞 BUG-utils-admin-03`, EC-23 |
| 8 | Unit (`.../__test__/slot-wiring.spec.tsx`) | slot wiring | Every plugin's contributions are registered exactly once even under `StrictMode`; registering the same plugin twice duplicates items (pinning EC-08 as known); a contribution to a slot no other plugin reads is harmless | F7, EC-08, EC-10 |
| 9 | `apps/admin-e2e` | `apps/admin-e2e/src/a11y/theme-contrast.spec.ts` | ♿ Run the existing axe suites a second time with the app forced to **dark** theme, and add a `forced-colors: active` emulation pass asserting focus indicators remain visible | `♿ A11Y-bootstrap-admin-06`, 1.4.3/1.4.11/2.4.7 |
| 10 | Unit (`.../__test__/intl.spec.tsx`) | i18n wiring | `createAdmin({ locale: 'de' })` sets `document.documentElement.lang` to `'de'` and installs an `onError` that does not spam the console. Currently fails on both | `♿ A11Y-bootstrap-admin-03`, EC-19, EC-20 |
| 11 | `apps/admin-e2e` | `apps/admin-e2e/src/shell/toast-position.spec.ts` | A toast appears in exactly one documented corner and does not overlay the copilot dock's controls when the dock is open | `🐞 BUG-bootstrap-admin-05`, `♿ A11Y-bootstrap-admin-05` |
| 12 | `apps/admin-e2e` | `apps/admin-e2e/src/a11y/reflow.spec.ts` | ♿ At a 320 px viewport and at 400 % zoom, the shell reflows without two-dimensional scrolling and all nav is reachable (1.4.10); with `text-spacing` overrides applied, no content is clipped (1.4.12) | WCAG 1.4.10 / 1.4.12, currently untested anywhere |
