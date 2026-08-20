# admin-e2e

End-to-end tests for the admin SPA (`apps/admin`), driven by **Playwright** in a
real browser. The backend is **mocked at the network layer** (`page.route` on
`/api/**`), so suites are deterministic and need no server, Postgres, or Docker.
The real HTTP round-trip is covered by [`server-e2e`](../server-e2e/AGENTS.md);
this suite covers _admin behavior_ — routing, forms, navigation, pending/error
states.

> Sibling of `server-e2e`: same philosophy (isolate each test, seed deterministic
> state, keep selectors/wiring in `support/`, one suite per concern), applied to
> the front end.

## How a run works

1. **`playwright.config.ts`** starts the admin dev server (`nx run admin:serve`,
   `reuseExistingServer`) at `http://localhost:${ADMIN_PORT ?? 4200}` — the
   per-worktree slot port, so parallel checkouts each drive their own stack — and
   runs `src/**/*.spec.ts` in chromium. `support/globalSetup.ts` then refuses the
   run if that port is not this app, or if a live API is answering behind the
   proxy (see Gotchas — both fail as a broad, plausible-looking regression).
2. **`support/fixtures.ts`** extends Playwright's `test` with **page-object**
   fixtures (`loginPage`, `homePage`). Specs import `test`/`expect` from here,
   never from `@playwright/test` directly.
3. **`support/api/*`** are the "seed" layer — they stub `/api/**` responses
   (`mockLogin`, `spyLogin`). Routes are per-`page`, so they reset between tests
   with the browser context (the FE analog of `resetDb()`).
4. **Accessibility.** `fixtures.ts` also provides `makeAxe` — an
   `@axe-core/playwright` scanner tagged WCAG 2.1 A/AA **+ `best-practice`**,
   with **one** rule excluded by name in `AXE_KNOWN_GAPS`. `support/a11y.ts`
   (`expectNoA11yViolations`) asserts a clean scan with a readable failure
   summary. `src/auth/a11y.spec.ts` scans pages **and dynamic states** (errors,
   banner); `keyboard.spec.ts` covers keyboard operability axe can't.

## Accessibility (a11y)

- Target: **WCAG 2.1 A/AA**, best-practice (not a formal 508/VPAT obligation).
  Automated scans are a regression guard — they catch a fraction of WCAG issues,
  never prove conformance; manual keyboard/screen-reader passes stay a human task.
- **Scan both themes.** The dark palette is a second, independently authored set
  of colour tokens — a light scan says nothing about it. Signed-in pages seed it
  through `mockPreferences(page, { theme: 'dark' })`; the **public** auth screens
  have no stored preference, so `page.emulateMedia({ colorScheme: 'dark' })` is
  what the pre-paint bootstrap in `index.html` resolves. Assert the `.dark` class
  landed before scanning — a dark scan that quietly ran in light mode is worse
  than none.
- **Reflow is not axe's job.** WCAG 1.4.10 (320px / 400% zoom) needs a viewport
  and geometry, not a rule engine: `src/auth/reflow.spec.ts` pins zero horizontal
  overflow and every control reachable by vertical scrolling alone.
- `makeAxe` runs the WCAG 2.1 A/AA tags **plus `best-practice`**, which is where
  axe files every structural rule — `heading-order`, `page-has-heading-one`,
  `region`, the `landmark-*` family, `aria-dialog-name`, `tabindex`, `skip-link`.
  `withTags` is a **whitelist**, so for a long time those simply never ran: 30 of
  axe-core 4.12's 105 rules, 29% of the catalogue, were dark, and nothing said so
  because no rule had been _disabled_. A route with no `<h1>`, no `<main>` and a
  nameless dialog scanned green. If you are ever tempted to trim that tag list,
  read `src/harness/axe-fixture.spec.ts` first — it exists to stop exactly this.
