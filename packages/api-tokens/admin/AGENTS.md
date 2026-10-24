# @orthacms/api-tokens-admin

The admin-side plugin for managing **external-API bearer tokens**. It contributes
a single global page at `/api-tokens` — reachable from the main sidebar's
`directory` group (next to Workspaces and Members), **not** a workspace-scoped
page — where an admin lists, creates, and revokes the tokens that authenticate
the external content API (`/api/v1/...`). This package and the
`identity-server` endpoints behind it are the token **lifecycle**; the public
API those tokens are spent against lives in `@orthacms/content-server`
(`public-api/`).

Layered per ADR-0003, mirroring `@orthacms/users-admin`:

```
domain/types/           view-model contracts (ApiToken, ApiTokenSummary, WorkspaceOption) — pure TS
domain/apiTokenExpiry/  expiry presets, the 30-day expiring-soon window, days-until — pure TS
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
  pages/ApiTokensPage/  the routed page (chips/search/list/create/revoke/reveal + states)
  components/           table, status chips, create dialog (WorkspacePicker, AccessChoice),
                        reveal-secret dialog, revoke dialog, empty/no-match/skeleton/no-access
  apiTokensPlugin/      the AdminPlugin factory (route + SIDEBAR_NAV_SLOT item)
```

## Key behaviours

- **The list (R7 redesign).** Each row names who created the token
  (`createdBy.name`, falling back to the email) and when; the workspace bucket
  is shown as initials tiles (named in `sr-only` text and `title`); a live token
  expiring within **30 days** (`EXPIRING_SOON_DAYS`, mirroring the server) reads
  "Expires soon" with an "in N days" countdown. **Active / Expired / Revoked**
  chips filter server-side (`?status=`), Active is the default, and each chip
  counts from the response's `summary` (which ignores the status and search
  filters). The search box filters by name or display prefix (`?q=`). Page,
  status and search all live in the URL (`useTableUrlState`). The subtitle reads
  the summary: "N active, M expires in D days". An empty _view_ of a deployment
  that has tokens gets `ApiTokensNoMatch` (per status, or "No tokens match …"
  with Clear search) — never the first-token `ApiTokensEmpty`. **New token**
  lives in the top bar (`PageActionsPortal`).
- **Create.** Workspaces are chips with a remove button plus an "Add a
  workspace…" combobox (`WorkspacePicker`, the plugin's own — its popover is
  named by the field label); access is two radio cards (`AccessChoice`); the
  expiry is a `SegmentedControl` preset (**30 days by default**) whose hint
  turns it into a date. The name is capped at the server's 120 characters.
- **Revoke** is a page-owned `RevokeApiTokenDialog` that says what will break:
  when the token was last used, on which workspaces, and — for a full-access
  token — that writes stop too. It stays open with a busy confirm until the
  request settles.

- **Global, not workspace-scoped.** The page lives in `SIDEBAR_NAV_SLOT`
  (`group: 'directory'`, `order: 30`), gated on `tokens:read`. The token's target
  workspaces are chosen in the **create dialog** (a `MultiSelect` fed by
  `GET /api/workspaces`), so the page needs no active workspace.
- **A token spans one or more workspaces.** `workspaceIds` is a list, not a
  scalar: the dialog requires at least one (matching the server's 400 on an
  empty bucket) and the table renders the bucket as one badge per workspace. A
  consumer names which workspace a request targets with `X-Workspace-Id`; a
  single-workspace token needs no header.
- **Reveal-once secret.** The create response carries the plaintext `secret`
  exactly once; `RevealSecretDialog` shows it with copy-to-clipboard, a
  ready-to-run **Try it** request (`curl <origin>/api/v1/content-types` with the
  `Authorization` and `X-Workspace-Id` headers; the secret shown elided, the
  full command copied by **Copy request**, which also counts as copying the
  secret), a one-line summary of what was minted, and a "can't be shown again"
  callout. Four things about it are load-bearing, and
  each mirrors the equivalent one-time invite link in `users/admin`
  (`InviteLinkPanel` / `InviteLinkDialog`):
    - the secret is a **labelled, focusable `readOnly` input** that selects
      itself on focus — not a `<code>` block — so it can be read and copied
      without the Copy button;
    - the clipboard write is wrapped in `try`/`catch`; a refused write (insecure
      origin, denied permission, unfocused document) toasts "select it manually"
      rather than doing nothing;
    - **every** dismissal path (Done, Esc, the overlay, the close button) asks
      before discarding an uncopied secret;
    - `useCreateApiToken` sets **`gcTime: 0`** and the page calls `reset()` on
      dismissal _and_ on unmount. TanStack keeps a settled mutation — including
      its result, which holds the plaintext — for `gcTime` after the last
      observer detaches, and the mutation cache is not scoped to a route. At the
      default the credential would outlive the dialog by five minutes and follow
      the user across the SPA. `reveal-secret.spec.ts` pins this.
- **The page number lives in the URL** (`?page=`), like `/users` and
  `/activity`, so a list page is linkable and survives a reload; the clamp pulls
  a hand-typed out-of-range page back to the last one.
- **Permission mirror.** Create/revoke controls gate on
  `tokens:create`/`tokens:delete`, matching the server `PERMISSIONS` keys exactly
  (a typo silently hides/mis-shows UI).

## Server contract this plugin depends on

- `GET /api/api-tokens?page=&pageSize=&workspaceId=&status=&q=` →
  `{ items, total, page, pageSize, summary }` (`workspaceId` matches tokens whose
  bucket _contains_ it; `status` is `active|expired|revoked`; `q` searches the
  name and display prefix; every item carries `createdBy`; `summary` is
  `{ active, expired, revoked, expiringSoon, nextExpiresAt }` over the workspace
  filter only)
- `POST /api/api-tokens` `{ name, workspaceIds, scope, expiresAt? }` → token + one-time `secret`
- `DELETE /api/api-tokens/:id` → 204
- `GET /api/workspaces` → `{ id, name, description, color }[]`

All are served by `@orthacms/identity-server`'s `ApiTokensController`.

## Commands

- `npx nx typecheck @orthacms/api-tokens-admin`
- `npx nx lint @orthacms/api-tokens-admin`
