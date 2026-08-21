# @orthacms/utils-admin — Test Artifact

> **Unit:** `packages/utils/admin` · **Package:** `@orthacms/utils-admin` · **Kind:** library (shared admin plumbing)
> **Source of truth:** `packages/utils/admin/AGENTS.md`
> **Findings verified:** 2026-08-11 — 10 confirmed · 0 deleted · 1 corrected · 1 unverified
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns.** The cross-plugin data/HTTP layer and a handful of generic, framework-level
helpers. Not a plugin (contributes no route, slot or module) and not the host
(`AGENTS.md`: "a small leaf package that both the host and feature plugins import"):

- **Transport** — the shared axios instance, the `X-Workspace-Id` request interceptor, the
  global `401` response interceptor and its handler seam (`src/lib/apiClient/index.ts`), and
  the normalized `ApiError` (`src/lib/apiError/index.ts`).
- **Server state** — the single `QueryClient` (`src/lib/queryClient/index.ts`) and the
  `STALE_TIME` presets (`src/lib/staleTime/index.ts`).
- **Extension primitive** — `createSlot` (`src/lib/slot/index.ts`) and `byOrder`
  (`src/lib/byOrder/index.ts`).
- **The app-wide unsaved-changes guard mechanism** — `UnsavedChangesProvider` and its two
  hooks (`src/lib/unsavedChanges/index.tsx`). This is the one part of the package that
  renders and that touches the DOM.
- **URL-as-source-of-truth list state** — `useTableUrlState`
  (`src/lib/useTableUrlState/index.ts`) and `useDebouncedValue`.
- **Small pure helpers** — `HTTP_STATUS`, `slugify`, `initialsOf` / `initialsFromEmail`,
  `asAvatarColor` / `avatarColorForId`.

**Does NOT own.** Auth state — "context, gate, and `/auth/me` all live in
`@orthacms/identity-admin`" (`AGENTS.md`). No copy: the unsaved-changes dialog is injected
by the host so this package stays `react-intl`-free
(`packages/bootstrap/admin/src/lib/UnsavedChangesGuard/index.tsx:34-53`). No concrete slot.
No page, no route, no design-system component (it imports only `AVATAR_COLORS`).

**Entry points (`src/index.ts:1-28`)**

| Export | Kind | Where |
| --- | --- | --- |
| `apiClient` | axios instance (`baseURL: '/api'`, `withCredentials`) | `src/lib/apiClient/index.ts:14` |
| `setActiveWorkspaceId(id \| null)` | module-level cell setter | `src/lib/apiClient/index.ts:33` |
| `setUnauthorizedHandler(fn \| null)` | session-lost seam | `src/lib/apiClient/index.ts:76` |
| `queryClient` | `QueryClient` singleton | `src/lib/queryClient/index.ts:9` |
| `STALE_TIME` | `{ None, Short, Standard, Forever }` | `src/lib/staleTime/index.ts:7` |
| `HTTP_STATUS` | named status codes | `src/lib/httpStatus/index.ts:6` |
| `ApiError` / `toApiError(error)` | normalized transport error | `src/lib/apiError/index.ts:10,39` |
| `createSlot<T>(name)` / `Slot` / `SlotContribution` | extension primitive | `src/lib/slot/index.ts:31,6,16` |
| `byOrder(items)` | non-mutating sort | `src/lib/byOrder/index.ts:6` |
| `slugify(input)` | pure | `src/lib/slugify/index.ts:7` |
| `useDebouncedValue(value, ms)` | hook | `src/lib/useDebouncedValue/index.ts:8` |
| `useTableUrlState(opts)` | hook (needs a router) | `src/lib/useTableUrlState/index.ts:65` |
| `asAvatarColor` / `avatarColorForId` | pure | `src/lib/avatarColor/index.ts:8,20` |
| `initialsOf` / `initialsFromEmail` | pure | `src/lib/initials/index.ts:16,26` |
| `UnsavedChangesProvider` / `useUnsavedChanges` / `useUnsavedChangesApi` + types | guard | `src/lib/unsavedChanges/index.tsx:70,211,202` |

**Runtime prerequisites**

- Everything transport-related needs the API on the same origin under `/api` — in dev via
  the Vite proxy (`apps/admin/vite.config.mts:20-26`).
- `useTableUrlState` requires a `react-router-dom` router in scope (`useSearchParams`);
  `react-router-dom` is a **peer** dependency (`package.json`).
- `UnsavedChangesProvider` must be mounted inside `BrowserRouter` for its confirmed
  navigations to reach the router — the host does that
  (`packages/bootstrap/admin/src/lib/createAdmin/index.tsx:73-99`).
- `setUnauthorizedHandler` must be installed by `identity-admin` for a `401` to sign the
  user out; with no handler the interceptor rethrows and nothing else happens.

**How to exercise it manually**

```bash
docker compose up -d && npx nx run server:db:migrate && npm run dev
# transport + 401 seam
open http://localhost:4200/                      # sign in, then revoke your session from another browser
# workspace header
open http://localhost:4200/workspaces            # enter a workspace, watch X-Workspace-Id appear on /api requests
# table URL state
open 'http://localhost:4200/users?search=ada&page=2&pageSize=10'
# unsaved-changes guard
#   open a content entry, edit a field, then click a sidebar link
npx nx lint @orthacms/utils-admin
npx nx typecheck @orthacms/utils-admin
```

**Dependencies.** `axios` ^1.6, `@tanstack/react-query` ^5, `react` ^19,
`@orthacms/design-system` (only for `AVATAR_COLORS`), and `react-router-dom` ^6 as a peer.

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | `apiClient` — axios instance with `baseURL: '/api'` and `withCredentials: true` | `src/lib/apiClient/index.ts:14-17` | ✅ E2E |
| F2 | Request interceptor attaches `X-Workspace-Id` when a workspace is active, omits it otherwise | `src/lib/apiClient/index.ts:42-47` | ⚠️ PARTIAL |
| F3 | `setActiveWorkspaceId(id \| null)` sets/clears the module-level cell | `src/lib/apiClient/index.ts:33-35` | ⚠️ PARTIAL |
| F4 | Response interceptor fires the unauthorized handler on an unexpected `401`, then **rethrows** | `src/lib/apiClient/index.ts:85-98` | ✅ E2E |
| F5 | Four self-handled `401` paths are exempt (`/auth/login`, `/auth/logout`, `/auth/me`, `/auth/invite`) | `src/lib/apiClient/index.ts:55-60,92` | ✅ E2E |
| F6 | `setUnauthorizedHandler(fn \| null)` installs/clears the seam | `src/lib/apiClient/index.ts:76-78` | ✅ E2E |
| F7 | `ApiError` carries `status: number \| null` and opaque `details` | `src/lib/apiError/index.ts:10-32` | ✅ E2E |
| F8 | `toApiError` normalizes an axios error, passes an `ApiError` through, and wraps anything else | `src/lib/apiError/index.ts:39-54` | ✅ E2E |
| F9 | `queryClient` — one `QueryClient` for the app | `src/lib/queryClient/index.ts:9` | ✅ E2E |
| F10 | `STALE_TIME` presets (`None`/`Short`/`Standard`/`Forever`) | `src/lib/staleTime/index.ts:7-16` | ⚠️ PARTIAL |
| F11 | `HTTP_STATUS` named codes | `src/lib/httpStatus/index.ts:6-13` | ✅ E2E |
| F12 | `createSlot<T>(name)` — `getItems()` + `_register(items)` | `src/lib/slot/index.ts:31-38` | ✅ E2E |
| F13 | `byOrder` sorts ascending into a **new** array | `src/lib/byOrder/index.ts:6-8` | ⚠️ PARTIAL |
| F14 | `slugify` — NFKD, strip accents, lower-case, collapse non-alphanumerics, trim hyphens | `src/lib/slugify/index.ts:7-14` | ✅ E2E |
| F15 | `useDebouncedValue(value, delayMs)` | `src/lib/useDebouncedValue/index.ts:8-17` | ✅ E2E |
| F16 | `useTableUrlState` reads `search`/`filter`/`page`/`pageSize` from the URL | `src/lib/useTableUrlState/index.ts:71-74` | ✅ E2E |
| F17 | `readInt` accepts only integers ≥ 1, else the fallback | `src/lib/useTableUrlState/index.ts:9-12` | ⚠️ PARTIAL |
| F18 | `searchInput` debounced 300 ms into the URL | `src/lib/useTableUrlState/index.ts:6,76-77,99-103` | ✅ E2E |
| F19 | `searchPending` is true while the box leads the URL | `src/lib/useTableUrlState/index.ts:107` | ⚠️ PARTIAL |
| F20 | `updateParams(patch, resetPage=true)` merges, drops empty values, resets `page`, uses `replace` | `src/lib/useTableUrlState/index.ts:79-95` | ✅ E2E |
| F21 | `initialsOf` / `initialsFromEmail` | `src/lib/initials/index.ts:16-29` | ⚠️ PARTIAL |
| F22 | `asAvatarColor` narrows to the palette, falling back to `slate` | `src/lib/avatarColor/index.ts:8-12` | ⚠️ PARTIAL |
| F23 | `avatarColorForId` derives a deterministic palette entry from an id | `src/lib/avatarColor/index.ts:20-26` | ⚠️ PARTIAL |
| F24 | `UnsavedChangesProvider` tracks a **set** of dirty keys ("any form is dirty") | `src/lib/unsavedChanges/index.tsx:79-100` | ⚠️ PARTIAL |
| F25 | Document-level **capture-phase** click interception of in-app links | `src/lib/unsavedChanges/index.tsx:112-157` | ⚠️ PARTIAL |
| F26 | Modified clicks, downloads, `target` links, `#` hrefs, external origins and same-URL clicks are all left alone | `src/lib/unsavedChanges/index.tsx:118-141` | ⚠️ PARTIAL |
| F27 | `confirmNavigation(proceed)` for programmatic navigation | `src/lib/unsavedChanges/index.tsx:102-109` | ❌ NONE |
| F28 | `beforeunload` for reload/close/external | `src/lib/unsavedChanges/index.tsx:161-169` | ❌ NONE |
| F29 | Confirming re-dispatches the navigation via `pushState` + a synthetic `popstate` | `src/lib/unsavedChanges/index.tsx:146-152,184-191` | ❌ NONE |
| F30 | `useUnsavedChanges(dirty, key)` registers and clears on unmount | `src/lib/unsavedChanges/index.tsx:211-219` | ⚠️ PARTIAL |
| F31 | `useUnsavedChangesApi()` returns `null` outside a provider (degrades, does not throw) | `src/lib/unsavedChanges/index.tsx:202-204` | ❌ NONE |

