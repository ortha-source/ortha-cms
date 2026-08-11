# @ortha-cms/identity-admin — Test Artifact

> **Unit:** `packages/identity/admin` · **Package:** `@ortha-cms/identity-admin` · **Kind:** admin plugin
> **Source of truth:** `packages/identity/admin/AGENTS.md`
> **Findings verified:** 2026-08-11 — 12 confirmed · 0 deleted · 3 corrected · 1 unverified
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

The admin-side identity plugin. It owns the two **unauthenticated** screens — sign-in and
accept-invite — and the **entire admin auth kit** that every other plugin depends on:
`AuthProvider`, `RequireAuth`, `useAuth`, `useHasPermission`, `AuthStatus`,
`useLogoutMutation`.

Notably it contributes **no slots and no nav**. Its only route is
`/identity/*`, marked `public: true` (`identityPlugin/index.tsx:35`); the **shell**
imports `AuthProvider` + `RequireAuth` and composes them into its `layout`.

It does **NOT** own:

- Any authorization decision. `useHasPermission` is UX only — the server guard is the
  boundary (`.cursor/BUGBOT.md` §Admin).
- The members / user-detail / preferences screens — those are `users/admin`.
- The `AccountMenu` and its Logout button — that is `users/admin`
  (`packages/users/admin/.../AccountMenu/index.tsx`), which merely calls this package's
  `useLogoutMutation`.
- Password reset, sign-up, terms, or privacy pages. **None exist** — see 🐞 BUG-identity-admin-02.

### Entry points

| Route | Component | Public? |
| --- | --- | --- |
| `/identity` | redirect → `signin` (`router/index.tsx:41`) | yes |
| `/identity/signin` | `LoginPage` (lazy) | yes |
| `/identity/accept-invite?token=…` | `AcceptInvitePage` (lazy) | yes |

**Exported API** (`src/index.ts`): `IdentityPlugin`, `IdentityRouter`, `LoginForm`,
`AcceptInviteForm`, `AcceptInviteFormValues`, `AuthLayout`, `PASSWORD_MIN_LENGTH`,
`PASSWORD_MAX_LENGTH`, `AuthProvider`, `RequireAuth`, `useAuth`, `useHasPermission`,
`AuthStatus`, `AuthState`, `AuthUser`, `useLogoutMutation`, and the wire types.

**Data layer** — one gateway, five methods (`infrastructure/httpAuthGateway/index.ts`):
`GET /auth/me`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/invite/:token`,
`POST /auth/invite/accept`. It is the only `apiClient` user in the plugin.

### Runtime prerequisites

- The API running with identity registered, and the Vite proxy (`/api` → `:3000`) so the
  session cookie is first-party (`AGENTS.md` "Cross-origin cookies (settled in #8)").
- For sign-in: an `active` account. For accept-invite: a live invite token, obtained from
  `POST /api/users/invites` — the admin UI shows it once
  (`packages/users/admin/.../InviteLinkPanel`).
- The host's single `IntlProvider` and `QueryClientProvider` (`createAdmin`).
- The shared `apiClient`'s 401 handler slot (`setUnauthorizedHandler`) — `AuthProvider`
  installs into it on mount (`AuthProvider/index.tsx:31-43`).

### How to exercise it manually

```bash
docker compose up -d && npx nx run server:db:migrate && npm run dev
open http://localhost:4200/identity/signin
```

For accept-invite, invite someone at `http://localhost:4200/users/invite`, copy the link
from the reveal dialog, open it in a **private window** (the flow must work with no session).

### Dependencies that must be healthy

`@ortha-cms/utils-admin` (`apiClient`, `toApiError`, `HTTP_STATUS`, `STALE_TIME`,
`setUnauthorizedHandler`), `@ortha-cms/design-system` (`Card`, `InputField`, `Field`,
`Alert`, `Button`, `Spinner`, `Skeleton`, `AppLoader`, `Logo`), `@tanstack/react-form`,
`zod`, `react-intl`, `react-router-dom`, and the shell (which mounts the layout).

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | `/identity` redirects to `/identity/signin` | `presentation/router/index.tsx:41` | ✅ E2E |
| F2 | Login form: email + password, card layout | `presentation/components/LoginForm/index.tsx:73-169` | ✅ E2E |
| F3 | Client-side login validation (required, email shape) | `LoginForm/useLoginSchema.ts:26-48`, `domain/value-objects/email/index.ts:25-31` | ✅ E2E |
| F4 | Submit → `POST /auth/login`, invalidate `['auth','me']`, navigate | `pages/LoginPage/index.tsx:45-54` | ✅ E2E |
| F5 | Return to the attempted route after sign-in (`location.state.from`) | `LoginPage/index.tsx:43,51` | ✅ E2E |
| F6 | 401 → "email or password is incorrect"; anything else → generic | `LoginPage/index.tsx:56-62` | ✅ E2E |
| F7 | Pending state: spinner + `sr-only` label, button disabled | `LoginForm/LoginActions/index.tsx:47-58` | ✅ E2E |
| F8 | Lazy-loaded routes behind a `LoginSkeleton` Suspense boundary | `router/index.tsx:12-26,39` | ⚠️ PARTIAL |
| F9 | `AuthProvider` — resolve `GET /auth/me`, publish `AuthState` | `presentation/auth/AuthProvider/index.tsx:27-65` | ✅ E2E |
| F10 | Session-lost handling: the shared 401 handler sets the user to `null` | `AuthProvider/index.tsx:31-43` | ✅ E2E |
| F11 | Three-state auth (`Loading` / `Authenticated` / `Unauthenticated`), fail-closed default | `auth/authContext/index.ts:23-54` | ✅ E2E |
| F12 | `RequireAuth` — loader while resolving, redirect preserving `from` | `auth/RequireAuth/index.tsx:38-55` | ✅ E2E |
| F13 | `useHasPermission` — fail-closed while loading/unauthenticated | `authContext/index.ts:63-68` | ✅ E2E (indirect) |
| F14 | `useCurrentUser` — `401` → `null`, `retry:false`, refetch on window focus | `application/useCurrentUser/index.ts:26-33`, `httpAuthGateway/index.ts:17-28` | ⚠️ PARTIAL |
| F15 | `useLogoutMutation` — `POST /auth/logout` then invalidate the current user | `application/useLogoutMutation/index.ts:13-21` | ⚠️ PARTIAL |
| F16 | Accept-invite: read `?token=`, resolve who it is for | `pages/AcceptInvitePage/index.tsx:61-64`, `application/useInvite/index.ts:20-30` | ✅ E2E |
| F17 | Email + name shown **read-only**; only a password is collected | `components/AcceptInviteForm/index.tsx:181-205` | ✅ E2E |
| F18 | Accept-invite validation: min/max length + confirm match | `AcceptInviteForm/useAcceptInviteSchema.ts:46-81`, `domain/value-objects/password/index.ts:30-35` | ✅ E2E |
| F19 | Submit → `POST /auth/invite/accept`, invalidate, land at `/` | `AcceptInvitePage/index.tsx:67-79` | ✅ E2E |
| F20 | Accept-invite error mapping: 404 → "expired", 400 → "password rejected", else generic | `AcceptInvitePage/index.tsx:130-138` | ✅ E2E |
| F21 | Missing-token state distinguished from a dead link | `AcceptInvitePage/index.tsx:81-87`, `components/InviteUnavailable/index.tsx:57-87` | ✅ E2E |
| F22 | Loading state announced (`role="status"` + `sr-only`, skeleton `aria-hidden`) | `AcceptInvitePage/index.tsx:89-118` | ✅ E2E |
| F23 | `Email` value object (format + 320-char cap) | `domain/value-objects/email/index.ts` | ❌ NONE (no unit test in-package) |
| F24 | `Password` value object (12…72) | `domain/value-objects/password/index.ts` | ❌ NONE |
| F25 | "Forgot your password?" control | `LoginForm/index.tsx:147-157` | ❌ NONE — **inert `TODO(#8)`** |
| F26 | "Don't have an account? Sign up" control | `LoginForm/LoginActions/index.tsx:60-72` | ❌ NONE — **inert `TODO(#8)`, and contradicts invite-only** |
| F27 | Terms of Service / Privacy Policy controls | `LoginForm/LegalFooter/index.tsx:18-40` | ❌ NONE — **inert `TODO(#8)`** |

## 3. Manual Test Plan

