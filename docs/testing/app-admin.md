# apps/admin — Test Artifact

> **Unit:** `apps/admin` · **Package:** `@ortha-cms/admin` (private) · **Kind:** app (composition root)
> **Source of truth:** `apps/admin/AGENTS.md`
> **Findings verified:** 2026-08-11 — 6 confirmed · 0 deleted · 4 corrected · 1 unverified
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns.** Four small things, and no domain logic:

1. **The plugin registry** — `src/main.tsx:16-48`, the ordered `AdminPlugin[]` handed to
   `createAdmin`, including the ordering comments (which overstate the constraint — see
   `🐞 BUG-app-admin-02`).
2. **The HTML entry** — `index.html`, including the pre-paint theme script
   (`:11-35`) and the static `<title>` / `<html lang>`.
3. **The style entry** — `src/styles.css`, which imports Tailwind, the design-system token
   layer and the WYSIWYG scope, declares Tailwind's `@source` globs for every admin package,
   and defines the light/dark `--color-*` token palette.
4. **The Vite configuration** — `vite.config.mts`: the dev server port, the `^/api/` proxy,
   the build output, and the vitest environment.

**Does NOT own.** Any page, route, hook, component, message or slot — every one of those
lives in a plugin. Not the mount, the router, the providers or the route split
(`packages/bootstrap/admin`). Not `apiClient`/`queryClient` (`packages/utils/admin`). Not
the chrome (`packages/shell/admin`).

**Entry points**

| Entry | What | Where |
| --- | --- | --- |
| `src/main.tsx` | side-effecting `createAdmin({ plugins })` call | `src/main.tsx:16-48` |
| `index.html` | `<div id="root">`, `<title>`, `<html lang>`, pre-paint theme script | `index.html:2,5,11-35,38` |
| `src/styles.css` | Tailwind entry, token palette, `@source` globs | `src/styles.css:1-10,29+` |
| `vite.config.mts` | dev server + `^/api/` proxy + build + vitest | `vite.config.mts:5-61` |

**Registered plugins, in order** (`src/main.tsx:17-47`) — `IdentityPlugin`, `ShellPlugin`,
`WorkspacesPlugin`, `InsightsPlugin`, `ContentPlugin`, `I18nPlugin`, `WysiwygPlugin`,
`MediaPlugin`, `CopilotPlugin`, `UsersPlugin`, `ActivityPlugin`, `ApiTokensPlugin`.

**Runtime prerequisites**

- The API on `http://localhost:3000` (the proxy target, `vite.config.mts:25`) with Postgres
  up and migrations applied — the admin has no mock mode outside `apps/admin-e2e`.
- A user account to sign in with (`ORTHA_ROOT_ADMIN_*` on the server).
- `localStorage['ortha.theme']` optionally set to `light`/`dark`/`system`.
- A workspace to enter for anything under `/workspaces/:id/*`.

**How to exercise it manually**

```bash
docker compose up -d && npx nx run server:db:migrate
npm run dev                                  # admin :4200, API :3000, both watchers
open http://localhost:4200/identity/signin
npx nx run admin:dev:typecheck               # Vite NEVER typechecks — this pane does
npx nx build admin && npx nx preview admin   # production bundle
npx nx e2e admin-e2e -- --project=chromium
npx nx e2e admin-e2e -- --project=chromium src/**/a11y.spec.ts src/**/keyboard.spec.ts
```

**Dependencies.** Every `@ortha-cms/*-admin` plugin (see the manifest caveat in
`🐞 BUG-app-admin-01`), `@ortha-cms/bootstrap-admin`, Vite 7 + `@vitejs/plugin-react`,
`@tailwindcss/vite`, and — at runtime — the server on `:3000`.

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | Hand the ordered plugin list to `createAdmin` | `src/main.tsx:16-48` | ✅ E2E |
| F2 | `IdentityPlugin` first — contributes the public sign-in/accept-invite routes and the auth client state | `src/main.tsx:18` | ✅ E2E |
| F3 | `ShellPlugin` contributes the one `layout` (chrome + auth gate) | `src/main.tsx:19` | ✅ E2E |
| F4 | `WorkspacesPlugin` before every workspace-interior plugin (it defines their slots) | `src/main.tsx:20,27-42` | ✅ E2E |
| F5 | `InsightsPlugin` before other interior plugins — section contributions merge by id, **last wins** | `src/main.tsx:21-26` | ⚠️ PARTIAL |
| F6 | `ContentPlugin` before `I18nPlugin` and `WysiwygPlugin` (both fill its slots) | `src/main.tsx:27-35` | ✅ E2E |
| F7 | `MediaPlugin`, `CopilotPlugin`, `UsersPlugin`, `ActivityPlugin`, `ApiTokensPlugin` registered | `src/main.tsx:36-46` | ✅ E2E |
| F8 | `index.html` provides `<div id="root">` and loads `/src/main.tsx` as a module | `index.html:38-39` | ✅ E2E |
| F9 | Pre-paint theme script applies `.dark` + `color-scheme` before first paint, defaulting to `system` on a corrupt value | `index.html:11-35` | ⚠️ PARTIAL |
| F10 | `<html lang="en">` and `<title>Admin</title>` | `index.html:2,5` | ❌ NONE |
| F11 | `<meta name="viewport" content="width=device-width, initial-scale=1">` | `index.html:8` | ❌ NONE |
| F12 | `styles.css` imports Tailwind + the design-system tokens + the WYSIWYG scope | `src/styles.css:1-6` | ⚠️ PARTIAL |
| F13 | `@source` globs cover design-system and every `packages/*/admin` package so their classes survive tree-shaking | `src/styles.css:8-10` | ❌ NONE |
| F14 | The `--color-*` token palette, with a `.dark` re-declaration via `@custom-variant` | `src/styles.css:12-29+` | ⚠️ PARTIAL |
| F15 | Dev server on `:4200`, host `localhost` | `vite.config.mts:7-8` | ✅ E2E |
| F16 | `^/api/` **regex** proxy to `:3000` with `changeOrigin` — deliberately not the bare `/api` prefix | `vite.config.mts:12-28` | ⚠️ PARTIAL |
| F17 | Production build to `./dist` with `emptyOutDir` | `vite.config.mts:41-48` | ❌ NONE |
| F18 | Vitest config (jsdom, globals, v8 coverage) | `vite.config.mts:47-61` | ❌ NONE |
| F19 | `admin:dev:typecheck` target — `tsc --build --watch`, because Vite never typechecks | `apps/admin/package.json` `nx.targets` | ⚠️ PARTIAL |

## 3. Manual Test Plan

Each block carries a keyboard-only path and a screen-reader expectation.

### F1 / F2 / F3 — Boot and the public/private split

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npm run dev`; open `http://localhost:4200/` signed out | Redirected to `/identity/signin`; the sign-in form renders with **no** sidebar |
| 2 | Sign in with valid credentials | Land on `/`; the home dashboard renders inside the shell with the sidebar visible |
| 3 | Comment out `ShellPlugin()` (`src/main.tsx:19`), reload, sign out, load `/` | The home page renders **ungated** under a bare `<Outlet/>` — the gate lives in the shell's layout. See `docs/testing/bootstrap-admin.md` `🐞 BUG-bootstrap-admin-01` |
| 4 | Restore | Gated again |

