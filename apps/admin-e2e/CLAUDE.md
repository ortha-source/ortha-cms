# admin-e2e

End-to-end tests for the admin SPA (`apps/admin`), driven by **Playwright** in a
real browser. The backend is **mocked at the network layer** (`page.route` on
`/api/**`), so suites are deterministic and need no server, Postgres, or Docker.
The real HTTP round-trip is covered by [`server-e2e`](../server-e2e/CLAUDE.md);
this suite covers _admin behavior_ — routing, forms, navigation, pending/error
states.

> Sibling of `server-e2e`: same philosophy (isolate each test, seed deterministic
> state, keep selectors/wiring in `support/`, one suite per concern), applied to
> the front end.

## How a run works

1. **`playwright.config.ts`** starts the admin dev server (`nx run admin:serve`,
   `reuseExistingServer`) at `http://localhost:4200` and runs `src/**/*.spec.ts`
   across chromium/firefox/webkit.
2. **`support/fixtures.ts`** extends Playwright's `test` with **page-object**
   fixtures (`loginPage`, `homePage`). Specs import `test`/`expect` from here,
   never from `@playwright/test` directly.
3. **`support/api/*`** are the "seed" layer — they stub `/api/**` responses
   (`mockLogin`, `spyLogin`). Routes are per-`page`, so they reset between tests
   with the browser context (the FE analog of `resetDb()`).

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
- **The submit button's name changes.** Idle it reads "Login"; while submitting
  the label is the `sr-only` "Signing in…". `LoginPage.submit` matches either
  (`name: /Login|Signing in/`) so one handle works across both states.

## Commands

- `npx nx e2e admin-e2e` — run the suites (starts the dev server automatically).
- `npx nx e2e admin-e2e -- --project=chromium` — single browser, faster locally.
- `npx nx lint admin-e2e` / `npx nx typecheck admin-e2e`.
