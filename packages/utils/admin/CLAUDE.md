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
  `axios`, so base URL, credentials, and future interceptors (e.g. a global
  `401` → redirect, added with auth gating) have a single home.
- `queryClient` — the app's single TanStack Query `QueryClient`. The host wires
  it into `QueryClientProvider`; plugins use `useQuery`/`useMutation`.
- `ApiError` / `toApiError(error)` — a normalized transport error carrying
  `status: number | null` (`null` for a network failure). `toApiError` unwraps
  an axios error so call sites never touch axios internals. **Transport only** —
  it carries the status, not domain meaning; the consumer decides what a code
  means (e.g. identity treats `401` as invalid credentials).
- `HTTP_STATUS` — named status codes (`UNAUTHORIZED`, `FORBIDDEN`,
  `TOO_MANY_REQUESTS`) so call sites branch on `HTTP_STATUS.UNAUTHORIZED`, not a
  bare `401`.

> Auth state is **not** here — context, gate, and `/auth/me` all live in
> `@ortha-cms/identity-admin`. This package stays a pure HTTP/data leaf (no
> `react` dependency).

## Layout

- One concern per folder, each an `index.ts`: `src/lib/apiClient/`,
  `src/lib/queryClient/`, `src/lib/apiError/`, `src/lib/httpStatus/`. The package
  surface is `src/index.ts`.

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