## 3. Manual Test Plan

Each block carries a keyboard-only path and a screen-reader expectation where the feature is
user-observable; the pure helpers carry a console recipe instead.

### F1 / F2 / F3 — Transport and the workspace header

**Preconditions:** signed in, DevTools Network tab open.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Load `/users` | Requests go to `http://localhost:4200/api/users`; `credentials` are included; the session cookie rides along |
| 2 | Inspect the request headers | **No** `X-Workspace-Id` — no workspace is open (`apiClient/index.ts:43`) |
| 3 | Open a workspace, then load a content collection | Every subsequent `/api` request carries `X-Workspace-Id: <uuid>` |
| 4 | Navigate back out to `/workspaces` and load `/users` | The header is gone again — the workspace shell called `setActiveWorkspaceId(null)` |
| 5 | Open workspace A, then workspace B, then trigger a request | The header is B's id. Note the cell is module-level, so it is **not** React state and does not participate in render ordering — see EC-05 |

**Screen reader:** transport is invisible; the observable consequence is whichever page state
results.

### F4 / F5 / F6 — The global `401` seam

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Sign in; from another browser, revoke the session (Users → sessions); back in the first tab, trigger any data request | You are signed out and redirected to `/identity/signin`; the private shell is gone (`apps/admin-e2e/src/auth/private-routes.spec.ts:74-92`) |
| 2 | On the sign-in page, submit a **wrong password** | You stay on sign-in with an inline credential error — `POST /auth/login` is exempt (`apiClient/index.ts:56`), so the global handler does not fire |
| 3 | Load the app while signed out | `GET /auth/me` returns `401` and you land on sign-in normally — exempt (`:58`) |
| 4 | Open a dead invite link | The accept-invite page shows its own dead-link state, not a sign-out — `/auth/invite` is exempt (`:59`) |
| 5 | Sign out normally | `POST /auth/logout` on an already-dead session does not re-trigger the handler (`:57`) |
| 6 | Watch the Network tab during step 1 | The failing request is **retried** before the redirect settles — TanStack Query's default `retry: 3`. See `🐞 BUG-utils-admin-02` |

**Keyboard path:** after the forced sign-out, focus is wherever it was — no focus is moved to
the sign-in form. See `♿ A11Y-utils-admin-01`.
**Screen reader:** nothing announces "your session ended"; the user simply finds a different
page under an unchanged document title.

### F7 / F8 — Error normalization

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Console: `toApiError(new Error('x'))` | `ApiError` with `status: null`, `message: 'x'`, `details: undefined` |
| 2 | Force a 422 from a form submit and inspect the caught error | `status: 422`; `details` is the parsed body, e.g. `{ issues: [{ field, message }] }` |
| 3 | Go offline and submit | `status: null`; `message` is axios's `'Network Error'` |
| 4 | `toApiError(existingApiError)` | The same instance is returned (`apiError/index.ts:40-42`) |
| 5 | Inspect `.message` on a 500 | axios's generic `'Request failed with status code 500'` — the server's message is in `details`, not in `message`. Correct: the transport does not decide meaning |

### F9 / F10 — Query client and stale times

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Visit Members, leave, return within 60 s | Served from cache |
| 2 | Focus another window, then return to the tab | Every mounted query **refetches** — `refetchOnWindowFocus` defaults to `true` and no default `staleTime` is set (`queryClient/index.ts:9`) |
| 3 | Navigate to a page whose resource 404s | The error state appears only after ~7 s of exponential-backoff retries. See `🐞 BUG-utils-admin-02` |
| 4 | Sign out and sign in as a different user in the same tab | Check whether the previous user's cached lists flash before the refetch — nothing clears the cache |

### F11 — `HTTP_STATUS`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Console: `HTTP_STATUS` | `{BAD_REQUEST:400, UNAUTHORIZED:401, FORBIDDEN:403, NOT_FOUND:404, CONFLICT:409, TOO_MANY_REQUESTS:429}` |
| 2 | Trigger the login rate limit (11 bad logins) | The UI branches on `429` via `HTTP_STATUS.TOO_MANY_REQUESTS` and shows a rate-limit message rather than "invalid credentials" |

### F12 / F13 — Slots

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Sign in; count sidebar nav items | Matches the sum of every registered plugin's contributions |
| 2 | Console: `const s = createSlot('t'); s._register([{order:2,id:'b'}]); s._register([{order:1,id:'a'}]); s.getItems()` | `[b, a]` — insertion order, unsorted |
| 3 | `byOrder(s.getItems())` | `[a, b]`, and `s.getItems()` is **still** `[b, a]` — the sort is on a copy (`byOrder/index.ts:7`) |
| 4 | `s.getItems().push({order:3,id:'c'}); s.getItems().length` | `3` — `getItems()` returns the **live internal array**, so a consumer can mutate slot state. See `🐞 BUG-utils-admin-05` |
| 5 | `s._register([{order:1,id:'a'}])` again | Duplicated; no de-duplication by id |

### F14 — `slugify`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `slugify('Hello World')` | `'hello-world'` |
| 2 | `slugify('Café Münchén')` | `'cafe-munchen'` — NFKD + combining-mark strip |
| 3 | `slugify('  --Trim__me--  ')` | `'trim-me'` |
| 4 | `slugify('Straße')` | `'stra-e'` — `ß` does not decompose under NFKD |
| 5 | `slugify('Łódź')` | `'od'` — `Ł` and `ź`… verify: `ź` decomposes, `Ł` does not |
| 6 | `slugify('日本語')` | `''` — documented ("an empty string for input with no usable characters") |
| 7 | `slugify('🎉')` | `''` |
| 8 | `slugify('a'.repeat(10000))` | A 10 000-character slug — no length cap |
| 9 | In the workspace create wizard, type a CJK-only name | The slug field prefills empty; check that the form explains why rather than just failing validation |

### F15 — `useDebouncedValue`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | On Members, type `a`, `d`, `a` quickly | Exactly **one** request fires, ~300 ms after the last keystroke |
| 2 | Type and then immediately navigate away | The timer is cleared on unmount (`useDebouncedValue/index.ts:13`); no stray request |
| 3 | Type, then clear the box | After 300 ms the URL's `search` param is removed |

### F16–F20 — `useTableUrlState`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open `/users?search=ada&page=2&pageSize=10` | The search box shows `ada`, page 2, 10 rows per page — the URL is the source of truth |
| 2 | Open `/users?page=abc` | Page 1 (`readInt` rejects `NaN`) |
| 3 | `/users?page=0` and `/users?page=-1` | Page 1 (`parsed >= 1` guard, `useTableUrlState/index.ts:11`) |
| 4 | `/users?page=2.5` | Page 1 (`Number.isInteger` guard) |
| 5 | `/users?pageSize=100000` | Accepted client-side and sent to the API — no upper bound here (the server clamps with `clampInt`) |
| 6 | Change a filter | `page` is dropped from the URL (`:88`) and the list returns to page 1 |
| 7 | Change a filter and inspect history | The entry was `replace`d (`:91`), so filter churn does not fill the back stack |
| 8 | Type a search, then press browser **Back** | **The search comes back.** The box's state is not re-synced from the URL, so the effect at `:99-103` immediately re-writes it. See `🐞 BUG-utils-admin-01` |
| 9 | Type a search, then click a sidebar link to the **same** list page with no query | Same problem — the search is silently re-applied |
| 10 | Watch the "searching" spinner while typing | It appears on the keystroke, not on the request — `searchPending` is `searchInput !== searchParam` (`:107`) |

**Keyboard path:** the search box is a normal input; `Tab` reaches it, typing filters. Step 8
is a keyboard-visible bug: `Alt+←` appears to do nothing.
**Screen reader:** the result count is announced by the page's own live region (e.g.
`packages/users/admin/src/lib/presentation/pages/MembersPage/index.tsx:237`), not by this
hook — correct separation, and it means a debounce that never settles leaves the announcement
stale.