- **One rule is excluded, in one place, with its reason.** `AXE_KNOWN_GAPS` in
  `support/fixtures.ts` held five when `best-practice` was switched on. Four
  were real product debt and are **fixed**, so `landmark-one-main`,
  `page-has-heading-one`, `heading-order` and `aria-dialog-name` all run again.
  What remains is `region`, and it is the rule rather than the product: an open
  Radix menu is portalled to `<body>`, and axe's default `regionMatcher`
  (`dialog, [role=dialog], [role=alertdialog], svg`) exempts a Popover but not a
  menu — which is a **check** option `AxeBuilder` has no way to set, since it can
  pass only `RunOptions`. Excluding the wrapper instead would drop the menu's
  subtree from every rule, losing the contrast and naming checks that run inside
  it. The two real findings `region` caught are pinned by name in
  `host/host.spec.ts` (the sidebar and the copilot dock are `complementary`
  landmarks) rather than left to the rule. `harness/axe-fixture.spec.ts` pins the
  list so it cannot quietly grow. Never exclude a rule anywhere else.
- **`incomplete` is not a pass.** `expectNoA11yViolations` records axe's
  "could not decide" bucket as a test annotation (visible per case in the HTML
  report) and folds it into the failure message. `color-contrast` is its biggest
  contributor — semi-transparent text over a semi-transparent background lands
  there rather than in `violations` — and it used to be destructured away, so
  every such element was reported clean.
- The scan originally caught a real `color-contrast` failure on muted text; the
  `muted-foreground` token was darkened to clear AA (`apps/admin/src/styles.css`)
  and the rule stays on to guard against regressions.

## Test catalog

[`TESTS.md`](./TESTS.md) is a **generated** index of every `test.describe`/`test`
case, built by parsing the spec AST (`tools/generate-test-catalog.mjs`) — it
never runs Playwright, so it needs no browser. **Don't edit it by hand.** After
adding, renaming, or removing a test, run `npx nx catalog admin-e2e` and commit
the result; `npx nx catalog:check admin-e2e` fails if it has drifted, and the
`admin-e2e-test-catalog` pre-commit hook regenerates and re-stages it for you.

**Nothing in CI runs any of this** — `.github/workflows/` holds `release.yml`
alone, with no `e2e`, `lint`, `typecheck` or `catalog:check`. That hook and
whatever you run locally are the entire gate for this suite. Run the full thing
before merging and never merge red.

## Conventions

- **Page Objects own selectors; specs own assertions.** A spec never calls
  `page.getByX` directly — go through a page object in `support/pages/`. Keeps
  selectors in one place when the UI shifts.
- **One suite per page/flow**, grouped in feature folders (`src/auth/`).
- **Black-box.** Specs never import admin/app source — they drive the browser as
  a user would (so no `@nx/enforce-module-boundaries` issues, and no coupling to
  internal route constants; navigate by URL string).
- **Network is the seed.** All backend state comes from `support/api/*` mocks.
- **Role/label locators** over CSS (`getByRole`, `getByLabel`) — resilient and
  a11y-aligned.

## Gotchas

- **`role="alert"` is shared.** Both the credential-error banner _and_ each
  field error render `role="alert"` (design-system `FieldError`). `LoginPage`
  anchors the banner on its title text ("Authentication failed"); assert field
  errors by their message text, not the bare role.
- **Pending state is brief.** To observe the spinner/disabled button, hold the
  response open with `mockLogin(page, { delayMs })`.
- **`page.route` _can_ fulfil an event-stream body.** The copilot suites stub
  `POST /api/copilot/runs` as `text/event-stream` and the reducer folds the
  frames exactly as it would live (`support/api/copilot.ts`). The whole body
  arrives in one read, so what is lost is only the _progressive_ arrival of
  frames — not the finished transcript, and not the order of its parts. The
  earlier note that this was impossible was wrong, and it cost the whole surface
  its coverage for a while.