Base URL `http://localhost:4200`. Every block ends with a **keyboard-only path** and a
**screen-reader expectation** (tested with NVDA + Firefox and VoiceOver + Safari).

### F1 — `/identity` redirect

**Preconditions:** signed out.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Navigate to `/identity` | URL replaces to `/identity/signin`; the back button does **not** re-enter `/identity` (`replace`) |

**Keyboard:** n/a (navigation only).
**Screen reader:** on arrival the page's `<h1>` "Welcome back" is the first heading.

### F2 / F3 — Login form and client-side validation

**Preconditions:** signed out, at `/identity/signin`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Observe the card | `<h1>` "Welcome back", description "Login to your account to continue", Email + Password fields, "Login" button |
| 2 | Press **Login** with both fields empty | one error under Email ("Email is required") and one under Password ("Password is required"); **no** network request in DevTools |
| 3 | Confirm each field shows exactly **one** message | not two — the schema is wired to `onChange` only (`LoginForm/index.tsx:90`), deliberately not also `onSubmit` |
| 4 | Type `notanemail` | "Enter a valid email address" appears as you type |
| 5 | Type `a@b.co` | the error clears |
| 6 | Type an email of 321 characters | invalid (`Email.isValid` caps at 320) |
| 7 | Type `a@b.co ` (trailing space) | invalid (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) |
| 8 | Fill both fields validly | the Login button is enabled (it is **never** disabled for an invalid form — that is the documented pattern) |

**Keyboard-only path:** Tab from page load → **Email** (first focus stop) → Tab →
"Forgot your password?" **or** Password (see ♿ A11Y-identity-admin-01 — the label-row
button is in the tab order **before** the password input) → Tab → Password → Tab →
**Login** → Tab → "Sign up" → Tab → "Terms of Service" → Tab → "Privacy Policy".
Press **Enter** anywhere in the form to submit.
**Screen reader:** each field announces "Email, edit, required" via `InputField`'s
`htmlFor`+`id` wiring; on submit each error is announced because `FieldError` carries
`role="alert"` (`packages/design-system/src/lib/components/ui/field.tsx:221`).

### F4 / F5 / F6 / F7 — Sign-in submission

**Preconditions:** a valid `active` account.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Submit valid credentials | a `POST /api/auth/login` fires; the button swaps to a spinner and is disabled |
| 2 | On success | `GET /api/auth/me` refetches, then the app navigates to `/` (replace) |
| 3 | Press the browser Back button | you stay in the app — the sign-in page is not re-entered (`navigate(..., { replace: true })`) |
| 4 | Sign out, visit `/users` directly, get bounced, then sign in | you land back on **`/users`**, not `/` |
| 5 | Submit wrong credentials | a red banner "Authentication failed / The email or password you entered is incorrect…"; you stay on the page; the fields keep their values |
| 6 | Stop the API and submit | the banner shows the **generic** message, not the credential one |
| 7 | Submit, then immediately submit again | the button is disabled while pending, so no double-POST |

**Keyboard-only path:** Type credentials, press **Enter**. Focus stays on the Login button
through the pending state. On failure, focus does **not** move to the banner — see
♿ A11Y-identity-admin-02.
**Screen reader:** the pending state announces "Signing in…" (`sr-only` beside an
`aria-hidden` spinner, `LoginActions/index.tsx:50-54`). The failure banner is an `Alert`
(`role="alert"`) and is announced on insertion.

### F8 — Lazy route + Suspense fallback

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | DevTools → Network → throttle to Slow 3G; hard-reload `/identity/signin` | a skeleton card renders (`LoginSkeleton`), not a blank page |
| 2 | Confirm the chunk is separate | `LoginPage` is in its own JS chunk (`router/index.tsx:12`) |
| 3 | Throttle and open `/identity/accept-invite?token=…` | **the *login* skeleton appears**, not an invite-shaped one (`router/index.tsx:39`) — cosmetic, see EC-24 |

**Screen reader:** `LoginSkeleton` wraps a single `role="status"` region with an `sr-only`
"Loading…" and marks the sketch `aria-hidden`.

### F9 / F10 / F11 / F12 — The auth gate

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Signed out, navigate to `/` | briefly the branded `AppLoader` ("Loading…"), then a redirect to `/identity/signin` |
| 2 | Signed out, navigate to `/nonexistent-path` | redirect to `/identity/signin` (the gate wraps the whole private tree) |
| 3 | Signed in, navigate to `/` | the shell renders; the sign-in page **never flashes** |
| 4 | Signed in, then revoke the session server-side and trigger any request | the app redirects to `/identity/signin` rather than sitting on a shell that 401s |
| 5 | Signed in, switch to another tab for >1 minute, come back | a background `GET /auth/me` fires (`refetchOnWindowFocus`, `staleTime` 1 min); the UI does **not** flash the root loader |
| 6 | Same, but the session died while the tab was idle | the probe returns 401, `data` becomes `null`, the gate settles on `Unauthenticated` and redirects |

**Keyboard:** after the redirect to sign-in, focus is on `<body>` — see
♿ A11Y-identity-admin-03.
**Screen reader:** `AppLoader` carries the localized "Loading…" label
(`RequireAuth/index.tsx:47`).

### F14 — `useCurrentUser`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Signed out, load the app | one `GET /auth/me` → 401 → resolves to `null` (**not** an error), and it does **not** retry |
| 2 | Return a 500 from `/auth/me` | it throws an `ApiError`; `data` stays undefined and `isPending` settles false, so `AuthState` becomes `Unauthenticated` → redirect to sign-in. **A server outage therefore presents as "you are signed out."** |
| 3 | Signed in, reload twice within a minute | the second load serves from cache (`STALE_TIME.Standard`) |

### F15 — Logout

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Signed in, open the sidebar Account menu → Logout | `POST /api/auth/logout`; `['auth','me']` is invalidated; the gate redirects to sign-in |
| 2 | In DevTools → Application → Cookies | `ortha_session` is cleared |
| 3 | **Without reloading the page**, sign in as a *different* user | inspect the React Query cache (or the Members table before its refetch lands) → **the previous user's cached rows are still present** → 🐞 BUG-identity-admin-01 |
| 4 | Log out while offline | the mutation rejects; `onSuccess` never runs; **you stay signed in in the UI** with a dead cookie |

### F16 / F17 — Accept-invite: resolve and display

**Preconditions:** a live invite for `grace@example.com` named "Grace Hopper"; a private
window with no session.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open `/identity/accept-invite?token=<raw>` | `<h1>` "Set your password"; description "Welcome, Grace Hopper. Your account is ready…" |
| 2 | Observe the Name field | rendered, `readOnly` (not `disabled`) with the invite's name |
| 3 | Observe the Email field | `readOnly`, value `grace@example.com`, helper text "Set by whoever invited you…" |
| 4 | Try to edit either | the value does not change |
| 5 | Invite someone with **no** name and open their link | the Name field is absent; the description is the un-named variant |
| 6 | Reload the page | still works — the describe call does not consume the token |

**Keyboard-only path:** Tab → Name (read-only but **focusable**, deliberately) → Email
(read-only, focusable) → Password → Confirm password → "Create my account".
**Screen reader:** the read-only fields are announced with their values, which is the
point of choosing `readOnly` over `disabled` (commented at `AcceptInviteForm/index.tsx:188-191`).

### F18 / F19 / F20 — Accept-invite: submit

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Press "Create my account" with both fields empty | both fields flag; **no** request |
| 2 | Enter an 11-character password twice | "Use at least 12 characters — length is what keeps a password hard to guess"; no request |
| 3 | Enter 12 chars in Password, a different 12 in Confirm | "These two passwords don't match" attached to the **Confirm** field |
| 4 | Enter matching 12+ chars and submit | `POST /api/auth/invite/accept`; the button swaps to a spinner |
| 5 | On success | `GET /auth/me` refetches, then navigate to `/` (replace) — the invitee lands signed in |
| 6 | Have an admin revoke the invite while the form is open, then submit | banner "This invite was accepted or expired while you were filling the form…" |
| 7 | Force a 400 from the server (e.g. a 73-byte password bypassing the client) | banner "That password didn't meet our requirements…" |
| 8 | Force a 500 | the **generic** banner |
| 9 | Enter a 72-character non-ASCII passphrase (e.g. `'é'.repeat(72)`) | accepted client-side and server-side, then silently truncated by bcrypt → see 🐞 BUG-identity-server-03 |