### F21 / F22 / F23 — Display helpers

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `initialsOf('  Ada   Lovelace ')` | `'AL'` |
| 2 | `initialsOf('Ada')` | `'A'` |
| 3 | `initialsOf('')` | `''` — a blank avatar |
| 4 | `initialsOf('😀 Smith')` | A **broken glyph** + `S` — `part[0]` takes one UTF-16 code unit. See `🐞 BUG-utils-admin-06` |
| 5 | `initialsFromEmail('ada.lovelace@example.com')` | `'AL'` |
| 6 | `initialsFromEmail('ada@example.com')` | `'A'` |
| 7 | `initialsFromEmail('@example.com')` | `''` |
| 8 | `asAvatarColor('violet')` (in palette) / `asAvatarColor('#ff0000')` | The value / `'slate'` |
| 9 | `avatarColorForId(id)` twice with the same id | Identical both times |
| 10 | `avatarColorForId('ab')` vs `avatarColorForId('ba')` | **Identical** — the hash is an order-insensitive character-code sum (`avatarColor/index.ts:22-24`) |

**Screen reader:** an avatar showing initials must not be the only carrier of the person's
identity — check that every avatar has an adjacent name or an accessible name. See
`♿ A11Y-utils-admin-03`.

### F24–F31 — The unsaved-changes guard

**Preconditions:** signed in; open a content entry and edit a field.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Click a sidebar link | The confirm dialog appears (copy from `packages/bootstrap/admin/src/lib/UnsavedChangesGuard/index.tsx:8-23`) |
| 2 | "Keep editing" / `Esc` | You stay; edits intact; the click was `preventDefault`ed (`unsavedChanges/index.tsx:143`) |
| 3 | "Leave and discard" | Navigation proceeds |
| 4 | After step 3, press **Back**, then **Forward** | Verify both work. The confirmed navigation was re-dispatched with a manual `pushState({}, '', url)` + a synthetic `PopStateEvent` (`:150-151`), which writes no router index state. See `🐞 BUG-utils-admin-04` |
| 5 | Dirty the form; `⌘`/`Ctrl`-click a link | Opens in a new tab, **no** prompt (`:119-125`) |
| 6 | Dirty the form; middle-click a link | No prompt (`event.button !== 0`, `:118`) |
| 7 | Dirty the form; click a link with `download` | No prompt (`:131`) |
| 8 | Dirty the form; click an external link | No prompt — `beforeunload` covers it (`:135`) |
| 9 | Dirty the form; press `Enter` on the skip link (`href="#main-content"`) | No prompt (`:130`) — correct |
| 10 | Dirty the form; click a link to the page you are already on | No prompt (`:137-141`) |
| 11 | Dirty the form; press `⌘R` | The browser's native "Leave site?" prompt (`:161-169`) |
| 12 | Dirty the form; use an in-app button that navigates programmatically | The dialog appears **only if** that call site uses `confirmNavigation` — nothing forces it (`:102-109`) |
| 13 | With **two** dirty forms mounted, confirm leaving one | The other is silently disarmed. See `🐞 BUG-utils-admin-03` |
| 14 | Unmount a dirty form without navigating (close a dialog containing it) | The guard clears for that key (`:216-217`) |
| 15 | Render a form using `useUnsavedChanges` with **no** provider above it | No crash, no guard (`:202-204,213`) |

**Keyboard path:** the dialog is Radix-backed, so `Tab` cycles within it, `Esc` cancels, and
focus is restored on close. Since the triggering click was `preventDefault`ed, focus never
left the anchor — verify it is still there after cancelling.
**Screen reader:** the dialog is announced with its title and description; the confirm button
is labelled "Leave and discard", which states the consequence (WCAG 3.3.4). But the
*capture-phase interception itself* is silent — a link activated by `Enter` produces a dialog
with no preceding announcement of why. See `♿ A11Y-utils-admin-02`.

## 4. Edge Cases & Negative Paths

**Transport**

- **EC-01 — A request URL without a leading slash.** `❌ NONE` The exemption list is matched
  with `SELF_HANDLED_401_PATHS.some((path) => url.startsWith(path))`
  (`apiClient/index.ts:92`) against `error.config.url` — the **as-passed** value. Axios
  accepts `apiClient.post('auth/login', …)` and resolves it correctly against `baseURL`, but
  `'auth/login'.startsWith('/auth/login')` is `false`, so such a call would trigger a global
  sign-out on a wrong password. Every current call site uses a leading slash, so this is
  latent. → `🐞 BUG-utils-admin-07`.
- **EC-02 — A future path that shares a prefix with an exempt one.** `❌ NONE` `startsWith`
  with no boundary means `/auth/logins-report` or `/auth/invites-admin` would be silently
  exempted from global 401 handling. Same root cause as EC-01.
- **EC-03 — A `401` with no handler installed.** `❌ NONE` `unauthorizedHandler?.()` is a
  no-op (`:94`) and the error rethrows — the page shows its own error state and the user
  stays on a dead session. Correct degradation, untested.
- **EC-04 — A handler that throws.** `❌ NONE` The throw escapes the interceptor's error
  callback, replacing the original rejection — so the caller sees the handler's error instead
  of the `401`, and its own `catch` misidentifies the failure.
- **EC-05 — `activeWorkspaceId` as a module cell.** `❌ NONE` Deliberate and explained
  (`:21-24`: "the interceptor below runs outside the component tree"), but it means the
  header can lag a render: a request fired during the same tick the shell switches workspaces
  can carry the previous id. The server's `WorkspaceGuard` would then answer for the wrong
  workspace — it is authorized, so not a leak, but it is a wrong answer. 🔒-adjacent.
- **EC-06 — Two tabs on different workspaces.** `✅ (by construction)` Separate JS contexts,
  separate cells. Fine.
- **EC-07 — A `403` (not a member of this workspace).** `❌ NONE` The interceptor only
  handles `401`; a `403` reaches the caller unchanged. Correct — a `403` is not a dead
  session — but `HTTP_STATUS.FORBIDDEN` exists precisely so pages branch on it, and whether
  every page does is per-page.
- **EC-08 — `withCredentials` + a cross-origin deployment.** `❌ NONE` The comment
  (`:6-8`) anticipates cross-origin, but `baseURL` is the literal `'/api'` and the server
  never calls `enableCors`, so cross-origin is not actually reachable. See
  `docs/testing/app-admin.md` `🐞 BUG-app-admin-03`.

**Query client**

- **EC-09 — No default options at all.** `❌ NONE` `new QueryClient()` with an empty
  constructor (`queryClient/index.ts:9`) inherits `retry: 3`, `staleTime: 0`,
  `refetchOnWindowFocus: true`, `gcTime: 5min`. → `🐞 BUG-utils-admin-02`.
- **EC-10 — Cache survives a user switch.** `❌ NONE` Nothing calls `queryClient.clear()` on
  sign-out; the singleton is module-scoped. 🔒 (stale cross-user data in one tab).
- **EC-11 — `STALE_TIME.Forever` is `Infinity`.** `❌ NONE` Documented for "effectively
  immutable for the session (e.g. the current user)" — but the current user's **role** can be
  changed by an admin mid-session, and a query pinned to `Infinity` will never notice.
- **EC-12 — `STALE_TIME.None` is `0`.** `❌ NONE` Identical to the default, so a hook
  passing it is documentation rather than behaviour.

**Slots**

- **EC-13 — `getItems()` exposes the live array.** `❌ NONE` → `🐞 BUG-utils-admin-05`.
- **EC-14 — Duplicate registration.** `❌ NONE` `_register` is `items.push(...newItems)`
  (`slot/index.ts:36`); no de-duplication, no id concept, no ordering guarantee beyond
  insertion order.
- **EC-15 — HMR double-registration.** `❌ NONE` A hot update that re-runs the app entry
  registers everything again onto the same module-level array; there is no `reset`.
- **EC-16 — Registering after first read.** `❌ NONE` Slots are boot-frozen by convention
  (`ARCHITECTURE.md` §6) but `_register` has no guard, so a late registration silently
  appends to an array a consumer may have already rendered.
- **EC-17 — `byOrder` with equal `order` values.** `❌ NONE` `Array.prototype.sort` is stable
  in modern V8, so ties keep insertion order — which means slot order for ties depends on
  plugin registration order. Not documented.
- **EC-18 — `byOrder` with `NaN`/missing `order`.** `❌ NONE` The type requires
  `{ order: number }`, but a runtime `undefined` yields `NaN` comparisons and an
  implementation-defined arrangement.

**`useTableUrlState`**

- **EC-19 — URL changes without a component remount.** `❌ NONE` → `🐞 BUG-utils-admin-01`.
- **EC-20 — `pageSize` has no upper bound.** `❌ NONE` `readInt` only enforces integer ≥ 1
  (`:9-12`); `?pageSize=1000000` is sent to the API. The server clamps
  (`packages/utils/server/src/lib/clamp-int.ts:7`), so the effect is a wasted round trip and
  a UI that disagrees with the server about the page size it asked for.
- **EC-21 — `page` beyond `pageCount`.** `❌ NONE` Accepted; the list renders empty. The hook
  documents that clamping is the page's job ("The page keeps only its data fetch, the
  query-builder glue, and **the page-clamp**", `:57-63`) — which is exactly the
  `.cursor/BUGBOT.md` "Stale page after mutation" trap, delegated rather than solved.
- **EC-22 — `?page=1e3`.** `❌ NONE` `Number('1e3')` is `1000`, an integer ≥ 1 → accepted.
- **EC-23 — `updateParams` with a value of `'0'`.** `✅ (by construction)` `'0'` is a truthy
  string, so it is `set`, not deleted (`:85-86`). Only `''` and `undefined` drop.
