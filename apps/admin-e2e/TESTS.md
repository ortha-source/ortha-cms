# Admin E2E test catalog

> **Generated file — do not edit by hand.** Regenerate with
> `npx nx catalog admin-e2e`. CI runs `npx nx catalog:check admin-e2e`
> and fails if this file has drifted from the specs.

_34 test cases across 8 spec files._

<!-- source: apps/admin-e2e/src/auth/a11y.spec.ts -->
_<sub>apps/admin-e2e/src/auth/a11y.spec.ts</sub>_

## accessibility (axe, WCAG 2.1 A/AA)

| Test case |
| --- |
| login page — initial |
| login page — required-field errors visible |
| login page — credential-error banner visible |
| home page |

<!-- source: apps/admin-e2e/src/auth/keyboard.spec.ts -->
_<sub>apps/admin-e2e/src/auth/keyboard.spec.ts</sub>_

## keyboard accessibility

| Test case |
| --- |
| the email field is the first focus stop |
| login can be completed and submitted by keyboard alone |

<!-- source: apps/admin-e2e/src/auth/login.spec.ts -->
_<sub>apps/admin-e2e/src/auth/login.spec.ts</sub>_

## Login page (/identity/signin)

### successful sign-in

| Test case |
| --- |
| navigates to the home page |

### invalid credentials (401)

| Test case |
| --- |
| shows the error banner and stays on the page |

### client-side validation

| Test case |
| --- |
| empty submit flags both required fields without calling the API |
| shows exactly one error per field |
| rejects a malformed email |

### pending state

| Test case |
| --- |
| disables the submit button while the request is in flight |

<!-- source: apps/admin-e2e/src/auth/private-routes.spec.ts -->
_<sub>apps/admin-e2e/src/auth/private-routes.spec.ts</sub>_

## Private route gating

| Test case |
| --- |
| redirects a signed-out user from / to the sign-in page |
| redirects a signed-out user from an unknown path to the sign-in page |
| returns to the home page after a gated user signs in |

<!-- source: apps/admin-e2e/src/auth/routing.spec.ts -->
_<sub>apps/admin-e2e/src/auth/routing.spec.ts</sub>_

## Admin routing

| Test case |
| --- |
| /identity redirects to the sign-in page |
| an unknown path redirects to home |
| serves the home page inside the shell at / |

<!-- source: apps/admin-e2e/src/workspaces/a11y.spec.ts -->
_<sub>apps/admin-e2e/src/workspaces/a11y.spec.ts</sub>_

## Workspaces accessibility (axe, WCAG 2.1 A/AA)

| Test case |
| --- |
| grid — initial |
| status filter popover — open |
| member popover — open |
| empty state — no matches |

<!-- source: apps/admin-e2e/src/workspaces/keyboard.spec.ts -->
_<sub>apps/admin-e2e/src/workspaces/keyboard.spec.ts</sub>_

## Workspaces keyboard accessibility

| Test case |
| --- |
| search is reachable and filters by keyboard |
| a card opens on Enter |
| the status filter radiogroup moves with arrow keys |

<!-- source: apps/admin-e2e/src/workspaces/workspaces.spec.ts -->
_<sub>apps/admin-e2e/src/workspaces/workspaces.spec.ts</sub>_

## Workspaces page

| Test case |
| --- |
| renders the workspaces behind the shell |
| search narrows the grid and updates the count |
| the archived filter empties the grid and badges the button |
| the status filter can show all workspaces |
| shows a contextual empty state when nothing matches |

### member stack

| Test case |
| --- |
| collapses extra members into a "+N" pill |
| opens a member list without opening the workspace |
| closes on Escape and on an outside click |

| Test case |
| --- |
| a card opens its workspace on click |