**Keyboard-only path:** Tab to Password, type, Tab to Confirm, type, **Enter** submits.
**Screen reader:** validation messages announce via `FieldError`'s `role="alert"`; the
submission banner announces via `Alert`. Note both are `role="alert"` — the `admin-e2e`
gotchas warn about stacking two in one view, which happens here when a submission error
and a field error are visible simultaneously.

### F21 / F22 — Dead links and loading

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open `/identity/accept-invite` with **no** `?token` | "This invite link no longer works" + the *truncated-link* advice ("some chat apps cut long links in half"); **no** network request (`useInvite` is `enabled: token.length > 0`) |
| 2 | Open with `?token=garbage` | the same card with the *generic* advice; one `GET` that 404s, **no retry** |
| 3 | Open with an already-accepted token | identical card — the UI does not distinguish, matching the server |
| 4 | Throttle the network and open a valid link | a `role="status"` region announces "Checking your invite…" while an `aria-hidden` skeleton card renders |
| 5 | Kill the API and open a valid link | **the dead-link card appears**, telling the invitee to ask for a new invite → 🐞 BUG-identity-admin-03 |
| 6 | On the dead-link card, activate "Go to sign in" | navigates to `/identity/signin` |

### F25 / F26 / F27 — The three inert controls

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Click "Forgot your password?" | **nothing happens** — no navigation, no dialog, no message |
| 2 | Click "Sign up" | nothing happens |
| 3 | Click "Terms of Service" / "Privacy Policy" | nothing happens |
| 4 | Tab through the sign-in page | all four are focusable stops |
→ 🐞 BUG-identity-admin-02.

## 4. Edge Cases & Negative Paths

### Empty / zero

- **EC-01 — `?token=` present but empty.** `✅ E2E` — `searchParams.get('token') ?? ''`
  then `!token` (`AcceptInvitePage/index.tsx:62,81`) → the missing-token card, no request.
- **EC-02 — Invite with `name: null`.** `✅ E2E` (`accept-invite.spec.ts:55`) — the Name
  field is omitted and the un-named description is used.
- **EC-03 — `permissions: []` on `/auth/me`.** `❌ NONE` — `useHasPermission` returns
  `false` for everything; every gated affordance hides. The user still reaches the shell.
- **EC-04 — `name: null` on the current user.** `❌ NONE` — `AuthUser.name` is
  `string | null` (`authContext/index.ts:13`); `AccountMenu` falls back to the email
  (`packages/users/admin/.../AccountMenu/index.tsx:56`). Confirm nothing else renders `null`.

### Boundary

- **EC-05 — Password of exactly 12 / 11 / 72 / 73 characters.** `⚠️ PARTIAL` — the e2e
  covers "too short" (`accept-invite.spec.ts:97`); neither boundary nor the 72/73 pair is
  asserted client-side.
- **EC-06 — Email of exactly 320 / 321 characters.** `❌ NONE` — `Email.isValid` caps at 320
  (`email/index.ts:10,28`), but the **server's `@IsEmail()` has no such cap**, so the two
  disagree at the boundary. Client-side is stricter, which is the safe direction.
- **EC-07 — A 200-character token in the query string.** `❌ NONE` — real tokens are 64 hex
  chars; the URL is well within limits.

### Size & encoding

- **EC-08 — Emoji password.** `❌ NONE` — `Password.isValid` uses `value.length`
  (`password/index.ts:32-33`), i.e. **UTF-16 code units**, exactly mirroring the server's
  character-vs-byte bug. `'🔑'.repeat(36)` is 72 units / 144 bytes: accepted here,
  accepted there, truncated by bcrypt. Cross-ref 🐞 BUG-identity-server-03.
- **EC-09 — RTL or combining characters in the invitee's name.** `❌ NONE` — rendered
  read-only; check for mojibake and that the RTL name does not reverse the surrounding
  English description.
- **EC-10 — `<script>alert(1)</script>` as the invite name.** `❌ NONE` — React escapes it;
  assert it renders as literal text in the `InputField` value and the description.
- **EC-11 — `%` / `#` / `&` in the token.** `❌ NONE` — the gateway applies
  `encodeURIComponent` (`httpAuthGateway/index.ts:49`), so a hypothetical non-hex token is
  transported safely.
- **EC-12 — Very long email typed into the login field.** `❌ NONE` — `Email.isValid`
  short-circuits on length before the regex, so no catastrophic backtracking.

### Permission matrix

These are **public** routes, so the interesting axis is session state, not role.

| Surface | admin | contributor | viewer | authenticated, no grants | unauthenticated |
| --- | --- | --- | --- | --- | --- |
| `/identity/signin` | renders (see EC-13) | renders | renders | renders | renders |
| `/identity/accept-invite` | renders | renders | renders | renders | renders |
| Any private route | shell | shell | shell | shell | redirect to sign-in |
| `useHasPermission(x)` | per role | per role | per role | `false` | `false` (fail-closed) |

- **EC-13 — An already-signed-in user opens `/identity/signin`.** `❌ NONE` — the login
  form renders normally. Submitting valid credentials opens a **second** session row
  server-side and navigates to `/`. Not a security problem (they authenticated), but
  it is a stray session and an odd flow. Low.