- **EC-24 — `filter` param is opaque.** `❌ NONE` `filterParam` is the raw string
  (`:72`); malformed JSON is not detected here and surfaces as a server 400.
- **EC-25 — Two lists on one page.** `❌ NONE` Both would read the same `page`/`pageSize`
  keys — only `searchKey` is parameterised (`:17`). Not currently exercised.

**Unsaved-changes guard**

- **EC-26 — Confirming clears every dirty key.** `❌ NONE` → `🐞 BUG-utils-admin-03`.
- **EC-27 — Manual `pushState` + synthetic `popstate`.** `❌ NONE` → `🐞 BUG-utils-admin-04`.
- **EC-28 — `stopPropagation()` on the intercepted click.** `❌ NONE` `:144` stops the event
  in the capture phase, so other capture listeners (a dropdown's close-on-outside-click, an
  analytics hook) never see it. Only matters while a form is dirty, which makes it an
  intermittent, hard-to-reproduce behaviour difference.
- **EC-29 — An `<a>` inside SVG.** `❌ NONE` `closest('a')` matches an `SVGAElement`, whose
  `origin`/`pathname` are `undefined`; `undefined !== window.location.origin` returns early
  (`:135`), so the guard silently does not protect SVG links.
- **EC-30 — An anchor with no `href`.** `❌ NONE` Correctly ignored (`:130`).
- **EC-31 — An anchor whose `href` is only a hash.** `✅ (by construction)` Ignored
  (`:130`) — which is what keeps the skip link working.
- **EC-32 — `target="_self"` explicitly.** `✅ (by construction)` Treated as in-app
  (`:132-133`).
- **EC-33 — `beforeunload` while clean.** `✅ (by construction)` The listener is only bound
  while `isDirty` (`:162`), so a clean page reloads without a prompt.
- **EC-34 — Two rapid link clicks while dirty.** `❌ NONE` The second `setPending` overwrites
  the first; confirming navigates to the second destination. Reasonable, undocumented.
- **EC-35 — `useUnsavedChanges` with a changing `key`.** `❌ NONE` The cleanup clears the
  **new** key's closure on the previous render's key correctly (deps include `key`,
  `:218`), so a key change clears the old and sets the new. Verified by reading — correct.
- **EC-36 — The dialog is rendered on every provider render.** `❌ NONE` `dialog({...})` is
  invoked unconditionally with `open: false` (`:179-192`), so a Radix dialog instance exists
  for the whole session. Cheap, but it means any bug in the injected dialog affects every
  page, including sign-in.

**Pure helpers**

- **EC-37 — `slugify` on `ß`, `Ł`, `đ`, `ø`.** `❌ NONE` None decompose under NFKD, so each
  becomes a hyphen. `'Straße'` → `'stra-e'`.
- **EC-38 — `slugify` producing `''`.** `❌ NONE` Documented, but a caller prefilling a
  required slug field gets an empty value and a validation error with no explanation.
- **EC-39 — `slugify` length.** `❌ NONE` No cap; a very long name yields a very long slug,
  which a DB column or URL length limit may then reject server-side.
- **EC-40 — `initialsOf`/`initialsFromEmail` on empty or symbol-only input.** `❌ NONE`
  Return `''` → a blank avatar with no fallback glyph.
- **EC-41 — `initialsOf` on astral characters.** `❌ NONE` → `🐞 BUG-utils-admin-06`.
- **EC-42 — `initialsFromEmail`'s dead fallback.** `❌ NONE` `email.split('@')[0] ?? email`
  (`initials/index.ts:27`) — `split` always returns at least one element, so `?? email` is
  unreachable and the documented "Falls back to the whole string when there is no `@`" is
  provided by `split` rather than by the fallback. Harmless; misleading.
- **EC-43 — `avatarColorForId` collisions.** `❌ NONE` → `🐞 BUG-utils-admin-08`.
- **EC-44 — `asAvatarColor` silently rewrites data.** `❌ NONE` An unknown persisted colour
  becomes `'slate'` (`avatarColor/index.ts:8-12`). This is exactly the
  `.cursor/BUGBOT.md` "Mapper fallbacks that rewrite data" pattern — though here the fallback
  is deliberate, documented, and cosmetic (a colour, not a role), so it is defensible.

### 4A. Accessibility & Section 508 Conformance

**Standards.** Tested to **WCAG 2.1 AA** (the target of
`.agents/skills/accessibility/SKILL.md`), citing the Revised Section 508 provision alongside
— 36 CFR Part 1194 Appendices A–C incorporate WCAG 2.0 A + AA by reference (**E205.4**
electronic content, **504.2** authoring tools). Chapter 5 provisions assessed where they
apply: **502.2/502.3** (AT interoperability — accessible name/role/state/value, and exposure
of programmatic changes), **503.2** (platform/user preferences), **504** (authoring tools).
WCAG 2.2 items are **advisory only**, since 508 references 2.0.

**Scope note.** Most of this package is non-visual (transport, cache, pure functions), so
many SC are Not Applicable. But it owns three things with direct a11y consequences, all of
which are *foundations every plugin inherits*: (1) the **session-lost transition**, which is
the largest unannounced change of context in the product; (2) the **capture-phase click
interceptor**, which sits in front of every link in the app; and (3) `useTableUrlState`,
whose behaviour determines whether the browser's Back button works on every list page.

**On automated scanning.** Nothing in this package is reachable by axe — it renders no
markup of its own except a caller-injected dialog. `apps/admin-e2e/src/support/fixtures.ts:110-115`
configures axe with `wcag2a/2aa/21a/21aa` and **no disabled rules** (a grep for
`disableRules`/`exclude(` in `apps/admin-e2e/src` returns nothing), so there is no suppressed
non-conformance to report — but equally, a clean axe run says nothing about any finding
below. All four are behavioural.

#### ♿ A11Y-utils-admin-01 — A forced sign-out changes the whole page with no announcement and no focus move

- **WCAG:** `4.1.3 Status Messages (AA)`, `2.4.3 Focus Order (A)`, `3.2.2 On Input (A)` (arguably) · **508:** `E205.4`, `502.3.9 Modification of Focus Cursor`
- **Verdict:** **Does Not Support**
- **Location:** `packages/utils/admin/src/lib/apiClient/index.ts:85-98`. The interceptor
  fires `unauthorizedHandler?.()` and rethrows; the handler (installed by `identity-admin`)
  drops the cached user, the route gate re-evaluates, and React Router replaces the entire
  view with the sign-in page. Nowhere in that chain is focus moved or a message announced —
  and because the document title never changes
  (`docs/testing/app-admin.md` `♿ A11Y-app-admin-01`), the usual SPA fallback signal is
  absent too.

**Repro:** sign in; from a second browser revoke the session; back in the first tab, `Tab`
to a control and activate it so a data request fires.
**Keyboard-only user:** the page underneath them is replaced. Focus stays on an element that
no longer exists, so the browser resets it to `<body>` — the next `Tab` starts from the top
of the sign-in page with no indication of why the user is there. Any text typed into a form
is gone.
**Screen-reader user:** worse. The virtual buffer still holds the old page; the user
continues reading content that has been unmounted, then encounters the sign-in form with no
explanation. There is no "Your session has ended, please sign in again" message anywhere —
not as a toast, not as a live region, not on the sign-in page.
**Remediation:** have the unauthorized handler surface a message through the existing toast
live region (mounted at `packages/bootstrap/admin/src/lib/createAdmin/index.tsx:101`) and
move focus to the sign-in form's heading. The seam is already the right place for it —
`setUnauthorizedHandler` exists precisely so the transport does not decide what a 401 means.

#### ♿ A11Y-utils-admin-02 — The unsaved-changes interceptor swallows link activations before the router sees them, with no announcement

- **WCAG:** `3.2.2 On Input (A)`, `4.1.3 Status Messages (AA)`, `2.1.1 Keyboard (A)` · **508:** `E205.4`
- **Verdict:** **Partially Supports**
- **Location:** `packages/utils/admin/src/lib/unsavedChanges/index.tsx:112-157`. A
  document-level **capture-phase** listener calls `preventDefault()` + `stopPropagation()`
  on any qualifying anchor click while a form is dirty, then opens a confirm dialog.

What works: pressing `Enter` on a focused link dispatches a synthetic `click` with
`button === 0` and no modifiers, so keyboard activation **is** intercepted the same way as a
mouse click — the guard is not mouse-only, which is the failure this pattern usually has.
`href="#…"` is exempt (`:130`), so the skip link still works. Radix's dialog traps focus and
restores it, and the confirm's label states the consequence (3.3.4).

What does not: there is no announcement between the activation and the dialog. Some screen
readers announce a dialog opening promptly; others do not until focus lands. And
`stopPropagation()` (`:144`) means other capture-phase listeners — including any future
route-announcer or focus-management hook — never observe the click, so a fix for
`♿ A11Y-app-admin-02` layered on click handling would silently not run while a form is
dirty. Finally, `closest('a')` does not match an `SVGAElement` usefully (`:135` returns early
on its `undefined` origin), so an SVG link is unguarded.
**Repro:** dirty a form; `Tab` to a sidebar link; press `Enter`; observe what is announced
before the dialog receives focus.
**Remediation:** ensure the injected dialog moves focus to itself on open (Radix does) and
consider `aria-live` confirmation of *why* navigation was blocked; drop `stopPropagation()`
unless a concrete conflict requires it.

