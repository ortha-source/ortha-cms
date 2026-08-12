# admin-e2e — Test Artifact

> **Unit:** `apps/admin-e2e` · **Package:** `admin-e2e` (private) · **Kind:** app (test harness)
> **Source of truth:** `apps/admin-e2e/AGENTS.md`, `.agents/skills/admin-e2e/SKILL.md`
> **Findings verified:** 2026-08-11 — 27 confirmed · 1 deleted · 14 corrected · 3 unverified
> **Generated:** 2026-08-11

> **This artifact tests the tests.** The unit under audit is not a product feature — it is
> the Playwright harness that every admin-side quality claim rests on. A defect here does
> not break one page; it makes every suite that depends on it dishonest. A green run that
> proves nothing is strictly worse than a red one, so findings below are graded by *how
> much false confidence they manufacture*, not by how much UI they break.

---

## 1. Scope & Preconditions

### What this unit owns

`apps/admin-e2e` is the black-box browser harness for the admin SPA (`apps/admin`). It owns:

- the Playwright runner configuration (`playwright.config.ts`) — including the dev-server
  lifecycle and the browser matrix;
- the fixture layer (`src/support/fixtures.ts`) — 18 page-object fixtures plus the axe
  scanner factory;
- 19 Page Objects (`src/support/pages/*.ts`, including the shared `BasePage`) that own every selector;
- **the mock layer, "the seed"** (`src/support/api/*.ts`, 5 287 lines across 13 modules) —
  hand-written `page.route` interceptors that fabricate every `/api/**` response;
- the accessibility assertion helper (`src/support/a11y.ts`);
- 44 spec files / 418 test cases (`apps/admin-e2e/TESTS.md:7`);
- the generated catalog and its drift check (`tools/generate-test-catalog.mjs`).

### What it explicitly does **not** own

- **Any real HTTP round trip.** `page.route` intercepts in the browser before the request
  reaches Vite's `/api` proxy (`.agents/skills/admin-e2e/SKILL.md`, "Mocks bypass the dev
  proxy"). No server, no Postgres, no Docker. Consequently **it cannot detect a single
  server-side regression** — that is `apps/server-e2e`'s job.
- **Contract conformance between the mock and the real API.** Nothing type-checks a
  `route.fulfill` body against the server's DTO; every mocked payload is a hand-written
  object literal in a `.ts` file that imports no server type. §6 is largely a catalogue of
  where that has already drifted.
