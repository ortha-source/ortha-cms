# @ortha-cms/api-tokens-admin

The admin-side plugin for managing **external-API bearer tokens**. It contributes
a single global page at `/api-tokens` — reachable from the main sidebar's
`directory` group (next to Workspaces and Members), **not** a workspace-scoped
page — where an admin lists, creates, and revokes the tokens used to authenticate
the external content API (`/api/v1/...`).

Layered per ADR-0003, mirroring `@ortha-cms/users-admin`:

```
domain/types/           view-model contracts (ApiToken, WorkspaceOption) — pure TS
infrastructure/
  apiTokenGateway/      the PORT the presentation talks to
  httpApiTokenGateway/  the impl — the ONLY apiClient user
  apiTokenMapper/       wire→view anti-corruption mapper (+ derived status)
  apiTokensKeys/        query-key factory + list params
application/
  useApiTokens/         list read hook (enabled on `tokens:read`)
  useWorkspaceOptions/  workspace-selector data (GET /api/workspaces)
  useApiTokensMutation/ create + revoke mutations (invalidate apiTokensKeys.all)
presentation/
  pages/ApiTokensPage/  the routed page (list/create/revoke/reveal + states)
  components/           table, create dialog, reveal-secret dialog, empty/skeleton/no-access
  apiTokensPlugin/      the AdminPlugin factory (route + SIDEBAR_NAV_SLOT item)
```

## Key behaviours

- **Global, not workspace-scoped.** The page lives in `SIDEBAR_NAV_SLOT`
  (`group: 'directory'`, `order: 30`), gated on `tokens:read`. The token's target
  workspace is chosen in the **create dialog** (a selector fed by
  `GET /api/workspaces`), so the page needs no active workspace.
- **Reveal-once secret.** The create response carries the plaintext `secret`
  exactly once; `RevealSecretDialog` shows it with copy-to-clipboard and a
  "won't be shown again" warning. It is held only in page state and never
  re-fetched.
- **Permission mirror.** Create/revoke controls gate on
  `tokens:create`/`tokens:delete`, matching the server `PERMISSIONS` keys exactly
  (a typo silently hides/mis-shows UI).

## Server contract this plugin depends on

- `GET /api/api-tokens?page=&pageSize=&workspaceId=` → `{ items, total, page, pageSize }`
- `POST /api/api-tokens` `{ name, workspaceId, scope, expiresAt? }` → token + one-time `secret`
- `DELETE /api/api-tokens/:id` → 204
- `GET /api/workspaces` → `{ id, name, description, color }[]`

All are served by `@ortha-cms/identity-server`'s `ApiTokensController`.

## Commands

- `npx nx typecheck @ortha-cms/api-tokens-admin`
- `npx nx lint @ortha-cms/api-tokens-admin`