- **EC-14 — An already-signed-in user opens a valid `/identity/accept-invite?token=…`.**
  `❌ NONE` — the accept succeeds, the server sets a **new** cookie for the *invitee*, and
  the page navigates to `/`. The original user is now silently signed in as someone else.
  Correct server behaviour (the token proves the invitee's identity), but the UI gives no
  warning. Worth a confirmation step; filed as an EC rather than a bug because it requires
  possession of a live invite token.
- **EC-15 — `useHasPermission` while `AuthStatus.Loading`.** `✅ correct` — returns `false`
  (`authContext/index.ts:65-67`), so gated affordances stay hidden until a grant is
  confirmed. Fail-closed, as documented.
- **EC-16 — `useAuth` outside an `AuthProvider`.** `✅ correct` — defaults to `Loading`
  (`authContext/index.ts:53`), so the gate stays closed rather than open.

### Tenant isolation

Not applicable — this plugin has no workspace dimension. The relevant isolation concern is
**cross-account cache bleed after logout** → 🐞 BUG-identity-admin-01.

### Concurrency

- **EC-17 — Double-submit the login form.** `✅ E2E` (`login.spec.ts:90`) — the button is
  disabled while pending.
- **EC-18 — Double-submit the accept form.** `✅ E2E` (`accept-invite.spec.ts:217`).
- **EC-19 — Two tabs sign in as different users.** `❌ NONE` — the cookie is shared, so the
  second login silently re-identifies the first tab on its next focus refetch. The first
  tab's cached data (from BUG-01) is not cleared.
- **EC-20 — The session dies while a mutation is in flight.** `❌ NONE` — the shared
  `apiClient` 401 handler sets the user to `null` and the gate redirects mid-flight. Verify
  no unhandled rejection surfaces.

### State after mutation

- **EC-21 — Back button after signing in.** `✅ E2E`-adjacent — `replace: true` means the
  sign-in entry is not in history.
- **EC-22 — Back button after accepting an invite.** `❌ NONE` — also `replace: true`; the
  invite URL (with the token) is **replaced** in history, which is the right call for a
  secret in a query string.
- **EC-23 — Refresh after a failed accept.** `❌ NONE` — the token was not consumed
  (the accept is transactional server-side), so the form re-renders and can be retried.

### Failure & partiality

- **EC-24 — `LoginSkeleton` is the fallback for the accept route too.** `❌ NONE` —
  `router/index.tsx:39` uses one `Suspense` for both. On a slow connection an invitee sees
  a *login*-shaped skeleton. Cosmetic; note it as a polish item.
- **EC-25 — `GET /auth/me` returns 500.** `❌ NONE` — the gateway rethrows
  (`httpAuthGateway/index.ts:26`), the query errors, `isPending`/`isFetching` settle false,
  `data` is undefined → `Unauthenticated` → redirect to sign-in. **An API outage renders as
  a sign-out.** The user then cannot sign in either (the login call also fails) and sees
  the generic banner, so the net UX is confusing rather than dangerous. Medium-value fix:
  distinguish `isError` from "no user" in `AuthProvider`.
- **EC-26 — `GET /auth/invite/:token` returns 500.** `❌ NONE` — indistinguishable from a
  dead link → 🐞 BUG-identity-admin-03.
- **EC-27 — `POST /auth/logout` fails.** `❌ NONE` — `onSuccess` never runs, the cache is
  not invalidated, the UI stays signed in. The server-side session may or may not have been
  revoked. No error is surfaced to the user at all
  (`AccountMenu/index.tsx:97` passes no `onError`).
- **EC-28 — The lazy chunk fails to load (deploy mid-session).** `❌ NONE` — no error
  boundary around the `Suspense`; expect a blank screen.

### Idempotency & replay

- **EC-29 — Reload the accept-invite page repeatedly.** `✅ E2E`
  (`accept-invite.spec.ts:118` server-side) — the describe call never consumes.
  `staleTime: Forever` means it is fetched once per mount.
- **EC-30 — Replay an accepted invite link.** `✅ E2E` (`accept-invite.spec.ts:183`) — the
  dead-link card.
- **EC-31 — The token in the TanStack query key.** `❌ NONE` — `inviteKey(token)` puts the
  raw secret in the in-memory cache key (`useInvite/index.ts:7-8`). Not persisted, but it
  is visible in React Query DevTools and any cache dump. Low.

### UI-specific

- **EC-32 — Loading vs error vs empty on accept-invite.** **Only two of the three exist.**
  `isPending` → skeleton; everything else (`isError || !data`) → dead link. See BUG-03.
- **EC-33 — Focus after the gate redirects.** `❌ NONE` → ♿ A11Y-identity-admin-03.
- **EC-34 — i18n message present for every branch.** `✅ verified` — every user-visible
  string in this package goes through `defineMessages` with an `identity.*` id. Spot-checked
  all 11 message blocks; no bare literals.
- **EC-35 — Two `role="alert"` regions visible at once.** `❌ NONE` — a submission `Alert`
  plus a `FieldError` can co-exist on both forms. The `admin-e2e` gotchas call this out as
  a known trap.

---

### 4A. Accessibility & Section 508 Conformance

**Standards tested against.** Revised Section 508 (36 CFR Part 1194, Appendices A–C)
incorporates WCAG 2.0 Level A + AA by reference (E205.4 for electronic content, 504.2 for
authoring tools). This repo's `accessibility` skill
(`.agents/skills/accessibility/SKILL.md`) targets **WCAG 2.1 AA**, so findings below are
tested to 2.1 AA and cite the 508 provision alongside the SC. Chapter 5 software
provisions assessed where applicable: **502.2 / 502.3** (AT interoperability — name, role,
state, value, and exposure of programmatic changes), **503.2** (respect platform/user
preferences), **503.4**, **504** (authoring tools).

**This is the highest-stakes surface in the whole audit.** A user who cannot complete the
sign-in or accept-invite form cannot reach any other screen, so a Does-Not-Support finding
here is a total-product barrier, not a feature-level one.

**Do not trust axe.** `apps/admin-e2e/src/auth/a11y.spec.ts` runs axe over seven states
(login initial `:17`, required-field errors `:23`, credential banner `:35`, accept-invite
ready `:48`, accept validation errors `:60`, accept submission banner `:74`, dead link
`:89`) plus the home page `:101` and the root loader `:107`. That is unusually good
automated coverage — but automated scanning reaches a minority of the success criteria and
proves **nothing** about focus order, focus restoration, announcement timing, keyboard
traps, or whether an accessible name is *meaningful*. Every finding below is in a category
axe cannot see, which is exactly why all seven of those scans pass today.

---

#### ♿ A11Y-identity-admin-01 — Three focusable controls on the sign-in page do nothing at all

**SC:** 2.4.3 Focus Order (A), 2.4.6 Headings and Labels (AA), 4.1.2 Name/Role/Value (A),
3.2.4 Consistent Identification (AA)
**508:** E205.4 / 502.3.1 (Object Information) / 502.3.9 (Modification of Values)
**Verdict:** **Does Not Support**
**Location:** `packages/identity/admin/src/lib/presentation/components/LoginForm/index.tsx:147-157`
("Forgot your password?"), `LoginForm/LoginActions/index.tsx:60-72` ("Sign up"),
`LoginForm/LegalFooter/index.tsx:18-40` ("Terms of Service", "Privacy Policy")

All four are real `<button type="button">` elements with **no `onClick`**, each marked
`TODO(#8)`. They are in the tab order, they receive focus, they announce as buttons, and
activating them does nothing.

**Repro:** load `/identity/signin`, press Tab repeatedly, press Enter on each stop.

**Keyboard-only experience:** four of the eight tab stops on the page are dead ends. The
"Forgot your password?" button sits in the label row **above** the password input
(`AuthField` passes it as `labelAction`), so the tab order is
Email → *Forgot* → Password — a keyboard user reaches a broken control in the middle of
the credential flow.
**Screen-reader experience:** NVDA announces "Forgot your password?, button" and "Sign up,
button". A user who has forgotten their password will activate it, hear nothing, and
reasonably conclude the page is broken — there is no `aria-disabled`, no message, no
change of any kind. Because a button that reports itself as operable must be operable,
this is a 4.1.2 failure, not merely a UX gap.

**Remediation:** until the routes exist, remove the controls (or render them as plain text
with an explanatory note); once they exist, make them `<a href>`/`<Link>` so they announce
as links. Cross-reference 🐞 BUG-identity-admin-02.

---

#### ♿ A11Y-identity-admin-02 — A failed sign-in is announced but focus is never moved, so a screen-reader user can miss it and a keyboard user must hunt for it

**SC:** 3.3.1 Error Identification (A), 4.1.3 Status Messages (AA)
**508:** E205.4 / 502.3.14 (Event Notification)
**Verdict:** **Partially Supports**
**Location:** `packages/identity/admin/src/lib/presentation/pages/LoginPage/index.tsx:56-69`,
`components/LoginForm/LoginAlert/index.tsx:23-30`

The banner is a design-system `Alert` (`role="alert"`), so it *is* announced on insertion —
that part supports. What does not: focus remains on the Login button, and the banner is
inserted **above** both fields inside the `FieldGroup` (`LoginForm/index.tsx:115`). The
error is also not programmatically associated with either input (no `aria-describedby`,
no `aria-invalid`) — server-side rejection is a form-level error, and the two fields stay
in their valid visual state.

**Repro:** submit wrong credentials with NVDA running; then, without a mouse, try to find
and re-read the message.

**Keyboard-only experience:** focus is on Login, which is *after* the banner in DOM order,
so Tab moves further away. Shift+Tab walks back through Password and Email to reach it —
and because the banner is not focusable, it can only be reached in browse mode, not by Tab
at all.
**Screen-reader experience:** the `role="alert"` fires once. If the user was mid-utterance,
or arrows away before it speaks, the message is gone with no way back short of a full
re-read of the page. Note the compounding risk the `accessibility` skill warns about
(§Non-negotiables 6, "Don't stack two `role='alert'`s in one view"): when a field error is
also present, two alert regions announce and the order is indeterminate.

**Remediation:** move focus to the alert (`tabIndex={-1}` + `.focus()`) on transition from
no-error to error, or set `aria-invalid` + `aria-describedby` on both inputs pointing at
the banner's id.

---

#### ♿ A11Y-identity-admin-03 — After the auth gate redirects, focus is dumped on `<body>` and nothing announces the change of context

**SC:** 2.4.3 Focus Order (A), 3.2.2 On Input (A) / 3.2.1 On Focus (A), 4.1.3 Status
Messages (AA), 2.4.2 Page Titled (A)
**508:** E205.4 / 502.3.14
**Verdict:** **Partially Supports**
**Location:** `packages/identity/admin/src/lib/presentation/auth/RequireAuth/index.tsx:50-52`

```tsx
if (status === AuthStatus.Unauthenticated) {
    return <Navigate to={signInPath} replace state={{ from: location }} />;
}
```

A client-side `<Navigate>` swaps the tree with no focus management and no announcement.
The same applies to the two success navigations (`LoginPage/index.tsx:51`,
`AcceptInvitePage/index.tsx:75`).

**Repro:** with a screen reader running, sit on `/users` until the session expires (or
revoke it from another device), then click anything.

**Keyboard-only experience:** focus resets to the document start; the next Tab begins from
the very top of the new page, and the user has no signal that they left the page they were
on.
**Screen-reader experience:** the redirect is silent. The user hears nothing, keeps
navigating, and discovers they are on a login form only when they reach a field labelled
"Email". The `accessibility` skill's §Focus management explicitly requires managing focus
on route change; the `AppLoader` shown during `Loading` carries a label, but the *transition
into* the sign-in page carries none.

Also assessed: **2.4.2 Page Titled** — no route in this plugin sets `document.title`
(`grep -rn "document.title\|<title" packages/identity/admin/src` → no hits), so the tab
title never changes between the app, the sign-in page, and the accept-invite page.
Verdict for 2.4.2 alone: **Does Not Support**.

**Remediation:** on route change, move focus to the new page's `<h1>` (both auth pages have
one, via `CardTitle asChild`) and set `document.title` per route; announce the destination
in a polite live region.