#### ♿ A11Y-utils-admin-03 — Initials-only avatars can be blank or mojibake, and carry no accessible name from this layer

- **WCAG:** `1.1.1 Non-text Content (A)`, `4.1.2 Name, Role, Value (A)` · **508:** `E205.4`, `502.3.1 Object Information`
- **Verdict:** **Partially Supports** (the name is the consumer's responsibility; the value this layer supplies can be empty or broken)
- **Location:** `packages/utils/admin/src/lib/initials/index.ts:2-9,16-29`. `initialsOf('')`
  and `initialsFromEmail('@example.com')` both return `''`; `initialsOf('😀 Smith')` returns a
  lone UTF-16 surrogate followed by `S`. Cross-reference `🐞 BUG-utils-admin-06`.

**Repro:** create a user whose display name is a single emoji, or whose name is empty and
whose email local part is empty; view the members roster.
**Keyboard-only user:** no impact.
**Screen-reader user:** an avatar rendering `''` announces nothing; one rendering a lone
surrogate announces a replacement character or is skipped. If the consuming component treats
the initials as the avatar's accessible name (rather than the person's full name), the
identity of that row is unavailable. This package cannot fix that alone — it produces a
display string, not a name — but it should never produce an empty or invalid one.
**Remediation:** make `initialsOf`/`initialsFromEmail` grapheme-aware (`Array.from(part)[0]`
or `Intl.Segmenter`) and return a defined fallback (e.g. `'?'`) rather than `''`; separately,
require consumers to give the avatar an accessible name from the full name, not the initials.

#### ♿ A11Y-utils-admin-04 — Back-button navigation is defeated on every list page

- **WCAG:** `3.2.5 Change on Request (AAA — advisory)`; the AA-level harm is to `2.4.5 Multiple Ways (AA)` and to `2.1.1 Keyboard (A)` in practice · **508:** `E205.4`
- **Verdict:** **Partially Supports**
- **Location:** `packages/utils/admin/src/lib/useTableUrlState/index.ts:76,99-103` — the
  search box's state initialises from the URL **once** and is never re-synced, while an
  effect continuously writes it back. Cross-reference `🐞 BUG-utils-admin-01`, which is the
  same defect described functionally.

