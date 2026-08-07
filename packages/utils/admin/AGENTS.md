# @ortha-cms/utils-admin

Shared **admin frontend library** — the cross-plugin data/HTTP layer. Not a
plugin (it contributes no routes or module) and not the host: it's a small leaf
package that both the host and feature plugins import, so shared client
singletons live in one place instead of inside `bootstrap-admin`.

## Package

- Name: `@ortha-cms/utils-admin`
- Import: `import { apiClient, queryClient } from '@ortha-cms/utils-admin'`
- Grouped package (`packages/utils/admin`), admin-only. Consumed from source
  (`exports` → `./src/index.ts`); no build step.

## Key exports

- `apiClient` — the shared axios instance (`baseURL: '/api'`, `withCredentials`).
  Plugins call it (`apiClient.post('/auth/login', …)`) instead of importing
  `axios`, so base URL, credentials, and interceptors have a single home: the
  `X-Workspace-Id` request header and the global `401` handling below.
- `setUnauthorizedHandler(fn | null)` — installs the callback the response
  interceptor fires when the API answers `401` to a request that expected a live
  session (revoked, expired, or the account suspended mid-visit). The transport
  seam lives here; the **auth state it flips does not** — `identity-admin`'s
  `AuthProvider` registers a handler that drops the cached current user, so the
  route gate redirects to sign-in. That inversion is what keeps this leaf from
  depending on the identity plugin. The interceptor always rethrows, so a
  caller's own error handling still runs, and it skips the paths where a `401`
  is the endpoint's own answer (`/auth/login`, `/auth/logout`, `/auth/me`,
  `/auth/invite`) — a rejected sign-in must not read as a lost session.
- `queryClient` — the app's single TanStack Query `QueryClient`. The host wires
  it into `QueryClientProvider`; plugins use `useQuery`/`useMutation`.
- `ApiError` / `toApiError(error)` — a normalized transport error carrying
  `status: number | null` (`null` for a network failure) and `details` (the
  parsed response body when the server responded, else `undefined`). `toApiError`
  unwraps an axios error so call sites never touch axios internals. **Transport
  only** — it carries the status + raw body, not domain meaning; the consumer
  decides what a code means and narrows `details` to its endpoint's error shape
  (e.g. identity treats `401` as invalid credentials; content-admin reads a
  422's `details.issues` to map field errors).
- `HTTP_STATUS` — named status codes (`UNAUTHORIZED`, `FORBIDDEN`,
  `TOO_MANY_REQUESTS`) so call sites branch on `HTTP_STATUS.UNAUTHORIZED`, not a
  bare `401`.
- `STALE_TIME` — named TanStack Query `staleTime` presets in ms
  (`None`/`Short`/`Standard`/`Forever`) so data hooks pass
  `staleTime: STALE_TIME.Standard` instead of a bare `60_000`. The same few
  durations recur across plugins' hooks; one source keeps "how long is reference
  data fresh?" a single decision.
- `createSlot<T>(name)` / `Slot<T>` / `SlotContribution<T>` — the plugin
  extension-point primitive. A slot is a named, shared list: a consumer creates
  it and reads `getItems()`, plugins contribute items via the host, and the host
  wires contributions in once at boot. Pure data (no `react`), so it lives in
  this leaf rather than the host. The *generic* mechanism only — concrete slots
  (e.g. the shell's `SIDEBAR_NAV_SLOT`) are defined by their owning plugin.

- `slugify(input)` — derives a URL slug (`^[a-z0-9-]+$`) from free text. Pure,
  framework-free.
- `useDebouncedValue(value, delayMs)` — a generic debounce hook. Cross-plugin
  helpers like this live here rather than inside a feature; it's why the package
  takes a `react` dependency (alongside the `@tanstack/react-query` it already
  uses). Keep only **generic, framework-level** hooks here — feature/auth state
  stays in its owning plugin.

> Auth state is **not** here — context, gate, and `/auth/me` all live in
> `@ortha-cms/identity-admin`. This package is the shared HTTP/data + generic
> utility leaf, not a home for feature state.

## Layout

- One concern per folder, each an `index.ts`: `src/lib/apiClient/`,
  `src/lib/queryClient/`, `src/lib/staleTime/`, `src/lib/apiError/`,
  `src/lib/httpStatus/`, `src/lib/slot/`. The package surface is `src/index.ts`.

## Architecture

- **Leaf, not host.** The host (`@ortha-cms/bootstrap-admin`) imports
  `queryClient` to mount the provider; plugins import `apiClient`. Keeping these
  here (rather than in the host) means a plugin never has to depend on the
  composition root just to make a request.
- **Admin-only.** There is no server counterpart — the server doesn't call its
  own API. Genuinely cross-cutting _types_ shared with the server would warrant
  a separate type-only package, not a mirrored `utils-server`.

## Conventions

- `type` over `interface`; JSDoc on exports; `import type` for type-only imports
- Each module is a `camelCase` folder with an `index.ts` (`apiClient/index.ts`)

## Commands

- `npm exec nx typecheck @ortha-cms/utils-admin`
- `npm exec nx lint @ortha-cms/utils-admin`