**Keyboard path:** on the sign-in page the first `Tab` stop is the email field
(`apps/admin-e2e/src/auth/keyboard.spec.ts:13`); the whole login completes with `Tab` +
`Enter` (`:26`). After signing in, the first `Tab` stop is the shell's "Skip to main
content" link (`packages/shell/admin/src/lib/components/AppShell/index.tsx:49-54`).
**Screen reader:** the sign-in page announces its `<h1>`. After sign-in, **nothing is
announced** — see `♿ A11Y-app-admin-01`.

### F4 / F5 / F6 / F7 — Plugin ordering constraints

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Sign in, open a workspace, look at the workspace sidebar | Entries from content, media, insights and the copilot's CMS ⇄ Agents switch are all present |
| 2 | Move `ContentPlugin()` **after** `I18nPlugin()` and reload | The locale switcher, Locales column and editor locale panel are **still present** — slots are module-level singletons and `createAdmin` registers every plugin's contributions before render (`packages/bootstrap/admin/src/lib/createAdmin/index.tsx:51-55`). Only their position **within** each slot changes. The comment at `src/main.tsx:30-31` overstates the constraint — see `🐞 BUG-app-admin-02` |
| 3 | Move `InsightsPlugin()` after `ContentPlugin()` and open Insights | Section bands may be renamed/re-iconed by whichever plugin now registers last — the merge is by id, field-by-field, last winning, keeping the first position (`packages/insights/admin/src/lib/utils/resolveInsightsLayout/index.ts:49-72`) |
| 4 | Move `WorkspacesPlugin()` after `MediaPlugin()` and open a workspace | The Media entry is **still present** in the workspace nav, for the same reason as step 2 |
| 5 | Restore the original order | Everything returns to its documented position |

**Keyboard path:** the workspace nav is a list of links; `Tab` moves through them in DOM
order, which is slot order (`byOrder`, `packages/utils/admin/src/lib/byOrder/index.ts:6`).
**Screen reader:** the nav is announced as a navigation landmark with an item count — in
step 2 the count silently drops with no explanation.

### F8 / F9 — HTML entry and the theme flash

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Set the app theme to Dark; hard-reload with the network throttled to Slow 3G | The page is dark from the **first** paint — no white flash. The inline script at `index.html:11-35` runs before the module bundle |
| 2 | `localStorage.setItem('ortha.theme','purple')`; reload | Falls back to `system` (`index.html:19-24`); no console error (the whole block is `try`/`catch`) |
| 3 | Disable JavaScript entirely and load the page | A blank white page with no message — an SPA with no `<noscript>` fallback |
| 4 | Set the OS to dark, theme to `system`, reload | Dark; `document.documentElement.style.colorScheme === 'dark'`, so native form controls and scrollbars render dark too |
| 5 | Block `localStorage` (Safari private / cookie-blocking) | The `try`/`catch` swallows it; the app defaults to light regardless of the OS setting |

**Screen reader:** step 3's blank page is silent — a user with JS disabled gets no
explanation at all.

### F10 / F11 — Title, language, viewport

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Sign in and visit `/`, `/users`, `/workspaces`, a content record, `/workspaces/:id/agents` | The browser tab reads **"Admin"** on every one. See `♿ A11Y-app-admin-01` |
| 2 | Open the copilot dock and let a run finish while on another tab | The title becomes `(1) Admin` — the **only** title writer in the app (`packages/copilot/admin/src/lib/application/useTabBadge.ts:34-36`) |
| 3 | `document.documentElement.lang` in the console | `'en'`, always (`index.html:2`) |
| 4 | Resize to 320 px wide | The viewport meta (`index.html:8`) is present and correct — no forced desktop zoom; then verify reflow per `♿ A11Y-app-admin-05` |