**Repro:** open `/users`; type `ada`; press `Alt+←` (Back).
**Keyboard-only user:** the browser Back shortcut is one of the few universally available
keyboard navigations, and here it visibly does nothing — the URL flickers and the filtered
list stays. Users who rely on Back as their primary "undo navigation" gesture have no
alternative; the only way out is to clear the box manually, which requires knowing that is
the problem.
**Screen-reader user:** the same, plus the confusion of a page that announces its result
count (via the page's own live region, e.g.
`packages/users/admin/src/lib/presentation/pages/MembersPage/index.tsx:237`) as unchanged
after an action the user believes should have changed it.
**Remediation:** re-sync `searchInput` from `searchParam` when the URL changes for a reason
other than the debounce (see `🐞 BUG-utils-admin-01`'s suggested fix).

**Remaining WCAG 2.1 AA checklist for this unit:**

| SC | Verdict | Note |
| --- | --- | --- |
| 1.1.1 Non-text Content (A) | Partially Supports | Only via the initials helpers — `♿ A11Y-utils-admin-03` |
| 1.3.1 / 1.3.2 / 1.3.5 | Not Applicable | The package renders no structural markup; the one element it renders is a caller-injected dialog |
| 1.4.1 Use of Colour (A) | Partially Supports | `avatarColorForId` assigns colour as an identity cue; consumers must not let colour be the **only** differentiator between two people (a real risk given the collision rate in `🐞 BUG-utils-admin-08`) |
| 1.4.3 / 1.4.11 Contrast (AA) | Not Applicable | Palette values come from `@orthacms/design-system`'s `AVATAR_COLORS`; this package only selects among them |
| 1.4.4 / 1.4.10 / 1.4.12 / 1.4.13 | Not Applicable | No layout, no hover content |
| 2.1.1 Keyboard (A) | Supports | The click interceptor handles keyboard-dispatched clicks identically (`unsavedChanges/index.tsx:113-125`) — see `♿ A11Y-utils-admin-02` |
| 2.1.2 No Keyboard Trap (A) | Supports | The confirm dialog is the injected Radix component; cancelling via `Esc` releases (`:181-183`) |
| 2.4.1 Bypass Blocks (A) | Supports (by not breaking it) | `href.startsWith('#')` is exempt from interception (`:130`), so the shell's skip link keeps working while a form is dirty. Verified by reading; **untested** |
| 2.4.2 Page Titled (A) | Not Applicable | Owned by the host |
| 2.4.3 Focus Order (A) | Does Not Support | Via the session-lost transition — `♿ A11Y-utils-admin-01` |
| 2.4.7 Focus Visible (AA) | Not Applicable | |
| 3.1.1 / 3.1.2 Language | Not Applicable | The package is deliberately copy-free ("it lives in `utils-admin`, which owns no strings", `packages/bootstrap/admin/src/lib/UnsavedChangesGuard/index.tsx:29-30`) — a correct design choice for i18n |
| 3.2.1 On Focus (A) | Supports | Nothing here reacts to focus |
| 3.2.2 On Input (A) | Partially Supports | Typing in a search box rewrites the URL after 300 ms (`useTableUrlState/index.ts:99-103`). Auto-filtering on input is conventional and not a "change of context" under 3.2.2 — but combined with `♿ A11Y-utils-admin-04` it makes the URL unpredictable |
| 3.3.1–3.3.3 | Not Applicable | No forms of its own |
| 3.3.4 Error Prevention (AA) | Supports | The unsaved-changes guard is precisely a 3.3.4 mechanism for destructive navigation, and it covers links, programmatic navigation and page unload |
| 4.1.2 Name, Role, Value (A) | Not Applicable | No custom control |
| 4.1.3 Status Messages (AA) | Does Not Support | The session-lost transition produces no status message — `♿ A11Y-utils-admin-01`. Note the package does **not** own the toast live region (that is the host's `<Toaster>`), so the fix is to *use* it |
| 2.4.11 / 2.5.8 (WCAG 2.2 — **advisory, out of scope for 508**) | Not Applicable | |
| 503.2 User Preferences | Not Applicable | No styling or animation |
| 503.4 Caption/Audio Controls | Not Applicable | |

**508 Chapter 5 — Authoring Tools (504).** This package is *infrastructure to* the authoring
path rather than part of it, so **504.2**, **504.2.1**, **504.3** and **504.4** are all
**Not Applicable** here — they belong to `content/admin`, `wysiwyg/admin` and `media/admin`.
The one adjacent obligation it does carry is protecting an author's in-progress work: the
unsaved-changes guard is what stands between an author and losing an unsaved entry, and it
**Partially Supports** that role because confirming one form's navigation disarms every other
mounted form (`🐞 BUG-utils-admin-03`) — an author with an entry editor and a docked
composer both dirty can lose the second without ever being asked.

## 5. E2E Coverage Map

This package has **no unit tests of its own** (no `*.spec.ts` under
`packages/utils/admin/src`), so every marker below is either indirect e2e coverage through a
consumer or absent.

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F1 `apiClient` | every `apps/admin-e2e` spec (each mocks `**/api/**` via `page.route`) | Requests are made to `/api/...` with credentials | ✅ E2E — implicit but total |
| F4/F5/F6 the `401` seam | `apps/admin-e2e/src/auth/private-routes.spec.ts:74-92` | With `GET /api/auth/me` still mocked **signed in**, a `401` on `**/api/users?*` alone drives the sign-out and tears down the private shell — proving the redirect came from the interceptor, not from the auth probe | ✅ E2E — a genuinely well-designed test of exactly this seam |
| F5 exempt paths | `apps/admin-e2e/src/auth/login.spec.ts` (bad password stays on the page), `auth/accept-invite.spec.ts` + `auth/a11y.spec.ts:89` (dead invite link), `auth/private-routes.spec.ts:22-31` (signed-out probe) | Each of `/auth/login`, `/auth/invite`, `/auth/me` produces its own state rather than a global sign-out | ✅ E2E — three of the four exempt paths are covered by behaviour |
| F7/F8 `ApiError` | `apps/admin-e2e/src/auth/login.spec.ts` (401 → credential error), `content/*.spec.ts` (422 → field errors), `users/members.spec.ts` (error states) | Callers branch on `status` and read `details` | ✅ E2E — the `status: null` network-error branch is **not** covered |
| F9 `queryClient` | `apps/admin-e2e/src/users/members-filter.spec.ts`, `activity/activity-filter.spec.ts` | Refetch-on-filter-change and cached navigation behave | ✅ E2E — the **defaults** (retry, refetchOnWindowFocus) are never asserted |
| F11 `HTTP_STATUS` | `apps/admin-e2e/src/auth/login.spec.ts` (429 rate-limit branch) | The UI distinguishes 429 from 401 | ✅ E2E |
| F12 `createSlot` | `apps/admin-e2e/src/shell/command-palette.spec.ts`, `home/dashboard.spec.ts`, every spec asserting `nav` | Contributed nav/section items render | ✅ E2E — happy path; duplicates, ordering and the live-array leak are unasserted |
| F14 `slugify` | `apps/admin-e2e/src/workspaces/workspaces.spec.ts`, `workspaces/a11y.spec.ts:68` (slug validation error visible) | The create wizard derives a slug from the name and validates it | ✅ E2E — ASCII only; no accented, CJK, emoji or empty-result case |
| F15 `useDebouncedValue` | `apps/admin-e2e/src/users/keyboard.spec.ts:16` ("search filters as you type"), `users/members-filter.spec.ts` | Typing filters the list | ✅ E2E — asserts the effect, not that a burst produces **one** request |
| F16/F18/F20 `useTableUrlState` | `apps/admin-e2e/src/users/members-filter.spec.ts`, `activity/activity-filter.spec.ts`, `content/records-filter.spec.ts` | Search, filter and pagination drive the URL and the list | ✅ E2E for the forward path |
| F2/F3 `X-Workspace-Id` | `apps/admin-e2e/src/copilot/dock.spec.ts:64` (comment only) | — | ⚠️ PARTIAL — the header is *mentioned*; no admin-e2e assertion that the interceptor attaches it, and the mock layer does not check request headers. Server-side coverage of the header exists (`apps/server-e2e/src/server/api-tokens/public-content-api.spec.ts:236,290,313`) but that is the guard, not this interceptor |
| F10 `STALE_TIME` | consumers' hooks | Values are passed | ⚠️ PARTIAL — no assertion of the resulting freshness behaviour |
| F13 `byOrder` | slot-rendering specs | Order is correct in the rendered nav | ⚠️ PARTIAL — the non-mutation guarantee (the reason the function exists, `byOrder/index.ts:2-4`) is untested |
| F17/F19 `readInt`, `searchPending` | pagination specs | Pages render | ⚠️ PARTIAL — malformed `?page=` values and the spinner's timing are unasserted |
| F21/F22/F23 initials + avatar colour | `apps/admin-e2e/src/users/members.spec.ts`, `users/user-detail.spec.ts` | Avatars render | ⚠️ PARTIAL — only well-formed names; no empty, emoji or collision case |
| F24/F25/F26 unsaved-changes guard | `apps/admin-e2e/src/content/i18n.spec.ts` (the only spec in the repo mentioning unsaved changes), `apps/admin-e2e/src/support/pages/AgentsPage.ts` | The dialog appears in one locale-switch flow | ⚠️ PARTIAL — a single path out of the ten branches at `unsavedChanges/index.tsx:118-141` |
| F27 `confirmNavigation` | — | — | ❌ NONE |
| F28 `beforeunload` | — | — | ❌ NONE |
| F29 confirmed-navigation re-dispatch | — | — | ❌ NONE — including the back/forward behaviour it affects |
| F30/F31 the hooks' lifecycle | — | — | ❌ NONE |
| **a11y** | — | — | ❌ NONE — no axe suite can reach this package, and none of the four ♿ findings is detectable by automated scanning. The repo's axe config disables **no** rules (`apps/admin-e2e/src/support/fixtures.ts:110-115`), so there is no hidden suppression to report |

**Coverage tally:** `31 features · 9 ✅ · 12 ⚠️ · 10 ❌`
**♿ tally:** `4 findings — 0 Supports · 3 Partially Supports · 1 Does Not Support` (plus 2 Does Not Support verdicts recorded in the SC table for 2.4.3 and 4.1.3, both arising from `♿ A11Y-utils-admin-01`).

## 6. 🐞 Potential Bugs

### 🐞 BUG-utils-admin-01 — The search box overwrites the URL, so Back (and any link that clears the search) is silently undone · Severity: Medium

**Location:** `packages/utils/admin/src/lib/useTableUrlState/index.ts:76-77,99-103`
**Category:** ux-state

**What the code does:** the box's value is seeded from the URL **once**, at mount:

```ts
const [searchInput, setSearchInput] = useState(searchParam);
const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);
```

and an effect then continuously pushes the debounced value **back into** the URL whenever the
two disagree:

```ts
useEffect(() => {
    if (debouncedSearch !== searchParam) {
        updateParams({ [searchKey]: debouncedSearch || undefined });
    }
}, [debouncedSearch, searchParam, searchKey, updateParams]);
```

**Why it is wrong:** the comment above it reasons about only one direction — "Settles in one
extra pass: once the URL reflects the debounced value the guard is false, so no loop." That
holds when the *box* is the thing that changed. It does not hold when the **URL** changes
while the component stays mounted, which is the common case:

- the user presses **Back**,
- the user clicks a sidebar link back to the same list page with no query,
- any code calls `updateParams({ [searchKey]: undefined })`.

In each, `searchParam` becomes `''` while `searchInput` still holds the typed text, so the
guard is true in the *other* direction and the effect immediately re-writes the search into
the URL. Because `updateParams` uses `{ replace: true }` (`:91`), the restored entry
overwrites the one the user just navigated to — so pressing Back again lands on the same
state. **The Back button cannot escape a search.** The hook's own docstring claims it exists
so "the bug-prone URL mechanics live in one tested place instead of being copy-pasted per
page" (`:57-63`) — and this is the bug-prone part, in the one place, untested.

**Repro:**
1. Open `/users`.
2. Type `ada` in the search box; wait for the list to filter (URL becomes `/users?search=ada`).
3. Press `Alt+←` (Back).
→ Observed: the URL flickers to `/users` and immediately returns to `/users?search=ada`; the
list stays filtered. Repeated Back presses do nothing.
→ Expected: Back returns to the unfiltered list and the search box clears.

**Blast radius:** every list page using this hook — Members, Activity, and the Content
Library's records views (`apps/admin-e2e/src/users/members-filter.spec.ts`,
`activity/activity-filter.spec.ts`, `content/records-filter.spec.ts` all exercise these
pages, forward-only). It is also an accessibility failure for keyboard users
(`♿ A11Y-utils-admin-04`). **Severity is Medium, not High:** the mechanism is confirmed
line-for-line, but the harm is navigational — no data is lost, corrupted or exposed, and no
authorization decision is affected. It is the most user-visible defect in this package, and
it is still a usability defect.
**Suggested fix:** track the last value this hook wrote and re-sync `searchInput` from
`searchParam` whenever `searchParam` changes to something other than that value (an effect
keyed on `searchParam`), so an externally-driven URL change wins over the stale box.

### 🐞 BUG-utils-admin-02 — The shared `QueryClient` ships with no defaults, so 4xx responses are retried three times and the session-lost handler can fire four times per query · Severity: Medium

**Location:** `packages/utils/admin/src/lib/queryClient/index.ts:1-9`, interacting with `packages/utils/admin/src/lib/apiClient/index.ts:85-98`
**Category:** ux-state / perf

**What the code does:**

```ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient();
```

No `defaultOptions`. TanStack Query v5's defaults therefore apply: `retry: 3` with
exponential backoff, `staleTime: 0`, `refetchOnWindowFocus: true`, `gcTime: 5 min`.

**Why it is wrong:** three consequences, all app-wide.

1. **4xx responses are retried.** A `401`, `403` or `404` is not transient; retrying it is
   pure latency. A page whose resource genuinely 404s shows nothing for roughly seven seconds
   (1 s + 2 s + 4 s of backoff) before its error state appears — long enough that users read
   it as a hang.
2. **The unauthorized handler fires up to four times per query.** The axios interceptor calls
   `unauthorizedHandler?.()` on **every** `401` (`apiClient/index.ts:94`), and the retry
   happens above axios, so a single dead session with three mounted queries produces up to
   twelve handler invocations. `identity-admin`'s handler is idempotent (it drops a cached
   user), so today this is noise rather than breakage — but it makes the seam's behaviour
   depend on an unstated idempotency requirement that
   `setUnauthorizedHandler`'s documentation (`apiClient/index.ts:65-75`) never states.
3. **`staleTime: 0` + `refetchOnWindowFocus: true`** means every alt-tab back to the browser
   refetches every mounted query. `STALE_TIME` exists (`staleTime/index.ts:7-16`) precisely
   so hooks make a deliberate freshness choice — but the *default* for a hook that forgets to
   pass one is the most aggressive possible setting.

**Repro:**
1. Sign in; open Members.
2. Revoke the session from another browser.
3. In the first tab, change the search filter, with the Network tab open.
→ Observed: the `/api/users` request is issued four times (each 401), the sign-out handler
runs on each, and the redirect settles only after the backoff completes.
→ Expected: one request, one handler call, immediate redirect.

**Blast radius:** every query in the app; most visible on error paths, which is exactly when
responsiveness matters. No data-integrity impact.
**Suggested fix:** give the client `defaultOptions.queries` with a `retry` predicate that
does not retry 4xx (`(count, err) => count < 2 && (err as ApiError).status !== null &&
(err as ApiError).status >= 500`), a small default `staleTime` (`STALE_TIME.Short` is already
defined), and an explicit `refetchOnWindowFocus` decision. Also document that an unauthorized
handler must be idempotent.

### 🐞 BUG-utils-admin-03 — Confirming one form's navigation clears every mounted form's dirty state, silently disarming the guard · Severity: Medium

**Location:** `packages/utils/admin/src/lib/unsavedChanges/index.tsx:184-191`, with `:211-219`
**Category:** data-loss

**What the code does:** on confirm, the provider wipes the entire dirty set:

```ts
onConfirm: () => {
    const proceed = pending;
    setPending(null);
    // Clear the guard first: the pending navigation is the
    // user's answer, and the form is about to unmount anyway.
    setDirtyKeys(new Set());
    proceed?.();
}
```