---

#### ♿ A11Y-identity-admin-04 — The read-only invite fields have no programmatic read-only state, and the password rule is associated by description only

**SC:** 4.1.2 Name/Role/Value (A), 3.3.2 Labels or Instructions (A)
**508:** E205.4 / 502.3.1 / 502.3.3 (Row/Column/Value)
**Verdict:** **Partially Supports**
**Location:** `packages/identity/admin/src/lib/presentation/components/AcceptInviteForm/index.tsx:181-224`

The Name and Email fields pass `readOnly` to `InputField` — a deliberate and **correct**
choice over `disabled`, with the reasoning commented at `:188-191` (a `readOnly` input
stays focusable and its value is announced, so the invitee can hear what identity they are
signing up as). The native `readonly` attribute maps to `aria-readonly`, so this largely
supports.

What is weaker: the *why* — "Set by whoever invited you. If it looks wrong, ask them for a
new invite" — is passed as `description` on the **Email** field only (`:202-204`), so a
user tabbing to the Name field hears a read-only value with no explanation. And the
password rule ("At least 12 characters. A short phrase you'll actually remember beats a
scrambled word you won't.") is passed as `description` on the password field (`:220-223`),
which `InputField` wires via `aria-describedby` — that part supports 3.3.2 properly, and is
worth preserving as the pattern other forms should copy.

**Keyboard-only experience:** Tab lands on both read-only fields, which is intended;
nothing traps.
**Screen-reader experience:** "Name, read only, Grace Hopper" — accurate but unexplained.
"Email, read only, grace@example.com, Set by whoever invited you…" — good.
"Password, edit, At least 12 characters…" — good.

**Remediation:** move the explanatory description to a group-level `<fieldset>`/`<legend>`
covering both read-only fields, or duplicate it onto the Name field.

---

#### ♿ A11Y-identity-admin-05 — The password fields have no reveal toggle, so an error cannot be self-diagnosed

**SC:** 3.3.3 Error Suggestion (AA) — advisory; 1.3.5 Identify Input Purpose (AA) — supports
**508:** E205.4
**Verdict:** **Supports** (with an advisory note)
**Location:** `LoginForm/index.tsx:134-160`, `AcceptInviteForm/index.tsx:207-243`

`autocomplete` is correct throughout and this is worth recording as a pass:
`autoComplete="email"` on the login email (`LoginForm/index.tsx:123`),
`"current-password"` on the login password (`:140`), and `"new-password"` on **both**
accept-invite password fields (`AcceptInviteForm/index.tsx:213,233`). That satisfies
**1.3.5 Identify Input Purpose (AA)** — **Supports** — and is exactly what the orchestrator's
508 checklist asks for.

There is **no** password-reveal toggle anywhere in the package
(`grep -rn "showPassword\|reveal\|type={show" packages/identity/admin/src` → no hits), so
the "is the toggle a named button with its pressed state exposed (4.1.2)?" question is
**Not Applicable**. The advisory: for a 12-character-minimum passphrase typed twice, a
reveal toggle materially reduces the mismatch-error loop for users with motor or cognitive
disabilities. If one is added, it must be a `<button>` with `aria-pressed` and a name that
changes with state.

**Remediation:** none required for conformance. If a toggle is added, implement it as
`<button type="button" aria-pressed={shown}>` with an accessible name, never as an icon
with no name.

---

#### ♿ A11Y-identity-admin-06 — Contrast and forced-colors are unverified in dark mode, and the loading skeleton animates regardless of `prefers-reduced-motion`

**SC:** 1.4.3 Contrast (Minimum) (AA), 1.4.11 Non-text Contrast (AA), 2.3.3 Animation from
Interactions (AAA — advisory), 1.4.12 Text Spacing (AA)
**508:** E205.4 / **503.2 (User Preferences)**
**Verdict:** **Partially Supports** — unverified
**Location:** `components/LoginSkeleton/index.tsx`, `AcceptInvitePage/index.tsx:96-115`,
`AuthLayout/index.tsx:19-25`

Both auth screens sit on `bg-muted` with `Card` surfaces and `text-muted-foreground`
helper text. Neither theme's contrast is measured anywhere: the axe suite runs at the
default theme only (`apps/admin-e2e/src/auth/a11y.spec.ts` sets no theme), whereas the
users suite does test dark explicitly (`apps/admin-e2e/src/users/preferences.spec.ts:124`
"the dark theme has no accessibility violations"). So the **sign-in page has never been
scanned in dark mode** — and it is the one page every user must pass through.

`Skeleton` uses Tailwind's `animate-pulse`. The activity plugin pairs its transitions with
`motion-reduce:transition-none`
(`packages/activity/admin/.../ActivityRow/index.tsx:89,114`), showing the repo knows the
idiom; the auth skeletons do not. Under 508 **503.2** an application must not override
user preferences for motion.

**Repro:** set OS "Reduce motion", throttle the network, load `/identity/signin` — the
skeleton pulses. Set Windows High Contrast and load the page — the `Card` border and the
focus ring are unverified.

**Screen-reader experience:** unaffected. **Low-vision / vestibular experience:** a pulsing
placeholder on a slow connection, and possibly sub-4.5:1 helper text in dark mode.

**Remediation:** add a dark-theme axe pass to `apps/admin-e2e/src/auth/a11y.spec.ts`
mirroring `preferences.spec.ts:124`; add `motion-reduce:animate-none` to the skeleton;
manually verify the two themes' `muted-foreground` on `muted` and `card` at 4.5:1, and the
focus ring at 3:1 (axe cannot judge either reliably against token-driven colours).

---

#### ♿ A11Y-identity-admin-07 — Reflow at 320 px / 400 % zoom is untested on both auth screens

**SC:** 1.4.10 Reflow (AA), 1.4.4 Resize Text (AA)
**508:** E205.4
**Verdict:** **Partially Supports** — unverified
**Location:** `components/AuthLayout/index.tsx:19-23` (`max-w-sm` column, `min-h-svh`,
`p-6 md:p-10`)

The layout is a single centred `max-w-sm` (24 rem) column, which is *structurally* the
right shape for reflow. But nothing tests it, and two specific risks are visible in the
markup: the accept-invite Email field renders a full email address in a fixed-width input,
and the helper text is long. At 400 % zoom on a 1280 px viewport (i.e. a 320 px effective
width) the `min-h-svh` centring plus `justify-center` can push content above the viewport
top, where it becomes unreachable by scrolling.

**Repro:** set the browser to 400 % zoom at 1280×1024 and load each auth screen; then set a
320 px-wide viewport. Check for horizontal scrolling and for content clipped above the fold.

**Remediation:** add a 320 px-viewport Playwright assertion to the auth suite checking
`document.documentElement.scrollWidth <= clientWidth` and that the `<h1>` is in view.

---

**a11y verdict tally: 7 findings · 1 Supports (A11Y-05) · 5 Partially Supports
(A11Y-02/03/04/06/07) · 1 Does Not Support (A11Y-01).**
Sub-verdicts not counted above: 2.4.2 Page Titled is separately **Does Not Support** within
A11Y-03, and the password-reveal toggle is **Not Applicable** within A11Y-05 (no such
control exists — `grep -rn "showPassword|reveal|aria-pressed" packages/identity/admin/src`
returns nothing).

**WCAG 2.2 (advisory only — 508 references 2.0):** 2.4.11 Focus Not Obscured — no sticky
chrome on the auth screens, so **Supports**. 2.5.8 Target Size (Minimum, 24×24) — the four
inert text buttons in A11Y-01 are inline text controls below 24 px in height; moot once
they are removed.

## 5. E2E Coverage Map

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F1 Redirect | `apps/admin-e2e/src/auth/routing.spec.ts:12` | `/identity` → sign-in | ✅ E2E |
| F2 Login form | `apps/admin-e2e/src/auth/login.spec.ts:25` | renders and navigates home on success | ✅ E2E |
| F3 Validation | `login.spec.ts:53,71,78` | empty submit flags both fields **without calling the API**, exactly one error per field, malformed email rejected | ✅ E2E |
| F4 Submission | `login.spec.ts:25` | POST fires, navigation follows | ✅ E2E |
| F5 Return-to | `apps/admin-e2e/src/auth/private-routes.spec.ts:44` | a gated user lands back on the home page after signing in | ⚠️ PARTIAL — only the `/` case; the "bounced from `/users`, return to `/users`" path is untested |
| F6 Error mapping | `login.spec.ts:40` | 401 shows the banner and stays on the page | ⚠️ PARTIAL — the **generic** (non-401) branch is unasserted |
| F7 Pending state | `login.spec.ts:90` | the submit button is disabled while in flight | ✅ E2E |
| F8 Lazy + skeleton | — | — | ⚠️ PARTIAL — `a11y.spec.ts:107` scans the root loader, but no test asserts the Suspense fallback renders or that the chunk is split |
| F9 AuthProvider | `private-routes.spec.ts:22,33` | signed-out users are redirected from `/` and from an unknown path | ✅ E2E |
| F10 Session lost | `private-routes.spec.ts:74` | a 401 mid-visit redirects to sign-in | ✅ E2E |
| F11 Three-state auth | `a11y.spec.ts:107` (root loader) + `private-routes.spec.ts` | the loading state renders; both settled states redirect or render | ✅ E2E |
| F12 RequireAuth | `private-routes.spec.ts:22,33,44` | gate + `from` preservation | ✅ E2E |
| F13 useHasPermission | `apps/admin-e2e/src/users/members.spec.ts:222,242`, `workspaces/permissions.spec.ts` | gated affordances hide without the permission | ✅ E2E (in consuming plugins) |
| F14 useCurrentUser | — | — | ⚠️ PARTIAL — the 401→null path is implied by every signed-out test; **the 500 path (EC-25) is untested**, and so is the focus refetch |
| F15 Logout | `apps/admin-e2e/src/users/account-menu.spec.ts:57` | "Logout calls the logout endpoint" | ⚠️ PARTIAL — asserts the call only. Nothing checks the redirect, the cache state, or the failure path |
| F16 Invite resolve | `apps/admin-e2e/src/auth/accept-invite.spec.ts:26,55` | shows who the invite is for and asks only for a password; omits Name when there is none | ✅ E2E |
| F17 Read-only fields | `accept-invite.spec.ts:26` | the email/name are displayed, not collected | ✅ E2E |
| F18 Validation | `accept-invite.spec.ts:97,113,127` | too-short password sends no request; mismatch sends no request; both empty fields flag | ✅ E2E |
| F19 Submission | `accept-invite.spec.ts:69` | posts the token with the password and lands in the app | ✅ E2E |
| F20 Error mapping | `accept-invite.spec.ts:146,166` | link died while the form was open; password rejected by the server | ✅ E2E — the generic branch is unasserted |
| F21 Dead vs truncated link | `accept-invite.spec.ts:183,196` | dead-link state for a rejected token; a truncated link is told apart | ✅ E2E |
| F22 Loading announcement | `accept-invite.spec.ts:207` | announces the lookup while it is in flight | ✅ E2E |
| F23 `Email` VO | — | — | ❌ NONE — no `*.spec.ts` in the package (`find packages/identity/admin/src -name '*.spec.*'` → empty) |
| F24 `Password` VO | — | — | ❌ NONE |
| F25/F26/F27 Inert controls | — | — | ❌ NONE — and note `a11y.spec.ts:17` scans this exact page **and passes**, because axe cannot tell a button with no handler from a working one |
| **a11y — login** | `apps/admin-e2e/src/auth/a11y.spec.ts:17,23,35` | axe on the initial page, with field errors visible, and with the credential banner visible | ⚠️ PARTIAL — three axe states, **light theme only**; nothing on focus order, focus after error, or the dead controls |
| **a11y — accept-invite** | `a11y.spec.ts:48,60,74,89` | axe on the ready form, with validation errors, with a submission banner, and on the dead link | ⚠️ PARTIAL — same caveat |
| **a11y — root loader** | `a11y.spec.ts:107` | axe while the auth probe is pending | ✅ E2E for that state |
| **keyboard — login** | `apps/admin-e2e/src/auth/keyboard.spec.ts:13,26` | the email field is the first focus stop; login can be completed and submitted by keyboard alone | ⚠️ PARTIAL — does **not** assert what the intermediate stops are, so the dead "Forgot your password?" stop between Email and Password goes unnoticed |
| **keyboard — accept-invite** | `keyboard.spec.ts:45,67` | an invite can be accepted by keyboard alone; every field is reachable in source order | ✅ E2E |

**Coverage tally: 27 features · 15 ✅ · 7 ⚠️ · 5 ❌**
**a11y coverage: 8 axe states + 4 keyboard tests, all light-theme, none covering focus
restoration, route-change announcement, dark-theme contrast, reflow, or reduced motion.**

## 6. 🐞 Potential Bugs

### 🐞 BUG-identity-admin-01 — Logging out leaves every other user's cached data in the React Query cache · Severity: Medium · 🔒

> **Verified 2026-08-11 — mechanism confirmed, exploit path corrected, severity downgraded
> High → Medium.** The cache genuinely is not cleared (code below re-read and unchanged).
> But the privilege-crossing repro that set the original severity **does not work**: both
> admin-only read surfaces gate on `useHasPermission` *before* rendering their table —
> `packages/activity/admin/src/lib/presentation/pages/ActivityLogPage/index.tsx:156`
> (`if (!canRead) return <ActivityNoAccess />`, with the query passed `enabled: canRead` at
> `:136`) and
> `packages/api-tokens/admin/src/lib/presentation/pages/ApiTokensPage/index.tsx:106`
> (same shape, `enabled: canRead` at `:79`). `useHasPermission` also fails closed while the
> post-login `auth/me` probe is in flight, and `['auth','me']` *is* invalidated on logout,
> so there is no window where the new user holds the old user's permission set. The
> original "a viewer sees the admin's audit rows" claim has been struck below.

**Location:** `packages/identity/admin/src/lib/application/useLogoutMutation/index.ts:13-21`
**Category:** tenant-leak (cross-account)

**What the code does:**

```ts
return useMutation<void, ApiError, void>({
    mutationFn: () => httpAuthGateway.logout(),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: currentUserKey });
    }
});
```

Only `['auth','me']` is invalidated. Every other cached query — `['members','list',…]`,
`['members','detail',<id>]`, `['members','detail',<id>,'sessions']`,
`['apiTokens',…]`, `['activity',…]`, workspaces, content — remains in the `QueryClient`,
which lives for the lifetime of the tab (`createAdmin` mounts it once). `invalidateQueries`
also does not evict: it marks stale and refetches active observers.

**Why it is wrong:** the SPA never reloads on sign-out — the gate simply re-renders the
public route. When a second person signs in on the same browser without reloading, every
list they open is served **from the previous user's cache** while its refetch is in flight,
and `useMembers` is configured with `placeholderData: keepPreviousData`
(`packages/users/admin/src/lib/application/useMembers/index.ts:25`), which deliberately keeps the old rows
on screen. On a slow connection that window is seconds.

The severity is set by *whose* data it is. `['members','detail',<id>,'sessions']` caches
IP addresses and user agents; `['members','list',…]` caches the roster.

**What does NOT happen (checked, and the reason this is Medium not High).** A *lower*-privileged
user cannot be shown a higher-privileged user's cached data. The only two read surfaces
whose permission differs between `admin` and `viewer` are `activity:read` and `tokens:read`,
and both pages render a no-access state ahead of the table and pass `enabled: canRead` into
the query (`ActivityLogPage/index.tsx:136,156`; `ApiTokensPage/index.tsx:79,106`). Every
other cached read (`workspaces:read`, `users:read`, `content:read`, `media:read`) is held by
all three roles, so serving it from cache crosses no permission boundary.

**What does happen.** Two people of the **same role** sharing a browser. Admin A signs out,
admin B signs in without reloading; every list B opens is served from A's cache while the
refetch is in flight, and `useMembers` is configured with `placeholderData: keepPreviousData`
(`packages/users/admin/src/lib/application/useMembers/index.ts:25`), which deliberately holds the old rows on
screen. On a slow connection that window is seconds — and `['members','detail',<id>,'sessions']`
is IP addresses and user-agent strings.

**Repro:**
1. Sign in as admin A. Open `/users` and `/users/<id>/sessions` so both are cached.
2. Sign out via the Account menu. Do **not** reload.
3. Sign in as a different admin, B. Throttle the network to Slow 3G.
4. Navigate to `/users/<id>/sessions`.
→ Observed: A's cached session rows — including IP addresses — render immediately and stay
until B's refetch lands. / Expected: no data fetched under a previous session is ever
rendered.

**Unverified —** whether the same holds *across workspace membership* (user A is a member of
workspace W, user B is not; W's cached entries/media are still in the `QueryClient` and W may
still appear in the cached workspace switcher). Confirming it needs the workspace shell's
membership gate read end-to-end, which was not done for this artifact. If it holds, it is a
true tenant leak and this finding returns to High.

**Blast radius:** any shared or kiosk workstation, and any support/QA workflow where people
switch accounts. Cross-*account* disclosure within one privilege level, entirely client-side
and invisible in the server logs. Not a privilege escalation.

**Suggested fix:** call `queryClient.clear()` (or `removeQueries()` scoped to everything but
`currentUserKey`) in the logout `onSuccess`, and again in `AuthProvider`'s 401 handler.
Note the existing comment at `AuthProvider/index.tsx:33-39` explains why `removeQueries` is
avoided **there** (mounted observers refetch and 401 straight back) — that reasoning does
not apply on an explicit logout, where the private tree is about to unmount. Do NOT implement.

---

### 🐞 BUG-identity-admin-02 — The sign-in page advertises password reset, sign-up, Terms and Privacy; all four are dead controls, and sign-up cannot exist in an invite-only product · Severity: Medium

**Location:** `packages/identity/admin/src/lib/presentation/components/LoginForm/index.tsx:147-157`,
`LoginForm/LoginActions/index.tsx:60-72`, `LoginForm/LegalFooter/index.tsx:18-40`
**Category:** ux-state / correctness

**What the code does:**

```tsx
// TODO(#8): wire to the real forgot-password route
<button type="button" className="ml-auto text-sm underline-offset-4 hover:underline">
    {intl.formatMessage(messages.forgotPassword)}
</button>
```

and, in `LoginActions`:

```tsx
noAccount: { defaultMessage: "Don't have an account? <signup>Sign up</signup>" }
…
signup: (chunks) => <button type="button" …>{chunks}</button>   // TODO(#8)
```

Four `<button>` elements, no handlers, styled to look like links.

**Why it is wrong on two separate counts.**

*Dead controls.* All four are focusable, announce as buttons, and do nothing. Covered as a
conformance failure in ♿ A11Y-identity-admin-01; recorded here because it is also a plain
functional defect — a user who has forgotten their password has **no recovery path at all**
(`packages/identity/server` has a `reset` token type in the schema but not one line of code
that issues or redeems one), and the UI implies otherwise.

*"Sign up" contradicts the product.* `packages/identity/server/AGENTS.md` opens with
"**Invite-only by design — there is no public registration; the only route into an account
is an admin's invite**". There is no registration endpoint, and there never will be under
that design. The sign-in page nonetheless asks "Don't have an account? Sign up". This is
not a TODO waiting on a route — the route is a contradiction of the stated architecture.
It reads as leftover shadcn boilerplate that survived review.

**Repro:**
1. Load `/identity/signin`. Click each of the four controls. Nothing happens.
2. `grep -rn "forgot\|signup\|sign-up\|register" packages/identity/admin/src/lib/presentation/router/index.tsx`
   → no such route. Same for `packages/identity/server` (`grep -rn "reset" src/lib` finds
   only the `tokenType` enum member and `resetTtlSeconds` config, no code path).

**Blast radius:** users who forget their password are stuck and must contact an admin, with
the UI actively misleading them into clicking a control that does nothing. The "Sign up"
prompt invites support requests for a feature that does not and will not exist.

**Suggested fix:** remove "Sign up" outright (it contradicts ADR-level product intent);
render Terms/Privacy as real `<a href>` once the pages exist, or drop the footer; keep
"Forgot your password?" only when the reset flow lands. Do NOT implement.

---

### 🐞 BUG-identity-admin-03 — A server outage on the invite lookup renders as "this invite link no longer works" · Severity: Medium

**Location:** `packages/identity/admin/src/lib/presentation/pages/AcceptInvitePage/index.tsx:120-128`
**Category:** ux-state

**What the code does:**

```tsx
// Any failure to resolve the token is a dead link — the server does not
// distinguish unknown from expired from already-used, and neither do we.
if (invite.isError || !invite.data) {
    return (<AuthLayout><InviteUnavailable /></AuthLayout>);
}
```

`useInvite` is configured `retry: false` (`application/useInvite/index.ts:25`), so a
single transient failure lands here immediately.

**Why it is wrong:** the comment's premise is true for **404** — the server deliberately
collapses unknown/expired/consumed/revoked into one bare 404
(`packages/identity/server/src/lib/auth/controllers/invite.controller.ts:88-95`). It is **not** true for 500,
502, a network drop, or a CORS/proxy failure, all of which say nothing whatsoever about the
token. `.cursor/BUGBOT.md` names this exactly: *"**Error masquerading as empty.**
Distinguish a failed query from a genuinely empty result. Rendering the empty state on
error hides outages."* The same file gets the equivalent decision right elsewhere —
`packages/users/admin/.../UserPreferencesPage/index.tsx:178-185` renders a distinct
warning for `preferences.isError` precisely so a failed read is not presented as a stored
choice.

The consequence is worse than a bad message. `InviteUnavailable` tells the invitee
"Ask whoever invited you to send a fresh one" (`InviteUnavailable/index.tsx:25-26`). If they
follow that advice, the admin hits **Resend**, which **rotates the token and kills the link
the invitee is holding** (`packages/users/server/src/lib/member/infrastructure/persistence/invite-token.service.ts:60-70`). A
five-second API blip therefore converts a perfectly good invite into a genuinely dead one,
and the admin must now deliver a new link by hand.

**Repro:**
1. Obtain a valid invite link.
2. Stop the API (or make `GET /api/auth/invite/:token` return 500 once).
3. Open the link.
→ Observed: "This invite link no longer works … Ask whoever invited you to send a fresh
one." / Expected: "Something went wrong — try again in a moment", with a retry control and
the link left intact.

**Blast radius:** every invitee who opens their link during a deploy, a restart, or a
network hiccup. Because the invite flow is the **only** way into the product, and because
the recommended remedy actively destroys the token, this converts a transient error into
permanent work for an admin.

**Suggested fix:** branch on `invite.error?.status === HTTP_STATUS.NOT_FOUND` for the
dead-link card and render a distinct retryable error state otherwise — the page already
imports `HTTP_STATUS` and uses exactly this branch for the *submission* error at
`AcceptInvitePage/index.tsx:132`. Do NOT implement.

---

### 🐞 BUG-identity-admin-04 — A logout that fails silently leaves the UI signed in · Severity: Low

**Location:** `packages/identity/admin/src/lib/application/useLogoutMutation/index.ts:16-19`,
consumed at `packages/users/admin/src/lib/presentation/components/AccountMenu/index.tsx:95-101`
**Category:** ux-state

**What the code does:** the invalidation is in `onSuccess`, and the only consumer calls
`logout.mutate()` with no `onError` and renders no error state — the menu item is merely
`disabled={logout.isPending}`.

**Why it is wrong:** if the request fails (offline, 502 from a proxy, `OriginGuard` 403
after a config change), the user clicks Logout, the menu closes, and **nothing happens**.
They remain in the app, apparently signed in. There is no toast, no banner, no retry. Worse,
the server may have revoked the session before the response was lost, in which case the UI
is signed in against a dead cookie and every subsequent request 401s — at which point the
`AuthProvider` 401 handler eventually rescues it, but only after a failed request.

**Repro:**
1. Sign in. Open DevTools → Network → Offline.
2. Account menu → Logout.
→ Observed: the menu closes; you are still in the app; no message. / Expected: an error
toast and a retry, or an optimistic local sign-out.

**Blast radius:** low frequency, but the failure mode of "I clicked Logout and I am still
logged in, on a shared machine" is exactly the one users must be able to trust. The
`AccountMenu` is in `users/admin`, so a full fix touches both packages.

**Suggested fix:** either surface `logout.isError` with a toast at the call site, or treat
logout as best-effort — clear the client auth state in `onSettled` rather than `onSuccess`,
since the cookie is `HttpOnly` and the server session will expire regardless. Do NOT implement.

---

### 🐞 BUG-identity-admin-05 — An API outage on `GET /auth/me` is indistinguishable from being signed out · Severity: Low

**Location:** `packages/identity/admin/src/lib/presentation/auth/AuthProvider/index.tsx:50-62`,
`packages/identity/admin/src/lib/infrastructure/httpAuthGateway/index.ts:17-28`
**Category:** ux-state

**What the code does:** the gateway maps **only** 401 to `null` and rethrows everything else
(`:23-26`). `AuthProvider` then computes:

```ts
const value: AuthState = data ? { …Authenticated… }
    : isPending || isFetching ? { …Loading… }
    : { …Unauthenticated… };
```

`isError` is never consulted. A 500 leaves `data` undefined and both flags false, so the
state settles on `Unauthenticated` and `RequireAuth` redirects to sign-in.

**Why it is wrong:** the same "error masquerading as empty" pattern as BUG-03, one layer up.
An API outage presents to the user as "you have been signed out", they land on the login
form, their credentials also fail (same outage), and they are shown "Something went wrong.
Please try again." — with no indication that they were never signed out in the first place.

**Repro:** sign in; make `GET /api/auth/me` return 500; reload.
→ Observed: redirect to `/identity/signin`. / Expected: an "we can't reach the server"
state that preserves the session.

**Blast radius:** low — the end state (a login form) is safe, and the user's session cookie
is untouched, so recovery is a reload once the API returns. Filed because it makes every
API incident look like a mass sign-out event, which is the sort of thing that generates
support load and false security reports.

**Suggested fix:** add a fourth `AuthStatus.Unavailable` (or read `isError` and hold on
`Loading` with a message) so an outage is not reported as a sign-out. Do NOT implement.

---

**Checked and cleared** (examined, no defect found):

- **Open redirect on sign-in return.** `from` is read from **router state**
  (`location.state.from.pathname`, `LoginPage/index.tsx:43`), which is set only by
  `RequireAuth` (`RequireAuth/index.tsx:51`) — never from the query string or a header. An
  attacker cannot craft `?next=https://evil.com`.
- **The invite token in the URL.** A deliberate, documented trade-off
  (`AcceptInvitePage/index.tsx:54-55`, `router/index.tsx:34-35`): the query string keeps the
  secret out of the route *pattern*, and the page emits no outbound links or redirect
  targets that could leak it via `Referer`. `navigate('/', { replace: true })` on success
  removes it from history. Correct as designed.
- **`useHasPermission` fail-closed.** Returns `false` while `Loading` and while
  `Unauthenticated` (`authContext/index.ts:65-67`); `useAuth` defaults to `Loading` with no
  provider (`:53`). Both fail closed.
- **`RequireAuth` never flashes the sign-in page.** It holds on `AppLoader` during
  `Loading` rather than redirecting, and `AuthProvider` keeps reporting `Loading` while a
  post-login/logout refetch is in flight — the comment at `AuthProvider/index.tsx:45-49`
  documents the exact gap this closes.
- **The 401 handler does not thrash.** `setQueryData(currentUserKey, null)` rather than
  `invalidate`/`removeQueries`, with the reasoning spelled out at `:33-39`. Avoiding an
  eviction→refetch→401 loop is genuinely subtle and correct.
- **Handler cleanup.** `setUnauthorizedHandler(null)` on unmount (`:42`), so a remounted
  provider does not leave a stale closure installed.
- **Double-submit.** Both forms disable their submit while pending; both e2e-asserted.
- **Client validation never gates the button.** Per the `accessibility` skill's
  non-negotiable #4, the submit stays enabled and surfaces errors instead of silently doing
  nothing — and the e2e asserts no request is made (`login.spec.ts:53`).
- **Exactly one error per field.** The schema is wired to `onChange` only, with the reason
  commented at `LoginForm/index.tsx:85-89`; e2e-asserted (`login.spec.ts:71`).
- **Gateway error normalisation.** All five methods wrap in `toApiError`, so callers branch
  on `error.status` and never see axios internals.
- **`useInvite` is disabled with no token** (`enabled: token.length > 0`), so the
  missing-token card costs no request.
- **No `apiClient` leakage.** `grep -rn "apiClient" packages/identity/admin/src` → only
  `httpAuthGateway`. The port/adapter boundary holds.
- **i18n completeness.** Every user-visible string is a `defineMessages` descriptor with a
  namespaced `identity.*` id; no bare literals in any branch, including the three error
  branches on each page.

**Defect tally:** `5 🐞 · 0 Critical · 0 High · 3 Medium · 2 Low · 1 🔒`
**Accessibility tally:** `7 ♿ · 1 Supports · 5 Partially Supports · 1 Does Not Support ·
0 Not Applicable`

## 7. Recommended E2E Tests

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | `apps/admin-e2e` (POM + `page.route`) | `auth/logout-cache.spec.ts` | after signing out and signing in as a **different admin** without a reload, no view is served from the previous user's cache: seed `/api/users/:id/sessions` for admin A, log out, log in as admin B with the sessions request delayed, assert A's IP addresses never render. (Do **not** use the viewer→activity path: `ActivityLogPage/index.tsx:156` gates on `useHasPermission` first, so that variant passes for the wrong reason.) | 🐞 BUG-01 |
| 2 | `apps/admin-e2e` | extend `auth/accept-invite.spec.ts` | a **500** from `GET /api/auth/invite/:token` renders a retryable error state, not the dead-link card; a **404** still renders the dead-link card | 🐞 BUG-03, EC-26 |
| 3 | `apps/admin-e2e` | `auth/a11y-focus.spec.ts` (following `apps/admin-e2e/src/support/a11y.ts`) | after a failed login, focus moves to the alert (or the alert is `aria-describedby`-linked to the fields); after the gate redirects, focus is on the sign-in `<h1>` and `document.title` changed | ♿ A11Y-02, ♿ A11Y-03 |
| 4 | `apps/admin-e2e` | extend `auth/keyboard.spec.ts` | enumerate **every** tab stop on the sign-in page and assert each is operable — this is what would have caught the four dead controls that `a11y.spec.ts:17` passes over | ♿ A11Y-01, 🐞 BUG-02, F25/F26/F27 ❌ |
| 5 | `apps/admin-e2e` | extend `auth/a11y.spec.ts` | run the existing seven axe states again with `data-theme="dark"`, mirroring `users/preferences.spec.ts:124`; the sign-in page is the one screen every user must pass and it has never been scanned in dark | ♿ A11Y-06 |
| 6 | `apps/admin-e2e` | `auth/reflow.spec.ts` | at a 320 px viewport and at 400 % zoom, both auth screens have no horizontal scroll and the `<h1>` is within the viewport | ♿ A11Y-07 |
| 7 | `apps/admin-e2e` | extend `auth/private-routes.spec.ts` | a signed-out user bounced from **`/users`** returns to `/users` (not `/`) after signing in | F5 ⚠️ |
| 8 | `apps/admin-e2e` | `auth/outage.spec.ts` | a 500 from `GET /api/auth/me` does **not** present as a sign-out; a failed `POST /api/auth/logout` surfaces an error rather than silently leaving the user signed in | 🐞 BUG-04, 🐞 BUG-05, EC-25/27 |
| 9 | unit (`packages/identity/admin`) | `domain/value-objects/email/index.spec.ts`, `password/index.spec.ts` | `Email.isValid` at 320/321 chars and against the whitespace/no-dot cases; `Password.isValid` at 11/12/72/73 **characters** — and a failing case pinning the byte-vs-character gap so it is visible on this side too | F23/F24 ❌, EC-05/06/08 |
| 10 | `apps/admin-e2e` | extend `auth/login.spec.ts` | a **non-401** failure shows the generic banner, not the credential one; a 429 does the same | F6 ⚠️ |
| 11 | `apps/admin-e2e` | extend `users/account-menu.spec.ts` | Logout redirects to `/identity/signin` and the private tree unmounts, not just that the endpoint is called | F15 ⚠️ |
| 12 | `apps/admin-e2e` | `auth/reduced-motion.spec.ts` | with `prefers-reduced-motion: reduce` emulated, the auth skeletons do not animate | ♿ A11Y-06 (503.2) |