### F12 / F13 / F14 — Styles and tokens

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx build admin`; inspect the emitted CSS | Utility classes used only inside `packages/*/admin` are present — the `@source` globs at `src/styles.css:9-10` are what keeps them |
| 2 | Add a new admin package at `packages/newthing/admin` using a class no other package uses; build | The class is included (the glob is `packages/*/admin/**`). Now try `packages/deep/nested/admin` — the second is **not** matched, because the glob is one level deep |
| 3 | Toggle Light/Dark and re-check contrast on muted text, disabled buttons, table borders, and focus rings | Every text-on-surface pairing should clear 4.5:1; `src/styles.css:23-25` records that this was verified and that the axe scan enforces it. Verify **both** themes |
| 4 | Confirm the documented brand caveat | White text on `bg-brand` (flame orange) does **not** clear AA — `src/styles.css:25-27` says to use ink text or keep orange to icons/accents. Spot-check that no component violates it |
| 5 | With the WYSIWYG editor open, inspect `.ortha-wysiwyg` | The rich-text scope reads the same `--color-*` tokens, so it follows the theme (`src/styles.css:3-6`) |

### F15 / F16 — Dev server and the API proxy

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npm run dev`; `curl -sD- -o/dev/null localhost:4200/api/auth/me` | `401` from the API — the request was proxied to `:3000` |
| 2 | Sign in, then hard-refresh on `/api-tokens` | The **SPA page** loads. This is exactly what the regex key protects: a plain `/api` string prefix would have swallowed `/api-tokens` and returned `Cannot GET /api-tokens` (`vite.config.mts:14-21`) |
| 3 | `curl -i localhost:4200/apifoo` | Served by Vite (index.html), not proxied |
| 4 | Stop the API and reload the admin | The app renders; every data request fails. Check that each page shows an **error** state rather than an empty one (`.cursor/BUGBOT.md`, "Error masquerading as empty") |
| 5 | Inspect a request's cookies | The session cookie is first-party — same origin via the proxy, so `SameSite=Lax` works and no CORS is involved (`vite.config.mts:11-13`) |

### F17 / F18 / F19 — Build, tests, typecheck

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx build admin` | Emits to `apps/admin/dist`, clearing it first (`vite.config.mts:42-43`) |
| 2 | `npx nx preview admin` and hard-refresh a deep route like `/workspaces/x/content` | Loads — Vite's preview supplies an SPA fallback. **Note:** a real static host needs one configured; nothing here documents that |
| 3 | Introduce a type error in a plugin and watch `npm run dev` | The `admin:dev:typecheck` pane reports it; the Vite pane does **not** — "Vite never typechecks" (root `AGENTS.md`) |
| 4 | `npx nx test admin` | Runs vitest in jsdom over `{src,tests}/**/*.{test,spec}.*` — today that set is **empty** (`apps/admin/src` contains only `main.tsx`, `styles.css`, `assets/`) |

## 4. Edge Cases & Negative Paths

**Plugin registry**

- **EC-01 — A plugin factory throws.** `❌ NONE` The factories are called inline in the array
  literal (`src/main.tsx:17-47`), i.e. at module scope, before `createAdmin` runs. Blank
  page, no boundary. → `docs/testing/bootstrap-admin.md` `🐞 BUG-bootstrap-admin-03`.
- **EC-02 — Reordering slot-filling plugins.** `❌ NONE` Breaks features **silently** (the
  contributions land in slots that do not exist yet). The three ordering constraints are
  encoded as comments (`:21-26,27-35`), not as assertions.
- **EC-03 — Removing a plugin whose slots another fills.** `❌ NONE` The filler's
  contributions become dead data; no error.
- **EC-04 — Two plugins contributing the same nav id.** `❌ NONE` Duplicated in the sidebar
  (`packages/utils/admin/src/lib/slot/index.ts:36` appends without de-duplication), plus a
  React duplicate-key warning. Insights works around this with its own last-wins merge
  (`src/main.tsx:21-26`), which is evidence the primitive's behaviour surprises people.
- **EC-05 — Manifest drift.** `❌ NONE` `apps/admin/package.json` lists eleven
  `@ortha-cms/*-admin` dependencies but `src/main.tsx` imports **thirteen**;
  `@ortha-cms/i18n-admin` and `@ortha-cms/copilot-admin` are undeclared.
  → `🐞 BUG-app-admin-01`.
- **EC-06 — `CopilotPlugin()` when the server has `COPILOT_ENABLED=false`.** `⚠️ PARTIAL`
  The admin surface is registered regardless; the copilot's own UI must degrade. Covered by
  `apps/admin-e2e/src/copilot/*` against mocked responses, not against a disabled server.

**HTML entry**

- **EC-07 — Corrupt / absent `localStorage['ortha.theme']`.** `❌ NONE` Falls back to
  `system` (`index.html:19-24`). Correct.
- **EC-08 — `localStorage` throws (private mode, blocked cookies).** `❌ NONE` Swallowed by
  the `try`/`catch` (`:33`); the app silently ignores the user's saved theme.
- **EC-09 — JS disabled.** `❌ NONE` Blank page, no `<noscript>`.
- **EC-10 — Stale `index.html` after a deploy.** `❌ NONE` The cached HTML points at hashed
  chunks that no longer exist; a lazy route import rejects and, with no error boundary,
  blanks the app on navigation.
- **EC-11 — `<title>` never updated.** `❌ NONE` → `♿ A11Y-app-admin-01`.
- **EC-12 — `<html lang>` never updated.** `❌ NONE` → `docs/testing/bootstrap-admin.md`
  `♿ A11Y-bootstrap-admin-03`.

**Styles**

- **EC-13 — A class used only in a package outside the `@source` globs.** `❌ NONE` Silently
  purged from the production CSS while working perfectly in dev (where Tailwind sees
  everything) — a class of bug that only appears after `nx build`.
- **EC-14 — A new token that fails contrast.** `⚠️ PARTIAL` The axe `color-contrast` rule
  catches text-on-background for **scanned pages in the theme the test runs in**. A dark-only
  regression, or one on a page with no a11y suite (media, shell/home, i18n, wysiwyg), passes
  CI. → `♿ A11Y-app-admin-03`.
- **EC-15 — White text on `bg-brand`.** `❌ NONE` Documented as failing AA
  (`src/styles.css:25-27`) with a convention to avoid it — but nothing enforces the
  convention.
- **EC-16 — `@theme` vs `@theme inline`.** `❌ NONE` `src/styles.css:27-29` explains that
  `@theme` (not `inline`) is required so utilities resolve to `var(--color-*)` and the
  `.dark` override works at runtime. A future `inline` would break dark mode wholesale, with
  no test to catch it.

**Dev server / proxy**

- **EC-17 — SPA route whose path starts with `api`.** `✅ (by construction)` The `^/api/`
  regex key exists precisely for `/api-tokens` (`vite.config.mts:14-21`). Verified by
  reading; not asserted by a test.
- **EC-18 — API on a non-default port.** `❌ NONE` The target is hard-coded to
  `http://localhost:3000` (`vite.config.mts:22`); there is no env override.
- **EC-19 — Deploying the SPA on a different origin from the API.** `❌ NONE`
  `apiClient`'s `baseURL` is the literal `'/api'`
  (`packages/utils/admin/src/lib/apiClient/index.ts:15`), so a split-origin deployment is
  impossible without a code change — and would additionally need CORS, which the server never
  enables.
- **EC-20 — Port 4200 already in use.** `❌ NONE` Vite picks another port; the e2e
  `baseURL` and the server's `ALLOWED_ORIGINS` (`apps/server/ortha.config.ts:111`) both
  assume 4200, so the CSRF origin check starts rejecting state-changing POSTs.

**Failure & partiality**

- **EC-21 — API down.** `❌ NONE` Every page must show an error state, not an empty one.
  Per-plugin concern, but this is where a user meets it.
- **EC-22 — Network drop mid-request.** `❌ NONE` `toApiError` maps it to
  `status: null` / "Network error"
  (`packages/utils/admin/src/lib/apiError/index.ts:24-26`); whether a page distinguishes it
  from "no rows" is per-page.
- **EC-23 — Session dies mid-visit.** `✅ E2E`
  `apps/admin-e2e/src/auth/private-routes.spec.ts:74-92` — a 401 on a data request signs the
  user out and tears down the shell.
- **EC-24 — Signing in as a different user in the same tab.** `❌ NONE` The `queryClient` is
  a module singleton (`packages/utils/admin/src/lib/queryClient/index.ts:9`) that nothing
  clears on sign-out, so the second user can briefly see the first's cached lists. 🔒

### 4A. Accessibility & Section 508 Conformance

**Standards.** Tested to **WCAG 2.1 AA** (the target of `apps/admin/AGENTS.md` — "UI must
meet WCAG 2.1 AA" — and of `.agents/skills/accessibility/SKILL.md`), citing the Revised
Section 508 provision alongside: 36 CFR Part 1194 Appendices A–C incorporate WCAG 2.0 A + AA
by reference (**E205.4** electronic content, **504.2** authoring tools). Chapter 5 provisions
assessed: **502.2/502.3** (AT interoperability), **503.2** (platform/user preferences),
**503.4** (caption/audio controls), **504** (authoring tools). WCAG 2.2 items are **advisory
only**.

**On automated scanning.** The axe harness is
`apps/admin-e2e/src/support/a11y.ts:12-23` (assert zero violations, with a readable summary)
driven by `apps/admin-e2e/src/support/fixtures.ts:110-115`
(`withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa'])`). **No rule is disabled** — grepping
`apps/admin-e2e/src` for `disableRules` and `exclude(` returns nothing — so there is no
suppressed, invisible non-conformance, which is a genuinely good starting position. But
coverage is six areas out of eleven surfaces: `auth`, `content`, `copilot`, `insights`,
`users`, `workspaces` have `a11y.spec.ts`; **`media`, `shell`/home, `i18n` and `wysiwyg`
have none**. And the harness's own comment is the right framing (`a11y.ts:9-10`):
"Automated scans catch only a fraction of WCAG issues — a green result is a regression guard,
not a conformance claim." Every finding below is invisible to axe.

#### ♿ A11Y-app-admin-01 — Every route in the shipped app is titled "Admin"

- **WCAG:** `2.4.2 Page Titled (A)` · **508:** `E205.4`
- **Verdict:** **Does Not Support**
- **Location:** `apps/admin/index.html:5`. The only code in the repository that writes
  `document.title` is `packages/copilot/admin/src/lib/application/useTabBadge.ts:34-36`,
  which captures the existing title as a base and prefixes an unread badge — it never sets a
  route name. No plugin sets a title; `createAdmin` provides no mechanism to.

**Repro:** sign in; visit `/`, `/users`, `/workspaces`, `/workspaces/:id/content/article`,
`/workspaces/:id/media`, `/workspaces/:id/agents`, `/api-tokens`; read the tab each time.
**Keyboard-only user:** with several Ortha tabs open, `Ctrl+Tab` cycling gives no way to tell
them apart; window-switcher entries are identical.
**Screen-reader user:** the title is the primary page-identity signal and the main thing a
screen reader re-announces on navigation. Because it never changes — and because focus never
moves (`♿ A11Y-app-admin-02`) — **no navigation in the product is announced at all**. A user
who follows a link has no way to know whether it worked short of manually exploring headings.
This is the app's most consequential 508 failure, and it is one line of infrastructure away
from being fixed.
**Remediation:** give `RouteItem` a `title` (or have each page set it from its `<h1>`), and
have the host apply it on route change — front-loading the unique part, e.g. "Members —
Ortha CMS".

#### ♿ A11Y-app-admin-02 — Focus is never moved on route change, so keyboard and SR users re-traverse the sidebar on every navigation

- **WCAG:** `2.4.3 Focus Order (A)`, `4.1.3 Status Messages (AA)` · **508:** `E205.4`, `502.3.9`
- **Verdict:** **Does Not Support**
- **Location:** `packages/bootstrap/admin/src/lib/createAdmin/index.tsx:75-98` (no
  location effect) and `packages/shell/admin/src/lib/components/AppShell/index.tsx:42-66`
  (the layout renders `<Outlet/>` with no focus management). Cross-reference
  `docs/testing/bootstrap-admin.md` `♿ A11Y-bootstrap-admin-02` — the defect is the host's;
  this entry records how it presents in the shipped app.

**Repro:** sign in; `Tab` to the "Members" sidebar link; `Enter`; then `Tab` repeatedly and
count how many stops precede the first control on the Members page.
**Keyboard-only user:** focus stays on the sidebar link, so every navigation costs a full
re-traverse of the sidebar (which grows with every registered plugin —
`src/main.tsx:17-47` currently registers twelve). The shell **does** provide the escape hatch
— `<SidebarInset id="main-content" tabIndex={-1}>`
(`AppShell/index.tsx:56`) is already focusable — it is simply never focused
programmatically.
**Screen-reader user:** silence. The virtual cursor stays in the sidebar; the new page's
heading is not read.
**Remediation:** on `location.pathname` change, call `focus()` on the existing
`#main-content` element (it already has `tabIndex={-1}` for exactly this) and/or render a
polite route announcer.

#### ♿ A11Y-app-admin-03 — Colour contrast is verified only in whichever theme the axe suites happen to run in, and only on six of eleven surfaces

- **WCAG:** `1.4.3 Contrast (Minimum) (AA)`, `1.4.11 Non-text Contrast (AA)` · **508:** `E205.4`
- **Verdict:** **Partially Supports**
- **Location:** `apps/admin/src/styles.css:20-27` states that "Every text-on-surface pairing
  below was verified >= 4.5:1 (WCAG AA) — the admin-e2e axe scan enforces this", and that
  "Dark mode: the `.dark` class on `<html>` … re-declares these `--color-*` tokens with a
  dark palette below". The enforcement claim is only half true: the axe suites
  (`apps/admin-e2e/src/{auth,content,copilot,insights,users,workspaces}/a11y.spec.ts`) run in
  a single theme, and there is no dark-theme pass anywhere. Media, shell/home, i18n and
  wysiwyg have no axe suite in **either** theme.

The file also records a real, unenforced hazard (`:21-23`): "White text on the brand orange
does NOT clear AA: never pair `text-*-foreground` white text with `bg-brand`". That is a
convention held in a comment.
**Repro:** switch to Dark and run the axe suites; then visually inspect the Media Library,
the home dashboard, the locale switcher and the WYSIWYG toolbar in both themes.
**Keyboard-only user:** low-contrast **focus rings** are the acute risk (1.4.11 requires
3:1 for the indicator), and focus rings are exactly what a single-theme scan under-tests.
**Screen-reader user:** unaffected.
**Remediation:** parameterise the a11y suites over both themes, and add `a11y.spec.ts` for
media, shell/home, i18n and wysiwyg.

#### ♿ A11Y-app-admin-04 — The app-wide scroll container is focusable with its focus indicator removed

- **WCAG:** `2.4.7 Focus Visible (AA)` · **508:** `E205.4`
- **Verdict:** **Does Not Support**
- **Location:** `packages/design-system/src/lib/components/ui/sidebar.tsx:406-410`:

```tsx
<div
    data-slot="sidebar-inset-scroll"
    tabIndex={0}
    className="flex min-h-0 flex-1 flex-col overflow-y-auto focus-visible:outline-none"
>
```

The `tabIndex={0}` is deliberate and correct — the comment at `:398-405` argues it well: "a
region that scrolls must be reachable by keyboard (WCAG 2.1.1), and a mouse user's wheel is
not a substitute … it matters most exactly when the page has nothing else to focus". But
`focus-visible:outline-none` then removes the only indication that this stop exists, in
direct conflict with the repo's own rule: "**Visible focus** on every interactive element
(don't `outline: none` without a replacement)"
(`.agents/skills/accessibility/SKILL.md:103-104`). No replacement is supplied.

This is a design-system element, but it renders on **every private route in the admin**
(`AppShell/index.tsx:56`), so the app inherits it everywhere.
**Repro:** sign in; `Tab` from the skip link and watch for a stop with no visible indicator;
press `↓` and confirm the page scrolls, proving something is focused.
**Keyboard-only user:** a "dead" tab stop — one press where nothing appears to happen,
followed by arrow keys behaving differently than expected. Sighted keyboard users routinely
read this as the app having lost focus and press `Tab` again, skipping past the scrollport.
**Screen-reader user:** the element has no accessible name or role, so it announces as a bare
group/blank — an unnamed focusable, which is also a 4.1.2 concern.
**Remediation:** replace `focus-visible:outline-none` with a real indicator (e.g. an inset
ring) and give the region an accessible name (`role="region"` + `aria-label`), or remove
`tabIndex` and make the inner content the scrollport.

#### ♿ A11Y-app-admin-05 — Reflow, text-spacing and zoom are untested for a fixed-sidebar layout

- **WCAG:** `1.4.4 Resize Text (AA)`, `1.4.10 Reflow (AA)`, `1.4.12 Text Spacing (AA)` · **508:** `E205.4`
- **Verdict:** **Unverified — Partially Supports** (could not confirm without running a browser)
- **Location:** the viewport meta is correct and does not block zoom (`index.html:8` —
  `width=device-width, initial-scale=1`, with no `maximum-scale` or `user-scalable=no`),
  which is the usual failure and is **not** present here. The risk is the layout: a
  persistent offcanvas sidebar plus an inner scrollport
  (`sidebar.tsx:379-412`) plus a third right-panel column
  (`AppShell/index.tsx:61`) is precisely the shape that produces two-dimensional scrolling at
  400 % zoom, and content tables (`content/admin`, `users/admin`) are the usual clipping
  victims.
**What I could not confirm:** whether the layout actually reflows — I read the CSS classes
but did not render the app at 320 px or 400 %. No suite exercises it: a grep of
`apps/admin-e2e/src` finds no viewport-resize or zoom assertions.
**Keyboard-only user:** horizontal scrolling makes tab-following unpredictable when the
focused element sits outside the visible box.
**Screen-reader user:** unaffected by reflow; affected by any content that becomes clipped
rather than reflowed.
**Remediation:** add a reflow suite at 320 × 256 CSS px and a text-spacing override pass, and
assert `document.documentElement.scrollWidth <= clientWidth`.

#### ♿ A11Y-app-admin-06 — `prefers-reduced-motion` is honoured; `forced-colors` is not handled anywhere

- **WCAG:** `2.3.3 Animation from Interactions (AAA — advisory)`; `1.4.11 Non-text Contrast (AA)` for the forced-colors consequence · **508:** `503.2 User Preferences`
- **Verdict:** **Partially Supports**
- **Location:** reduced motion is genuinely respected —
  `packages/design-system/src/styles.css:74` and `:98` carry
  `@media (prefers-reduced-motion: reduce)` blocks, and `motion-reduce:` utilities appear
  across the plugins (e.g.
  `packages/activity/admin/src/lib/presentation/components/ActivityTable/ActivityRow/index.tsx:89,114`,
  `packages/content/admin/src/lib/presentation/components/ContentEntryView/EntryBusyOverlay/index.tsx:51`,
  `packages/i18n/admin/src/lib/components/LocaleSwitchOverlay/index.tsx:98`,
  `packages/copilot/admin/src/lib/presentation/CopilotPanel/index.tsx:339`). That half of
  503.2 **Supports**.

`forced-colors` is the gap: a repo-wide grep returns **zero** hits across `apps/` and
`packages/`.
**Repro:** enable Windows High Contrast (or Firefox `browser.display.document_color_use=2`)
and load the admin.
**Keyboard-only user:** in forced-colors mode the UA replaces author colours; `ring-*`-based
focus indicators and token-coloured borders can disappear entirely, so the (already thin —
see `♿ A11Y-app-admin-04`) focus story degrades further.
**Screen-reader user:** unaffected.
**Remediation:** add a `@media (forced-colors: active)` block to the token layer restoring
borders and focus rings with system colours (`Highlight`, `CanvasText`, `ButtonBorder`), and
add a forced-colors emulation pass to the a11y suites.

#### ♿ A11Y-app-admin-07 — Landmarks and skip link are present and correct, but only under the shell, and neither is asserted

- **WCAG:** `2.4.1 Bypass Blocks (A)`, `1.3.1 Info and Relationships (A)` · **508:** `E205.4`
- **Verdict:** **Supports** (private routes) / **Not Applicable** (public routes)
- **Location:** `packages/shell/admin/src/lib/components/AppShell/index.tsx:49-56` renders a
  visually-hidden-until-focused "Skip to main content" link targeting
  `<SidebarInset id="main-content" tabIndex={-1}>`, and `SidebarInset` is a real `<main>`
  element (`packages/design-system/src/lib/components/ui/sidebar.tsx:386`). The inner
  scrollport deliberately declines a second landmark role (`sidebar.tsx:404-405`: "`<main>`
  above already is one, and a second would just add noise"), so there is exactly one `<main>`
  — the repo's own rule ("Don't add a second `<main>`",
  `.agents/skills/accessibility/SKILL.md:93-94`) is respected here.

Two caveats worth recording rather than defects: (1) the a11y skill is **stale** on this
point — `SKILL.md:95-99` says "The app has no skip link yet and `AppShell`'s `<main>` has no
`id`", which the code has since fixed; (2) **nothing tests it** — a grep of
`apps/admin-e2e/src` for `Skip to main` / `main-content` returns no hits, so the sole
bypass-blocks mechanism has no regression guard. The unsaved-changes guard correctly leaves
it alone (`packages/utils/admin/src/lib/unsavedChanges/index.tsx:130` exempts `#` hrefs).
**Remediation:** add the skip-link sequence to `apps/admin-e2e/src/auth/keyboard.spec.ts`,
and update `SKILL.md`.

**Remaining WCAG 2.1 AA checklist for the app surface** (items this unit either satisfies,
delegates, or must be verified per-plugin):

| SC | Verdict here | Note |
| --- | --- | --- |
| 1.1.1 Non-text Content (A) | Delegated | The app ships one asset, `public/favicon.ico`; images live in `media/admin` and the WYSIWYG |
| 1.3.1 Info & Relationships (A) | Supports at this layer | One `<main>`, `<nav>` in the sidebar; page semantics are per-plugin |
| 1.3.2 Meaningful Sequence (A) | Supports | DOM order matches visual order in the three-column shell |
| 1.3.5 Identify Input Purpose (AA) | Delegated | Sign-in email/password `autocomplete` is `identity/admin`'s |
| 1.4.1 Use of Colour (A) | Delegated | Status chips, publish state, locale coverage all pair colour with text — verify per plugin |
| 1.4.13 Content on Hover/Focus (AA) | Supports | Radix tooltips via the host's `TooltipProvider` |
| 2.1.1 Keyboard (A) | Partially Supports | Good per-page coverage (`apps/admin-e2e/src/{auth,users,workspaces}/keyboard.spec.ts`); no coverage for media, shell/home, i18n, wysiwyg |
| 2.1.2 No Keyboard Trap (A) | Unverified | Radix overlays trap and release correctly; the TipTap editor and the copilot dock are the untested risk areas |
| 2.4.6 Headings & Labels (AA) | Delegated | `ContainerHeader` renders the single `<h1>` per page |
| 3.1.1 Language of Page (A) | Partially Supports | `lang="en"` is correct for today's English-only UI but does not track `locale` — see `docs/testing/bootstrap-admin.md` `♿ A11Y-bootstrap-admin-03` |
| 3.1.2 Language of Parts (AA) | Not Applicable today | Becomes applicable as soon as the UI ships a second locale, or when a content entry in another locale renders inside an English page — a real near-term gap for `i18n/admin` |
| 3.2.1 / 3.2.2 On Focus / On Input (A) | Delegated | |
| 3.3.1–3.3.3 (A/AA) | Delegated | Covered per page; `auth/a11y.spec.ts:23,35,60,74` scans **error-visible** states, which is the right pattern |
| 3.3.4 Error Prevention (AA) | Supports | Destructive actions use `ConfirmDialog`; navigation away from unsaved edits is guarded |
| 4.1.2 Name, Role, Value (A) | Partially Supports | Radix primitives handle this; the unnamed focusable scrollport (`♿ A11Y-app-admin-04`) is the known exception |
| 4.1.3 Status Messages (AA) | Supports for toasts and lists | The toast live region is mounted at app start; several pages ship `role="status" aria-live="polite"` result counts (e.g. `packages/users/admin/src/lib/presentation/pages/MembersPage/index.tsx:237`, `packages/content/admin/src/lib/presentation/components/CollectionRecordsView/LoadedRecordsView/index.tsx:531`). **Route changes are the gap** (`♿ A11Y-app-admin-02`) |
| 2.4.11 Focus Not Obscured (AA, **WCAG 2.2 — advisory, out of scope for 508**) | Flagged | Bottom-right toasts over the bottom-right copilot dock |
| 2.5.8 Target Size (AA, **WCAG 2.2 — advisory, out of scope for 508**) | Flagged | Icon-only sidebar and table row actions are the candidates to measure |
| 503.4 Caption / audio controls | Not Applicable | The admin plays no media of its own; the WYSIWYG's resizable **video** embeds (`CONTEXT-MAP.md`, wysiwyg/admin) make this applicable to that plugin |

**508 Chapter 5 — Authoring Tools (504).** `apps/admin` *is* the authoring tool, but it
implements none of the authoring behaviour itself — it composes the plugins that do. So the
verdicts belong to `content/admin`, `wysiwyg/admin` and `media/admin`, and are recorded here
as the app-level obligations they roll up to:

- **504.2 — a mode that produces WCAG-conformant content.** Applicable to `wysiwyg/admin`
  (TipTap: real headings, lists, tables with header cells and `scope`, link purpose). The
  editor ships callouts, tables, columns and resizable images/video
  (`CONTEXT-MAP.md`), so the question is whether its table tool emits `<th scope>` and
  whether its heading control emits real heading levels rather than styled paragraphs.
  **Not assessed in this artifact** — flagged as required for that unit's.
- **504.2.1 — accessibility information preserved across conversion/paste/save-reload.**
  Applicable to the same unit: does an image's alt text survive a save/reload round trip and
  a paste from Word/Google Docs? The rich-text value round-trips through a `richtext` field,
  so this is directly testable.
- **504.3 — prompt the author for accessibility information.** The high-value check: when an
  author inserts an image (from `media/admin`'s library or the `WYSIWYG_MEDIA_SLOT`), is
  alt text **prompted for**, and is there a way to mark an image **decorative**? A media
  library that stores no alt field at all would be a clear Does Not Support.
- **504.4 — shipped templates/defaults produce conformant content.** `apps/server/src/content/`
  ships the default content types (`article`, `author`, `page`, `seo_meta`, …). Whether
  their default field set nudges an author toward conformant output (e.g. an image field
  that requires alt) is an app-level composition decision made in that file.

## 5. E2E Coverage Map

`apps/admin-e2e` drives the **real** app (Playwright against the dev server) with `/api`
mocked via `page.route`, so it is genuine coverage of this unit's composition — unlike the
server side, there is no parallel composition root.

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F1/F8 boot | every spec in `apps/admin-e2e/src` | The composed app renders | ✅ E2E — implicit but total |
| F2 identity public routes | `apps/admin-e2e/src/auth/login.spec.ts`, `auth/accept-invite.spec.ts`, `auth/routing.spec.ts:12-21` | Sign-in and accept-invite render outside the shell; `/identity` redirects to `/identity/signin` | ✅ E2E |
| F3 shell layout + gate | `apps/admin-e2e/src/auth/private-routes.spec.ts:22-31,33-42,44-61`; `auth/routing.spec.ts:31-40` | Signed-out users are redirected from `/` and from unknown paths; signing in returns them; `/` renders inside the shell with `homePage.nav` visible | ✅ E2E |
| F4 workspace shell + interior nav | `apps/admin-e2e/src/workspaces/workspaces.spec.ts`, `workspaces/settings.spec.ts`, `workspaces/permissions.spec.ts` | The workspace shell and its nav render | ✅ E2E |
| F6 content + i18n + wysiwyg slot filling | `apps/admin-e2e/src/content/content-library.spec.ts`, `content/i18n.spec.ts`, `content/wysiwyg-fields.spec.ts`, `content/records-filter.spec.ts` | i18n's locale switcher/column/panel and the wysiwyg field control render **inside** content's surfaces — i.e. the ordering constraint at `src/main.tsx:27-35` held | ✅ E2E |
| F7 media / copilot / users / activity / api-tokens | `apps/admin-e2e/src/media/media-library.spec.ts`, `copilot/*.spec.ts` (9 files), `users/*.spec.ts`, `activity/*.spec.ts` | Each plugin's pages render and behave | ✅ E2E |
| F5 insights ordering | `apps/admin-e2e/src/insights/insights.spec.ts` | The dashboard renders with contributed widgets | ⚠️ PARTIAL — asserts the result, not the **last-wins section merge** the ordering comment (`src/main.tsx:21-26`) depends on |
| F9 pre-paint theme | `apps/admin-e2e/src/users/preferences.spec.ts` | Theme selection applies and persists | ⚠️ PARTIAL — no assertion that the **inline script** prevents a flash, which is the script's whole purpose |
| F15 dev server | `apps/admin-e2e` `baseURL` | Tests reach `:4200` | ✅ E2E — implicit |
| F16 `^/api/` proxy regex | — | — | ⚠️ PARTIAL — the e2e suite intercepts `/api` with `page.route`, so the **proxy** is bypassed entirely. The `/api-tokens` hard-refresh case the regex exists for (`vite.config.mts:14-21`) is never exercised |
| F12/F14 styles + tokens | `apps/admin-e2e/src/**/a11y.spec.ts` (`color-contrast` rule via axe) | Contrast on scanned pages, in one theme | ⚠️ PARTIAL — see `♿ A11Y-app-admin-03` |
| F19 typecheck | `admin:dev:typecheck` + `nx typecheck admin` in CI | Type errors fail | ⚠️ PARTIAL — a build-time guard, not a test |
| F10 title / lang, F11 viewport, F13 `@source` globs, F17 build, F18 vitest | — | — | ❌ NONE — `apps/admin/src` contains no spec file at all, so `nx test admin` runs zero tests |
| **a11y — axe** | `apps/admin-e2e/src/auth/a11y.spec.ts:17,23,35,48,60,74,89,101,107`; `users/a11y.spec.ts:18,24,37,44,59,66,73`; `workspaces/a11y.spec.ts:23,28,41,51,63,68`; plus `content/a11y.spec.ts`, `copilot/a11y.spec.ts`, `insights/a11y.spec.ts` | Zero violations across genuinely varied states — initial, loading skeleton, validation errors visible, error banners visible, open row menu, open wizard steps, empty state, no-access state, dead invite link, auth probe pending | ✅ E2E **for what axe can see** — and the state coverage is better than most codebases. ⚠️ PARTIAL as conformance: an axe scan with a dialog **closed** says nothing about the dialog, and none of this unit's seven ♿ findings is detectable by axe |
| **a11y — coverage gaps** | — | — | ❌ NONE for `media`, `shell`/home, `i18n`, `wysiwyg` — four surfaces with no axe suite, including the WYSIWYG editor, which is the single most 504-relevant component in the product |
| **a11y — keyboard** | `apps/admin-e2e/src/auth/keyboard.spec.ts:13,26,45,67`; `users/keyboard.spec.ts:16,25,39`; `workspaces/keyboard.spec.ts:18,31,42,69,84` | First focus stop; keyboard-only login and invite acceptance; source-order reachability; menu and wizard opening from the keyboard; arrow-key filter chips; Enter-to-open a row; keyboard colour-swatch selection | ✅ E2E for those flows |
| **a11y — skip link, route focus, title, dark-theme contrast, reflow, forced-colors** | — | — | ❌ NONE |

**Coverage tally:** `19 features · 8 ✅ · 6 ⚠️ · 5 ❌`
**♿ tally:** `7 findings — 1 Supports · 2 Partially Supports · 3 Does Not Support · 1 Unverified` (plus 1 Not Applicable verdict for public-route bypass blocks and 1 for 503.4).

## 6. 🐞 Potential Bugs

### 🐞 BUG-app-admin-01 — Two plugins the app imports are missing from its package manifest · Severity: Medium

**Location:** `apps/admin/package.json` `dependencies` versus `apps/admin/src/main.tsx:6,13`
**Category:** correctness

**What the code does:** `main.tsx` imports thirteen `@ortha-cms/*` packages:

```ts
import { I18nPlugin } from '@ortha-cms/i18n-admin';        // line 6
import { CopilotPlugin } from '@ortha-cms/copilot-admin';  // line 13
```

but the manifest declares eleven — `activity-admin`, `api-tokens-admin`, `bootstrap-admin`,
`content-admin`, `identity-admin`, `insights-admin`, `media-admin`, `shell-admin`,
`users-admin`, `workspaces-admin`, `wysiwyg-admin`. **`@ortha-cms/i18n-admin` and
`@ortha-cms/copilot-admin` are absent.** (Verified programmatically by diffing the import
list against the dependency keys; the reverse check finds no unused declarations, so the
list was clearly meant to be exhaustive.)

**Why it is wrong:** it resolves today only because npm workspaces hoists every package into
the root `node_modules`, so an undeclared dependency is indistinguishable from a declared one
at runtime. The manifest is nonetheless the app's stated contract, and three things read it:
a fresh install in a non-hoisting layout, any dependency-audit or license tooling, and the
release pipeline's manifest rewrite (`docs/releasing.md`: "`pack` stages a rewritten manifest
under `dist/pack/`, because the workspace resolves from source and a consumer cannot"). The
app is `private: true` so it is not itself published — but it is the reference example every
new plugin registration is copied from, and the same omission in a published package would
ship a broken tarball.

**Repro:**
```bash
node -e "
const pkg=require('./apps/admin/package.json');
const src=require('fs').readFileSync('apps/admin/src/main.tsx','utf8');
const imports=[...src.matchAll(/from '(@ortha-cms\/[^']+)'/g)].map(m=>m[1]);
console.log(imports.filter(i=>!Object.keys(pkg.dependencies).includes(i)));
"
```
→ Observed: `[ '@ortha-cms/i18n-admin', '@ortha-cms/copilot-admin' ]`.
→ Expected: `[]`.

**Blast radius:** no runtime impact in this repo's layout; a correctness and
tooling-integrity issue that would become real for a non-hoisted install or a published
consumer.
**Suggested fix:** add both to `apps/admin/package.json`, and add a CI check (or an
`nx sync`-style lint) that every `@ortha-cms/*` import in an app or package is declared in
its manifest.

### 🐞 BUG-app-admin-02 — Plugin order silently decides slot item order and which section override wins, and `main.tsx`'s comments describe a stronger constraint than the code actually has · Severity: Low

**Location:** `apps/admin/src/main.tsx:17-47`
**Category:** correctness (documentation vs. behaviour)

**What the code does:** the array carries three ordering rules, each explained in a comment
and enforced by nothing:

```ts
// Insights goes first among the workspace-interior features: … section
// contributions merge by id with the LAST one winning …
InsightsPlugin(),
// Workspace-interior features — they only contribute to the workspace
// shell's rail/route slots, so they must follow WorkspacesPlugin().
ContentPlugin(),
// Contributes only to the Content Library's extension slots, so it
// must follow ContentPlugin().
I18nPlugin(),
```

**Why it is wrong — and, importantly, *how much* it is wrong.** Verification of the source
does **not** support the strong reading these comments invite (that a mis-ordered plugin
loses its contributions). Two mechanisms rule that out:

- A slot is a **module-level singleton** created at import time, not at plugin-factory time
  (`packages/content/admin/src/lib/presentation/slots/contentSlots/index.ts:66,109,161,…`,
  all `export const … = createSlot(…)`), and `createSlot` closes over a plain array
  (`packages/utils/admin/src/lib/slot/index.ts:31-37`).
- `createAdmin` registers **every** plugin's contributions in one pass *before* render
  (`packages/bootstrap/admin/src/lib/createAdmin/index.tsx:51-55`), and consumers read
  `getItems()` during render. So `I18nPlugin()` placed *before* `ContentPlugin()` still
  pushes into the same array the Content Library reads — the locale switcher, Locales column,
  entry sidebar widget and locale filters all still appear.

What order **does** decide is real but narrower:

1. **Item order within a slot** is push order, so moving a plugin reorders the toolbar
   controls, the records columns and the entry-menu items it contributes. Insights sorts by
   an explicit `order` first and only falls back to registration order for ties
   (`packages/insights/admin/src/lib/utils/resolveInsightsLayout/index.ts:104-108`), but the
   content slots have no such tie-breaker.
2. **Section overrides are last-wins, field by field**
   (`resolveInsightsLayout/index.ts:49-72`), so a plugin registered after `InsightsPlugin()`
   overrides a band's title/icon while keeping its first position. Moving `InsightsPlugin()`
   after a plugin that overrides a band silently flips which title wins.

So the defect is that three comments assert hard "must follow" constraints that the runtime
does not enforce **and does not need** — a reader who trusts them will mis-diagnose a real
ordering bug, and a reader who tests them will find they can be violated with no effect. The
one genuinely order-sensitive, silent-failure mechanism in the host is `layout` (first plugin
contributing one wins), filed separately as
`docs/testing/bootstrap-admin.md` `🐞 BUG-bootstrap-admin-01`.

**Repro:**
1. Swap `ContentPlugin()` (`:29`) and `I18nPlugin()` (`:32`).
2. `npm run dev`; open a localized collection.
→ Observed: **everything still works** — the locale switcher, Locales column and locale
filters are all present, contradicting the comment at `:30-31`. Only the relative position of
i18n's contributions inside each slot changes.
3. Now move `InsightsPlugin()` (`:26`) to the end of the array and reload `/insights`.
→ Observed: any band title another plugin overrides now resolves to the *built-in* default
instead of the override, with no warning. → Expected: either an explicit `order` on section
contributions so the outcome does not depend on array position, or comments that say what is
actually true.

**Blast radius:** low. Nothing disappears; a maintainer's mental model and the Insights band
titles are what is at risk. `apps/admin-e2e` would not catch the Insights case, since no suite
asserts a band title's provenance.
**Suggested fix:** correct the three comments to describe ordering as affecting *item order
and section-override precedence* rather than presence, and give `INSIGHTS_SECTION_SLOT`
contributions an explicit precedence field so the merge outcome is declared rather than
positional.

### 🐞 BUG-app-admin-03 — The API base URL is hard-coded in two places, so the SPA cannot be deployed on a different origin from the API · Severity: Low

**Location:** `apps/admin/vite.config.mts:23-28` (dev) and `packages/utils/admin/src/lib/apiClient/index.ts:14-17` (runtime)
**Category:** correctness (deployability)

**What the code does:**

```ts
// vite.config.mts — dev only
proxy: { '^/api/': { target: 'http://localhost:3000', changeOrigin: true } }

// utils-admin — every environment
export const apiClient = axios.create({ baseURL: '/api', withCredentials: true });
```

Neither reads an environment variable; there is no `import.meta.env.VITE_API_URL` anywhere in
the repo.

**Why it is wrong:** two separate limitations fall out of the same decision.

1. **Dev:** the proxy target is the literal `http://localhost:3000`. A contributor running the
   API on another port (because 3000 is taken, or against a shared staging API) must edit a
   checked-in file, which then shows up in every `git status`.
2. **Production:** `baseURL: '/api'` means the built SPA can only ever talk to an API served
   from its own origin. Putting `dist/` on a CDN or object store with the API elsewhere — the
   normal way to deploy a static SPA — is impossible without a code change, and would
   additionally require CORS, which `packages/bootstrap/server` never enables (no
   `app.enableCors()` call exists). Nothing in `apps/admin/AGENTS.md` or the README records
   this constraint.

**Repro:**
1. Start the API on `PORT=3001`.
2. `npm run dev`, sign in.
→ Observed: every request 502s through the proxy; the only fix is editing
`vite.config.mts:25`. → Expected: `VITE_API_TARGET` (dev) and a build-time or
runtime-configurable `baseURL` (production), or an explicit documented statement that
same-origin deployment is required.

**Blast radius:** contributor friction, plus a deployment topology that is silently
unsupported.
**Suggested fix:** read the proxy target from `process.env.VITE_API_TARGET` with the current
value as the default, and let `apiClient`'s `baseURL` fall back to
`import.meta.env.VITE_API_BASE_URL ?? '/api'` — documenting that a cross-origin choice also
requires server CORS.

**Checked and cleared** (no defect found): the `^/api/` **regex** proxy key is correct and its
reasoning holds — a plain `/api` string key prefix-matches and would swallow the `/api-tokens`
SPA route on a hard refresh (`vite.config.mts:16-22`); every request `apiClient` makes is
`baseURL: '/api'` plus a rooted path, so it always carries the trailing slash the regex
needs. The pre-paint theme script (`index.html:11-35`) is correct: it mirrors
`AppearanceProvider`'s key and resolution, handles a corrupt stored value by falling back to
`system`, sets both the `.dark` class and `style.colorScheme` (so native controls follow), and
wraps everything in `try`/`catch` so a blocked `localStorage` cannot break boot. The viewport
meta (`index.html:8`) permits zoom — no `maximum-scale`, no `user-scalable=no`, which is the
usual 1.4.4 failure and is absent here. `src/styles.css`'s use of `@theme` rather than
`@theme inline` is deliberate and correctly explained (`:26-27`) — it is what makes the
runtime dark override work. The `@source` globs (`:8-10`) correctly cover both the flat
design-system path and the grouped `packages/*/admin` layout. The plugin **list content**
matches `CONTEXT-MAP.md`'s inventory exactly — no admin plugin is missing from the registry.
And `apps/admin/AGENTS.md`'s claim that this app "holds almost no logic" is accurate:
`src/` contains exactly `main.tsx`, `styles.css` and `assets/`.

**Tally:** `3 🐞 — 0 Critical · 0 High · 1 Medium · 2 Low (0 🔒)` ·
`♿ 7 findings — 1 Supports · 2 Partially Supports · 3 Does Not Support · 1 Unverified`

## 7. Recommended E2E Tests

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | `apps/admin-e2e` (POM + `page.route` mock) | `apps/admin-e2e/src/a11y/spa-navigation.spec.ts` | ♿ For each of five routes: `document.title` is unique and non-"Admin", and after a sidebar navigation `document.activeElement` is within `#main-content`. Currently fails on both | `♿ A11Y-app-admin-01`, `♿ A11Y-app-admin-02` |
| 2 | `apps/admin-e2e` | `apps/admin-e2e/src/media/a11y.spec.ts`, `shell/a11y.spec.ts`, `content/wysiwyg-a11y.spec.ts`, `content/i18n-a11y.spec.ts` | ♿ axe (via `makeAxe`, following `apps/admin-e2e/src/support/a11y.ts`) over the four surfaces with **no** suite today — including the WYSIWYG editor **open**, the media upload dialog **open**, and the locale switcher **open**, since a scan with an overlay closed proves nothing about it | The four ❌ a11y coverage gaps |
| 3 | `apps/admin-e2e` | extend `apps/admin-e2e/src/auth/keyboard.spec.ts` | ♿ First `Tab` after load focuses a **visible** "Skip to main content" link; `Enter` moves focus into `<main id="main-content">`; the next `Tab` is page content. Also assert every tab stop between them has a visible focus indicator — which will surface `♿ A11Y-app-admin-04` | `♿ A11Y-app-admin-07`, `♿ A11Y-app-admin-04` |
| 4 | Unit (`apps/admin/src/__test__/plugins.spec.ts`, vitest — the app currently has **zero** tests) | registry invariants | `ShellPlugin` is the only plugin contributing a `layout` (the one genuinely order-sensitive slot); every plugin `name` is unique; and — the assertion that matters — reordering `ContentPlugin`/`I18nPlugin` leaves every content slot's item **set** unchanged, so the comments' "must follow" claim is either enforced or corrected | `🐞 BUG-app-admin-02`, F4, F5, F6 |
| 5 | Unit (`apps/admin/src/__test__/manifest.spec.ts`) | manifest integrity | Every `@ortha-cms/*` specifier imported by `src/main.tsx` appears in `package.json` `dependencies`. Currently fails with two entries | `🐞 BUG-app-admin-01`, EC-05 |
| 6 | `apps/admin-e2e` | `apps/admin-e2e/src/a11y/dark-theme.spec.ts` | ♿ Re-run every existing axe suite with the app forced to Dark, so `color-contrast` is enforced in both palettes — the `styles.css:22-24` claim currently holds for one theme only | `♿ A11Y-app-admin-03`, EC-14 |
| 7 | `apps/admin-e2e` | `apps/admin-e2e/src/a11y/reflow.spec.ts` | ♿ At 320 × 256 CSS px and at 400 % zoom, `document.documentElement.scrollWidth <= clientWidth` on the home, members, records and media pages, and the sidebar remains reachable; plus a text-spacing override pass asserting no clipping | `♿ A11Y-app-admin-05` (1.4.4 / 1.4.10 / 1.4.12) |
| 8 | `apps/admin-e2e` | `apps/admin-e2e/src/a11y/forced-colors.spec.ts` | ♿ With `forced-colors: active` emulated, focus indicators and control borders remain perceivable on the sidebar, buttons and table rows | `♿ A11Y-app-admin-06` (508 503.2) |
| 9 | `apps/admin-e2e` | `apps/admin-e2e/src/shell/api-down.spec.ts` | With every `/api` route mocked to 500 (and a second run to `abort()`), each top-level page shows a distinct **error** state — never the empty state — and offers a retry. Directly targets `.cursor/BUGBOT.md`'s "Error masquerading as empty" | EC-21, EC-22 |
| 10 | Unit (`apps/admin/src/__test__/theme-script.spec.ts`, jsdom) | pre-paint theme | The inline script from `index.html` applied to a jsdom document sets `.dark` + `colorScheme` for `dark`, for `system` + `prefers-color-scheme: dark`, falls back to `system` on a corrupt value, and does not throw when `localStorage` throws | F9, EC-07, EC-08 |
| 11 | `apps/admin-e2e` (running against the **real** dev server, proxy not mocked) | `apps/admin-e2e/src/shell/spa-fallback.spec.ts` | A hard refresh on `/api-tokens` serves the SPA page, not `Cannot GET /api-tokens` — the one behaviour the `^/api/` regex exists for, currently untested because the suite mocks `/api` | F16, EC-17 |
| 12 | CI check | CSS purge guard | Build the admin and assert a known utility used only inside `packages/*/admin` survives in the emitted CSS — guarding the `@source` globs against a package added at a nesting depth the glob does not match | F13, EC-13 |