**Why it is wrong:** the provider deliberately holds a **set** of keys so that "several forms
can be mounted and the guard is 'any'" (`:78`), and `useUnsavedChanges` registers one key per
form (`:211-219`). Clearing all of them assumes exactly one form is dirty, and the comment
says as much ("the form is about to unmount anyway") — which is true of the form being left
and false of any other.

The damage is compounded by the re-registration path. `useUnsavedChanges` only calls
`setDirty` inside an effect keyed on `[setDirty, key, dirty]` (`:214-218`). After the wipe, a
**still-mounted** form whose `dirty` prop has not changed does not re-run that effect, so it
never re-registers. Its edits are now unprotected for the rest of its life — no link click,
no programmatic navigation and no `beforeunload` will prompt for them again until its
dirtiness toggles off and back on.

This is reachable today: the copilot's docked window is explicitly non-modal and mountable
over any page ("the **non-modal docked window** (bottom-right, several at once behind a dock,
`⌘J`)", `CONTEXT-MAP.md`), so a half-written composer message can coexist with a dirty entry
editor.

**Repro:**
1. Open a content entry and edit a field (form A dirty).
2. Open the copilot dock (`⌘J`) and type a message without sending (form B dirty).
3. Click a sidebar link; confirm "Leave and discard".
4. From the new page, with the dock still open and still holding text, click another link.
→ Observed: no prompt — B's edits are discarded silently. → Expected: B is still guarded.

**Blast radius:** silent loss of user-entered text whenever two dirty forms coexist. Narrow
today (few pages mount two), widening as the copilot dock and side panels are used more.
**Suggested fix:** clear only the key associated with the pending navigation (track it
alongside `pending`), or leave the set alone and let each form's unmount clear its own key —
the cleanup at `:217` already does that correctly.

### 🐞 BUG-utils-admin-04 — A confirmed navigation is re-dispatched with a raw `pushState` + synthetic `popstate`, desynchronising React Router's history index · Severity: Medium

**Location:** `packages/utils/admin/src/lib/unsavedChanges/index.tsx:145-152`
**Category:** correctness

**What the code does:**

```ts
const url = anchor.pathname + anchor.search + anchor.hash;
setPending(() => () => {
    // Re-dispatch as a real click once confirmed. Cheaper and safer
    // than reaching for the router here: the anchor already knows
    // where it goes, and the guard is clear by then.
    window.history.pushState({}, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
});
```

**Why it is wrong:** the two calls disagree about what happened. `pushState` **adds** a
history entry; the synthetic `popstate` tells the router a **pop** occurred. React Router 6's
`createBrowserHistory` (the repo pins `react-router-dom` at `6.30.3`,
`package.json:44`) maintains its own position counter in `history.state.idx` and uses it to
decide navigation direction and to restore scroll. Writing `{}` as the state erases `idx` for
that entry, and the synthetic event drives the router's pop handler with no matching index.
The router's location updates — which is why this appears to work — but its internal
bookkeeping is now wrong for that entry and every subsequent relative navigation.

The comment calls this "Cheaper and safer than reaching for the router here", but the safe
option was available: the provider is mounted **inside** `BrowserRouter`
(`packages/bootstrap/admin/src/lib/createAdmin/index.tsx:73-99`), so `useNavigate()` is in
scope and would perform a real push with correct state. The file's header explains the
constraint it was working around — `useBlocker` needs a data router (`:66-68`) — but
`useNavigate` does not.

**Repro:**
1. Visit `/` → `/users` → open a content entry and dirty it.
2. Click a sidebar link; confirm "Leave and discard".
3. Press Back, then Forward, then Back again, watching the URL and the rendered page.
→ Observed: the history sequence does not round-trip cleanly for the confirmed hop — expect a
skipped entry, a duplicated one, or scroll restoration landing wrong.
→ Expected: normal back/forward behaviour.

**What I could not confirm:** the precise misbehaviour depends on React Router 6.30's
internals, which I read about rather than executed. What is certain from the code is that
`pushState({}, …)` writes no `idx` and that a `pushState` is being reported to the router as
a `popstate` — the two cannot both be right.
**Blast radius:** browser history correctness after any confirmed navigation away from a
dirty form. Confusing rather than destructive.
**Suggested fix:** replace the pair with a `useNavigate()` call captured in the provider
(`navigate(url)`), which performs a real push with the router's own state bookkeeping.

### 🐞 BUG-utils-admin-05 — `Slot.getItems()` returns the live internal array, so any consumer can mutate shared plugin state · Severity: Low

**Location:** `packages/utils/admin/src/lib/slot/index.ts:31-38`
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

**Why it is wrong:** `getItems` hands out the closure's array by reference, so
`slot.getItems().sort(...)`, `.reverse()`, `.push(...)` or `.splice(...)` permanently mutate
state shared by every plugin reading that slot. That the codebase *knows* this is the
giveaway: `byOrder` exists specifically to avoid it and says so — "Slot contributions are
read from a shared, plugin-owned array, so callers must never sort it in place — hence the
`slice()` copy before sort" (`byOrder/index.ts:2-5`). The invariant is therefore enforced by
a comment in a **different module** and by every consumer remembering to route through
`byOrder`. The type even advertises the array as safe: `getItems(): T[]` with the doc
"Returns every item registered to this slot" (`slot/index.ts:10-11`).

There is no de-duplication either, so registering the same contribution twice (a
double-registered plugin, or a Vite HMR re-run of the app entry) duplicates every item with
no warning — which is why `apps/admin/src/main.tsx:21-26` had to give insights its own
last-wins merge by id.

**Repro:**
1. In any consumer, call `SIDEBAR_NAV_SLOT.getItems().sort((a, b) => b.order - a.order)`.
2. Reload nothing; navigate to another page that reads the same slot.
→ Observed: the nav order is now reversed for every consumer, for the rest of the session.
→ Expected: the consumer sorts a copy; shared state is untouched.

**Blast radius:** requires a consumer to misuse the API, and the codebase currently does not.
A latent trap with a one-line fix.
**Suggested fix:** return a copy (`getItems: () => [...items]`), or type it
`readonly T[]` so `sort`/`push` are compile errors.

### 🐞 BUG-utils-admin-06 — `initialsOf` slices UTF-16 code units, producing lone surrogates for emoji and astral characters · Severity: Low

**Location:** `packages/utils/admin/src/lib/initials/index.ts:2-9,16-18`
**Category:** correctness

**What the code does:**

```ts
function initialsFromParts(parts: string[]): string {
    return parts
        .filter(Boolean)
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}
```

**Why it is wrong:** `part[0]` indexes by UTF-16 **code unit**, not by code point. Any
character outside the BMP — every emoji, many CJK extension characters, mathematical
alphanumerics — occupies two code units, so `part[0]` returns the high surrogate alone: an
unpaired code unit that renders as `` and is invalid text. `initialsOf('😀 Smith')` yields
`'\ud83dS'`.

Two related outputs are empty rather than broken: `initialsOf('')` and
`initialsFromEmail('@example.com')` both reduce to `[]` after `filter(Boolean)` and return
`''`, giving a blank avatar with no fallback glyph. Both feed an avatar whose accessible
name may be derived from them (see `♿ A11Y-utils-admin-03`).

Separately, `initialsFromEmail`'s `email.split('@')[0] ?? email` (`:27`) has a dead branch —
`String.prototype.split` always returns at least one element — so the documented "Falls back
to the whole string when there is no `@`" is delivered by `split`, not by the `??`.

**Repro:**
1. Create or edit a user whose display name is `😀 Smith`.
2. Open the members roster.
→ Observed: the avatar shows a replacement character followed by `S`. → Expected: `😀S`, or a
defined ASCII fallback.

**Blast radius:** cosmetic, but visible on the members roster, user detail pages and every
avatar in the product; and it produces invalid text that a screen reader cannot voice.
**Suggested fix:** take the first **grapheme** — `Array.from(part)[0]` handles surrogate
pairs — and return a defined fallback (`'?'`) when no parts survive.

### 🐞 BUG-utils-admin-07 — Unverified — The self-handled `401` exemption is a bare prefix match on the as-passed URL · Severity: Low · 🔒

**Location:** `packages/utils/admin/src/lib/apiClient/index.ts:55-60,88-95`
**Category:** correctness

**What the code does:**

```ts
const SELF_HANDLED_401_PATHS = ['/auth/login', '/auth/logout', '/auth/me', '/auth/invite'];
…
const url: string = error?.config?.url ?? '';
if (
    status === HTTP_STATUS.UNAUTHORIZED &&
    !SELF_HANDLED_401_PATHS.some((path) => url.startsWith(path))
) {
    unauthorizedHandler?.();
}
```

**Why it is wrong:** two brittle assumptions, in opposite directions.

- **Under-matching.** `error.config.url` is whatever the caller passed, before `baseURL` is
  applied. Axios accepts `apiClient.post('auth/login', …)` (no leading slash) and resolves it
  correctly, but `'auth/login'.startsWith('/auth/login')` is `false` — so such a call would
  fire the **global sign-out on a wrong password**, throwing the user to the sign-in page with
  no error. The bug would look like "login is broken", not like a transport issue.
- **Over-matching.** `startsWith` has no path boundary, so any future route beginning with an
  exempt string — `/auth/login-history`, `/auth/invites`, `/auth/mentions` — is silently
  exempted from session-lost handling. A genuinely dead session on such a route would then
  leave the user on a page that keeps failing rather than signing them out. 🔒 in the sense
  that it weakens a security-adjacent transition, though not a bypass.