- **`forcedColors` and `reducedMotion` are not Playwright _test options_.**
  `test.use({ forcedColors: 'active' })` does nothing at all — the media query
  still reports `false` — while `test.use({ colorScheme })` works normally. The
  cause is not this repo's config: the runner assembles `browser.newContext()`'s
  argument from a **fixed list of option fixtures**
  (`playwright/lib/index.js`, `_combinedContextOptions`), and these two are not
  on it. They are absent from `PlaywrightTestOptions` for the same reason, so
  passing either through `test.use()` is a **compile error** (`TS2353`) — it only
  ever looked _silent_ because `nx typecheck admin-e2e` had been red for weeks
  and nobody was reading it. Two routes work, and both are pinned in
  `src/host/platform-preferences.spec.ts`:
  `page.emulateMedia({ forcedColors: 'active' })` per test, or
  `test.use({ contextOptions: { forcedColors: 'active' } })` — `contextOptions`
  **is** an option fixture and is spread into the context arguments verbatim.
  Same for every other `BrowserContextOptions` key with no fixture of its own
  (`screen`, `strictSelectors`, `recordHar`, `recordVideo`): reach for
  `contextOptions`, and let the compiler tell you when you have guessed wrong.
- **Keep `typecheck` green.** It is the only static gate over 45 spec files, and
  the point above is what a broken one costs: a whole class of "this option does
  nothing" mistake stops being reported. There is no CI here — `npx nx typecheck
admin-e2e && npx nx lint admin-e2e` plus a full run is the entire gate.
- **The run refuses to start against the wrong server.** `globalSetup` checks
  that the port really holds _this_ app (`reuseExistingServer` is `true`
  unconditionally, so Playwright will happily adopt an impostor) and that no live
  API is answering behind the Vite proxy. A backend on the API port is the most
  expensive trap in this harness: mocks only cover the routes a spec registered,
  everything else proxies through, the real `401` trips the admin's global
  sign-out interceptor, `mockSignedIn` stops holding and nearly every page-level
  spec fails on a redirect to `/identity/signin`. It looks exactly like a broad
  regression. Measured: one spec file, 15 passed → 14 failed, purely by starting
  the API.
- **Don't drive an asynchronous control with `check()`.** Playwright's
  `_setChecked` clicks once, re-reads the state one tick later and raises a
  **non-recoverable** `Clicking the checkbox did not change its state` — no
  retry, no web-first wait. Any control that fetches before it can report itself
  checked (the relation picker's "Select all N", which pages the rest in) passes
  on an idle machine and fails on a busy one. Use `click()` and assert the end
  state. That was the whole of the `relations.spec.ts` load-flake.
- **Assert against a number the product states, not one you snapshotted.** A
  count taken from a lazily-paged list is a moving target; the same list's
  "Select all 32" label is not. The failure mode is a test that measures two
  different sets and reads as a regression under load.
- **axe never emulates a media feature.** Every scan runs in the browser default
  — light, no forced colors, no reduced motion, desktop viewport — so a clean
  run is a statement about _that_ state and no other. `scrollable-region-focusable`
  only fires at a viewport where the element actually overflows, and
  `color-contrast` only ever saw the light palette. Anything keyed on a
  preference or a size needs a computed-style assertion, not a scanner.
- **A Radix menu that is `modal` fails axe.** It `aria-hidden`s the page root,
  which holds focusable content, so `aria-hidden-focus` fires. Every row menu and
  picker in the admin passes `modal={false}`; a new one that doesn't will fail
  its scan rather than the assertion you were writing.
- **A query's error state is ~7s away — for a `5xx` or a network failure.**
  TanStack Query retries those 3× with exponential backoff before `isError`, so
  such an assertion needs an explicit `{ timeout: 15_000 }`. A **`4xx` fails
  fast**: the shared client's retry predicate treats it as the server's settled
  answer and stops (`packages/utils/admin/src/lib/queryClient`), so a 400/403/404
  state appears immediately. Mock the status you actually mean.
- **The submit button's name changes.** Idle it reads "Login"; while submitting
  the label is the `sr-only` "Signing in…". `LoginPage.submit` matches either
  (`name: /Login|Signing in/`) so one handle works across both states.

## Commands

- `npx nx e2e admin-e2e` — run the suites (starts the dev server automatically).
- `npx nx e2e admin-e2e -- --project=chromium` — single browser, faster locally.
- `npx nx lint admin-e2e` / `npx nx typecheck admin-e2e`.
- `npx nx catalog admin-e2e` — regenerate `TESTS.md` from the specs.
- `npx nx catalog:check admin-e2e` — fail if `TESTS.md` is stale.
