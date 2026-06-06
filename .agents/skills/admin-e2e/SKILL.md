---
name: admin-e2e
description: Authoring or extending Ortha CMS admin end-to-end tests (apps/admin-e2e) — the Playwright Page Object harness for the admin SPA. Covers POM fixtures, the page.route `/api` mock layer (the "seed"), accessibility (axe) + keyboard suites, and the documented DOM gotchas. Use when adding an admin e2e suite for a page or flow, or changing the e2e harness.
user-invocable: false
allowed-tools: Read, Edit, Write, Glob, Grep, Bash(npx nx *), Bash(npm exec nx *)
---

# Ortha CMS admin e2e tests

`apps/admin-e2e` drives the admin SPA in a **real browser** with **Playwright**,
using the **Page Object** pattern. The backend is **mocked at the network layer**
(`page.route` on `/api/**`), so suites are deterministic and need no server,
Postgres, or Docker — `npx nx e2e admin-e2e` starts the dev server and runs.

> **Reference suites:** `src/auth/login.spec.ts` (form flow: success, 401,
> validation, pending), `src/auth/routing.spec.ts` (redirects), `a11y.spec.ts`
> (axe), `keyboard.spec.ts` (keyboard operability). Read the closest one before
> writing a new suite. Package notes:
> [`apps/admin-e2e/CLAUDE.md`](../../../apps/admin-e2e/CLAUDE.md).

This skill is the front-end sibling of **`server-e2e`** (same philosophy, applied
to the browser) and the companion to **`accessibility`**: when you build an admin
page, add a suite here that exercises it — including an axe scan.

---

## The non-negotiables

1. **Page Objects own selectors; specs own assertions.** A spec never calls
   `page.getByX` directly — it goes through a page object in `support/pages/`.
   When the UI shifts, only the page object changes.
2. **Black-box.** Specs (and page objects) import **no app source** — they drive
   the browser as a user does and navigate by URL string (`/identity/signin`),
   never by importing route constants. So there are no `@nx/enforce-module-boundaries`
   concerns, unlike `server-e2e`.
3. **The network is the seed.** All backend state comes from `support/api/*`
   mocks (`page.route`). Routes are per-`page`, so they reset between tests with
   the browser context — the FE analog of `resetDb()`.
4. **One suite per page/flow**, grouped by feature folder under `src/` (e.g.
   `src/auth/login.spec.ts`). Import `test`/`expect` from
   `../support/fixtures`, never from `@playwright/test`.
5. **Prefer role/label locators** (`getByRole`, `getByLabel`) over CSS — resilient
   and a11y-aligned.

## Harness API (`src/support/`)

```ts
// fixtures.ts — import { test, expect } from this, not @playwright/test
test.extend<{ loginPage; homePage; makeAxe }>
//   loginPage / homePage  → page objects (support/pages/)
//   makeAxe()             → a fresh AxeBuilder, tagged WCAG 2.1 A/AA

// pages/LoginPage.ts
loginPage.goto() / login(email, password)
loginPage.{heading, email, password, submit, errorBanner}
loginPage.fieldError(message)            // a field-level validation message

// api/auth.ts — the "seed" layer
mockLogin(page, { status?, delayMs? })   // 201 → navigates to /; 401 → banner
spyLogin(page)                           // always 201; .count to assert (not) called

// a11y.ts
expectNoA11yViolations(makeAxe())        // readable failure summary
```

## Adding a suite — the shape

A page object (selectors + actions), then a spec (assertions):

```ts
// support/pages/WidgetsPage.ts
import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class WidgetsPage extends BasePage {
    readonly heading: Locator;
    constructor(page: Page) {
        super(page);
        this.heading = page.getByRole('heading', { name: 'Widgets' });
    }
    async goto() {
        await this.page.goto('/widgets');
    }
}
```

Register it as a fixture in `support/fixtures.ts`, then:

```ts
// src/widgets/widgets.spec.ts
import { test, expect } from '../support/fixtures';

test.describe('Widgets page', () => {
    test('lists widgets', async ({ widgetsPage }) => {
        await widgetsPage.goto();
        await expect(widgetsPage.heading).toBeVisible();
    });
});
```

Mock that page's data with a `support/api/<domain>.ts` helper (mirror
`api/auth.ts`) — never hit a real backend.

### Cover, at minimum

- **Happy path** — the page renders and its primary action works.
- **Error state** — mock a non-2xx and assert the UI surfaces it (and recovers).
- **Empty/loading/pending** — use `mockLogin(page, { delayMs })`-style delays to
  observe spinners/disabled controls.
- **Validation** — client-side errors appear; the API is **not** called when the
  form is invalid (assert with `spyLogin`-style `.count`).
- **Accessibility** — an `a11y.spec.ts` axe scan of the page **and its dynamic
  states**, plus keyboard operability for any new interaction. See the
  `accessibility` skill for what "accessible" means.

## Accessibility & keyboard (see also the `accessibility` skill)

- `makeAxe()` returns an axe scanner tagged WCAG 2.1 A/AA. Scan **states**, not
  just the initial render (errors shown, banner shown, dialog open).
- **`color-contrast` is currently disabled in `makeAxe`** — a loudly-commented,
  centralized known-debt exception (the `muted-foreground` token fails AA;
  tracked for a design-system contrast pass). Every other rule is enforced. Do
  not add more rule exclusions silently — if you must, comment why + link a TODO.
- Keyboard specs cover what axe can't: first-focus, tab reachability, Enter-submits.
  Don't assert the exact tab order through **placeholder** controls (they change);
  assert the properties that matter.

## Gotchas

- **`role="alert"` is shared.** The credential-error banner *and* every field
  error use it (design-system `FieldError`). Anchor the banner on its title
  ("Authentication failed"); assert field errors by message text.
- **The submit button's accessible name changes** ("Login" → sr-only
  "Signing in…" while pending). `LoginPage.submit` matches either
  (`name: /Login|Signing in/`) so one handle works across states.
- **Import depth:** specs live at `src/<feature>/`, support at `src/support/` —
  so it's `../support/...` (one level), not `../../` (the server suite is deeper).
- **Mocks bypass the dev proxy.** `page.route` intercepts in the browser before
  the request reaches Vite, so the `/api` proxy is irrelevant — no backend needed.

## After writing

```bash
npx nx e2e admin-e2e -- --project=chromium   # faster locally; CI runs all 3
npx nx run-many -t typecheck lint -p admin-e2e
npx nx format:write
```