**What I could not confirm:** I did not audit every call site across the thirteen admin
plugins to prove that all of them pass a leading slash. Every example in the package's own
documentation does (`AGENTS.md`: `apiClient.post('/auth/login', …)`), and the exempt paths
are exercised correctly by
`apps/admin-e2e/src/auth/login.spec.ts` and `auth/private-routes.spec.ts:22-31`, so the
convention clearly holds today — this is about how easily it can be broken, not about a
current failure.

**Repro (of the fragility):**
1. Change any identity call site to `apiClient.post('auth/login', …)`.
2. Submit a wrong password.
→ Observed: instead of an inline credential error, the app performs a global sign-out.

**Blast radius:** latent; one careless call site or one new `/auth/*` route away from a
user-visible auth bug.
**Suggested fix:** normalise the URL before matching (strip `baseURL`, ensure a leading
slash) and compare against exact paths or a boundary-aware pattern rather than `startsWith`.

### 🐞 BUG-utils-admin-08 — `avatarColorForId` hashes by summing character codes, so anagram ids collide and the palette is unevenly used · Severity: Low

**Location:** `packages/utils/admin/src/lib/avatarColor/index.ts:20-26`
**Category:** correctness

**What the code does:**

```ts
export function avatarColorForId(id: string): AvatarColor {
    let hash = 0;
    for (let index = 0; index < id.length; index++) {
        hash = (hash + id.charCodeAt(index)) % AVATAR_COLORS.length;
    }
    return AVATAR_COLORS[hash];
}
```

**Why it is wrong:** the accumulator is a **sum** taken mod the palette size, so it is
completely position-insensitive: any permutation of the same characters yields the same
colour. The doc claims the function is "spread across the palette so a roster reads as
distinct" (`:16-18`), which a character-code sum does not deliver — for fixed-length hex
UUIDs the input alphabet is only 16 symbols plus dashes, so the sum's distribution is
narrow and bunched rather than uniform. In a roster of a dozen users, visibly repeated
colours are likely.

This matters slightly more than cosmetics: the colour is an identity cue, so two people
sharing one weakens it (WCAG 1.4.1 if colour is ever the *only* differentiator — see the SC
table in §4A).

**Repro:**
1. `avatarColorForId('ab')` and `avatarColorForId('ba')`.
→ Observed: identical. → Expected: different, for a hash that claims to spread ids across the
palette.

**Blast radius:** cosmetic; a roster that looks less distinct than intended.
**Suggested fix:** use a position-sensitive hash (e.g. FNV-1a or
`hash = (hash * 31 + code) | 0`) and take the modulus once at the end.

**Checked and cleared** (no defect found): the `401` interceptor correctly **rethrows** after
firing the handler (`apiClient/index.ts:96`), so a caller's own error handling still runs —
the design note at `:80-83` is honoured, and `apps/admin-e2e/src/auth/private-routes.spec.ts:74-92`
is a genuinely good test of the seam. The inversion that keeps `utils-admin` from depending
on `identity-admin` (`setUnauthorizedHandler` as a seam) is sound and well documented.
`toApiError` is correct in all three branches, including the `instanceof ApiError`
passthrough (`apiError/index.ts:40-42`), and it deliberately keeps the server's body in
`details` rather than in `message` — the right call for a transport layer. `byOrder`'s
`slice()` before `sort` is correct and its rationale is right, even though the underlying
array it defends against is exposed (`🐞 BUG-utils-admin-05`). `useDebouncedValue` clears its
timer on unmount and on every dependency change (`useDebouncedValue/index.ts:13`) — no leak.
`readInt` correctly rejects `NaN`, `0`, negatives and non-integers
(`useTableUrlState/index.ts:9-12`). `updateParams` correctly uses the functional
`setSearchParams` form so concurrent patches compose, and `replace: true` is the right
history choice for filter churn (`:81-92`). In the unsaved-changes guard: `confirmNavigation`
correctly stores the callback as a thunk to stop `setState` invoking it (`:107-108`); the
`dirtyRef` mirror is the right way to let a stable DOM listener read fresh state without
rebinding on every keystroke (`:86-87`); the modified-click, download, `target`, external-origin
and same-URL exemptions are all correct and individually justified (`:118-141`); the `#`-href
exemption is what keeps the shell's skip link working; `beforeunload` is bound only while
dirty (`:162`); `useUnsavedChanges`'s cleanup correctly clears on unmount and handles a
changing `key` (`:214-218`); and `useUnsavedChangesApi` returning `null` rather than throwing
outside a provider is the right degradation for tests and Storybook (`:197-204`).
`asAvatarColor`'s `slate` fallback is a mapper default, but a cosmetic one, so it does not
meet the `.cursor/BUGBOT.md` "mapper fallbacks that rewrite data" bar.

**Tally:** `8 🐞 — 0 Critical · 0 High · 4 Medium · 4 Low (1 🔒)` ·
`♿ 4 findings — 0 Supports · 3 Partially Supports · 1 Does Not Support · 0 Unverified`

## 7. Recommended E2E Tests

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | Unit (`packages/utils/admin/src/lib/useTableUrlState/__test__/index.spec.tsx`, vitest + Testing Library + `MemoryRouter`) | URL↔box sync | Typing writes the URL after the debounce; **changing the URL externally re-syncs the box**; pressing Back does not restore the search. Currently fails on the last two | `🐞 BUG-utils-admin-01`, `♿ A11Y-utils-admin-04`, EC-19 |
| 2 | `apps/admin-e2e` (POM + `page.route` mock) | `apps/admin-e2e/src/users/members-back-button.spec.ts` | Search on Members, press `goBack()`, assert the URL has no `search` param **and** the list is unfiltered. Currently fails | `🐞 BUG-utils-admin-01` |
| 3 | Unit (`.../lib/apiClient/__test__/index.spec.ts`, vitest + `axios-mock-adapter`) | the 401 seam | The handler fires for `/users` and **not** for each of the four exempt paths; it fires for `auth/login` **without** a leading slash today (pinning `🐞 BUG-utils-admin-07`); the original error is always rethrown; a throwing handler does not replace the rejection | F4, F5, EC-01, EC-02, EC-04, `🐞 BUG-utils-admin-07` |
| 4 | Unit (same file) | workspace header | `setActiveWorkspaceId('w1')` adds `X-Workspace-Id: w1` to the next request; `setActiveWorkspaceId(null)` removes it — the interceptor has **no** direct coverage anywhere today | F2, F3 |
| 5 | `apps/admin-e2e` | `apps/admin-e2e/src/content/unsaved-changes-multi.spec.ts` | With an entry editor **and** the copilot dock both dirty, confirming navigation away from the editor leaves the dock still guarded. Currently fails | `🐞 BUG-utils-admin-03`, EC-26 |
| 6 | `apps/admin-e2e` | `apps/admin-e2e/src/content/unsaved-changes-branches.spec.ts` | Each interception branch: plain click prompts; `⌘`-click, middle-click, `download`, `target=_blank`, external origin, same-URL and `#main-content` all do **not**; `Esc` cancels and keeps the edits; after confirming, `goBack()` then `goForward()` round-trip correctly (expected to fail — `🐞 BUG-utils-admin-04`) | F25, F26, F29, EC-27–EC-34 |
| 7 | Unit (`.../lib/queryClient/__test__/index.spec.ts`) | client defaults | A query failing with a 404 is **not** retried; a 500 is retried at most twice; `refetchOnWindowFocus` is an explicit value. Currently fails — the client has no defaults at all | `🐞 BUG-utils-admin-02`, EC-09 |
| 8 | `apps/admin-e2e` | `apps/admin-e2e/src/auth/session-lost-announcement.spec.ts` | ♿ When a `401` forces a sign-out, a status message is announced through the toast live region **and** focus lands on the sign-in form's heading. Currently fails | `♿ A11Y-utils-admin-01` |
| 9 | Unit (`.../lib/slot/__test__/index.spec.ts`) | slot immutability | `getItems()` returns a value the caller cannot use to mutate the slot (sorting the result leaves `getItems()` unchanged); registering the same items twice duplicates them (pinning EC-14 as known); `byOrder` never mutates its input | `🐞 BUG-utils-admin-05`, F13, EC-13, EC-14, EC-17 |
| 10 | Unit (`.../lib/initials/__test__/index.spec.ts` and `.../lib/slugify/__test__/index.spec.ts`) | text helpers | `initialsOf('😀 Smith')` returns a valid grapheme, `initialsOf('')` returns a defined fallback, `initialsFromEmail('@x.com')` likewise; `slugify` covers accents, `ß`, CJK-only (empty), emoji-only (empty), whitespace-only and a length bound | `🐞 BUG-utils-admin-06`, F14, F21, EC-37–EC-42 |
| 11 | Unit (`.../lib/unsavedChanges/__test__/index.spec.tsx`) | guard mechanics | `confirmNavigation` runs `proceed` immediately when clean and defers it when dirty; `useUnsavedChanges` clears its key on unmount and handles a changing `key`; `useUnsavedChangesApi` returns `null` with no provider; `beforeunload` is bound only while dirty | F27, F28, F30, F31, EC-33, EC-35 |
| 12 | Unit (`.../lib/avatarColor/__test__/index.spec.ts`) | avatar colour | `avatarColorForId` is deterministic, always returns a palette member, and gives **different** results for `'ab'` and `'ba'` (currently fails); `asAvatarColor` narrows correctly and falls back to `slate` | `🐞 BUG-utils-admin-08`, F22, F23, EC-43 |