- **App source.** Specs import no admin code and navigate by URL string
  (`.agents/skills/admin-e2e/SKILL.md`, non-negotiable #2).

### Entry points

| Kind | Entry point | Where |
| --- | --- | --- |
| Runner config | default export | `apps/admin-e2e/playwright.config.ts:17` |
| Test factory | `test` (extended), `expect` | `src/support/fixtures.ts:53`, `:120` |
| Fixtures | 18 page objects + `makeAxe` | `src/support/fixtures.ts:22-47` |
| A11y assertion | `expectNoA11yViolations(axe)` | `src/support/a11y.ts:12` |
| Mock layer | 13 modules, ~40 exported `mock*`/`spy*` fns | `src/support/api/*.ts` |
| Nx targets | `catalog`, `catalog:check` declared (`apps/admin-e2e/package.json:9-30`); `e2e`, `lint`, `typecheck` are inferred by Nx plugins, not declared here | `apps/admin-e2e/package.json:9-30` |

### Runtime prerequisites

| Requirement | Detail |
| --- | --- |
| Node + npm workspaces | `npm ci` at the repo root. **`node_modules` is absent in a fresh checkout** — every command below fails until you install. |
| Playwright browsers | `npx playwright install chromium` (the config declares only chromium — `playwright.config.ts:33-37`). |
| Admin dev server | Started automatically by `webServer` (`playwright.config.ts:27-32`) via `npx nx run admin:serve` on `http://localhost:4200`. |
| Postgres / Docker | **Not required.** This is the harness's headline property. |
| `.env` | **Not required.** No env var is read except `BASE_URL` (`playwright.config.ts:6`). |
| A logged-in role | Faked. `mockSignedIn(page)` (`src/support/api/auth.ts:98`) returns a full-permission admin; narrow with `mockSignedIn(page, { permissions: [...] })`. |

### How to exercise it manually

```bash
npm ci
npx playwright install chromium

# Whole suite (starts the Vite dev server itself)
npx nx e2e admin-e2e

# One area, headed, with the inspector
npx nx e2e admin-e2e -- src/content --headed --debug

# One spec, one case
npx nx e2e admin-e2e -- src/auth/login.spec.ts -g 'rejects bad credentials'

# Static checks — these need no browser
npx nx run-many -t typecheck lint -p admin-e2e
npx nx catalog:check admin-e2e
```

### Dependencies that must be healthy for the tests to mean anything

1. **`apps/admin` builds and serves.** A Vite compile error surfaces as a blank page and
   dozens of unrelated locator timeouts, not as a build failure — Vite never typechecks
   (root `AGENTS.md`, "Commands").
2. **The mock layer matches the live API.** This is the load-bearing dependency and it is
   maintained entirely by hand. See §6 for the divergences found.
3. **`apps/server-e2e` covers what this suite mocks away.** The two are complements; a
   product area covered *only* here has no proof its API contract is real.
4. **axe-core 4.12.1** (`package-lock.json:19706`) via `@axe-core/playwright ^4.9.0`
   (`package.json:50`).

---

## 2. Feature Inventory

Harness capabilities, not product features.

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | Playwright config + Nx preset composition | `playwright.config.ts:17` | ⚠️ PARTIAL |
| F2 | Auto-started admin dev server (`webServer`) | `playwright.config.ts:27-32` | `🐞 BUG-admin-e2e-06` |
| F3 | Browser/project matrix | `playwright.config.ts:33-37` | `🐞 BUG-admin-e2e-16` |
| F4 | Trace capture on retry | `playwright.config.ts:23` | `🐞 BUG-admin-e2e-07` |
| F5 | `test`/`expect` fixture extension | `src/support/fixtures.ts:53`, `:120` | ✅ E2E (used by all 44 specs) |
| F6 | 18 page-object fixtures | `src/support/fixtures.ts:54-107` | ✅ E2E |
| F7 | `BasePage` shell chrome helpers (account menu, command palette) | `src/support/pages/BasePage.ts:13-53` | ✅ E2E |
| F8 | `BasePage` shared query-builder / filter-drawer helpers | `src/support/pages/BasePage.ts:55-180` | ✅ E2E |
| F9 | `makeAxe()` scanner factory (WCAG tag selection) | `src/support/fixtures.ts:108-117` | `♿ A11Y-admin-e2e-01` |
| F10 | `expectNoA11yViolations` assertion + summary | `src/support/a11y.ts:12-23` | `♿ A11Y-admin-e2e-02` |
| F11 | Auth seed: `mockLogin` / `mockSignedIn` / `mockSignedOut` | `src/support/api/auth.ts:18`, `:98`, `:121` | ✅ E2E |
| F12 | Session-loss injection: `mockUnauthorized` | `src/support/api/auth.ts:138` | ✅ E2E |
| F13 | Permission narrowing via `mockSignedIn({ permissions })` | `src/support/api/auth.ts:39-84` | ✅ E2E |
| F14 | Call spies (`spyLogin`, `spyLogout`, `spyInvite`, `spyEntrySave`, …) | `src/support/api/auth.ts:183`, `api/content.ts:1580` | ✅ E2E |
| F15 | Pending-state injection (`delayMs`) | `src/support/api/auth.ts:20`, `api/members.ts:194` | `🐞 BUG-admin-e2e-15` |
| F16 | Error-status injection (`status`, `listStatus`, `failing`) | `api/content.ts:1140`, `api/insights.ts:321` | ✅ E2E |
| F17 | Invites seed (`mockInvite`, `spyAcceptInvite`) | `src/support/api/invites.ts:28`, `:73` | ✅ E2E |
| F18 | Members seed + in-mock query-builder evaluator | `src/support/api/members.ts:145-179`, `:191` | ⚠️ PARTIAL (fail-open, `:164`) |
| F19 | Workspaces seed (list / create / settings) | `src/support/api/workspaces.ts:159`, `:184`, `:307` | `🐞 BUG-admin-e2e-10` |
| F20 | Content-schema seed (catalogue + detail) | `src/support/api/content.ts:791`, `:938` | `🐞 BUG-admin-e2e-03` |
| F21 | Content-entries fabrication engine (search/sort/paginate) | `src/support/api/content.ts:1048-1065`, `:1141-1230` | `🐞 BUG-admin-e2e-12` |
| F22 | Relation preview / per-field paging / relation writes | `api/content.ts:1252`, `:1407`, `:1458` | ✅ E2E |
| F23 | Entry media seed | `src/support/api/content.ts:1361` | ✅ E2E |
| F24 | Entry-revisions stateful flow mock | `src/support/api/revisions.ts:56` | ✅ E2E |
| F25 | i18n stateful locale/publish engine | `src/support/api/i18n.ts:185` | `🐞 BUG-admin-e2e-14` |
| F26 | Media library seed (assets/folders/upload spy/failure) | `src/support/api/media.ts:168`, `:151` | ✅ E2E |
| F27 | Copilot seed: conversations, transcripts, skills, spy | `src/support/api/copilot.ts:383` | ✅ E2E |
| F28 | Copilot **SSE run** stub (`text/event-stream`) | `src/support/api/copilot.ts:293`, `:529` | `🐞 BUG-admin-e2e-04` |
| F29 | Insights seed (10 widget endpoints, delay, per-widget failure) | `src/support/api/insights.ts:338` | ✅ E2E |
| F30 | Activity-log seed | `src/support/api/activity.ts:167` | ✅ E2E |
| F31 | User-detail seed (member, sessions, activity, update spy) | `src/support/api/userDetail.ts:45`-`:158` | `🐞 BUG-admin-e2e-05` |
| F32 | Preferences seed | `src/support/api/preferences.ts:19` | ✅ E2E |
| F33 | Per-`page` route reset (test isolation) | `src/support/api/auth.ts:15-17` (contract) | ✅ E2E |
| F34 | Generated test catalog + drift gate | `tools/generate-test-catalog.mjs`, `package.json:10-29` | `🐞 BUG-admin-e2e-01` |
| F35 | axe suite coverage across product areas | 20 spec files, 63 scans | ⚠️ PARTIAL (§4A) |
| F36 | Keyboard-operability suite coverage | `auth/`, `users/`, `workspaces/keyboard.spec.ts` | `🐞 BUG-admin-e2e-09` |
| F37 | CI execution of the suite | *(none)* | ❌ NONE — `BUG-admin-e2e-01` |

**Cleared on inspection** (checked, no defect found): no `test.skip` / `test.fixme` /
`.only` / `test.fail` anywhere in `src/` (verified by grep across all 44 specs); no
`disableRules` / `.exclude()` / `.include()` call on any AxeBuilder; media's `AssetResponse`
(`api/media.ts:4-26`) and `FolderResponse` (`:29-34`) match `AssetView`
(`packages/media/server/src/lib/types/asset-view.ts:7-29`) and `FolderView` field-for-field;
`ActivitySeed` (`api/activity.ts:4-13`) matches `ActivityEventView`
(`packages/activity/server/src/lib/activity/types/activity-view.ts:8-25`); the i18n mock
deep-copies its module-level seed per registration (`api/i18n.ts:195`) so no shared mutable
fixture leaks between tests in a file.

---

## 3. Manual Test Plan

Every block assumes the prerequisites in §1 are satisfied and that you are at the repo root.

### F1 — Playwright config + Nx preset composition

**Preconditions:** `npm ci` complete.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx playwright test --config apps/admin-e2e/playwright.config.ts --list` | Prints 418 cases across 44 files, all under project `chromium`. |
| 2 | Inspect the printed project list | Exactly one project name appears. If more than one, the config changed — update §2 F3. |
| 3 | `BASE_URL=http://localhost:9999 npx nx e2e admin-e2e -- src/auth/login.spec.ts` | Playwright still starts the dev server on 4200 (the `webServer.url` is hard-coded, `playwright.config.ts:29`) but navigates to 9999 → every test fails with `net::ERR_CONNECTION_REFUSED`. Confirms `BASE_URL` and `webServer.url` are not linked. |

### F2 — Auto-started admin dev server

**Preconditions:** nothing listening on 4200.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `lsof -i :4200` | No output. |
| 2 | `npx nx e2e admin-e2e -- src/auth/login.spec.ts` | Playwright logs it is starting the web server, waits for 4200, then runs. |
| 3 | Now start an unrelated server: `python3 -m http.server 4200` | Port occupied by something that is *not* the admin. |
| 4 | Re-run step 2 | **Observed:** the run proceeds against the impostor server and every test fails on a missing heading, with no message about the port. See `🐞 BUG-admin-e2e-06`. |

### F3 — Browser/project matrix

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx e2e admin-e2e -- --project=firefox` | `Error: Project(s) "firefox" not found.` Only `chromium` is declared. |
| 2 | Open `apps/admin-e2e/playwright.config.ts` and read lines 38-57 | Mobile Chrome / Mobile Safari / Edge / Chrome are present but commented out. No small-viewport project exists. |

### F4 — Trace capture on retry

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Temporarily break a locator in a scratch copy and run that spec | Test fails. |
| 2 | `ls apps/admin-e2e/test-output/**/trace.zip` (or the Nx-configured output dir) | **Observed:** no trace, because `trace: 'on-first-retry'` (`playwright.config.ts:23`) only fires on retry and no `retries` value is set in the repo. See `🐞 BUG-admin-e2e-07`. |
| 3 | Re-run with `--retries=1` | A `trace.zip` now appears; `npx playwright show-trace <path>` opens it. |

### F5/F6 — Fixture extension and page-object fixtures

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `grep -rn "from '@playwright/test'" apps/admin-e2e/src/*/*.spec.ts` | No matches — every spec imports from `../support/fixtures`. |
| 2 | `grep -c "await use(new" apps/admin-e2e/src/support/fixtures.ts` | 18 — one per page object in the `Fixtures` interface (`fixtures.ts:22-40`). |
| 3 | `grep -rn "page.getBy" apps/admin-e2e/src/*/*.spec.ts \| grep -v support` | Any hit is a violation of non-negotiable #1 (selectors belong in a Page Object). |

### F7 — `BasePage` shell chrome helpers

**Preconditions:** signed-in mock (`mockSignedIn`).

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx e2e admin-e2e -- src/users/account-menu.spec.ts --headed` | Browser opens, clicks the button named **"Account menu"** (`BasePage.ts:15`), the menu renders `menuitem`s "My profile" / "Logout". |
| 2 | `npx nx e2e admin-e2e -- src/shell/command-palette.spec.ts --headed` | The sidebar button named exactly **"Search"** (`BasePage.ts:32`) opens a palette whose input placeholder is **"Search or jump to…"** (`BasePage.ts:43`). |

### F8 — Shared query-builder helpers

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx e2e admin-e2e -- src/users/members-filter.spec.ts --headed` | The toolbar button matching `/^Filters/` opens a `dialog` named **"Query Builder"** (`BasePage.ts:62`). |
| 2 | In the drawer, watch the spec add a rule | "Add rule" click, then three comboboxes appear in field/operator/value order (`BasePage.ts:88-131`). |
| 3 | `npx nx e2e admin-e2e -- src/activity/activity-filter.spec.ts --headed` | Same helpers drive an **inline panel** rather than a drawer, because `ActivityLogPage` overrides `filterSurface()` (`BasePage.ts:70`). |

### F9/F10 — axe scanner and assertion

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx e2e admin-e2e -- src/auth/a11y.spec.ts` | 9 scans pass. |
| 2 | Read `src/support/fixtures.ts:110-115` | Tags are exactly `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`. `best-practice` is **absent** — see `♿ A11Y-admin-e2e-01`. |
| 3 | Read `src/support/a11y.ts:13` | `const { violations } = await axe.analyze();` — `incomplete` is destructured away. See `♿ A11Y-admin-e2e-02`. |
| 4 | Force a failure: add an `<img>` with no alt to a page under test and re-run | Failure message is `• image-alt (critical) — 1 node(s): …` followed by the CSS target, i.e. the summary format at `a11y.ts:16-21`. |

**Keyboard-only path:** not applicable — F9/F10 are assertions, not UI.
**Screen-reader expectation:** not applicable.

### F11/F12/F13 — Auth seed, session loss, permission narrowing

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx e2e admin-e2e -- src/auth/login.spec.ts` | All cases pass. `mockLogin(page, { status: 401 })` produces the banner titled **"Authentication failed"**. |
| 2 | `npx nx e2e admin-e2e -- src/auth/private-routes.spec.ts` | `mockSignedOut` → every private route redirects to `/identity/signin`. |
| 3 | `npx nx e2e admin-e2e -- src/workspaces/permissions.spec.ts --headed` | `mockSignedIn(page, { permissions: [] })` hides the create button and renders the no-access state. |
| 4 | Verify the permission catalogue | `src/support/api/auth.ts:39-67` lists 20 keys including `copilot:use` and `copilot:skills:manage`. Compare against `PERMISSIONS` in `@ortha-cms/identity-server` — a key added there and not here silently blinds every "admin sees everything" suite (the comment at `auth.ts:58-62` records exactly that happening once). |

### F14 — Call spies

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx e2e admin-e2e -- src/auth/login.spec.ts -g 'does not call the API'` | Passes; `spyLogin(page).count` stays `0` (`login.spec.ts:66`). |
| 2 | `npx nx e2e admin-e2e -- src/content/wysiwyg-fields.spec.ts -g 'saves'` | `spyEntrySave` captures request bodies; assertions read `saves.bodies[0].values['body']` (`wysiwyg-fields.spec.ts:236`). |
| 3 | Confirm the spy is a getter, not a snapshot | `src/support/api/auth.ts:194-196` — `get count()`. Reading it before the request settles returns a stale 0; specs must `await expect.poll(() => spy.count)` (as `auth/keyboard.spec.ts:64` does) rather than a bare `expect`. |

### F15 — Pending-state injection

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx e2e admin-e2e -- src/users/a11y.spec.ts -g 'loading skeleton' --headed` | The Members skeleton stays on screen (held by `delayMs: 30_000`, `users/a11y.spec.ts:31`) while axe scans. |
| 2 | Time the case | It must finish well inside Playwright's 30 s default. See `🐞 BUG-admin-e2e-15`. |

### F16 — Error-status injection

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx e2e admin-e2e -- src/insights/a11y.spec.ts -g 'failed widget'` | `mockInsightsApi(page, { failing: ['content/stale','media/alt'] })` yields two error cards while neighbours load. |
| 2 | Note the required timeout | An error state is ~7 s away because TanStack Query retries 3× (`apps/admin-e2e/AGENTS.md`, "Gotchas"). Any error assertion needs `{ timeout: 15_000 }`. |

### F17-F32 — the per-domain seeds

Each follows the same shape; run the paired spec and confirm the seed's documented behaviour.

| Feature | Command | Expected result |
| --- | --- | --- |
| F17 invites | `npx nx e2e admin-e2e -- src/auth/accept-invite.spec.ts` | 404 invite → "unavailable" heading; valid invite → prefilled read-only name/email. |
| F18 members | `npx nx e2e admin-e2e -- src/users/members-filter.spec.ts` | `?filter=` JSON is evaluated in-mock (`api/members.ts:145`); unknown ops **match everything** (`:164`) — a filter regression can pass. |
| F19 workspaces | `npx nx e2e admin-e2e -- src/workspaces/workspaces.spec.ts` | 4 active + 2 archived cards from `WORKSPACES_SEED` (`api/workspaces.ts:35`). |
| F20 content schema | `npx nx e2e admin-e2e -- src/content/content-library.spec.ts` | Sidebar groups "Collections" / "Pages"; `Blog posts` selectable. |
| F21 entries | same spec, `-g 'sorts records'` | Table sorts asc → desc → off; the mock re-sorts server-side (`api/content.ts:1088`). |
| F22 relations | `npx nx e2e admin-e2e -- src/content/relations.spec.ts` | Relation previews appear **only** with `?relations=preview&relationFields=` (`api/content.ts:1189-1207`). |
| F23 entry media | `npx nx e2e admin-e2e -- src/content/media-fields.spec.ts` | "Cover image" replaces; "Gallery" appends + reorders. |
| F24 revisions | `npx nx e2e admin-e2e -- src/content/entry-revisions.spec.ts` | Restore mutates the mock's state and the next read reflects it. |
| F25 i18n | `npx nx e2e admin-e2e -- src/content/i18n.spec.ts` | `de` row `lp-de-1` reads **Modified** (draft + `publishedAt`, `api/i18n.ts:117-123`). |
| F26 media | `npx nx e2e admin-e2e -- src/media/media-library.spec.ts` | `hero.png` tile; `failMediaReads` produces the error state. |
| F27/F28 copilot | `npx nx e2e admin-e2e -- src/copilot/agents-chat.spec.ts` | The scripted run renders prose → tool step → change card → prose, in order. |
| F29 insights | `npx nx e2e admin-e2e -- src/insights/insights.spec.ts` | 10 widgets render; the range picker re-requests. |
| F30 activity | `npx nx e2e admin-e2e -- src/activity/audit-log.spec.ts` | Rows show actors; a null actor renders **"System"**. |
| F31 user detail | `npx nx e2e admin-e2e -- src/users/user-detail.spec.ts` | Sessions list + Activity tab render. |
| F32 preferences | `npx nx e2e admin-e2e -- src/users/preferences.spec.ts` | No `PUT` fires when nothing changed (`preferences.spec.ts:96`). |

### F33 — Per-`page` route reset

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Run any spec file with 2+ tests where only the first registers a mock | The second test's request is **not** intercepted → it reaches Vite → `/api/...` 404s or proxies. |
| 2 | Confirm the contract | Routes are registered on the per-test `page`, so they die with the browser context (`api/auth.ts:15-17`). This is the FE analogue of `resetDb()`. |
| 3 | Confirm route precedence | Playwright runs the **most recently registered** matching handler first; the seeds rely on this (`api/content.ts:1249-1251`, "Register **after** `mockContentEntryWrites`"). |

### F34 — Generated catalog + drift gate

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx catalog:check admin-e2e` | Exit 0 when `TESTS.md` matches the spec AST. |
| 2 | Rename a `test('…')` title, re-run | Non-zero exit naming the drift. |
| 3 | `npx nx catalog admin-e2e && git diff apps/admin-e2e/TESTS.md` | The regenerated file shows the rename. |
| 4 | `grep -rn "catalog:check" .github/workflows/` | **Observed:** no matches. `apps/admin-e2e/AGENTS.md` claims "CI runs `npx nx catalog:check admin-e2e`". It does not. See `🐞 BUG-admin-e2e-01`. |

### F35 — axe suite coverage

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `grep -rlc expectNoA11yViolations apps/admin-e2e/src/**/*.spec.ts` | 20 files contain scans; 24 contain none. |
| 2 | `grep -rc "expectNoA11yViolations(" apps/admin-e2e/src/**/*.spec.ts` | 63 scan calls total. Distribution and gaps are tabulated in §4A. |

### F36 — Keyboard suites

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx e2e admin-e2e -- src/auth/keyboard.spec.ts` | 4 cases pass. This is the **only** file that presses `Tab` (5 occurrences, `auth/keyboard.spec.ts:22,79,81,83,85`). |
| 2 | `grep -rn "press('Shift+Tab')" apps/admin-e2e/src` | No matches anywhere. Reverse focus order is untested. |
| 3 | `grep -c toBeFocused apps/admin-e2e/src/users/keyboard.spec.ts` | `0`. See `🐞 BUG-admin-e2e-09`. |

### F37 — CI execution

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `ls .github/workflows/` | `release.yml` only. |
| 2 | `grep -n "run:" .github/workflows/release.yml` | `npm ci`, git identity, `npx nx run-many -t typecheck`, `npx nx release`. No `e2e`, no `lint`, no `test`, no `catalog:check`. |
| 3 | Conclude | **Nothing in CI ever executes this harness.** See `🐞 BUG-admin-e2e-01`. |

---

## 4. Edge Cases & Negative Paths

Grouped by the harness mechanism they stress.

#### Mock fidelity — shape drift

- **EC-01 — A content type's `paranoid` flag never arrives.** `❌ NONE`
  Trigger: open any collection's records view in any admin-e2e suite.
  Expected: `SerializedContentTypeSummary` always carries `paranoid: boolean`
  (`packages/content/server/src/lib/registry/content-type-registry.ts:66`).
  Suspected: `ContentTypeSummary` in the seed omits it entirely
  (`api/content.ts:5-13`), so `schema.paranoid ?? false`
  (`packages/content/admin/src/lib/presentation/components/CollectionRecordsView/LoadedRecordsView/index.tsx:146`) is always `false`, the
  "View Trash" button at `:422` never renders, and the whole soft-delete surface is
  unreachable → `🐞 BUG-admin-e2e-03`.
- **EC-02 — A content type's `i18n` flag never arrives from the main seed.** `⚠️ PARTIAL`
  Only `api/i18n.ts:41,212` sets `i18n: true`; `CONTENT_SCHEMA_SEED`, `RELATIONS_SCHEMA_SEED`,
  `MEDIA_FIELDS_SCHEMA_SEED` and `WYSIWYG_SCHEMA_SEED` all omit it. Any interaction between
  localization and relations/media/wysiwyg is structurally unreachable.
- **EC-03 — `publishable` is optional in the seed, required on the wire.** `⚠️ PARTIAL`
  `api/content.ts:12` declares `publishable?: boolean`; the server always emits it
  (`content-type-registry.ts:65`). `CONTENT_SCHEMA_SEED` (`api/content.ts:46-51`) omits it on
  all four types, so the catalogue list and the detail read disagree with each other inside
  the same harness.
- **EC-04 — `WorkspaceView.content` absent on 5 of 6 seeded workspaces.** `⚠️ PARTIAL`
  Server type: `content: string[]`, required (`packages/workspaces/server/src/lib/workspace/application/queries/workspace.view.ts:32`).
  Seed type: `content?: string[]` (`api/workspaces.ts:20`), present only on `ws_marketing`.
  → `🐞 BUG-admin-e2e-10`.
- **EC-05 — `MemberWorkspaceView.description` missing from the members seed.** `❌ NONE`
  Server declares `description: string | null` (`packages/users/server/src/lib/member/application/queries/member.view.ts:18`);
  `WorkspaceSeed` (`api/members.ts:11-15`) has only `id`/`name`/`color` → `🐞 BUG-admin-e2e-11`.
- **EC-06 — Envelope `publishedAt` never emitted by the entries engine.** `❌ NONE`
  `entriesFor()` (`api/content.ts:1048-1065`) emits `status` but never `publishedAt`, so the
  **Modified** badge (`status:'draft'` + non-null `publishedAt`,
  `packages/content/admin/src/lib/domain/entryStatusView/index.ts:61`) cannot appear in the
  records table → `🐞 BUG-admin-e2e-12`.
- **EC-07 — `blog_post` declares a *field* named `publishedAt`.** `⚠️ PARTIAL`
  `api/content.ts:102-108` puts a `datetime` field called `publishedAt` in `values`, which
  shadows the envelope column of the same name. `content-library.spec.ts:582` comments that
  "the seed's first row carries `publishedAt: 2026-01-01…`" — that is the *field*, not the
  envelope. A reader cannot tell which contract is under test.
- **EC-08 — SSE frames carry no `event:` name line.** `❌ NONE`
  Real: `event: ${event.type}\ndata: ${json}\n\n`
  (`packages/copilot/server/src/lib/chat/http/sse-stream.ts:60-62`).
  Mock: `data: ${json}\n\n` only (`api/copilot.ts:293-294`) → `🐞 BUG-admin-e2e-04`.
- **EC-09 — SSE comment frames (`: open`, `: ping`) never sent.** `❌ NONE`
  The server opens with `: open\n\n` (`sse-stream.ts:40`) and heartbeats every 15 s (`:45`).
  `parseFrame` documents these as its expected `null` case
  (`packages/copilot/admin/src/lib/application/runStream.ts:132-140`) but the harness never
  produces one.
- **EC-10 — `run-started` lacks `messageId`; `tool-result` lacks `name`; `done` lacks `usage`.** `❌ NONE`
  Required by `RunStartedEvent.messageId`, `RunToolResultEvent.name`, `RunDoneEvent.usage`
  (`packages/copilot/domain/src/lib/run/run-event.ts:22,53,164`). Mock frames at
  `api/copilot.ts:305,316-321,342`.
- **EC-11 — Whole SSE body arrives in one read.** `⚠️ PARTIAL`
  `runStream`'s chunk-boundary buffering (`runStream.ts:103,111-122`) — a frame split across
  two TCP reads — is never exercised. That is the single most fragile line in the client.
- **EC-12 — Nest's error envelope is never reproduced.** `⚠️ PARTIAL`
  Mocks return `{ message: '…' }` (`api/auth.ts:32`, `api/content.ts:1155`). A real Nest
  `HttpException` body is `{ statusCode, message, error }` and for a `ValidationPipe` failure
  `message` is a **string[]**. `errorMessage()` handles the array
  (`runStream.ts:154-157`) but no admin-e2e spec ever feeds it one.

#### Mock fidelity — behaviour drift

- **EC-13 — `userDetail.mockActivity` ignores `?subjectId=`.** `❌ NONE` 🔒
  `api/userDetail.ts:139-155` returns the seeded events verbatim and the JSDoc admits it. A
  regression where the User-detail Activity tab requests *another user's* audit trail is
  invisible → `🐞 BUG-admin-e2e-05`.
- **EC-14 — Every mock answers regardless of `X-Workspace-Id`.** `❌ NONE` 🔒
  `grep -rn "X-Workspace-Id" apps/admin-e2e/src` returns exactly one **comment**
  (`copilot/dock.spec.ts:64`) and zero assertions. The header is set by an axios interceptor
  (`packages/utils/admin/src/lib/apiClient/index.ts:42-47`); dropping it or sending a stale
  workspace id would pass every suite → `🐞 BUG-admin-e2e-02`.
- **EC-15 — The members filter evaluator fails open.** `⚠️ PARTIAL`
  `matchesNode`'s `default: return true` (`api/members.ts:163-165`) means an operator the
  admin newly emits (say `between`) silently matches every row, so a broken filter renders a
  full table and the spec's "rows are filtered" assertion is the only thing that could catch
  it — and only if the expected set is smaller.
- **EC-16 — i18n list never returns created rows.** `⚠️ PARTIAL`
  `const items = seeded.filter(...)` (`api/i18n.ts:~265`) while creates go into a separate
  `created` array that only `allRows()` reads. "Create a translation, then see it in the
  list" cannot be modelled → `🐞 BUG-admin-e2e-14`.
- **EC-17 — Route-pattern anchoring in the content-schema seed.** Cleared.
  Checked and found correct: `mockContentSchemaDetail` registers
  `/\/api\/content-schema\/([^/?]+)(\?.*)?$/` (`api/content.ts:973`) — **end-anchored** —
  after the `/filter-fields` pattern (`:948`), and its own docstring records why
  (`:934`, "The detail pattern is end-anchored so it no longer also swallows the
  `/filter-fields` request"). The one genuinely unanchored pattern in the module is
  `mockContentEntryWrites`'s `/\/api\/content\/[^/?]+\/.+/` (`:1465`), which is
  deliberate — it has to match every write sub-route.

#### Assertion quality

- **EC-18 — `focus()` immediately followed by `toBeFocused()`.** `⚠️ PARTIAL`
  `workspaces/keyboard.spec.ts:23-24`, `:34-35`, `:52-53`, `:76-77`, `:93-94`. Calling
  `.focus()` succeeds on any focusable element, including `tabindex="-1"`; asserting it took
  is a tautology. The test names claim "reachable", which is not what is proven
  → `🐞 BUG-admin-e2e-09`.
- **EC-19 — `users/keyboard.spec.ts` asserts no focus at all.** `⚠️ PARTIAL`
  Three `.focus()` calls, zero `toBeFocused` (verified by grep). "The row menu opens from the
  keyboard" (`:39-48`) proves only that `Enter` on a programmatically-focused trigger opens a
  menu — true even if the trigger were unreachable by `Tab`.
- **EC-20 — Permissive matchers on absent elements.** `⚠️ PARTIAL`
  `toBeHidden()` and `toHaveCount(0)` both pass when the locator matches nothing, so a typo
  in a Page Object selector turns a real regression green. **47** `toBeHidden()` calls across
  **17** spec files (recounted; `workspaces/settings.spec.ts` alone has 7, `content-library`
  and `agents-view` 6 each). The safe shape is to assert the element exists in the positive
  case *in the same spec*, which most but not all of these do.
- **EC-21 — Hard-coded sleeps instead of web-first assertions.** `⚠️ PARTIAL`
  `content/content-library.spec.ts:396,398,400` — three `page.waitForTimeout(200)` calls
  around a dnd-kit keyboard drag → `🐞 BUG-admin-e2e-08`.
- **EC-22 — `delayMs: 30_000` equals the default test timeout.** `⚠️ PARTIAL`
  `users/a11y.spec.ts:31`, `workspaces/a11y.spec.ts:35`, `auth/a11y.spec.ts:114`. The route
  handler holds a live `setTimeout` for the whole window; the case must finish first
  → `🐞 BUG-admin-e2e-15`.
- **EC-23 — Un-awaited `expect(...)`.** Cleared.
  All **135** bare (un-`await`ed) `expect(` occurrences are synchronous matchers on plain
  values (`expect(spy.count).toBe(1)`, `expect(body).toContain('<th')` etc.), not locator
  assertions. Verified by grepping every bare `expect(` together with the two following
  lines for locator matchers (`toBeVisible`/`toBeHidden`/`toBeFocused`/`toHaveText`/
  `toHaveURL`/`toHaveCount`/`toHaveAttribute`/`toBeEnabled`/`toBeDisabled`/`toBeChecked`):
  the only two hits are themselves `await`ed. No missing `await` found.
- **EC-24 — Disabled/skipped tests.** Cleared.
  No `test.skip`, `test.fixme`, `test.fail`, `.only`, or `describe.skip` in any spec.

#### Isolation & ordering

- **EC-25 — Shared mutable module-level seeds.** Cleared for i18n and copilot.
  `api/i18n.ts:196` copies `ROWS` per registration; `api/copilot.ts:387` builds `spy` fresh
  per call. `WORKSPACES_SEED` / `DEFAULT_MEMBERS` / `CONTENT_DETAIL_SEED` are only ever read
  and spread, never mutated in place — verified by reading every `mock*` in `support/api/`.
- **EC-26 — Route-precedence ordering is load-bearing and undocumented in the config.** `⚠️ PARTIAL`
  Several seeds depend on "last registered wins" (`api/content.ts:1249`, `api/auth.ts:92-93`,
  `:134-136`). Re-ordering two `await mock*` lines in a `beforeEach` silently changes which
  handler answers. Nothing asserts the ordering.
- **EC-27 — Cross-test order dependence.** Cleared.
  Every route lives on the per-test `page`, so nothing survives a test boundary. No spec
  reads state written by an earlier test in the same file.

#### Boundary / size / encoding (of the harness's own fabrication engine)

- **EC-28 — `pageSize=0`.** `❌ NONE` `api/content.ts:1187-1188` computes `start = (page-1)*0 = 0`
  and `slice(0,0)` → empty page with a non-zero `total`. The real server rejects
  `pageSize=0` at the DTO. A pager regression that sends 0 would render "no results" here and
  a 400 in production.
- **EC-29 — `page` beyond `pageCount`.** `❌ NONE` The mock returns `items: []` with the true
  `total`; the pager-clamping behaviour after a delete is never asserted in any content spec.
- **EC-30 — Non-numeric `page`/`pageSize`.** `❌ NONE` `Number('abc')` → `NaN`;
  `slice(NaN, NaN)` → `[]`. Silent empty page, no error, nothing asserts it.
- **EC-31 — Unicode / RTL / emoji in a seeded value.** `❌ NONE` Every seed string is ASCII
  Latin (`api/content.ts:1010-1044` fabricates `Row N` / `Body copy for row N`). No suite
  renders a bidi or CJK string, so text-direction and truncation bugs are invisible.
- **EC-32 — HTML/script in a text field.** `⚠️ PARTIAL` Only the wysiwyg suite feeds markup,
  and it asserts the *stored* HTML (`wysiwyg-fields.spec.ts:285-287`), not that a plain-text
  cell escapes it.
- **EC-33 — Very long value in a table cell.** `❌ NONE` No seeded string exceeds ~40 chars,
  so `truncate` / `line-clamp-3` (`WorkspacesTable/index.tsx:113`) is never exercised.
- **EC-34 — Empty seed arrays.** `⚠️ PARTIAL` Covered for workspaces/members/copilot
  (`empty: true`, `emptyText(...)`), not for content entries — `ENTRY_COUNT` is fixed and
  `mockContentEntries` offers no "zero rows" switch other than an explicit `entries: {}`
  override.

#### Permission matrix & tenancy

- **EC-35 — Per-role UI.** `⚠️ PARTIAL` The harness models permissions as a flat key list
  (`api/auth.ts:39-67`) and suites narrow it ad hoc. There is no systematic
  admin/contributor/viewer sweep of any page; `workspaces/permissions.spec.ts` and the
  `no-access` cases in `users/a11y.spec.ts:73` and `media-library.spec.ts:111` are the whole
  of it.
- **EC-36 — Unauthenticated.** `✅ E2E` `auth/private-routes.spec.ts` + `mockSignedOut`.
- **EC-37 — Authenticated but not a member of this workspace.** `❌ NONE` No mock distinguishes
  "workspace exists but you are not in it" (which the server answers 404 for) from "workspace
  does not exist". `UNGRANTED_WORKSPACE` (`api/content.ts:768`) models *content* grants, not
  membership.
- **EC-38 — Same id, different workspace.** `❌ NONE` See EC-14; the harness has no concept of
  the active workspace at the network layer at all.

#### Failure & partiality

- **EC-39 — API 500 on a list.** `⚠️ PARTIAL` *(corrected — was `✅ E2E`)*
  The **capability** exists — `mockContentEntries` honours `status >= 400`
  (`api/content.ts:1151-1158`) — but **no spec ever passes it**:
  `grep -rn "mockContentEntries(page, { status" apps/admin-e2e/src` returns nothing. The
  only two 500 injections in the whole suite are `mockContentSchema(page, { status: 500 })`
  (`content/content-library.spec.ts:167`, the *catalogue* read) and
  `mockCopilotApi(page, { listStatus: 500 })` (`copilot/agents-view.spec.ts:83`). The
  records **list**'s 500 path is unexercised — see EC-44.
- **EC-40 — Network drop mid-request.** `❌ NONE` No mock uses `route.abort()`. `net::ERR_FAILED`
  behaviour (a different axios error shape than an HTTP error) is never exercised.
- **EC-41 — SSE stream aborted mid-run.** `❌ NONE` Structurally impossible — the mock fulfils
  the whole body at once (`api/copilot.ts:529`), so the stop/unmount path
  (`runStream.ts:124-128`, `reader.releaseLock()`) has no coverage.
- **EC-42 — Upload interrupted.** `⚠️ PARTIAL` `failMediaReads` (`api/media.ts:151`) fails
  *reads*; a partially-completed upload is not modelled.
- **EC-43 — 401 mid-session.** `✅ E2E` `mockUnauthorized` (`api/auth.ts:138`), used to prove
  the global sign-out interceptor (`apiClient/index.ts:85-97`) fires.

#### UI-state distinctions

- **EC-44 — loading vs error vs empty as three distinct states.** `✅ E2E` for members,
  workspaces, insights, media, activity (each has a skeleton, an error and an empty case),
  **and for the content library's catalogue** — `content-library.spec.ts:162-180` ("shows the
  error state and recovers on retry") drives `mockContentSchema(page, { status: 500 })`,
  asserts `errorTitle` with `{ timeout: 15_000 }`, then re-mocks and asserts Retry restores
  the sidebar. That is a model case. `❌ NONE` for the **records table's** error state: no
  spec ever fails `mockContentEntries` (EC-39), and `content/a11y.spec.ts` scans only loaded
  states.
- **EC-45 — Focus after dialog close.** `⚠️ PARTIAL` Exactly one assertion exists
  (`copilot/agents-manage.spec.ts:96`, and its comment records a real Radix bug found this
  way). Nothing asserts focus after `Escape` — 14 `press('Escape')` calls, zero followed by
  `toBeFocused`.
- **EC-46 — i18n message present for every branch.** `❌ NONE` No spec asserts the absence of a
  raw message id (the react-intl fallback), so a missing `defineMessages` entry renders its id
  and passes.

---

### 4A. Accessibility & Section 508 Conformance

**Standards.** Revised Section 508 (36 CFR Part 1194, App. A-C) incorporates WCAG 2.0 A+AA
by reference (E205.4 for electronic content; **504.2 for authoring tools**). This repo's
`accessibility` skill targets WCAG 2.1 AA, so findings cite the 2.1 SC alongside the 508
provision. WCAG 2.2 additions (2.4.11, 2.5.8) are advisory here.

**What is being assessed.** This unit renders no UI of its own. What it *does* own is the
**admin's entire automated a11y detection capability** — so §4A audits the harness's ability
to catch a11y regressions, and marks true UI criteria **Not Applicable**.

**Do not trust axe.** A clean axe run is not conformance. axe evaluates a minority of the
success criteria and proves nothing about focus order, focus restoration, announcement
timing, keyboard traps, or whether an accessible name is *meaningful* rather than merely
present. Several product areas in this repo have **axe as their only a11y coverage** — those
are called out below.

#### Where axe actually runs

63 `expectNoA11yViolations` calls across 20 of 44 spec files (both counts re-verified by
grep). Real distribution, by area — the rows below sum to exactly 63:

| Area | Scans | States scanned | Verdict |
| --- | --- | --- | --- |
| auth (login, accept-invite, root loader, home) | 9 | initial, field errors, error banner, dead link, pending boot | **Supports** (for what axe covers) |
| workspaces | 7 | table, skeleton, archived rows, empty, create wizard + validation error (`a11y.spec.ts` ×6, `settings.spec.ts` ×1) | **Supports** |
| users / members | 8 | table, skeleton, invite wizard ×2 steps, **row menu open**, empty, no-access (`a11y.spec.ts` ×7, `members-filter.spec.ts` ×1) | **Supports** |
| copilot / agents | 7 | empty thread, transcript, expanded tool step, archived list, **rename dialog**, **row menu open**, **model picker open** | **Supports** |
| copilot dock + skills | 7 | dock states, skills manage | **Supports** |
| content library | 4 | sidebar+welcome, records table, **column picker open**, **search palette open** | **Supports** |
| content (relations, media fields, wysiwyg, read-only, relation cells) | 9 | field controls, collapsed + expanded editor | Partially Supports |
| insights | 3 + 2 | loaded, loading, mixed-failure; plus a keyboard case and a chart text-alternative case | **Supports** |
| activity log | 6 | table, expanded row, skeleton, empty, no-access, **open filter panel with a rule** | **Supports** |
| media library | 1 | loaded grid **only** | Partially Supports |
| preferences | 2 | — | Partially Supports |
| **shell / command palette** | **0** | — | **Does Not Support** |
| **home dashboard** | **0** | — | **Does Not Support** |
| **content i18n (locale switcher, translation UI)** | **0** | — | **Does Not Support** |
| **content entry-revisions (diff, restore dialog)** | **0** | — | **Does Not Support** |
| **user detail (sessions, activity tab)** | **0** | — | **Does Not Support** |
| **any destructive-confirm dialog** | **0** | — | **Does Not Support** |

Note that dialogs and menus **are** scanned in their open state in five areas (content column
picker and search palette; copilot rename dialog, row menu, model picker; members row menu and
invite wizard; activity filter panel). That is better than the harness's reputation. The gaps
are the *unscanned* surfaces above, not a systemic closed-dialog problem.

---

#### ♿ A11Y-admin-e2e-01 — The axe tag set silently drops the entire `best-practice` ruleset, including `aria-dialog-name`

**WCAG:** 1.3.1 Info and Relationships (A), 2.4.1 Bypass Blocks (A), 2.4.6 Headings and
Labels (AA), 4.1.2 Name, Role, Value (A)
**508:** E205.4; 502.3.1 (Object Information); 502.2.2 (No Disruption of Accessibility Features)
**Verdict:** **Partially Supports**
**Location:** `apps/admin-e2e/src/support/fixtures.ts:108-117`

```ts
makeAxe: async ({ page }, use) => {
    await use(() =>
        new AxeBuilder({ page }).withTags([
            'wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'
        ])
    );
}
```

`withTags` is a **whitelist**: axe runs only rules carrying one of the listed tags. Every
axe-core rule tagged `best-practice` and *not* additionally tagged with a WCAG level is
therefore never evaluated. In axe-core 4.12 (`package-lock.json:19706`) that set includes,
among others:

- `aria-dialog-name` — a `role="dialog"` with **no accessible name**. This CMS is built out of
  dialogs (rename, delete confirm, invite wizard, column picker, query builder, media picker).
  A nameless dialog announces as bare "dialog" and is invisible to the current scans.
- `heading-order` — skipped heading levels (h1 → h3). Directly 1.3.1.
- `region` — content that sits outside any landmark. The practical detector for 2.4.1.
- `landmark-one-main`, `landmark-unique`, `landmark-no-duplicate-banner`,
  `landmark-no-duplicate-contentinfo`, `landmark-*-is-top-level` — the whole landmark family.
- `page-has-heading-one` — a route with no `<h1>`.
- `skip-link` — the skip link's target must exist and be focusable. The `accessibility` skill
  mandates a skip link; nothing verifies it lands anywhere.
- `tabindex` — positive `tabindex`, which wrecks focus order (2.4.3).
- `empty-heading`, `empty-table-header`, `label-title-only`, `presentation-role-conflict`,
  `image-redundant-alt`, `aria-progressbar-name`, `aria-treeitem-name`, `aria-allowed-role`.

Both `apps/admin-e2e/AGENTS.md` ("`makeAxe` runs the **full** WCAG 2.1 A/AA ruleset (no rule
exclusions)") and the skill ("running the **full** ruleset") are *technically* true and
*practically* misleading: nobody disabled a rule, but a third of axe's catalogue was never
enabled, and the docs read as though nothing is missing.

**Keyboard-only experience:** a positive `tabindex` on a new control reorders the whole page's
focus sequence and the suite stays green.
**Screen-reader experience:** opening the rename dialog announces "dialog" with no name; the
user has no idea what they are in. `copilot/a11y.spec.ts:63-69` scans that exact dialog and
passes.

**Remediation:** add `'best-practice'` to the tag list in one place, fix or explicitly
`disableRules([...])` the fallout with a comment and a tracked TODO (the process the skill
already prescribes for exclusions).

---

#### ♿ A11Y-admin-e2e-02 — axe's `incomplete` results are discarded, so unmeasurable contrast passes silently

**WCAG:** 1.4.3 Contrast (Minimum) (AA), 1.4.11 Non-text Contrast (AA)
**508:** E205.4
**Verdict:** **Partially Supports**
**Location:** `apps/admin-e2e/src/support/a11y.ts:12-23`

```ts
export async function expectNoA11yViolations(axe: AxeBuilder): Promise<void> {
    const { violations } = await axe.analyze();
    ...
    expect(summary, summary || 'no violations').toBe('');
}
```

`axe.analyze()` returns four buckets: `violations`, `passes`, `incomplete`, `inapplicable`.
`incomplete` is the "axe could not decide" bucket — and `color-contrast` is its largest
contributor: text over a gradient, an image, a semi-transparent overlay, or a
`background-color` axe cannot resolve lands there rather than in `violations`. The admin's
insights dashboard is explicitly "colour-heavy" (`insights/a11y.spec.ts:10-16`) — exactly the
markup that produces `incomplete`. Every such element is reported as clean.

**Keyboard-only experience:** unaffected.
**Screen-reader experience:** unaffected. This is a low-vision failure: a chart label at 3:1
over a tinted card can ship green.

**Remediation:** surface `incomplete` in the failure summary as a separate, loud section — at
minimum log it; ideally fail on `incomplete` for `color-contrast` specifically, since that rule
is the one whose "unknown" is almost always a real risk.

---

#### ♿ A11Y-admin-e2e-03 — Every scan runs in one theme; dark mode has zero contrast coverage

**WCAG:** 1.4.3 Contrast (Minimum) (AA), 1.4.11 Non-text Contrast (AA)
**508:** E205.4
**Verdict:** **Does Not Support**
**Location:** `apps/admin-e2e/playwright.config.ts:20-24` (no `colorScheme` in `use`)

Playwright's `use` block sets only `baseURL` and `trace`. `colorScheme` is unset, so every
scan runs in the browser default (light). `grep -rn "colorScheme" apps/admin-e2e` returns
nothing. The repo ships a dark palette (`apps/admin/src/styles.css` carries the token set that
`AGENTS.md` records as having been darkened to clear AA), and `copilot/a11y.spec.ts:16-20`
documents a token that sits *exactly* on the AA boundary at 10 px — the kind of value that
flips sign in the other theme.

**Screen-reader experience:** unaffected. **Low-vision dark-mode users:** unprotected.

**Remediation:** add a second Playwright project (or a `test.use({ colorScheme: 'dark' })`
describe wrapper) that re-runs the a11y specs in dark, so both palettes are guarded.

---

#### ♿ A11Y-admin-e2e-04 — One fixed viewport; reflow and zoom are never tested

**WCAG:** 1.4.10 Reflow (AA), 1.4.4 Resize Text (AA), 1.4.12 Text Spacing (AA)
**508:** E205.4
**Verdict:** **Does Not Support**
**Location:** `apps/admin-e2e/playwright.config.ts:33-37` (chromium/Desktop Chrome only);
mobile projects commented out at `:39-47`

`grep -rn "setViewportSize" apps/admin-e2e/src` returns nothing. Every one of the 418 cases
runs at Desktop Chrome's 1280×720. SC 1.4.10 requires content to reflow at 320 CSS px without
two-dimensional scrolling; a wide records table with a sticky toolbar is precisely where that
fails, and no test can see it. Text-spacing overrides (1.4.12) are likewise never applied.

**Remediation:** enable the commented-out `Mobile Chrome` project for the a11y specs only, or
add a `test.use({ viewport: { width: 320, height: 800 } })` variant of the axe suites.

---

#### ♿ A11Y-admin-e2e-05 — Platform preferences (reduced motion, forced colors) are never emulated

**WCAG:** 2.3.3 (AAA, advisory), 1.4.1 Use of Color (A) — under forced colors
**508:** **503.2 (User Preferences)** — this is a Chapter 5 provision, not a WCAG one
**Verdict:** **Does Not Support**
**Location:** `apps/admin-e2e/playwright.config.ts:20-24`

Playwright exposes `reducedMotion` and `forcedColors` as context options; neither is set
anywhere. 503.2 requires an application to respect platform accessibility settings. Windows
High Contrast / `forced-colors: active` commonly erases `background-image`-based icons,
`box-shadow` focus rings, and colour-only status chips — of which the admin has many
(`StatusChip`, the workspace avatar colours, the insights palette).

**Keyboard-only experience:** in forced colors a `box-shadow`-only focus ring disappears
entirely → the user cannot see where they are (also 2.4.7).
**Vestibular users:** dnd-kit drag animations and the copilot's streaming transcript are never
checked against `prefers-reduced-motion`.

**Remediation:** add `forcedColors: 'active'` and `reducedMotion: 'reduce'` variants to the
a11y projects, at minimum for the shell, tables and focus-ring assertions.

---

#### ♿ A11Y-admin-e2e-06 — axe's experimental rules never run, including two WCAG 2.1 SCs

**WCAG:** 1.3.4 Orientation (AA), 2.5.3 Label in Name (A), 1.3.1 (A)
**508:** E205.4
**Verdict:** **Partially Supports** · *Unverified —* rule-by-rule `experimental` flags could
not be confirmed against the installed package because `node_modules` is absent in this
checkout; the claim rests on axe-core's documented behaviour that `enabled: false`
(experimental) rules are excluded regardless of tag match.
**Location:** `apps/admin-e2e/src/support/fixtures.ts:110-115`

Rules axe ships disabled-by-default are not enabled by a matching tag; they need explicit
opt-in. The relevant ones:

- `css-orientation-lock` (tagged `wcag21aa`, SC 1.3.4) — a CSS rule that locks orientation.
- `label-content-name-mismatch` (tagged `wcag21a`, SC 2.5.3) — visible label text not contained
  in the accessible name. Directly relevant here, because several controls carry an
  `aria-label` *and* visible text (the account menu, the Filters trigger whose label carries a
  count, `BasePage.ts:56`).
- `p-as-heading` (SC 1.3.1) — a styled `<p>` used as a heading.

**Remediation:** enable them explicitly via `.options({ rules: { 'label-content-name-mismatch':
{ enabled: true }, ... } })` in `makeAxe`, with a comment noting they are experimental.

---

#### ♿ A11Y-admin-e2e-07 — "Keyboard operability" is proven with `.focus()`, not `Tab`

**WCAG:** 2.1.1 Keyboard (A), 2.4.3 Focus Order (A)
**508:** E205.4; **502.2.1 (No Disruption)**
**Verdict:** **Partially Supports**
**Location:** `apps/admin-e2e/src/workspaces/keyboard.spec.ts:23-24, 34-35, 52-53, 76-77, 93-94`;
`apps/admin-e2e/src/users/keyboard.spec.ts:18, 32, 44`

```ts
await workspacesPage.search.focus();
await expect(workspacesPage.search).toBeFocused();
```

`Locator.focus()` calls the DOM `focus()` method, which succeeds on any focusable element
including one with `tabindex="-1"` or one hidden behind a broken focus trap. Asserting
`toBeFocused()` straight afterwards therefore always passes. The test is titled "search is
**reachable** and filters by keyboard" — reachability is exactly what is not established.

Measured across the whole suite:

- `press('Tab')` appears in **one file only** — `auth/keyboard.spec.ts` (5 occurrences).
- `press('Shift+Tab')` appears **nowhere**.
- `users/keyboard.spec.ts` contains **zero** `toBeFocused` assertions.

`auth/keyboard.spec.ts:67-87` is the counter-example and the model to copy: it Tabs through
the accept-invite form and asserts the landing element at each step, and its comment explains
*why* the read-only fields must stay in the tab order.

**Keyboard-only experience:** a control that becomes unreachable by `Tab` (a wrapper gaining
`tabindex="-1"`, an overlay stealing focus, a roving-tabindex group losing its entry point)
ships green.
**Screen-reader experience:** the same regression strands a VoiceOver/NVDA user in browse
mode with no way into the control.

**Remediation:** replace `.focus()` with a `Tab` walk in the keyboard suites, or keep
`.focus()` only for asserting *activation* and add a separate reachability case that Tabs from
a known anchor. Add at least one `Shift+Tab` case per surface.

---

#### ♿ A11Y-admin-e2e-08 — Focus restoration after `Escape` is never asserted

**WCAG:** 2.4.3 Focus Order (A), 2.4.7 Focus Visible (AA), 2.1.2 No Keyboard Trap (A)
**508:** E205.4; 502.2.2
**Verdict:** **Partially Supports**
**Location:** 14 `page.keyboard.press('Escape')` calls across the suite; none is followed by a
focus assertion. The single restoration test that exists is
`apps/admin-e2e/src/copilot/agents-manage.spec.ts:82-97` — and it closes via the **Cancel
button**, not `Escape`.

That one test is worth reading, because its comment records a real bug found this way: "The
dialog is opened from a menu item that unmounts with its menu, so Radix has nothing left to
restore focus to and drops it on `<body>` — stranding a keyboard user at the top of the page."
Every other dialog in the admin (delete confirm, invite wizard, media picker, column picker,
query-builder drawer, command palette) opens the same way and has no equivalent test.

**Keyboard-only experience:** press `Escape` on a confirm dialog and focus lands on `<body>`;
the next `Tab` restarts from the skip link, many stops away from where the user was.

**Remediation:** add a `closes on Escape and restores focus to the trigger` case to each
dialog-bearing suite; it is two lines and it is the highest-yield keyboard assertion available.

---

#### ♿ A11Y-admin-e2e-09 — Destructive-confirm dialogs are never scanned or keyboard-tested

**WCAG:** 3.3.4 Error Prevention (Legal, Financial, Data) (AA), 4.1.2 (A)
**508:** E205.4
**Verdict:** **Does Not Support**
**Location:** no `expectNoA11yViolations` call in any spec follows a delete/archive/revoke
confirm. Verified by reading all 20 axe-bearing spec files; the scanned dialogs are rename
(`copilot/a11y.spec.ts:63`), the invite wizard (`users/a11y.spec.ts:37,44`), the column picker
(`content/a11y.spec.ts:45`) and the search palette (`:56`).

The admin has at least four destructive confirms with distinct copy branches — entry delete
soft vs hard (`CollectionRecordsRowActions/index.tsx:329`), entry-menu delete
(`EntryMenu/index.tsx:227`), member disable/last-admin, workspace archive. None is scanned;
none has a keyboard case; none has a "the destructive button is not the default focus" check,
which is the practical 3.3.4 protection.

**Remediation:** one axe scan + one `Escape`-cancels case per confirm dialog.

---

#### ♿ A11Y-admin-e2e-10 — Two whole routes have no a11y coverage of any kind

**WCAG:** all of them, for those routes
**508:** E205.4
**Verdict:** **Does Not Support**
**Location:** `apps/admin-e2e/src/shell/command-palette.spec.ts` and
`apps/admin-e2e/src/home/dashboard.spec.ts` — neither imports `expectNoA11yViolations`.

The **command palette** is the worst of the two: it is a modal combobox with a listbox of
`option` roles (`BasePage.ts:42-53`), the single most ARIA-dependent widget in the product,
reachable from every page, and it has zero automated a11y coverage. The **home dashboard** is
the first authenticated screen a user ever sees.

Also uncovered: `content/i18n.spec.ts` (locale switcher + translation status),
`content/entry-revisions.spec.ts` (revision diff + restore), `users/user-detail.spec.ts`
(sessions table + activity tab), `content/records-filter.spec.ts`.

**Remediation:** an axe scan of the open palette, and one of the loaded dashboard, are two
short tests that close the largest gaps in the map.

---

#### ♿ A11Y-admin-e2e-11 — No route ever asserts its document title

**WCAG:** 2.4.2 Page Titled (A)
**508:** E205.4
**Verdict:** **Does Not Support**
**Location:** `grep -rn "toHaveTitle\|document.title" apps/admin-e2e/src` → 0 matches.

In an SPA, 2.4.2 applies per route: navigating from Workspaces to Members must change
`<title>`, or a screen-reader user gets no confirmation that anything happened. 44 spec files
navigate between routes constantly and not one checks the title.

**Screen-reader experience:** every route change announces the same stale title (or none),
so the user cannot tell whether their activation worked.

**Remediation:** add `await expect(page).toHaveTitle(/Members/)` to the first navigation
assertion of each area's main spec — near-zero cost, closes a Level A criterion.

---

#### ♿ A11Y-admin-e2e-12 — Status messages / live regions are never asserted

**WCAG:** 4.1.3 Status Messages (AA)
**508:** E205.4; **502.3.4 (Values) / 502.3.14 (Event Notification)**
**Verdict:** **Partially Supports** *(corrected — the original "0 matches" grep was wrong)*
**Location:** `grep -rn "aria-live" apps/admin-e2e/src` → **0 matches**;
`getByRole('status')` → **6 matches, all in Page Objects and none of them a toast**:
`ActivityLogPage.ts:80`, `WorkspacesPage.ts:62`, `MembersPage.ts:53` (loading skeletons),
`AcceptInvitePage.ts:93` (the invite-lookup busy region), `HomePage.ts:61`
(`filter({ hasText: /Loading/ })`), `AgentsPage.ts:290` (the composer hint).

So live regions **are** touched — for *pending* states — and toasts are asserted heavily
(29+ `toast(...)` assertions across `workspaces/settings`, `content-library`, `i18n`,
`agents-manage`). What is missing is the announcement contract: every toast Page Object
resolves to a plain text lookup —

```ts
/** A toast message (sonner, portaled to the body). */
toast(text: string | RegExp): Locator {
    return this.page.getByText(text);   // ContentLibraryPage.ts:394, AgentsPage.ts:552
}
```

— so no spec asserts that a toast sits in a live region, that it is announced without
stealing focus, or that a save/delete/publish produces any announcement at all. The
`role="alert"` usages are Page Objects for *form errors* (`BasePage.ts:159`, `LoginPage`),
asserted as visible text — which proves rendering, not announcement.

**Screen-reader experience:** a user saves an entry, hears nothing, and cannot tell whether it
worked.

**Remediation:** assert the toast container's `role`/`aria-live` and that focus is unchanged
after a mutation, in one shared helper used by every mutating suite.

---

#### ♿ A11Y-admin-e2e-13 — 504 Authoring Tools: the harness never checks that the CMS produces accessible content

**WCAG:** 1.1.1 Non-text Content (A), 1.3.1 (A)
**508:** **504.2 (Content Creation), 504.2.1 (Preservation), 504.3 (Prompts), 504.4 (Templates)**
**Verdict:** **Does Not Support**

This is where a real 508 audit of a CMS bites, and it is the least-covered area of the harness.

- **504.3 (prompts for accessibility information).** The media-upload dialog is **never
  scanned and never driven** by any a11y or keyboard test. Nothing asserts that inserting an
  image prompts for alt text, or that a "decorative" option exists. The alt field is modelled
  in the seed (`api/media.ts:70`, `MEDIA_HERO_ALT`) and asserted for *round-tripping*
  (`wysiwyg-fields.spec.ts:404`, `:442`) — but round-tripping a value the author already typed
  is not the same as prompting for it.
- **504.2 (can an author produce conformant content).** `wysiwyg-fields.spec.ts:285-287`
  asserts the saved HTML contains `<table` and `<th`, which is a genuine (and good) 504.2
  signal — real header cells. But nothing checks a `<caption>`, a `scope` attribute, heading
  *order* inside the body (see `♿ A11Y-admin-e2e-01`: `heading-order` is never *enabled*),
  or list semantics.
- **504.2.1 (preservation).** No spec asserts that alt text, table headers or a language marker
  survive a save → reload → revision-restore → locale-copy cycle. `entry-revisions.spec.ts`
  and `i18n.spec.ts` exercise those flows and assert none of it.
- **Schema-level gap.** The WYSIWYG stores a single HTML string; there is no field for a table
  caption or a per-block `lang`. Whether the *data model* can hold that information is a
  question for `content-domain` / `content-server`, and should be filed there — it is a
  schema-level Does Not Support that no amount of `aria-label` work in the admin can fix.

**Remediation (harness scope only):** add an axe scan of the open media-upload dialog and a
case that asserts the alt input is present, labelled, and offers a decorative option; add a
"alt text survives a revision restore" assertion to `entry-revisions.spec.ts`.

---

#### ♿ A11Y-admin-e2e-14 — All scans run in one locale; no RTL, no language-of-parts

**WCAG:** 3.1.1 Language of Page (A), 3.1.2 Language of Parts (AA), 1.4.10 (AA, via RTL reflow)
**508:** E205.4
**Verdict:** **Partially Supports**

`html-has-lang` and `valid-lang` are `wcag2a` and therefore *do* run in every scan — so
3.1.1's mechanical half is covered. What is not: the admin ships a locale switcher
(`content/i18n.spec.ts`) and the seed carries German content (`api/i18n.ts:119` "Winterstiefel"),
yet no axe scan is ever taken with a non-`en` UI locale, and no seeded string is RTL. 3.1.2
(a German title inside an English page needs `lang="de"`) has no coverage at all, and the
i18n spec file has no axe scan of any kind.

**Remediation:** add one axe scan to `content/i18n.spec.ts` with the German locale selected,
and one RTL seed string to any table suite.

---

#### Not Applicable

The following criteria describe rendered UI and are **Not Applicable** to this unit, which
renders none. They are assessed on `app-admin`, `design-system` and the individual admin
plugins: 1.4.1 Use of Color, 1.4.13 Content on Hover or Focus, 2.1.2 No Keyboard Trap (as a
product property), 2.2.1 Timing Adjustable, 3.2.1/3.2.2 On Focus / On Input, 3.3.1 Error
Identification, 3.3.2 Labels or Instructions, 3.3.3 Error Suggestion, 502.3 (AT
interoperability of specific widgets), 503.4 (captions/audio controls — the admin ships no
media playback UI).

---

## 5. E2E Coverage Map

*Inverted for this unit.* For a harness, the question is not "is this feature covered" but **which product areas does
this harness cover, and how honestly**. Honesty is graded on three axes: does a spec exist,
does it assert the interesting part, and — uniquely for this unit — **could the mock it runs
against ever be produced by the real server**.

| Product area | Specs | What is genuinely asserted | Mock fidelity | Verdict |
| --- | --- | --- | --- | --- |
| Login / logout | `auth/login.spec.ts`, `users/account-menu.spec.ts` | 201→navigate, 401→banner, client validation suppresses the call (`login.spec.ts:66`), pending state | Faithful: `{ok:true}` + 201 matches `login.controller.ts:42,57`; 401 message matches `:51` | ✅ E2E |
| Session gate / redirects | `auth/private-routes.spec.ts`, `auth/routing.spec.ts` | Signed-out redirect, deep-link preservation, root loader | Faithful: `me` returns `PublicUser` + `permissions`, matching `me.controller.ts:8` | ✅ E2E |
| Session loss mid-visit | `auth/*` via `mockUnauthorized` | 401 on a non-self-handled path triggers global sign-out | Faithful | ✅ E2E |
| Invite acceptance | `auth/accept-invite.spec.ts` | Prefilled read-only fields, validation, 404 dead link, submit spy | Faithful: 404-for-everything matches `invite.controller.ts:39-43` | ✅ E2E |
| Workspaces list / filter / create | `workspaces/workspaces.spec.ts`, `settings.spec.ts`, `permissions.spec.ts` | Cards, status chips, search, wizard steps, slug validation, permission gating | **Drifts**: `content` omitted on 5/6 seeds (§EC-04) → the "N content types" column asserts 0 everywhere | ⚠️ PARTIAL — `🐞 BUG-admin-e2e-10` |
| Members / invites | `users/members.spec.ts`, `members-filter.spec.ts` | Roster rendering, last-admin lock, invite wizard, token reveal, resend rotation, filter deep-link | **Drifts**: `description` missing from the workspace sub-view (§EC-05); filter evaluator fails open (§EC-15) | ⚠️ PARTIAL |
| User detail | `users/user-detail.spec.ts` | Profile edit spy, sessions list, activity tab rendering | **Drifts hard**: the activity mock ignores `subjectId` (§EC-13) | ⚠️ PARTIAL — `🐞 BUG-admin-e2e-05` 🔒 |
| Preferences | `users/preferences.spec.ts` | No-op save suppressed (`:96`) | Faithful | ✅ E2E |
| Activity log | `activity/audit-log.spec.ts`, `activity-filter.spec.ts` | Actors incl. "System", row expand, search→request, deep-linked filter, empty, no-access | Faithful: `ActivitySeed` ≡ `ActivityEventView` | ✅ E2E |
| Content library navigation | `content/content-library.spec.ts` | Sidebar groups, type selection, column picker, **keyboard column reorder**, sort cycle, search | Faithful for the read path | ⚠️ PARTIAL (hard sleeps, §EC-21) |
| Records table — soft delete / trash | *(none)* | — | **Unreachable**: `paranoid` never mocked (§EC-01) | ❌ NONE — `🐞 BUG-admin-e2e-03` |
| Records table — Modified badge | *(none)* | — | **Unreachable**: envelope `publishedAt` never mocked (§EC-06) | ❌ NONE — `🐞 BUG-admin-e2e-12` |
| Records filter (query builder) | `content/records-filter.spec.ts` | Rule building, apply gate, deep link | Fail-open evaluator | ⚠️ PARTIAL |
| Relations | `content/relations.spec.ts`, `relation-cells.spec.ts` | Every cardinality, opt-in preview scoping, per-field paging, missing-ref rendering | Faithful to `RelationRef` / `RelationFieldView` (`entry-list-view.ts:67-133`) | ✅ E2E |
| Media fields on an entry | `content/media-fields.spec.ts` | Single replace vs multiple append/reorder, accept filtering | Faithful to `MediaRef` (`entry-list-view.ts:97-121`) | ✅ E2E |
| WYSIWYG | `content/wysiwyg-fields.spec.ts` | Toolbar, tables with `<th>`, columns, image insert with alt, `widget:'textarea'` opt-out, empty→`''` | Faithful; asserts saved HTML, not just the DOM | ✅ E2E |
| Entry revisions | `content/entry-revisions.spec.ts` | Restore mutates state, list reflects it | Faithful (stateful mock) | ⚠️ PARTIAL — no axe scan |
| Localization | `content/i18n.spec.ts` | Locale switch, sibling create, all-locales publish preview verdicts, Modified state | **Drifts**: created rows never appear in a later list (§EC-16) | ⚠️ PARTIAL — `🐞 BUG-admin-e2e-14` |
| Read-only entry | `content/entry-read-only.spec.ts` | Controls disabled, no save fires (`:228`) | Faithful | ✅ E2E |
| Media library | `media/media-library.spec.ts` | Grid, folders, upload, read failure, no-access | Faithful (`AssetView`/`FolderView` match) | ⚠️ PARTIAL — only 1 axe scan, upload dialog unscanned |
| Insights | `insights/insights.spec.ts`, `a11y.spec.ts` | 10 widgets, loading, per-widget failure, range picker keyboard + `aria-checked`, chart text alternatives | Faithful | ✅ E2E |
| Copilot dock | `copilot/dock.spec.ts` | Open/close, composer focus, transcript, permission gating | See SSE drift below | ⚠️ PARTIAL |
| Copilot Agents view | `copilot/agents-*.spec.ts`, `view-switcher.spec.ts` | Thread rail, rename/archive, **focus restored to the row menu (`agents-manage.spec.ts:96`)**, attachments, skills, model picker | See SSE drift below | ⚠️ PARTIAL |
| Copilot run stream | `copilot/agents-chat.spec.ts` | Frame **order** and rendered transcript | **Drifts on five points**: no `event:` line, no comment frames, `run-started` missing `messageId`, `tool-result` missing `name`, `done` missing `usage`; whole body in one read (§EC-08-11) | ⚠️ PARTIAL — `🐞 BUG-admin-e2e-04` |
| Copilot skills | `copilot/skills-manage.spec.ts`, `agents-skills.spec.ts` | Catalogue, code-vs-CMS badging, write refusal | Faithful | ✅ E2E |
| Command palette | `shell/command-palette.spec.ts` | Open, search, jump | Faithful | ⚠️ PARTIAL — no axe, no keyboard spec |
| Home dashboard | `home/dashboard.spec.ts` | Renders | — | ⚠️ PARTIAL — no axe |
| **Tenant scoping (`X-Workspace-Id`)** | *(none)* | — | **Not modelled at all** | ❌ NONE — `🐞 BUG-admin-e2e-02` 🔒 |
| **Cross-workspace / non-member access** | *(none)* | — | Not modelled | ❌ NONE |
| **Dark theme** | *(none)* | — | — | ❌ NONE — `♿ A11Y-admin-e2e-03` |
| **Small viewport / reflow** | *(none)* | — | — | ❌ NONE — `♿ A11Y-admin-e2e-04` |
| **Per-route document title** | *(none)* | — | — | ❌ NONE — `♿ A11Y-admin-e2e-11` |
| **Toast / live-region announcements** | *(none)* | — | — | ❌ NONE — `♿ A11Y-admin-e2e-12` |

**Coverage tally (harness features, §2):** `37 features · 19 ✅ · 3 ⚠️ · 1 ❌ · 12 🐞 · 2 ♿`
**Coverage tally (product areas, this table):** `33 areas · 12 ✅ · 13 ⚠️ · 8 ❌`
**Accessibility tally:** `14 ♿ findings · 0 Supports · 7 Partially Supports · 7 Does Not Support ·
0 Not Applicable` (1 of the 14, `A11Y-06`, additionally carries an `Unverified —` opening)
(area-level axe verdicts are tabulated separately at the head of §4A: 17 areas —
8 Supports, 3 Partially Supports, 6 Does Not Support)
**🐞 tally:** `16 findings · 0 Critical · 1 High · 11 Medium · 4 Low` (3 carry 🔒; 3 open
`Unverified —` on a sub-claim: `BUG-07`, `BUG-15`, `A11Y-06`)
**Edge cases:** `46 EC entries · 1 deleted in verification (EC-17, claim false)`

---

## 6. 🐞 Potential Bugs

Ranked by severity. Every finding was read in the cited source.

### 🐞 BUG-admin-e2e-01 — No CI workflow runs this suite, or the drift gate the docs claim it runs · Severity: High

*(Downgraded from Critical: this is a verification/process gap, not a reachable exploit or a
data-loss path — nothing here corrupts or exposes data. Kept at High because its blast radius
is the whole document: it is the multiplier on every other finding.)*

**Location:** `.github/workflows/release.yml:1-63` (the repository's only workflow);
`apps/admin-e2e/TESTS.md:4`; `.agents/skills/admin-e2e/SKILL.md:144,151`
**Category:** correctness (process)

**What the code does:** `.github/workflows/` contains exactly one file, `release.yml`. Its
only `run:` steps are:

```yaml
- run: npm ci
- name: Configure git identity
- name: Typecheck
  run: npx nx run-many -t typecheck
- name: Release
  run: npx nx release ${{ inputs.specifier }} --yes …
```

There is no `e2e`, no `lint`, no `test`, and no `catalog:check` step, and the workflow is
manually dispatched for releases rather than run on push or pull request.

**Why it is wrong:** the false claims live in **two** files, and the attribution matters
because a fix has to edit the right ones. `apps/admin-e2e/TESTS.md:4` states "CI runs `npx nx
catalog:check admin-e2e` and fails if this file has drifted"; `.agents/skills/admin-e2e/SKILL.md:144`
tells authors "`--project=chromium # faster locally; CI runs all 3". Neither is true.
`apps/admin-e2e/AGENTS.md:48,95` is **not** at fault — re-read during verification, it says only
"`npx nx catalog:check admin-e2e` fails if it has drifted", with no CI claim, which is
accurate. `apps/server-e2e/AGENTS.md:99` is explicit about the gap ("wire this into CI once a
pipeline exists"), which corroborates that the admin-side CI claims are aspirational. Every
quality claim in this repository rests on a developer choosing to run the suite locally.

**Repro:**
1. `ls .github/workflows/` → `release.yml`
2. `grep -nE "e2e|playwright|lint|catalog" .github/workflows/release.yml` → no matches
→ Observed: no automated execution of 418 admin cases or 851 server cases.
   Expected: a push/PR workflow running `lint`, `typecheck`, `test`, both `e2e` targets and
   both `catalog:check` targets.

**Blast radius:** total. A broken spec, a stale `TESTS.md`, a regression in any of the 33
product areas above — none is caught before merge. This finding is the multiplier on every
other finding in this document.

**Suggested fix:** add a `ci.yml` running `npx nx affected -t lint typecheck test` plus both
e2e targets (server-e2e needs Docker or `E2E_DATABASE_URL`; admin-e2e needs
`npx playwright install --with-deps chromium`), and correct the two AGENTS.md files until it
exists.

---

### 🐞 BUG-admin-e2e-02 — No mock or spec ever inspects `X-Workspace-Id`, so tenant scoping is untestable · Severity: Medium · 🔒 SECURITY

*(Downgraded from High: this is a **detection** gap, not a bypass. The server's `WorkspaceGuard`
still enforces scoping on every workspace-scoped route, so no exploit or cross-tenant read is
reachable through the harness — what is lost is the ability to catch a client-side regression
before it ships.)*

**Location:** all 13 modules in `apps/admin-e2e/src/support/api/`; contrast
`packages/utils/admin/src/lib/apiClient/index.ts:42-47`
**Category:** tenant-leak (detection gap)

**What the code does:** the admin attaches the active workspace to every request:

```ts
apiClient.interceptors.request.use((config) => {
    if (activeWorkspaceId) {
        config.headers.set('X-Workspace-Id', activeWorkspaceId);
    }
    return config;
});
```

Every mock ignores it. `mockContentEntries` (`api/content.ts:1150`), `mockMediaApi`
(`api/media.ts:168`), `mockInsightsApi` (`api/insights.ts:338`) and `mockCopilotApi`
(`api/copilot.ts:383`) all key on the URL path alone. `grep -rn "X-Workspace-Id"
apps/admin-e2e/src` returns exactly one hit and it is a **comment**
(`copilot/dock.spec.ts:64`); `grep -rn "route.request().headers"` returns nothing.

**Why it is wrong:** the header is the sole client-side input to the server's `WorkspaceGuard`
(the interceptor's own JSDoc records this at `apiClient/index.ts:38-41`; the guard itself lives
server-side). Root `AGENTS.md` and the `admin-plugin` skill both treat
workspace scoping as an invariant. The harness's own doctrine — "the network is the seed" —
means the network layer is precisely where this should be asserted, and it is the only layer
that can see it.

**Repro:**
1. In a scratch branch, comment out the interceptor body at `apiClient/index.ts:43-45`.
2. `npx nx e2e admin-e2e`
→ Observed: all 418 cases pass. Expected: the content, media, insights and copilot suites
   should fail, because every one of them is workspace-scoped.

**Blast radius:** a regression that drops the header, sends a stale workspace id after a
workspace switch, or leaks one workspace's id into another's request reaches production with a
fully green suite. The server would answer 403/404 and the user would see an empty library —
a user-visible outage the harness is structurally unable to predict.

**Suggested fix:** assert the header in the shared seeds — have `mockContentEntries` and
friends record `route.request().headers()['x-workspace-id']` on a spy, and add one case per
workspace-scoped area asserting it equals the workspace in the URL.

---

### 🐞 BUG-admin-e2e-03 — The content-schema seed omits `paranoid` and `i18n`, making the whole soft-delete surface unreachable · Severity: Medium

*(Downgraded from High: the product feature is intact — only the harness cannot see it. No
exploit and no data-loss path; the risk is a future soft-delete regression shipping unnoticed,
which is a coverage gap.)*

**Location:** `apps/admin-e2e/src/support/api/content.ts:4-13` (type) and `:46-51` (seed);
contrast `packages/content/server/src/lib/registry/content-type-registry.ts:58-70`
**Category:** correctness (mock-vs-reality drift)

**What the code does:**

```ts
/** A content-type summary as `GET /api/content-schema` returns it. */
interface ContentTypeSummary {
    name: string;
    kind: 'collection' | 'single';
    label: string;
    description?: string;
    path?: string;
    /** Has a draft/published `status` envelope column. */
    publishable?: boolean;
}
```

The server's wire type is:

```ts
export interface SerializedContentTypeSummary {
    name: string; kind: ContentTypeKind; label: string;
    description?: string; path?: string;
    publishable: boolean;   // always present
    paranoid: boolean;      // always present
    i18n: boolean;          // always present
}
```

`paranoid` and `i18n` are absent from the harness type *and* from every seed value.
`CONTENT_SCHEMA_SEED` (`:46-51`) sets none of the three.

**Why it is wrong:** the admin branches on `paranoid` in five places. The consequential one:

```ts
const paranoid = schema.paranoid ?? false;          // LoadedRecordsView/index.tsx:146
…
{paranoid && canDelete ? (                          // :422
    <Link to={`${typePath}/${TRASH_SEGMENT}`}>…View Trash…</Link>
) : null}
```

With `paranoid` permanently `undefined`, the Trash route, the soft-delete confirm copy branch
(`CollectionRecordsRowActions/index.tsx:329,337` — `deleteBodySoft` vs `deleteBodyHard`,
`'softDeleted'` vs `'deleted'`) and the restore/purge flow are unreachable from every one of
the 418 cases. That the flag matters is not in doubt: `apps/server-e2e`'s own reference
collection sets `paranoid: true` (`apps/server-e2e/src/support/content/test-article.ts:30`),
so the server suite exercises exactly the behaviour the admin suite cannot see.

**Repro:**
1. `npx nx e2e admin-e2e -- src/content/content-library.spec.ts --headed`
2. Watch the records toolbar.
→ Observed: no "View Trash" button, ever. Expected (for a paranoid type): the button renders
   and routes to the trash segment.

**Blast radius:** the entire soft-delete/restore/purge feature — a data-loss-adjacent surface —
has zero admin e2e coverage, and no test failure would ever reveal that.

**Suggested fix:** make `publishable`/`paranoid`/`i18n` required in `ContentTypeSummary`, set
them on every seed, and add a `paranoid: true` collection so a trash suite can exist.

---

### 🐞 BUG-admin-e2e-04 — The copilot SSE mock diverges from `SseStream` on five points · Severity: Medium

*(Downgraded from High: all five divergences are latent. Today's client parses `data:` lines
only (`runStream.ts:138`) and ignores comment frames, and no shipped UI reads `messageId`,
`name` or `usage` off those frames — so nothing is currently broken. The cost is that a future
wire-format change is undetectable.)*

**Location:** `apps/admin-e2e/src/support/api/copilot.ts:293-294` (frame writer) and
`:299-344` (the scripted run); contrast
`packages/copilot/server/src/lib/chat/http/sse-stream.ts:40,45,54-63` and
`packages/copilot/domain/src/lib/run/run-event.ts:15-194`
**Category:** correctness (mock-vs-reality drift)

**What the code does:**

```ts
/** One SSE frame, as the run route writes it. */
const frame = (event: Record<string, unknown>) =>
    `data: ${JSON.stringify(event)}\n\n`;
```

The run route actually writes:

```ts
this.res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);   // sse-stream.ts:60-62
```

Five concrete divergences:

| # | Real wire | Mock |
| --- | --- | --- |
| 1 | `event: <type>` line on every frame (`sse-stream.ts:61`) | absent — `data:` only |
| 2 | `: open\n\n` on connect (`:40`) and `: ping\n\n` every 15 s (`:45`) | never sent |
| 3 | `run-started` carries `messageId` (`run-event.ts:22`) | `{ type, runId, conversationId }` only (`copilot.ts:305`) |
| 4 | `tool-result` carries `name` (`run-event.ts:53`) | `{ type, id, ok, summary, durationMs }` (`copilot.ts:316-321`) |
| 5 | `done` carries `usage: ModelUsage` (`run-event.ts:164`) | `{ type, messageId, stopReason }` (`copilot.ts:342`) |

**Why it is wrong:** the union at `run-event.ts:186-194` is documented as "exactly what the SSE
controller serializes… the client's reducer is written against this union, so adding an event
kind is a compile error at every consumer". The harness feeds that reducer objects that fail
the union's own required fields, so the compile-time guarantee the ADR relies on is bypassed at
runtime. Concretely: today's client parses `data:` lines only
(`runStream.ts:138`), so #1 is latent — but the moment anyone switches to `EventSource` with
named listeners, or the server's `event:` line regresses, the harness cannot tell. #2 means
`parseFrame`'s documented comment-frame branch (`runStream.ts:132-140`) has no e2e coverage at
all. #3-#5 mean any UI that starts rendering token usage or a tool name from the frame will be
built and tested against `undefined`.

**Repro:**
1. Remove the `event: ${event.type}\n` prefix from `sse-stream.ts:61`.
2. `npx nx e2e admin-e2e -- src/copilot`
→ Observed: all copilot cases pass. Expected: a wire-format change to the run route should be
   detectable somewhere in the front-end suite.

**Blast radius:** the copilot is the product's highest-risk surface (it writes content
directly, ADR-0009) and its transport is the least faithfully modelled thing in the harness.

**Suggested fix:** make `frame()` emit `event: ${type}\n` too, prepend `: open\n\n`, and fill
the three missing required fields. Add a case that interleaves a `: ping` comment frame between
two `text-delta`s.

---

### 🐞 BUG-admin-e2e-05 — The user-detail activity mock ignores `subjectId`, so a cross-user audit leak would pass · Severity: Medium · 🔒 SECURITY

*(Downgraded from High: a **detection** gap, not a leak. Verified against the server —
`GET /api/activity` is guarded by `@RequirePermissions(PERMISSIONS.ACTIVITY_READ)`
(`packages/activity/server/src/lib/activity/controllers/list-activity.controller.ts:16-18`)
and `activity:read` is admin-only, so the only caller who could see a foreign audit trail may
already read every trail. The finding is that the one suite opening that page could not tell
the difference.)*

**Location:** `apps/admin-e2e/src/support/api/userDetail.ts:133-155`
**Category:** tenant-leak (detection gap)

**What the code does:**

```ts
/**
 * Stub `GET /api/activity` with seeded events for the Activity tab. The Activity
 * tab pins a `subjectId` filter, but the mock returns the events as-is (the
 * filtering is the server's job and is covered there) so the tab's rendering …
 * can be asserted.
 */
export async function mockActivity(page, events) {
    await page.route('**/api/activity?*', async (route) => {
        await route.fulfill({ status: 200, …, body: JSON.stringify({
            items: events, total: events.length, page: 1, pageSize: 25 }) });
    });
}
```

**Why it is wrong:** the JSDoc's reasoning — "the filtering is the server's job" — is correct
about *filtering* and wrong about *the request*. What the admin suite is uniquely positioned
to assert is that the client **sends the right `subjectId`**. It never does. The equivalent
seed one directory over gets this right: `api/members.ts:196-217` reads `search`/`filter`/
`page` off the intercepted URL and applies them, precisely so the page's controls "behave for
real". `api/activity.ts:167` (the *other* `mockActivity`) does the same for the audit-log page.

**Repro:**
1. Change the User-detail activity query to omit `subjectId`, or to send a different user's id.
2. `npx nx e2e admin-e2e -- src/users/user-detail.spec.ts`
→ Observed: passes. Expected: the tab is now displaying another user's audit trail and a spec
   should say so.

**Blast radius:** a user-detail page rendering another user's audit events is a real
information-disclosure bug in an admin console, and the one suite that opens that page cannot
see it. Compounded by the duplicate-symbol confusion in `🐞 BUG-admin-e2e-13`.

**Suggested fix:** read `subjectId` from the URL and filter, mirroring `api/members.ts:204-216`;
or return a spy and assert the sent id.

---

### 🐞 BUG-admin-e2e-06 — `reuseExistingServer: true` unconditionally, so any process on :4200 is trusted · Severity: Medium

**Location:** `apps/admin-e2e/playwright.config.ts:27-32`
**Category:** correctness (harness)

**What the code does:**

```ts
webServer: {
    command: 'npx nx run admin:serve',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
    cwd: workspaceRoot
}
```

**Why it is wrong:** Playwright's documented idiom is `reuseExistingServer: !process.env.CI` —
reuse locally for speed, always start fresh in CI so the run is reproducible. Here it is
hard-`true`. Any listener on 4200 is adopted without a health check on *what* it is: a dev
server from another branch, a stale server holding a previous commit's bundle, or an unrelated
process. Combined with `🐞 BUG-admin-e2e-01` (no CI), the practical exposure is a developer who
runs the suite against yesterday's build and believes today's change is green.

**Repro:**
1. `git stash` a breaking admin change and `npx nx run admin:serve` (old code still served).
2. `git stash pop` (breaking change back in the working tree).
3. `npx nx e2e admin-e2e`
→ Observed: the suite passes against the *old* bundle. Expected: it should test the working tree.

**Blast radius:** silently stale results; the single most confusing class of "it passed on my
machine".

**Suggested fix:** `reuseExistingServer: !process.env.CI`.

---

### 🐞 BUG-admin-e2e-07 — `trace: 'on-first-retry'` with no `retries` configured, so a trace is likely never produced · Severity: Medium

**Location:** `apps/admin-e2e/playwright.config.ts:20-24`
**Category:** correctness (harness) · *Unverified —* the effective `retries` value comes from
`nxE2EPreset` (`playwright.config.ts:17`), whose source is in `node_modules`, absent in this
checkout. Playwright's own default is `retries: 0`, and the repo config overrides nothing.

**What the code does:**

```ts
use: {
    baseURL,
    /* Collect trace when retrying the failed test. */
    trace: 'on-first-retry'
}
```

**Why it is wrong:** `on-first-retry` captures a trace only on retry attempt #1. With
`retries: 0` there is never a retry, so the single most valuable debugging artefact — the one
the comment exists to provide — is never written. The setting is not wrong in principle; it is
wrong in combination with an unset `retries`.

**Repro:** break a locator, run the spec, look for `trace.zip` in the output dir.
→ Observed: none. With `--retries=1`: a trace appears.

**Blast radius:** every failure in a future CI run is debugged from a stack trace alone.

**Suggested fix:** set `retries: process.env.CI ? 2 : 0` explicitly, or switch to
`trace: 'retain-on-failure'` so local failures also produce a trace.

---

### 🐞 BUG-admin-e2e-08 — Hard-coded `waitForTimeout` sleeps around the keyboard column-reorder · Severity: Medium

**Location:** `apps/admin-e2e/src/content/content-library.spec.ts:393-401`
**Category:** correctness (flake)

**What the code does:**

```ts
await contentLibraryPage.columnsButton.click();
await contentLibraryPage.reorderHandle('Title').focus();
await page.keyboard.press('Space');
await page.waitForTimeout(200);
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(200);
await page.keyboard.press('Space');
await page.waitForTimeout(200);
await page.keyboard.press('Escape');
```

**Why it is wrong:** these are the only three `waitForTimeout` calls in the suite; every other
spec uses web-first assertions. The comment justifies them ("dnd-kit schedules each keyboard
move on an animation frame") but an animation frame is not 200 ms, and 200 ms is not a bound —
on a loaded CI runner or under `--headed` with devtools open, a frame can take longer, and the
assertion at `:413` then reads the pre-drag order and fails with a confusing column-list diff.
The reverse is also true: on a fast machine 600 ms is pure waste, repeated on every run.

Note this also makes the test *slower to fail*: 600 ms of guaranteed sleep sits between the
action and the assertion.

**Repro:** run the spec under CPU contention (`--workers=8` on a 2-core box, or with
`--repeat-each=20`) and observe intermittent failure on the `expectedAfter` header list.

**Blast radius:** one flaky test erodes trust in the whole suite; a flaky test in a suite with
no CI (see `BUG-01`) tends to get ignored rather than fixed.

**Suggested fix:** assert an observable intermediate state between key presses — e.g. the drag
handle's `aria-pressed`/`aria-describedby` announcement, or `toHaveText` on the picker's own
list order — instead of sleeping.

---

### 🐞 BUG-admin-e2e-09 — The keyboard suites prove activation, not reachability · Severity: Medium

**Location:** `apps/admin-e2e/src/users/keyboard.spec.ts:16-48`;
`apps/admin-e2e/src/workspaces/keyboard.spec.ts:18-102`
**Category:** a11y — cross-referenced as `♿ A11Y-admin-e2e-07`

**What the code does:**

```ts
test('search is reachable and filters by keyboard', async ({ workspacesPage }) => {
    await workspacesPage.goto();
    await workspacesPage.search.focus();
    await expect(workspacesPage.search).toBeFocused();      // tautology
    await workspacesPage.search.pressSequentially('Marketing');
    …
});
```

**Why it is wrong:** `.focus()` is the DOM method; it focuses `tabindex="-1"` elements and
elements inside a broken focus trap just as readily as reachable ones. Asserting
`toBeFocused()` on the line after therefore asserts that `focus()` works, not that the user can
get there. The test *name* claims reachability. `users/keyboard.spec.ts` goes further and drops
the focus assertion entirely (3 `.focus()` calls, 0 `toBeFocused`), so "the row menu opens from
the keyboard" (`:39-48`) survives a change that removes the trigger from the tab order.

The counter-example in the same repo is `auth/keyboard.spec.ts:67-87`, which Tabs from the
document start and asserts each landing element — and whose comment explains why the read-only
fields must remain reachable. That is the pattern; it exists in exactly one file.

**Repro:**
1. Add `tabIndex={-1}` to the Workspaces search input.
2. `npx nx e2e admin-e2e -- src/workspaces/keyboard.spec.ts`
→ Observed: passes. Expected: "search is reachable" should fail.

**In fairness (verified):** `workspaces/keyboard.spec.ts:5-11` is *explicit* about the
trade — "Avoids asserting the exact global tab order (it runs through the shell nav and
varies); instead it pins the properties that matter: each control is focusable and activates
by keyboard, and the filter chips move with the arrow keys." That is a defensible choice, and
one case in the file (`:42-60`, the roving-tabindex chips) does prove real movement: it
`.focus()`es only the entry point and then asserts `ArrowRight` lands on `Archived`
(`:55-57`). The defect is narrower than "the file is worthless": the **test titles** promise
reachability ("search is **reachable** and filters by keyboard") that the assertions do not
establish, and `users/keyboard.spec.ts` drops the focus assertion entirely.

**Blast radius:** the harness's stated purpose for these files is keyboard operability — "the
part axe can't check". For the reachability half, two of the three files do not check it,
while reporting green under a title that says they do.

**Suggested fix:** Tab from a known anchor and assert the landing element; keep `.focus()` only
where the test is about activation semantics (Enter/Space), and rename those tests accordingly.

---

### 🐞 BUG-admin-e2e-10 — `WorkspaceView.content` is optional in the seed but required on the wire · Severity: Medium

**Location:** `apps/admin-e2e/src/support/api/workspaces.ts:11-21` and `:53-116`; contrast
`packages/workspaces/server/src/lib/workspace/application/queries/workspace.view.ts:27-32`
**Category:** correctness (mock-vs-reality drift)

**What the code does:** the seed declares `content?: string[]` and supplies it on exactly one
of six workspaces (`ws_marketing`, `:52`); `ws_docs`, `ws_support`, `ws_internal`,
`ws_research` and `ws_events` omit it. The server's `WorkspaceView.content` is
non-optional: "Slugs of the code-defined content types this workspace was granted at
creation". `CreateWorkspaceUseCase` always writes grants
(`packages/workspaces/server/src/lib/workspace/application/use-cases/create-workspace.use-case.ts:54,63`),
so an absent `content` is a state the API cannot produce.

**Why it is wrong:** the admin's mapper compensates with
`content: view.content ?? []` (`packages/workspaces/admin/src/lib/infrastructure/workspaceMapper/index.ts:62`,
commented "absent on older responses") — a mapper fallback that silently rewrites data, which
`.cursor/BUGBOT.md` lists as a recurring pattern to watch for. The consequence is concrete:
`WorkspacesTable/index.tsx:126` renders `{count: workspace.content.length}` in the type-count
column, so five of six rows display "0 content types" in every run, and no spec can distinguish
"granted nothing" from "the field never arrived". If the mapper's `?? []` were ever removed as
dead defensive code, the table would throw a `TypeError` in the harness and be fine in
production — the exact inversion a harness is supposed to prevent.

**Repro:**
1. Delete the `?? []` at `workspaceMapper/index.ts:62`.
2. `npx nx e2e admin-e2e -- src/workspaces/workspaces.spec.ts`
→ Observed: the table crashes on `undefined.length` for five rows. In production, nothing
   would change, because the server always sends the array.

**Blast radius:** medium — the type-count column is decorative, but the divergence trains the
codebase to keep defensive fallbacks that mask real contract breaks.

**Suggested fix:** make `content` required in `WorkspaceView` (`api/workspaces.ts:20`) and give
every seeded workspace an explicit array, including `[]` for one, so the genuine empty-grant
case is covered.

---

### 🐞 BUG-admin-e2e-11 — The members seed drops `description` from the nested workspace view · Severity: Medium

**Location:** `apps/admin-e2e/src/support/api/members.ts:10-15`; contrast
`packages/users/server/src/lib/member/application/queries/member.view.ts:11-21`
**Category:** correctness (mock-vs-reality drift)

**What the code does:**

```ts
/** A member's workspace as the API returns it (server `MemberWorkspaceView`). */
interface WorkspaceSeed { id: string; name: string; color: string; }
```

The server's type is `{ id, name, description: string | null, color }`.

**Why it is wrong:** the comment explicitly claims parity with `MemberWorkspaceView` and does
not have it. Any admin surface that renders a workspace description inside a member row — a
tooltip, a chip's title attribute, a detail popover — is untestable here and would be built
against `undefined`. This is the smallest of the drift findings and the clearest illustration
of the class: the docstring asserts fidelity that nothing verifies.

**Repro:** compare the two interfaces side by side; there is no runtime repro because no admin
code currently reads the field.

**Blast radius:** low today, medium as soon as the field is used. Listed at Medium because it
is one of four independent instances of the same root cause (see also BUG-03, BUG-10, BUG-12),
and the root cause is what needs fixing.

**Suggested fix:** the durable fix for all four is to have the mock modules import the server's
view types (they are `export interface`s in packages the e2e app could depend on for
**types only**) so the compiler enforces the contract. Failing that, add `description` here.

---

### 🐞 BUG-admin-e2e-12 — The entry fabricator never emits envelope `publishedAt`, and a seeded *field* shadows the name · Severity: Medium

**Location:** `apps/admin-e2e/src/support/api/content.ts:1048-1065` (fabricator) and `:102-108`
(the colliding field); contrast
`packages/content/server/src/lib/entries/types/entry-list-view.ts:17-26`
**Category:** correctness (mock-vs-reality drift)

**What the code does:**

```ts
return {
    id: `${detail.name}-${String(i + 1).padStart(2, '0')}`,
    ...(detail.publishable ? { status: i % 3 === 0 ? 'draft' : 'published' } : {}),
    createdAt: day,
    updatedAt: day,
    values
} as EntryRecord;
```

No `publishedAt`. Meanwhile `CONTENT_DETAIL_SEED.blog_post` declares a **user field** named
`publishedAt` (`:102-108`), which lands in `values` — a different thing at the same name.

**Why it is wrong:** the server's contract is explicit that `publishedAt` "survives an edit:
saving a published entry moves it back to `draft` while its published version stays live, so
`status: 'draft'` with a `publishedAt` means 'published content plus unpublished changes' (the
admin's **Modified** state)" (`entry-list-view.ts:19-25`). The admin implements exactly that
(`packages/content/admin/src/lib/domain/entryStatusView/index.ts:56-61`,
`packages/content/admin/src/lib/presentation/components/EntryStatusBadge/index.tsx:24-30`). Because the fabricator never emits the envelope field, the
Modified badge cannot appear in any records-table test. The `i18n` seed models it correctly
(`api/i18n.ts:117-123`), which proves the omission is an oversight rather than a design choice.

The name collision makes the seed actively misleading: `content-library.spec.ts:582` comments
"the seed's first row carries `publishedAt: 2026-01-01T00:00:00.000Z`", which is true of the
*field* and false of the *envelope*, and a reader cannot tell which contract the test is about.

**Repro:**
1. `npx nx e2e admin-e2e -- src/content/content-library.spec.ts --headed`
2. Inspect the Status column across all 23 rows (`ENTRY_COUNT = 23`, `api/content.ts:1008`).
→ Observed: only Draft and Published. Expected (given a Modified state exists): at least one
   Modified row.

**Blast radius:** the three-state publish badge is the primary signal editors read off the
records table; one of its three states has no coverage.

**Suggested fix:** emit `publishedAt` on publishable rows (null for a third of them, a past ISO
for the drafts that should read Modified), and rename the colliding seed field to
`releaseDate`.

---

### 🐞 BUG-admin-e2e-13 — Two mock modules export the same `ActivitySeed` / `mockActivity` symbols with divergent behaviour · Severity: Low

**Location:** `apps/admin-e2e/src/support/api/activity.ts:4-13`, `:167` and
`apps/admin-e2e/src/support/api/userDetail.ts:121-131`, `:139`
**Category:** correctness (maintainability)

**What the code does:** both modules export an interface named `ActivitySeed` with an identical
field list, and an async function named `mockActivity` that routes `**/api/activity?*`. Their
behaviour differs: `api/activity.ts`'s honours the request's parameters; `api/userDetail.ts`'s
returns its argument verbatim (see `🐞 BUG-admin-e2e-05`).

**Why it is wrong:** a spec that imports `mockActivity` from the wrong module gets silently
different semantics with no type error (the signatures are compatible). Worse, if a spec
registers both, the later registration wins — and which one is later depends on statement
order in a `beforeEach`, which nothing documents.

**Repro:** swap the import source in any spec that uses one of them; TypeScript accepts it and
the test's meaning changes.

**Blast radius:** low in isolation; it is the mechanism by which `BUG-05` is easy to miss in
review.

**Suggested fix:** delete the duplicate and have `userDetail.ts` re-export (and parameterise)
`api/activity.ts`'s implementation.

---

### 🐞 BUG-admin-e2e-14 — The i18n mock's list read cannot see rows the same mock created · Severity: Low

**Location:** `apps/admin-e2e/src/support/api/i18n.ts:195-197` and the list handler (~`:263-268`)
**Category:** correctness (mock fidelity)

**What the code does:**

```ts
const seeded: LocalizedRow[] = ROWS.map((row) => ({ ...row }));
const allRows = (): LocalizedRow[] => [...seeded, ...created];
…
const items = seeded.filter((row) => row.locale === locale);   // list handler
```

Creates push into `created` (`:~250`), and every other handler reads through `allRows()` — the
list handler alone reads `seeded`.

**Why it is wrong:** the real server returns a created row on the next list. "Create a German
sibling, navigate back to the list, see it" — the single most natural i18n flow — cannot be
modelled, so no spec attempts it. The asymmetry looks like an oversight rather than a decision:
every sibling handler uses `allRows()`.

**Repro:** add a spec that creates a `de` sibling and then asserts it appears in
`GET /api/content/localized_post?locale=de`.
→ Observed: absent. Expected: present.

**Blast radius:** low — it constrains what can be tested rather than producing a false pass.
Listed because it is a mock-fidelity gap in the one stateful seed the harness has.

**Suggested fix:** `const items = allRows().filter(...)`.

---

### 🐞 BUG-admin-e2e-15 — The pending-state idiom sleeps for exactly the default test timeout · Severity: Low

**Location:** `apps/admin-e2e/src/users/a11y.spec.ts:31`,
`apps/admin-e2e/src/workspaces/a11y.spec.ts:35`, `apps/admin-e2e/src/auth/a11y.spec.ts:114`;
mechanism at `apps/admin-e2e/src/support/api/auth.ts:22-25`
**Category:** correctness (flake) · *Unverified —* the effective test timeout comes from
`nxE2EPreset`, unreadable in this checkout; Playwright's own default is 30 000 ms and the repo
config overrides nothing.

**What the code does:**

```ts
await mockMembers(page, DEFAULT_MEMBERS, { delayMs: 30_000 });
```

and inside the route handler:

```ts
if (delayMs) { await new Promise((resolve) => setTimeout(resolve, delayMs)); }
```

**Why it is wrong:** the hold is chosen to be "longer than the test", but it is chosen to be
*exactly* the default timeout, leaving no margin. These are the a11y cases, which run a full
axe analysis on the held page — the slowest assertion in the suite. If the scan plus page load
exceeds 30 s on a cold runner, the test times out mid-scan and reports as a locator failure
rather than as "the mock was still sleeping". Secondarily, the handler leaves a live 30 s timer
per test, so a file with three such cases carries 90 s of pending timers into teardown.

**Suggested fix:** use a hold that is unambiguously longer than any plausible test (e.g.
`delayMs: 120_000`) or, better, have the seed accept a `hold: Promise<void>` the test resolves
explicitly, so the pending window ends deterministically.

---

### 🐞 BUG-admin-e2e-16 — The skill and AGENTS.md describe a browser matrix and a CI gate that do not exist · Severity: Low

**Location:** `.agents/skills/admin-e2e/SKILL.md:144` ("After writing":
`npx nx e2e admin-e2e -- --project=chromium   # faster locally; CI runs all 3`);
`apps/admin-e2e/TESTS.md:4` ("CI runs `npx nx catalog:check admin-e2e`");
contrast `apps/admin-e2e/playwright.config.ts:33-37`
**Category:** correctness (documentation)

*(Attribution corrected during verification: `apps/admin-e2e/AGENTS.md` does **not** make
either claim — `:48` and `:95` say only that `catalog:check` "fails if it has drifted", with
no mention of CI. The two files to fix are `TESTS.md` and the skill.)*

**What the code does:** `playwright.config.ts` declares exactly one project:

```ts
projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
    // Uncomment for mobile browsers support …
]
```

**Why it is wrong:** an author following the skill believes cross-browser and mobile coverage
exists and writes chromium-only selectors and assertions accordingly. It does not exist, and
the absence of a mobile project is also the root of `♿ A11Y-admin-e2e-04` (no reflow coverage).
Combined with `🐞 BUG-admin-e2e-01`, both CI claims in the docs are false.

**Suggested fix:** correct `TESTS.md` and the skill to state "chromium only, no CI", or add the
projects and the workflow. The documentation should not describe an aspiration in the present
tense.

---

## 7. Recommended E2E Tests

Ordered by value: each row's value is (false confidence removed) × (blast radius of the thing
it would catch). Prose only.

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | CI (not a spec) | `.github/workflows/ci.yml` | On every push and PR: `lint`, `typecheck`, `test`, `e2e admin-e2e`, `e2e server-e2e`, `catalog:check` for both. Without this every row below is optional. | `🐞 BUG-admin-e2e-01` |
| 2 | admin-e2e harness change | `src/support/api/*.ts` — record `x-workspace-id` on each seed's spy | Every workspace-scoped read sends the workspace id from the URL; a workspace switch changes it. One assertion per area (content, media, insights, copilot). | `🐞 BUG-admin-e2e-02`, EC-14, EC-38 |
| 3 | admin-e2e | `src/content/trash.spec.ts` (needs a `paranoid: true` seed type first) | "View Trash" renders for a paranoid type and not otherwise; row delete uses the soft-delete copy; restore returns the row to the list; purge is confirmed separately. | `🐞 BUG-admin-e2e-03`, EC-01 |
| 4 | admin-e2e harness change | `src/support/api/copilot.ts` | Frames carry `event:` names, a leading `: open` comment frame and an interleaved `: ping`; `run-started.messageId`, `tool-result.name`, `done.usage` present. Add one case asserting the transcript is unaffected by comment frames. | `🐞 BUG-admin-e2e-04`, EC-08/09/10 |
| 5 | admin-e2e | `src/users/user-detail.spec.ts` (extend) | The Activity tab's request carries `subjectId` equal to the open user; the mock filters by it and a foreign event never renders. | `🐞 BUG-admin-e2e-05` 🔒, EC-13 |
| 6 | admin-e2e | `src/support/fixtures.ts` + all `a11y.spec.ts` | `makeAxe` adds `'best-practice'`; fix or explicitly disable the fallout with comments. Immediately gains `aria-dialog-name`, `heading-order`, `region`, `landmark-*`, `skip-link`, `tabindex`. | `♿ A11Y-admin-e2e-01` |
| 7 | admin-e2e | `src/support/a11y.ts` | Report `incomplete` in the failure summary; fail on an `incomplete` `color-contrast` node. | `♿ A11Y-admin-e2e-02` |
| 8 | admin-e2e | `src/shell/a11y.spec.ts` (new) | axe scan of the **open** command palette, of the shell with the sidebar collapsed, and of the home dashboard; plus `Escape` closes the palette and restores focus to the Search trigger. | `♿ A11Y-admin-e2e-08`, `-10` |
| 9 | admin-e2e | `src/content/a11y.spec.ts` (extend) | axe scan of each destructive confirm dialog (entry delete soft + hard, workspace archive, member disable); assert the destructive action is not the initially focused control. | `♿ A11Y-admin-e2e-09` |
| 10 | admin-e2e | new dark-theme project in `playwright.config.ts` | Re-run every `a11y.spec.ts` under `colorScheme: 'dark'`. | `♿ A11Y-admin-e2e-03` |
| 11 | admin-e2e | new 320 px project | Re-run the table-bearing a11y specs at `viewport: { width: 320, height: 800 }`; assert no horizontal page scroll. | `♿ A11Y-admin-e2e-04` |
| 12 | admin-e2e | `src/*/keyboard.spec.ts` (rewrite) | Replace `.focus()`-then-`toBeFocused()` with a `Tab` walk from a known anchor; add one `Shift+Tab` case per surface; keep `.focus()` only for activation semantics. | `🐞 BUG-admin-e2e-09`, `♿ A11Y-admin-e2e-07`, EC-18/19 |
| 13 | admin-e2e | shared helper + one case per area | `await expect(page).toHaveTitle(...)` after each route change. | `♿ A11Y-admin-e2e-11` |
| 14 | admin-e2e | shared helper + one case per mutating suite | A save/delete/publish announces in a live region and does **not** move focus. | `♿ A11Y-admin-e2e-12` |
| 15 | admin-e2e | `src/media/a11y.spec.ts` (new) | axe scan of the **open** upload dialog, the folder-create dialog and the asset-detail drawer; assert the alt-text input is present, labelled, and offers a decorative option (504.3). | `♿ A11Y-admin-e2e-13` |
| 16 | admin-e2e | `src/content/entry-revisions.spec.ts` (extend) | Alt text, table header cells and the language marker survive save → reload → restore (504.2.1). | `♿ A11Y-admin-e2e-13` |
| 17 | admin-e2e harness change | `src/support/api/content.ts` | Emit envelope `publishedAt`; rename the colliding `publishedAt` field to `releaseDate`; add a records-table case asserting the **Modified** badge. | `🐞 BUG-admin-e2e-12`, EC-06/07 |
| 18 | admin-e2e harness change | `src/support/api/*.ts` | Import the server view types (type-only) so `MemberWorkspaceView`, `WorkspaceView`, `SerializedContentTypeSummary` and `EntryRecord` are compiler-enforced. This is the structural fix for the whole drift class. | `🐞 BUG-admin-e2e-03/10/11/12` |
| 19 | admin-e2e | `playwright.config.ts` | `reuseExistingServer: !process.env.CI`; explicit `retries`; `trace: 'retain-on-failure'`. | `🐞 BUG-admin-e2e-06`, `-07` |
| 20 | admin-e2e | `src/content/content-library.spec.ts:393-401` | Replace the three `waitForTimeout(200)` with assertions on the picker's own list order between key presses. | `🐞 BUG-admin-e2e-08`, EC-21 |
| 21 | admin-e2e | `src/content/i18n.spec.ts` (extend) | An axe scan with the German locale selected; one RTL seed string in a table suite. | `♿ A11Y-admin-e2e-14`, EC-31 |
| 22 | admin-e2e | `src/content/records-error.spec.ts` (new) | `mockContentEntries(page, { status: 500 })` renders the error state (not the empty state) with `{ timeout: 15_000 }`; retry recovers. | EC-44 |
| 23 | admin-e2e | `src/content/pagination.spec.ts` (new) | Delete the only row on the last page → pager clamps and refetches; `page` beyond `pageCount` → the pager corrects rather than showing "no results". | EC-29 |
| 24 | admin-e2e harness change | `src/support/api/members.ts:163` | Make the filter evaluator fail **closed** (throw or return no rows) on an unknown operator, so a new client-side operator is a loud failure. | EC-15 |
| 25 | admin-e2e | `src/auth/network-failure.spec.ts` (new) | `route.abort('failed')` on a list read renders the error state; distinguishes a transport failure from an HTTP error. | EC-40 |
| 26 | admin-e2e | `src/users/members.spec.ts` (extend) | Seed a 200-character name and an emoji/CJK name; assert truncation and that the row still renders. | EC-31, EC-33 |
| 27 | admin-e2e harness change | `src/support/api/userDetail.ts` | Delete the duplicate `ActivitySeed`/`mockActivity`; re-export from `api/activity.ts`. | `🐞 BUG-admin-e2e-13` |
| 28 | admin-e2e harness change | `src/support/api/i18n.ts` list handler | `allRows()` instead of `seeded`; then add "create a sibling, see it in the list". | `🐞 BUG-admin-e2e-14` |
| 29 | docs | `apps/admin-e2e/AGENTS.md`, `.agents/skills/admin-e2e/SKILL.md` | Correct the browser-matrix and CI claims; document that `makeAxe` omits `best-practice` until #6 lands. | `🐞 BUG-admin-e2e-16` |
