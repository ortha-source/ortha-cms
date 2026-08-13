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
   `reuseExistingServer`) at `http://localhost:4200` and runs `src/**/*.spec.ts`
   in chromium.
2. **`support/fixtures.ts`** extends Playwright's `test` with **page-object**
   fixtures (`loginPage`, `homePage`). Specs import `test`/`expect` from here,
   never from `@playwright/test` directly.
3. **`support/api/*`** are the "seed" layer — they stub `/api/**` responses
   (`mockLogin`, `spyLogin`). Routes are per-`page`, so they reset between tests
   with the browser context (the FE analog of `resetDb()`).
4. **Accessibility.** `fixtures.ts` also provides `makeAxe` — an
   `@axe-core/playwright` scanner pre-tagged for WCAG 2.1 A/AA. `support/a11y.ts`
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
- `makeAxe` runs the **full** WCAG 2.1 A/AA ruleset (no rule exclusions). The
  scan originally caught a real `color-contrast` failure on muted text; the
  `muted-foreground` token was darkened to clear AA (`apps/admin/src/styles.css`)
  and the rule stays on to guard against regressions. If you must ever exclude a
  rule, do it in one place with a comment + a tracked TODO — never silently.

## Test catalog

[`TESTS.md`](./TESTS.md) is a **generated** index of every `test.describe`/`test`
case, built by parsing the spec AST (`tools/generate-test-catalog.mjs`) — it
never runs Playwright, so it needs no browser. **Don't edit it by hand.** After
adding, renaming, or removing a test, run `npx nx catalog admin-e2e` and commit
the result; `npx nx catalog:check admin-e2e` fails if it has drifted.

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
- **A Radix menu that is `modal` fails axe.** It `aria-hidden`s the page root,
  which holds focusable content, so `aria-hidden-focus` fires. Every row menu and
  picker in the admin passes `modal={false}`; a new one that doesn't will fail
  its scan rather than the assertion you were writing.
- **A query's error state is ~7s away.** TanStack Query retries 3× with
  exponential backoff before `isError`, so an error-state assertion needs an
  explicit `{ timeout: 15_000 }`.
- **The submit button's name changes.** Idle it reads "Login"; while submitting
  the label is the `sr-only` "Signing in…". `LoginPage.submit` matches either
  (`name: /Login|Signing in/`) so one handle works across both states.

## Commands

- `npx nx e2e admin-e2e` — run the suites (starts the dev server automatically).
- `npx nx e2e admin-e2e -- --project=chromium` — single browser, faster locally.
- `npx nx lint admin-e2e` / `npx nx typecheck admin-e2e`.
- `npx nx catalog admin-e2e` — regenerate `TESTS.md` from the specs.
- `npx nx catalog:check admin-e2e` — fail if `TESTS.md` is stale.
