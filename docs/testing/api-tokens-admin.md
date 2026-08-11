# @ortha-cms/api-tokens-admin — Test Artifact

> **Unit:** `packages/api-tokens/admin` · **Package:** `@ortha-cms/api-tokens-admin` · **Kind:** admin plugin
> **Source of truth:** `packages/api-tokens/admin/AGENTS.md`
> **Findings verified:** 2026-08-11 — 12 confirmed · 0 deleted · 6 corrected · 1 unverified
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

One global page at `/api-tokens` where an admin lists, creates and revokes the bearer
tokens that authenticate the external content API (`/api/v1/...`). It contributes a single
`SIDEBAR_NAV_SLOT` entry in the `directory` group, gated on `tokens:read`.

**It is workspace-agnostic.** The page lives in the global sidebar; a token's target
workspaces are chosen in the create dialog from `GET /api/workspaces`.

It does **NOT** own:

- The token model, the hashing, or the `tokens:*` permissions — those are
  `@ortha-cms/identity-server`'s `api-tokens/` feature.
- The public content API the tokens are spent against — `@ortha-cms/content-server`'s
  `public-api/` and `@ortha-cms/content-graphql`.
- `X-Workspace-Id` selection. The dialog's hint mentions the header
  (`CreateApiTokenDialog/index.tsx:56-60`); enforcement is entirely server-side.
- Any authorization decision. `useHasPermission` hides affordances only.

### Entry points

| Route | Component | Gated on |
| --- | --- | --- |
| `/api-tokens` | `presentation/pages/ApiTokensPage` | `tokens:read` (else a no-access state, and no fetch) |

**API surface consumed** (`infrastructure/httpApiTokenGateway/index.ts`):

- `GET /api/api-tokens?page&pageSize[&workspaceId]` → the list envelope
- `POST /api/api-tokens` `{ name, workspaceIds, scope, expiresAt? }` → token + one-time `secret`
- `DELETE /api/api-tokens/:id` → 204
- `GET /api/workspaces` → the workspace selector's options (via `useWorkspaceOptions`)

### Runtime prerequisites

- Signed in as an **`admin`**. `tokens:read` / `tokens:create` / `tokens:delete` are
  granted to `admin` alone (`packages/identity/server/src/lib/rbac/system-roles.ts:76-105`), so
  every other role sees the no-access state — and the sidebar entry is hidden.
- At least two workspaces exist, so the multi-workspace bucket can be exercised.
- Seed data worth having before testing: one `active` token, one `expired`
  (`expires_at` in the past), one `revoked`, and one token bucketed to two workspaces.
- **A secure origin.** `navigator.clipboard.writeText` is unavailable on plain `http://`
  except on `localhost`; this matters for 🐞 BUG-api-tokens-admin-01.

### How to exercise it manually

```bash
docker compose up -d && npx nx run server:db:migrate && npm run dev
open http://localhost:4200/api-tokens
```

To confirm a minted token actually works:

```bash
curl -s http://localhost:3000/api/v1/entries/posts \
  -H "Authorization: Bearer orthacms_<secret>" \
  -H "X-Workspace-Id: <one of its bucket>"
```

### Dependencies that must be healthy

`@ortha-cms/identity-admin` (`useHasPermission`), `@ortha-cms/shell-admin`
(`PageTopBar`, `SIDEBAR_NAV_SLOT`), `@ortha-cms/design-system` (`Table`, `Dialog`,
`ConfirmDialog`, `DropdownMenu`, `MultiSelect`, `Select`, `Label`, `Input`, `toast`),
`@ortha-cms/utils-admin` (`apiClient`, `toApiError`), and the workspaces API for the
selector.

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | `/api-tokens` route + sidebar entry, gated on `tokens:read` | `presentation/apiTokensPlugin/index.tsx:41` | ❌ NONE |
| F2 | Token table: name, workspaces, prefix, access, status, expires, last used | `presentation/components/ApiTokensTable/index.tsx:99-274` | ❌ NONE |
| F3 | Status derived client-side (`revoked` > `expired` > `active`) | `infrastructure/apiTokenMapper/index.ts:25-33` | ❌ NONE |
| F4 | Workspace ids resolved to names, falling back to the raw id | `pages/ApiTokensPage/index.tsx` (`resolveWorkspaceName`) | ❌ NONE |
| F5 | Four page states: skeleton / error+Retry / empty / table | `ApiTokensPage/index.tsx:168-232` | ❌ NONE |
| F6 | No-access state without `tokens:read`, and **no fetch** | `ApiTokensPage/index.tsx:106-126`, `components/ApiTokensNoAccess` | ❌ NONE |
| F7 | Create dialog: name, multi-workspace select, scope, expiry preset | `components/CreateApiTokenDialog/index.tsx:103-270` | ❌ NONE |
| F8 | Expiry presets (never / 30 / 90 / 365 days) → ISO | `CreateApiTokenDialog/index.tsx:89-95` | ❌ NONE |
| F9 | Reveal-once secret dialog with copy-to-clipboard | `components/RevealSecretDialog/index.tsx:51-131` | ❌ NONE |
| F10 | Revoke behind a confirm dialog naming the token | `ApiTokensTable/index.tsx:276-296` | ❌ NONE |
| F11 | Per-row busy state during a revoke (`revokingId`) | `ApiTokensTable/index.tsx:289`, `ApiTokensPage/index.tsx:196-200` | ❌ NONE |
| F12 | Revoke is offered only on an `active` token | `ApiTokensTable/index.tsx:239` | ❌ NONE |
| F13 | Local (non-URL) pagination, clamped after a mutation | `ApiTokensPage/index.tsx:100-104,209-232` | ❌ NONE |
| F14 | Create/revoke errors surface as toasts | `ApiTokensPage/index.tsx:135,141` | ❌ NONE |
| F15 | Mutations invalidate `apiTokensKeys.all` | `application/useApiTokensMutation/index.ts` | ❌ NONE |
| F16 | Workspace options fetched once for the page | `application/useWorkspaceOptions/index.ts` | ❌ NONE |
| F17 | `toApiToken` / `toCreatedApiToken` mappers (dates, status, secret pass-through) | `infrastructure/apiTokenMapper/index.ts:36-56` | ❌ NONE |
| F18 | Row action menu named per token ("Actions for {name}") | `ApiTokensTable/index.tsx:246-249` | ❌ NONE |

## 3. Manual Test Plan

Base `http://localhost:4200/api-tokens`, signed in as an **admin**.

Every feature in this unit is `❌ NONE`, so §3 is the **only** executable specification
that exists for it — there is no admin-e2e directory for `api-tokens` at all
(`ls apps/admin-e2e/src` → activity, auth, content, copilot, home, insights, media, shell,
support, users, workspaces). Treat this section as the regression suite until §7 lands.

### F1 — Route and nav entry

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | As an admin, open the sidebar | an "API tokens" entry in the **directory** group, beside Workspaces and Members |
| 2 | Activate it | `/api-tokens` renders with `<h1>` from `ContainerHeader` |
| 3 | As a `contributor` or `viewer` | the entry is **absent** from the sidebar |
| 4 | As a `viewer`, type `/api-tokens` directly | the no-access state, and **zero** requests to `/api/api-tokens` in the Network tab |
| 5 | Signed out | redirected to `/identity/signin` by `RequireAuth` |

**Keyboard-only path:** Tab from the skip link into the sidebar nav → arrow/Tab to "API
tokens" → Enter.
**Screen reader:** the nav entry announces as a link inside the sidebar's landmark.

### F2 / F3 / F4 — The table

**Preconditions:** four tokens — one active, one expired, one revoked, one bucketed to two
workspaces.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Look at the header row | Name, Workspaces, Token, Access, Status, Expires, Last used, and an actions column |
| 2 | Inspect the Token column | the **`lookupPrefix`** only (e.g. `orthacms_ab12cd`) — never a full secret |
| 3 | Inspect Access | "Read-only" or "Full" |
| 4 | Inspect Status | "Active" / "Expired" / "Revoked" badges with distinct variants |
| 5 | On a token whose `revoked_at` is set **and** whose `expires_at` is past | it reads **Revoked** — revocation wins |
| 6 | On a token with `expires_at: null` | Expires reads "Never" |
| 7 | On a token never used | Last used reads "Never" |
| 8 | On the two-workspace token | both workspace **names** are shown |
| 9 | Delete one of those workspaces server-side and reload | the orphaned id falls back to the raw uuid (`workspaceNames.get(id) ?? id`) |

**Keyboard-only path:** Tab into the table; only the row action buttons are stops.
**Screen reader:** the table announces via `aria-label="API tokens"`
(`ApiTokensTable/index.tsx:121`); every header is `scope="col"`.

### F5 / F6 — Page states

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Throttle the network and load the page | a skeleton table inside a `role="status"` region announcing the load, with the sketch `aria-hidden` |
| 2 | Force `GET /api/api-tokens` to 500 | a destructive `role="alert"` with a **Retry** button — **not** the empty state |
| 3 | Press Retry with the API restored | the table renders |
| 4 | Point at a deployment with no tokens | the empty state, with a "Create" action if you hold `tokens:create` |
| 5 | Same as a role holding `tokens:read` but not `tokens:create` | the empty state with **no** create action |
| 6 | Without `tokens:read` | the no-access state, no request |

### F7 / F8 — Create a token

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Press **New API token** | a dialog titled "New API token", described "The token grants API access to the content of every workspace you pick." |
| 2 | Observe initial focus | the **Name** field is focused (`autoFocus`) |
| 3 | Leave every field empty and submit | the submit should be blocked — confirm whether it is disabled or the request 400s |
| 4 | Enter a name, pick **one** workspace, Access "Read-only", Expires "Never" → **Create token** | `POST /api/api-tokens` with `{ name, workspaceIds:[…], scope:'read' }` and **no** `expiresAt` |
| 5 | Repeat with Expires "30 days" | the body carries an ISO `expiresAt` ≈ now + 30 days |
| 6 | Pick **two** workspaces | `workspaceIds` has both, in selection order |
| 7 | Read the workspaces hint | "Pick one or more. A request names the workspace it targets with the X-Workspace-Id header." |
| 8 | Submit with **zero** workspaces | the server 400s (`@ArrayNotEmpty`) → the create error toast. Confirm the dialog does not close and lose the entered name |
| 9 | Enter a 121-character name | the server 400s (`@MaxLength(120)`) → the error toast |
| 10 | Force the POST to fail | toast "…" from `messages.createError`; the dialog **closes anyway**? Verify — `onSuccess` closes it, `onError` only toasts, so it should stay open |
| 11 | Press **Cancel** or **Esc** | the dialog closes with nothing sent |

**Keyboard-only path:** Enter on "New API token" → focus lands on Name → Tab → the
workspaces `MultiSelect` (Enter/Space opens, arrows move, Enter toggles, Esc closes the
popover **without** closing the dialog) → Tab → Access `Select` → Tab → Expires `Select` →
Tab → Cancel → Tab → Create token → Enter. **Esc must close the dialog and return focus to
the "New API token" button.**
**Screen reader:** Name announces its label via `htmlFor`; the Access and Expires selects
announce **without a label** → ♿ A11Y-api-tokens-admin-02.

### F9 — The reveal-once secret

**This is the highest-stakes interaction in the unit: the plaintext is returned by the API
exactly once and is never re-fetchable
(`packages/identity/server/src/lib/api-tokens/application/api-token.service.ts:87-101`).**

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Complete a create | the create dialog closes and a second dialog opens: "Copy your API token" |
| 2 | Read the description | "This is the only time the token is shown. Store it somewhere safe — you won't be able to see it again." |
| 3 | Read the warning alert | "Treat this token like a password. Anyone with it can read this workspace's content." |
| 4 | Look at the secret | rendered in a `<code>` block that is **truncated** — the full value is not visible |
| 5 | Try to select the secret **with the keyboard alone** | **you cannot** — it is a non-focusable `<code>` element → 🐞 BUG-api-tokens-admin-02 |
| 6 | Press **Copy** | the icon flips to a tick and a toast reads "Copied to clipboard"; paste elsewhere to confirm the value |
| 7 | Deny clipboard permission in the browser, then press Copy | **nothing happens** — no toast, no tick, no error → 🐞 BUG-api-tokens-admin-01 |
| 8 | Load the admin over plain `http://` on a non-localhost host and press Copy | same silent failure |
| 9 | Press **Done** | the dialog closes and the secret is gone forever |
| 10 | Press **Esc** or click the overlay instead | same — the secret is discarded with no warning |
| 11 | Reload and look for the token in the table | present, but only its `lookupPrefix`; the secret is unrecoverable |

**Keyboard-only path:** after create, focus should enter the dialog. Tab → **Copy** (the
first stop — the secret itself is skipped) → Tab → **Done** → Enter. Esc closes.
**Screen reader:** the dialog's accessible name is "Copy your API token"; the description
is read. The secret is plain text inside the dialog, so it is reachable in browse mode but
is announced as an unlabelled 50-character string with no context.

### F10 / F11 / F12 — Revoke

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open the kebab on an **active** token | a single destructive item, "Revoke" |
| 2 | Open the kebab on an **expired** or **revoked** token | **no kebab at all** — the cell is empty |
| 3 | As a role without `tokens:delete` | the whole actions column is absent |
| 4 | Select **Revoke** | a confirm dialog: "Revoke this token?" / "Any app using "{name}" will immediately lose access. This can't be undone." |
| 5 | Confirm | `DELETE /api/api-tokens/:id`; the row's status flips to Revoked; the kebab disappears |
| 6 | Immediately call the public API with that bearer | `401` — revocation is effective on the next request, with no cache TTL |
| 7 | During the request, watch the row | the confirm button shows a busy state and cannot double-submit |
| 8 | Force the DELETE to fail | the revoke error toast; the row is unchanged |
| 9 | Cancel the dialog | nothing is sent |

**Keyboard-only path:** Tab to the kebab → Enter → ↓ to "Revoke" → Enter → focus moves into
the confirm dialog → Tab between Cancel and Revoke → Enter → **focus should return to a
stable anchor**; in practice the kebab it came from has just been removed
(the token is no longer `active`), so focus falls to `<body>` →
♿ A11Y-api-tokens-admin-05.

### F13 — Pagination

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | With ≤ 25 tokens | **no pager is rendered at all** (`pageCount > 1` guard) |
| 2 | With 30 tokens | "Page 1 of 2" plus Previous/Next |
| 3 | Press Next | page 2; Next disables at the last page, Previous at the first |
| 4 | Look at the URL | **unchanged** — paging is local component state, so a page cannot be shared or bookmarked, unlike `/users` and `/activity` |
| 5 | Go to page 2 with 26 tokens, revoke nothing but delete 5 server-side and refetch | the page clamps to 1 (`ApiTokensPage/index.tsx:100-104`) |
| 6 | Reload while on page 2 | you land back on page 1 |

### F15 / F16 / F17 — Cache and mappers

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Create a token | every cached list page refetches (`apiTokensKeys.all`) |
| 2 | Revoke a token | same |
| 3 | Open the create dialog twice | `GET /api/workspaces` is not refetched the second time (query cache) |
| 4 | Inspect a mapped token | `expiresAt`/`lastUsedAt`/`revokedAt` are `Date` or `null`; `createdAt` is always a `Date`; `status` is derived, never sent by the server |

## 4. Edge Cases & Negative Paths

### Empty / zero

- **EC-01 — No tokens at all.** `❌ NONE` — the empty state, with the create action gated on
  `tokens:create`.
- **EC-02 — A token whose workspace bucket is empty.** `❌ NONE` — **cannot happen** by the
  server's contract: the bucket is written in the same transaction as the token and every
  read returns them together (`packages/identity/server/src/lib/api-tokens/infrastructure/persistence/drizzle-api-token.repository.ts:51-53`).
  The mapper would render an empty Workspaces cell if it ever did.
- **EC-03 — No workspaces exist at all.** `❌ NONE` — the `MultiSelect` shows
  "No workspaces found." and the form cannot be submitted validly. Verify the message is
  not confused with a **failed** `GET /api/workspaces` (an error-vs-empty risk in the
  selector — `useWorkspaceOptions` has no error branch surfaced in the dialog).
- **EC-04 — `lastUsedAt: null`.** `❌ NONE` — "Never".
- **EC-05 — `expiresAt: null`.** `❌ NONE` — "Never". Note this is the **default** preset,
  so the easiest token to create is one that never expires.

### Boundary

- **EC-06 — Exactly 25 tokens (one full page).** `❌ NONE` — `pageCount` is 1, so no pager.
- **EC-07 — Exactly 26 tokens.** `❌ NONE` — "Page 1 of 2".
- **EC-08 — Revoke the only token on the last page.** `❌ NONE` — the clamp at
  `ApiTokensPage/index.tsx:100-104` should pull `page` back. **But revoking does not remove
  the row** — it flips the status to Revoked — so the count is unchanged and the clamp
  never fires. The clamp only matters if a row is deleted, which this API never does.
  Worth confirming the effect is a no-op rather than a flicker.
- **EC-09 — `expiresAt` exactly now.** `❌ NONE` — `statusOf` uses `<= Date.now()`
  (`apiTokenMapper/index.ts:29`), so a token expiring this instant reads **Expired** and
  loses its Revoke affordance. The server's `verify` uses the same `<=`
  (`api-token.service.ts:117`), so the two agree.
- **EC-10 — Name of exactly 120 / 121 characters.** `❌ NONE` — the server caps at 120; the
  dialog's `Input` has no `maxLength`, so 121 round-trips to a 400 and a generic toast
  rather than inline feedback.
- **EC-11 — 100 / 101 workspaces selected.** `❌ NONE` — the server caps at
  `WORKSPACE_IDS_MAX = 100`; the `MultiSelect` does not.

### Size & encoding

- **EC-12 — A very long token name.** `❌ NONE` — the Name column is not explicitly
  truncated in the markup reviewed; check it does not force horizontal overflow of the
  `overflow-hidden` table container (see ♿ A11Y-api-tokens-admin-06).
- **EC-13 — Emoji / RTL in a token name.** `❌ NONE` — it is interpolated into the confirm
  dialog's description ("Any app using "{name}"…"), so an RTL name inside an LTR sentence
  can reorder the surrounding text. Verify with a bidi override character.
- **EC-14 — `<script>` in a token name.** `❌ NONE` — React escapes it; assert it renders as
  literal text in the table cell, the kebab's `aria-label`, and the confirm description.
- **EC-15 — The secret string in a narrow viewport.** `❌ NONE` — handled deliberately:
  `min-w-0` on the row lets the unbreakable token shrink, with the reasoning commented at
  `RevealSecretDialog/index.tsx:93-99`, and the button is `shrink-0`. Good, but it means the
  secret is **visually truncated**, which is the root of ♿ A11Y-api-tokens-admin-01.

### Permission matrix

`tokens:read` / `tokens:create` / `tokens:delete` are **admin-only** in the v1 matrix.

| Surface | admin | contributor | viewer | authenticated, no grants | unauthenticated | API-token caller |
| --- | --- | --- | --- | --- | --- | --- |
| Sidebar "API tokens" entry | shown | hidden | hidden | hidden | n/a | n/a |
| `/api-tokens` page | full | no-access | no-access | no-access | redirected to sign-in | n/a |
| `GET /api/api-tokens` | 200 | 403 | 403 | 403 | 401 | **not routed** — these are session routes |
| "New API token" button | shown | hidden | hidden | hidden | n/a | n/a |
| Revoke kebab | shown | hidden | hidden | hidden | n/a | n/a |

- **EC-16 — Hidden ≠ enforced.** Every gate has a server counterpart
  (`packages/identity/server/src/lib/api-tokens/http/controllers/api-tokens.controller.ts:65,84,100`), e2e-proven at
  `apps/server-e2e/src/server/api-tokens/api-tokens-management.spec.ts:183,198`.
- **EC-17 — Can a bearer token reach these management routes?** **No** — they are
  session-authenticated and gated on `tokens:*`, which `scopePermissions` never mints
  (`api-token-scope.ts:35-49` yields only `content:*` + `media:read`/`media:create`). So a
  token cannot mint another token. Verified in code; asserted server-side.
- **EC-18 — Can a token pick a workspace outside its bucket?** Not decided in this unit —
  `X-Workspace-Id` validation lives in `content-server`'s `public-api/`. The admin only
  *chooses* the bucket. Covered by
  `apps/server-e2e/src/server/api-tokens/public-content-api.spec.ts`.

### Tenant isolation

- **EC-19 — Does the list leak tokens across workspaces?** The page deliberately lists
  **every** token in the deployment (no `workspaceId` filter is passed from the UI), which
  is correct: only admins can see it, and admins are global. The server's `?workspaceId=`
  filter exists but this page never uses it.
- **EC-20 — Can an admin mint a token for a workspace they are not a member of?** **Yes** —
  the selector is fed by `GET /api/workspaces`, which lists what the admin can see, and the
  server performs **no** membership or existence check on `workspaceIds`
  (cross-referenced as 🐞 BUG-identity-server-06). Admin-only, so low risk.

### Concurrency

- **EC-21 — Double-submit the create form.** `❌ NONE` — `submitting` is threaded into the
  dialog; verify the submit button is actually disabled by it, otherwise two tokens are
  minted and only the **second** secret is revealed (`setSecret` overwrites), silently
  orphaning the first.
- **EC-22 — Double-confirm a revoke.** `❌ NONE` — `busy={pending !== null && revokingId === pending.id}`
  guards the confirm button (`ApiTokensTable/index.tsx:289`), and `setPending(null)` runs
  immediately on confirm, so the dialog closes. Second call would 204 anyway (idempotent).
- **EC-23 — Two admins revoke the same token.** `❌ NONE` — the second `DELETE` returns 204
  with `false` from the repository; both UIs show success. Correct.

### State after mutation

- **EC-24 — After a create, does the new row appear?** `❌ NONE` — `apiTokensKeys.all` is
  invalidated, so page 1 refetches. But the list is `desc(createdAt)`, so the new token is
  first on page 1 — and if the admin is on page 2, they will not see it.
- **EC-25 — After a revoke, does the row update in place?** `❌ NONE` — the row stays, with
  status Revoked and no kebab.
- **EC-26 — Does the reveal dialog survive a background refetch?** `❌ NONE` — the secret is
  in `ApiTokensPage`'s own state (`secret`), not in the query cache, so an invalidation
  cannot clear it. Correct.

### Failure & partiality

- **EC-27 — `GET /api/api-tokens` 500.** `❌ NONE` — a distinct error state with Retry
  (`ApiTokensPage/index.tsx:170-186`), correctly not the empty state.
- **EC-28 — `GET /api/workspaces` 500.** `❌ NONE` — `useWorkspaceOptions` has no surfaced
  error branch, so the `MultiSelect` shows "No workspaces found." — an **error masquerading
  as empty**, and the admin cannot tell that the list failed rather than being genuinely
  empty. Compare `UserPreferencesPage/index.tsx:178-185`, which gets this right.
- **EC-29 — `POST /api/api-tokens` fails.** `❌ NONE` — a toast; `onSuccess` (which closes
  the dialog and sets the secret) does not run, so the form should stay open with its
  values. Verify.
- **EC-30 — The clipboard write rejects.** `❌ NONE` — **unhandled** → 🐞 BUG-api-tokens-admin-01.
- **EC-31 — The browser navigates away while the reveal dialog is open.** `❌ NONE` — the
  secret is lost with no `beforeunload` guard.

### Idempotency & replay

- **EC-32 — Reload after a create.** `❌ NONE` — the token exists; the **secret is gone**.
- **EC-33 — Browser Back from the reveal dialog.** `❌ NONE` — the dialog is not a route, so
  Back leaves the page entirely and the secret is lost.
- **EC-34 — Replay a revoke.** `❌ NONE` — no affordance (the kebab is gone), and the API is
  idempotent regardless.

---

### 4A. Accessibility & Section 508 Conformance

**Standards tested against.** Revised Section 508 (36 CFR Part 1194, Appendices A–C)
incorporates WCAG 2.0 A + AA by reference (E205.4 electronic content, 504.2 authoring
tools). This repo's `accessibility` skill targets **WCAG 2.1 AA**, so findings are tested
to 2.1 AA with the 508 provision cited. Chapter 5 provisions assessed: **502.2/502.3**
(AT interoperability), **503.2** (user preferences), **503.4**, **504**.

**There is no axe coverage of any kind for this unit, and no keyboard suite.**
`ls apps/admin-e2e/src` has no `api-tokens` directory. So unlike `identity/admin`,
`users/admin` and `activity/admin` — each of which has at least an axe describe block —
**every state of this page is unscanned**, automated or otherwise. Nothing below was
caught by a tool; all of it is source review.

That matters especially here because the **reveal-once secret is a genuine 508 trap**: the
credential is shown exactly once, so an accessibility barrier at that moment is not an
inconvenience, it is permanent, unrecoverable data loss for the affected user.

---

#### ♿ A11Y-api-tokens-admin-01 — The one-time secret sits in a non-focusable, truncated `<code>` block with no accessible name

**SC:** 1.4.10 Reflow (AA), 2.1.1 Keyboard (A), 4.1.2 Name/Role/Value (A),
1.3.1 Info and Relationships (A)
**508:** E205.4 / 502.3.1 (Object Information) / 502.3.13 (Text)
**Verdict:** **Does Not Support**
**Location:** `packages/api-tokens/admin/src/lib/presentation/components/RevealSecretDialog/index.tsx:101-103`

```tsx
<div className="flex min-w-0 items-center gap-2">
    <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-3 py-2 font-mono text-sm">
        {secret}
    </code>
```

The secret is plain text in a `<code>` element. It has no `id`, no label, no
`tabIndex`, no `aria-label`, and `truncate` (`text-overflow: ellipsis; overflow: hidden;
white-space: nowrap`) so the value is **visually clipped**. There is no way to scroll it
into view, no way to focus it, and no way to select it with the keyboard.

The sibling implementation in this very repo does it correctly:
`packages/users/admin/src/lib/presentation/components/InviteLinkPanel/index.tsx:78-86`
renders the equivalent one-time secret as

```tsx
<input readOnly value={link}
    aria-label={intl.formatMessage(messages.linkLabel, { email })}
    onFocus={(e) => e.currentTarget.select()} … />
```

— focusable, named, and selecting its whole value on focus so Ctrl/Cmd+C works. That is the
pattern; this component predates or diverged from it.

**Repro:** create a token. With the keyboard only, try to read or select the full secret
without using the Copy button.

**Keyboard-only experience:** the secret is unreachable. Tab goes straight from the dialog
to **Copy**, then **Done**. If Copy fails (see 🐞 BUG-api-tokens-admin-01, where failure is
also *silent*), there is no fallback path at all — the credential is lost.
**Screen-reader experience:** in browse mode the user can reach the text, but it is
announced as a bare 50-character alphanumeric run with **no label** saying what it is. There
is nothing tying it to the dialog's title, and character-by-character review of an
unlabelled `<code>` is the only way to transcribe it.
**Low-vision / 400 % zoom experience:** `truncate` means most of the secret is simply not
rendered, and no amount of zooming or reflow reveals it — a direct 1.4.10 failure, because
content is lost rather than reflowed.

**Remediation:** replace the `<code>` with the `InviteLinkPanel` pattern — a `readOnly`
`<input>` with an `aria-label` ("API token secret") and `onFocus` select — or add
`tabIndex={0}`, an `aria-label`, and `break-all` instead of `truncate`.

---

#### ♿ A11Y-api-tokens-admin-02 — The Access and Expires selects have no programmatic label

**SC:** 3.3.2 Labels or Instructions (A), 4.1.2 Name/Role/Value (A), 1.3.1 (A)
**508:** E205.4 / 502.3.1 / 502.3.3 (Row, Column, and Headers) / 504.2
**Verdict:** **Does Not Support**
**Location:** `packages/api-tokens/admin/src/lib/presentation/components/CreateApiTokenDialog/index.tsx:216-234`
(Access), `:238-262` (Expires)

```tsx
<Label>{intl.formatMessage(messages.scopeLabel)}</Label>
<Select value={scope} onValueChange={…}>
    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
```

Both `<Label>` elements are rendered with **no `htmlFor`**, and the Radix `SelectTrigger`
carries no `id`. A `<label>` with neither `htmlFor` nor a wrapped control labels nothing.
The dialog gets the other two fields right — Name uses `<Label htmlFor={nameId}>` with a
matching `id` (`:169-179`), and the workspaces `MultiSelect` uses
`<Label htmlFor={workspacesId}>` plus `aria-describedby={workspacesHintId}` (`:184-204`) —
which makes the omission on the two `Select`s look like an oversight rather than a choice.

**Repro:** open the create dialog with NVDA, Tab to the Access control, and listen.

**Keyboard-only experience:** both selects are reachable and operable — Enter/Space opens,
arrows move, Enter selects, Esc closes. Operability is fine.
**Screen-reader experience:** the trigger announces only its **current value** — "Read-only,
combo box" and "Never, combo box" — with no indication of what "Read-only" or "Never" is
*about*. A user cannot tell the access-level control from the expiry control except by
guessing from the values, and "Never" is a particularly opaque orphan. This is the classic
3.3.2 failure and, because the control genuinely has no accessible name, also a 4.1.2 one.

The consequence is not cosmetic: choosing "Full access" instead of "Read-only" mints a
credential that can create, update, publish and delete content
(`packages/identity/server/src/lib/api-tokens/domain/api-token-scope.ts:39-48`).

**Remediation:** give each `SelectTrigger` an `id` from `useId()` and point the matching
`<Label htmlFor>` at it, exactly as the Name field does — or pass `aria-label` to the
trigger.

---

#### ♿ A11Y-api-tokens-admin-03 — "Copied to clipboard" is a toast, but the copy failure is announced not at all

**SC:** 4.1.3 Status Messages (AA), 3.3.1 Error Identification (A)
**508:** E205.4 / 502.3.14 (Event Notification)
**Verdict:** **Partially Supports**
**Location:** `packages/api-tokens/admin/src/lib/presentation/components/RevealSecretDialog/index.tsx:64-71`

```tsx
const copy = async () => {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    toast.success(intl.formatMessage(messages.copied));
};
```

The **success** path is handled well: sonner's `Toaster` is a live region mounted once in
`createAdmin`, so "Copied to clipboard" is announced — that half **Supports** 4.1.3. The
visual tick (`copied ? <Check /> : <Copy />`) is redundant reinforcement, which is correct.

The **failure** path does not exist. `navigator.clipboard.writeText` rejects on an insecure
origin, on a denied permission, and when the document is not focused. There is no
`try`/`catch`, so the promise rejects, `setCopied(true)` and the toast never run, and the
user gets **no signal whatsoever**. `InviteLinkPanel` catches exactly this and toasts
actionable copy — "Couldn't reach the clipboard. Select the link and copy it manually."
(`packages/users/admin/src/lib/presentation/components/InviteLinkPanel/index.tsx:64-69`).

**Repro:** deny clipboard permission (or serve over plain `http://` from a non-localhost
host), create a token, press Copy.

**Keyboard-only experience:** the button appears to do nothing. Combined with
♿ A11Y-api-tokens-admin-01 there is no alternative way to obtain the secret, so the
credential is irrecoverably lost.
**Screen-reader experience:** identical — silence. The user cannot distinguish "copied
successfully" from "failed", because only one of the two speaks.

**Remediation:** wrap in `try`/`catch` and toast an error that tells the user to select the
value manually — which also requires A11Y-01's fix, since there is currently nothing to
select. Cross-reference 🐞 BUG-api-tokens-admin-01.

---

#### ♿ A11Y-api-tokens-admin-04 — The page has no live region for list changes

**SC:** 4.1.3 Status Messages (AA)
**508:** E205.4 / 502.3.14
**Verdict:** **Partially Supports**
**Location:** `packages/api-tokens/admin/src/lib/presentation/pages/ApiTokensPage/index.tsx:155-232`

Creating a token adds a row, revoking one changes a row's status badge and removes its
kebab, and paging replaces the entire table body — all without a navigation and **without
any announcement**. There is no `role="status"` region on this page.

Two sibling pages do it correctly and are the model:
`packages/users/admin/src/lib/presentation/pages/MembersPage/index.tsx:235-241` and
`packages/activity/admin/.../ActivityLogPage` each render an `sr-only`
`role="status" aria-live="polite"` region carrying the result count, with a comment citing
WCAG 4.1.3.

Partial credit: the *mutation errors* do announce, via `toast.error`
(`ApiTokensPage/index.tsx:135,141`) into sonner's live region, and the loading skeleton
wraps a `role="status"` with an `sr-only` label
(`components/ApiTokensSkeleton/index.tsx:33-45`). The gap is the **result of a successful
change**.

**Repro:** with a screen reader, revoke a token and listen for any confirmation. There is
none — no toast on success, and no live region.

**Keyboard-only experience:** after confirming a revoke, focus is lost (A11Y-05) and the
only evidence anything happened is a badge change the user cannot see from where focus
landed.
**Screen-reader experience:** silence on success, for both create (the reveal dialog opens,
which does announce as a dialog) and revoke (nothing).

**Remediation:** add an `sr-only` polite region announcing "{n} tokens" after a refetch,
and a `toast.success` on revoke, mirroring `users/admin`.

---

#### ♿ A11Y-api-tokens-admin-05 — Focus is lost after a revoke, because the trigger it would return to has been removed

**SC:** 2.4.3 Focus Order (A)
**508:** E205.4 / 502.3.14
**Verdict:** **Does Not Support**
**Location:** `packages/api-tokens/admin/src/lib/presentation/components/ApiTokensTable/index.tsx:237-296`

The kebab is rendered **only** when `token.status === 'active'` (`:239`). Confirming a
revoke flips the status to `revoked`, so the kebab unmounts on the very re-render that
follows. Radix's `ConfirmDialog` restores focus to whatever opened it — an element that no
longer exists — and focus falls to `<body>`.

**Repro:** with the keyboard only, Tab to a token's kebab, Enter, ↓, Enter, Tab to the
confirm button, Enter. Then press Tab.

**Keyboard-only experience:** the next Tab restarts at the top of the document — past the
skip link, the sidebar, the top bar and the "New API token" button — before returning to
the table. On a page of tokens this is a full re-traversal after every revoke.
**Screen-reader experience:** the reading cursor resets to the document start, and since
there is no success announcement (A11Y-04) the user has no confirmation that the revoke
happened at all. The two findings compound into "I pressed a button, everything went quiet,
and I am now somewhere else."

**Remediation:** move focus to a stable anchor after the mutation settles — the row's Status
cell with `tabIndex={-1}`, the table container, or the page `<h1>` — and pair it with the
live-region announcement from A11Y-04.

---

#### ♿ A11Y-api-tokens-admin-06 — Reflow, dark-theme contrast and forced-colors are entirely unverified

**SC:** 1.4.10 Reflow (AA), 1.4.4 Resize Text (AA), 1.4.3 Contrast (AA),
1.4.11 Non-text Contrast (AA), 1.4.1 Use of Color (A)
**508:** E205.4 / **503.2 (User Preferences)**
**Verdict:** **Partially Supports** — unverified
**Location:** `ApiTokensTable/index.tsx:120` (`overflow-hidden rounded-xl border`),
`:78-91` (`STATUS_VARIANT`), `components/ApiTokensSkeleton/index.tsx`

Three unverified risks:

1. **Reflow.** The table has **eight** columns — the widest in the admin — inside an
   `overflow-hidden` container. At 320 px or 400 % zoom, `overflow-hidden` clips rather than
   scrolls, so the Last-used and Actions columns (including every kebab) may become
   unreachable. The `accessibility` skill requires wide content to scroll in its own
   container.
2. **Status conveyed by badge variant.** `STATUS_VARIANT` maps
   active→`default`, expired→`secondary`, revoked→`outline` (`:84-91`). Each badge also
   carries **text** ("Active" / "Expired" / "Revoked"), so 1.4.1 **Supports** — but the
   `outline` variant's border must clear 3:1 for 1.4.11, in both themes and in
   `forced-colors: active`, and nothing checks it.
3. **Dark theme.** Zero scans. `users/admin` has one dark-theme axe pass
   (`apps/admin-e2e/src/users/preferences.spec.ts:124`); this unit has none of any kind.

Also: `ApiTokensSkeleton` uses Tailwind `animate-pulse` with no `motion-reduce:` variant —
the same 503.2 gap as the auth and members skeletons.

**Repro:** load `/api-tokens` at a 320 px viewport; check whether the table scrolls or
clips. Then repeat with `data-theme="dark"` and with forced colors on.

**Keyboard-only experience:** if the kebab column is clipped, **revoke becomes unreachable
at that viewport** — which would escalate this to Does Not Support.
**Screen-reader experience:** unaffected; the DOM is intact.

**Remediation:** give the table wrapper `overflow-x: auto`; add axe scans in both themes;
add `motion-reduce:animate-none` to the skeleton; verify the `outline` badge border at 3:1.

---

#### ♿ A11Y-api-tokens-admin-07 — The workspace bucket selector is labelled and described correctly

**SC:** 3.3.2 Labels or Instructions (A), 4.1.2 Name/Role/Value (A), 1.3.1 (A)
**508:** E205.4 / 502.3.1
**Verdict:** **Supports** — pending one verification
**Location:** `CreateApiTokenDialog/index.tsx:184-204`

```tsx
<Label htmlFor={workspacesId}>{intl.formatMessage(messages.workspaceLabel)}</Label>
<MultiSelect id={workspacesId} … aria-describedby={workspacesHintId} … />
…
<p id={workspacesHintId}>{intl.formatMessage(messages.workspaceHint)}</p>
```

This is the pattern the brief asks for: a real group label ("Workspaces") tied by
`htmlFor`/`id`, plus the explanatory hint associated by `aria-describedby` rather than
merely floating nearby. The hint itself is genuinely useful — "Pick one or more. A request
names the workspace it targets with the X-Workspace-Id header."

Recorded as **Supports** deliberately, because it is the counter-example to
♿ A11Y-api-tokens-admin-02 in the *same dialog*: the two `Select`s should simply copy it.

**Verification resolved 2026-08-11 — the label half genuinely Supports.** `MultiSelect`
forwards `id` and `aria-describedby` straight onto the trigger, which is a real
`<Button role="combobox" aria-expanded>` — not a wrapper
(`packages/design-system/src/lib/components/ui/multi-select.tsx:83-92`). So `htmlFor`
associates, the hint is described, and the trigger's own content is the selected workspace
`Badge`s, meaning the current selection is read out as the combobox's value. This does not
flip to Does Not Support.

**Unverified — the *option-level* selected state inside the popover.** The check mark on a
chosen option is a `<Check aria-hidden>` toggled by `opacity-0` / `opacity-100`
(`multi-select.tsx:127-137`), i.e. the per-option selected state is conveyed **visually
only**, with nothing in the repo's own code exposing it programmatically. Whether that is
an actual 4.1.2 / 1.4.1 failure depends on what `cmdk`'s `CommandItem` emits — it renders
`role="option"` and manages `aria-selected`, but in a command palette `aria-selected`
conventionally tracks the *highlighted* row, not a multi-select choice, in which case it
would actively misreport the state. `cmdk` is not installed in this checkout
(`ls node_modules/cmdk` → nothing) and `CommandItem` is a pass-through wrapper
(`packages/design-system/src/lib/components/ui/command.tsx:136-150`), so this could not be
settled from source. **Test it against a real screen reader before trusting the Supports
verdict for the popover.** Note this is a design-system question, not an `api-tokens-admin`
one — it affects every `MultiSelect` in the repo.

**Remediation:** none for the label/description wiring. If the popover check turns out to be
visual-only, add `aria-selected` (or `aria-checked` with `role="option"`) reflecting
membership, and add an e2e assertion pinning both the trigger's accessible name and an
option's selected state so a design-system refactor cannot silently break either.

---

**a11y verdict tally: 7 findings · 1 Supports · 3 Partially Supports · 3 Does Not Support ·
0 Not Applicable.**

**WCAG 2.2 (advisory only — 508 references 2.0):** 2.4.11 Focus Not Obscured — the sticky
`PageTopBar` may overlay a focused row control when tabbing upward. 2.5.8 Target Size — the
kebab is `size-8` (32 px) and clears the 24 px minimum; **Supports**.

## 5. E2E Coverage Map

There is **no e2e coverage for this unit at any level**. Confirmed two ways:

- `ls apps/admin-e2e/src` → `activity  auth  content  copilot  home  insights  media
  shell  support  users  workspaces` — **no `api-tokens` directory**.
- `find apps/admin-e2e/src -name '*api-token*'` → nothing. There is no Page Object, no
  `page.route` seed under `apps/admin-e2e/src/support/api/`, and no axe or keyboard spec.

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F1 Route + nav entry | — | — | ❌ NONE |
| F2 Table | — | — | ❌ NONE |
| F3 Derived status | — | — | ❌ NONE |
| F4 Workspace-name resolution | — | — | ❌ NONE |
| F5 Page states | — | — | ❌ NONE |
| F6 No-access | — | — | ❌ NONE |
| F7 Create dialog | — | — | ❌ NONE |
| F8 Expiry presets | — | — | ❌ NONE |
| F9 Reveal-once secret | — | — | ❌ NONE |
| F10 Revoke + confirm | — | — | ❌ NONE |
| F11 Per-row busy state | — | — | ❌ NONE |
| F12 Revoke only when active | — | — | ❌ NONE |
| F13 Pagination + clamp | — | — | ❌ NONE |
| F14 Error toasts | — | — | ❌ NONE |
| F15 Invalidation | — | — | ❌ NONE |
| F16 Workspace options | — | — | ❌ NONE |
| F17 Mappers | — | — | ❌ NONE |
| F18 Row action naming | — | — | ❌ NONE |
| **a11y (any state)** | — | — | ❌ NONE — **no axe suite, no keyboard suite** |

**What *is* covered, one layer down.** The server contract behind this page is well tested:
`apps/server-e2e/src/server/api-tokens/api-tokens-management.spec.ts:59,80,101,115,123,154,167,183,198`
asserts mint-with-plaintext-once, multi-workspace buckets, duplicate collapsing, empty-bucket
400, per-workspace listing, past-expiry 400, revoke, the `tokens:*` permission gate, and
401 unauthenticated. `public-content-api.spec.ts` asserts that a revoked or expired bearer
is refused. So the **API is trustworthy and the UI is unverified** — the risk is
concentrated entirely in this package.

**Coverage tally: 18 features · 0 ✅ · 0 ⚠️ · 18 ❌**
**a11y coverage: none.**

## 6. 🐞 Potential Bugs

### 🐞 BUG-api-tokens-admin-01 — A failed clipboard write is unhandled, so the one-time secret is silently and permanently lost · Severity: High

> **Verified 2026-08-11 — defect confirmed at the cited lines; the `🔒` marker removed.**
> `copy` at `RevealSecretDialog/index.tsx:64-71` has no `try`/`catch`, exactly as quoted.
> `🔒` is defined in the artifact spec as an auth / authz / tenant-isolation / **data-leak**
> concern, and this is none of those — nothing is disclosed, no boundary is crossed. It is
> a `data-loss` defect that happens to involve a credential, which is what the Category
> line already says. Severity stays High: the trigger is routine (any non-`localhost`
> `http://` origin) and the loss is irreversible.

**Location:** `packages/api-tokens/admin/src/lib/presentation/components/RevealSecretDialog/index.tsx:64-71`
**Category:** data-loss

**What the code does:**

```tsx
const copy = async () => {
    if (!secret) {
        return;
    }
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    toast.success(intl.formatMessage(messages.copied));
};
```

No `try`/`catch`. `navigator.clipboard.writeText` rejects in at least four routine
situations: a non-secure origin (any `http://` host that is not `localhost`), a denied or
prompt-blocked `clipboard-write` permission, a document that does not have focus, and
Firefox's stricter user-activation requirements. On rejection the promise is unhandled,
`setCopied(true)` never runs, the toast never fires, and the button gives **no feedback of
any kind**.

**Why it is wrong:** the value being copied is a credential the server returns exactly
once. `ApiTokenService.mint` generates it, stores only its SHA-256, and returns the
plaintext in the create response and nowhere else
(`packages/identity/server/src/lib/api-tokens/application/api-token.service.ts:87-101`); every subsequent read is
secret-free by construction (`toView`, `:170-183`). The dialog's own copy says so — "This
is the only time the token is shown … you won't be able to see it again."

So the failure mode is: the admin presses Copy, sees nothing change, presses it again, sees
nothing, presses Done, and discovers on their first API call that they never had the token.
The only recovery is to revoke and re-mint.

The identical component in `users/admin` handles this correctly, with the reasoning spelled
out in a comment:

```tsx
} catch {
    // Clipboard access can be denied (insecure origin, permissions).
    // The link is selectable in the field, so say so rather than failing silently.
    toast.error(intl.formatMessage(messages.copyFailed));
}
```
(`packages/users/admin/src/lib/presentation/components/InviteLinkPanel/index.tsx:64-69`)

**Repro:**
1. Serve the admin over plain `http://` from a non-`localhost` host (or deny
   `clipboard-write` in Chrome's site settings).
2. Create a token. In the reveal dialog, press **Copy**.
→ Observed: no toast, no tick, an unhandled promise rejection in the console. Pressing Done
loses the secret. / Expected: an error toast telling the admin to select the value manually.

**Blast radius:** every self-hosted deployment behind a non-TLS reverse proxy, every user
with restrictive clipboard settings, and anyone whose browser drops document focus at the
wrong moment. The lost value is a workspace-scoped API credential, so the cost is a revoke
plus a re-mint plus redeploying whatever consumed it. It compounds with
🐞 BUG-api-tokens-admin-02: there is **no manual fallback** to fall back to.

**Suggested fix:** wrap the `writeText` in `try`/`catch` and toast the failure with
actionable copy, exactly as `InviteLinkPanel` does. Do NOT implement.

---

### 🐞 BUG-api-tokens-admin-02 — The secret cannot be selected or read manually, so there is no fallback when Copy fails · Severity: High

> **Verified 2026-08-11 — defect confirmed; the `🔒` marker removed** for the same reason as
> BUG-01 (data-loss / a11y, not auth, authz, tenant isolation or disclosure). The `<code>`
> element and its `truncate` class are at `RevealSecretDialog/index.tsx:101-103` as
> described. Severity stays High: for a keyboard-only or screen-reader user the credential
> is unobtainable **unconditionally**, not just when Copy fails.

**Location:** `packages/api-tokens/admin/src/lib/presentation/components/RevealSecretDialog/index.tsx:101-103`
**Category:** data-loss / a11y

**What the code does:**

```tsx
<code className="min-w-0 flex-1 truncate rounded-md bg-muted px-3 py-2 font-mono text-sm">
    {secret}
</code>
```

A non-interactive `<code>` element with `truncate` — `overflow: hidden`, `white-space:
nowrap`, `text-overflow: ellipsis`. The full value is neither visible nor scrollable, the
element is not focusable, and there is no `aria-label` identifying what the string is.

**Why it is wrong:** it removes the manual escape hatch. A user who cannot use the Copy
button — because it silently failed (BUG-01), because their browser blocks the Clipboard
API, or because they are keyboard-only — has no way to obtain the credential. They cannot
Tab to it, cannot select it, and cannot even see all of it.

The comment above it (`:93-99`) shows the truncation was chosen deliberately, to stop the
unbreakable token string widening the dialog past `max-w-lg`. That is a real layout problem
and the reasoning is sound — but `InviteLinkPanel` solves the *same* problem for the *same
class of secret* without losing access to the value: a `readOnly` `<input>` that is
`min-w-0 flex-1 truncate`, focusable, `aria-label`led, and `onFocus`-selecting
(`packages/users/admin/src/lib/presentation/components/InviteLinkPanel/index.tsx:78-86`). The input truncates visually
while still holding, exposing and selecting the whole value.

**Repro:**
1. Create a token.
2. Without using the Copy button, try to obtain the full secret: Tab through the dialog
   (you get Copy, then Done — the code block is never focused); try to select it by keyboard
   (impossible); read it on screen (clipped).
→ Observed: the value is unobtainable. / Expected: focusable, selectable, fully readable.

**Blast radius:** the same population as BUG-01, plus every keyboard-only and screen-reader
user unconditionally. Because the two bugs are in the same component and remove the primary
and the fallback path respectively, together they make the reveal dialog a single point of
permanent credential loss. Filed separately because either fix alone leaves a real gap:
catching the error without a selectable value tells the user to do something they cannot do,
and making it selectable without catching the error leaves them with no signal that they
need to.

**Suggested fix:** adopt the `InviteLinkPanel` shape — `readOnly` `<input>` +
`aria-label` + `onFocus={(e) => e.currentTarget.select()}`. Cross-reference
♿ A11Y-api-tokens-admin-01. Do NOT implement.

---

### 🐞 BUG-api-tokens-admin-03 — Nothing warns before the reveal dialog is dismissed uncopied · Severity: Medium

> **Verified 2026-08-11 — defect confirmed; the `🔒` marker removed** (data-loss, not a
> disclosure or authorization defect). The `copied` state at
> `RevealSecretDialog/index.tsx:62` and its reset at `:78` are exactly as described, so the
> information needed to warn really is present and discarded. The residual security-hygiene
> angle — an orphaned live, possibly non-expiring `api_tokens` row — is real but not
> exploitable: the plaintext reached nobody, so the row authenticates no one.

**Location:** `packages/api-tokens/admin/src/lib/presentation/pages/ApiTokensPage/index.tsx:252-260`,
`components/RevealSecretDialog/index.tsx:74-82`
**Category:** data-loss

**What the code does:**

```tsx
<RevealSecretDialog secret={secret} open={secret !== null}
    onOpenChange={(open) => { if (!open) { setSecret(null); } }} />
```

`onOpenChange(false)` fires identically for the **Done** button, the **Esc** key, an
**overlay click**, and the dialog's own close control. All four null the secret. The
component tracks `copied` in local state (`RevealSecretDialog/index.tsx:62`) and even
**resets it on close** (`:78`) — so the information needed to warn is present and is
discarded rather than used.

**Why it is wrong:** the dialog's description states "This is the only time the token is
shown. Store it somewhere safe — you won't be able to see it again." and then makes
dismissing it a reflex action with no guard. Esc in particular is what a user presses when
they are unsure — and here it is destructive.

`users/admin` has the same shape for invite links (🐞 BUG-users-admin-02), so this is a
repo-wide pattern rather than a one-off; it is filed in both units because the *credential*
here is longer-lived (a `full`-scope token can be non-expiring) and the recovery is more
expensive (revoke + re-mint + redeploy the consumer).

**Repro:**
1. Create a token. When the reveal dialog appears, press **Esc**.
→ Observed: the dialog closes, `secret` is nulled, the value is gone. The token row exists
and is live, but nothing can ever use it. / Expected: a confirmation such as "You haven't
copied this token yet — it can't be shown again. Close anyway?"

**Blast radius:** one orphaned, live, never-expiring credential per occurrence — a row in
`api_tokens` that authenticates nothing and that an admin must notice and clean up. Every
occurrence also requires a full re-mint cycle.

**Suggested fix:** gate `onOpenChange(false)` on `copied`, and require an explicit
confirmation otherwise. The state is already there. Do NOT implement.

---

### 🐞 BUG-api-tokens-admin-04 — A failed workspace fetch renders as "No workspaces found", so a token can be minted against the wrong bucket · Severity: Medium

**Location:** `packages/api-tokens/admin/src/lib/presentation/components/CreateApiTokenDialog/index.tsx:52-55,118,187-206`,
`packages/api-tokens/admin/src/lib/application/useWorkspaceOptions/index.ts`
**Category:** ux-state

**What the code does:** the dialog destructures **only** `data` from the query —
`const { data: workspaces = [] } = useWorkspaceOptions(open);` (`:118`) — feeds
`MultiSelect` from it, and supplies a single empty-state message:

```ts
workspaceEmpty: { defaultMessage: 'No workspaces found.' },
```

There is no `isError` branch in the dialog. A failed `GET /api/workspaces` — 500, network
drop, a proxy hiccup — leaves `data` undefined, the option list empty, and the selector
saying "No workspaces found."

**Why it is wrong:** `.cursor/BUGBOT.md` names it — *"**Error masquerading as empty.**
Distinguish a failed query from a genuinely empty result. Rendering the empty state on
error hides outages."* Here it is worse than hiding an outage: the selector is the control
that decides **what a credential can reach**. An admin who sees "No workspaces found"
reasonably concludes there are none, and either abandons the flow or — if the list
partially loads on a retry — mints a token bucketed to whatever subset happened to arrive.

The repo has the correct pattern in `packages/users/admin/src/lib/presentation/pages/UserPreferencesPage/index.tsx:174-185`,
which renders a dedicated warning when the preferences read fails, with a comment
explaining exactly this reasoning: *"A failed read gets its own state rather than being
folded into 'no preference saved': without it the picker would confidently present the
local fallback as the stored choice."*

**Repro:**
1. Make `GET /api/workspaces` return 500.
2. Press "New API token" and open the Workspaces selector.
→ Observed: "No workspaces found." / Expected: "Couldn't load workspaces — try again", with
submission blocked.

**Blast radius:** a token minted against an incomplete bucket silently cannot reach the
workspaces the admin believed they granted, producing 403s in a downstream integration that
are traced back to this dialog only with difficulty. Bounded because it needs a failing
workspaces endpoint to trigger.

**Suggested fix:** surface `useWorkspaceOptions().isError` as a distinct message and disable
submission while it holds. Do NOT implement.

---

### 🐞 BUG-api-tokens-admin-05 — Pagination is component-local, so a token list page cannot be linked, bookmarked, or survive a reload · Severity: Low

**Location:** `packages/api-tokens/admin/src/lib/presentation/pages/ApiTokensPage/index.tsx:100-104,209-232`
**Category:** ux-state

**What the code does:** `page` is `useState` and is advanced by two plain buttons
(`setPage((current) => Math.min(pageCount, current + 1))`). Nothing touches the URL.

**Why it is wrong:** both sibling list pages use `useTableUrlState` and make the URL the
single source of truth, with the rationale stated in their JSDoc — *"The URL query string is
the single source of truth for search, the query-builder filter, and the page … so a
filtered view can be shared or bookmarked"*
(`packages/users/admin/src/lib/presentation/pages/MembersPage/index.tsx:70-73`;
`packages/activity/admin/src/lib/presentation/pages/ActivityLogPage/index.tsx:74-76`). This page silently opts out.

Consequences: a reload returns to page 1; a shared link always opens page 1; the browser
Back button does not step back through pages; and a newly created token added to page 1
(the list is `desc(createdAt)`) is invisible to an admin sitting on page 2 with no cue.

**Repro:**
1. With 30+ tokens, go to page 2. Reload.
→ Observed: page 1. / Expected: page 2, as `/users?page=2` behaves.

**Blast radius:** minor usability, and an inconsistency a user will notice because the two
neighbouring pages in the same sidebar group behave differently. Filed as Low.

**Suggested fix:** adopt `useTableUrlState`, matching `MembersPage` and `ActivityLogPage`.
Do NOT implement.

---

**Checked and cleared** (examined, no defect found):

- **The secret is never persisted client-side.** It lives only in `ApiTokensPage`'s
  `secret` state (`:252-260`), never in the query cache, never in `localStorage`, never in
  a URL. An invalidation cannot surface it and a background refetch cannot clear it. The
  mapper carries it only on the create response (`toCreatedApiToken`), and the list mapper
  has no `secret` field at all (`apiTokenMapper/index.ts:36-49`).
- **The list never receives a secret.** The server's `toView` strips it
  (`packages/identity/server/src/lib/api-tokens/application/api-token.service.ts:170-183`), and the admin's
  `ApiTokenResponse` type has no `secret` member — only `CreatedApiTokenResponse` does.
- **Only the `lookupPrefix` is displayed.** The Token column renders the non-secret prefix,
  which is exactly what it exists for.
- **Revoke is confirmed and names the token.** `ApiTokensTable/index.tsx:276-296`
  interpolates `{name}` into the description and warns "This can't be undone" — the 3.3.4
  step that `users/admin`'s Disable and Revoke-invite are missing.
- **Revoke is offered only on a live token.** `token.status === 'active'` (`:239`), so an
  expired or already-revoked token shows no affordance.
- **Double-revoke is guarded.** `busy={pending !== null && revokingId === pending.id}`
  (`:289`) plus an idempotent server (`204` either way).
- **Revocation latency.** There is no client cache of token validity, and the server's
  `verify` re-reads the row on every request (`api-token.service.ts:112`), so a revoke takes
  effect on the very next API call — the answer to "immediately, or after a cache TTL?" is
  *immediately*.
- **Error vs empty on the main list.** All four page states are distinct
  (`ApiTokensPage/index.tsx:168-232`), with the error state carrying a working Retry.
- **No fetch without permission.** `useApiTokens(params, canRead)` and
  `useWorkspaceOptions(enabled)` both take an `enabled` flag, so a user without
  `tokens:read` issues no requests.
- **Page clamp exists.** `ApiTokensPage/index.tsx:100-104`, guarded on `data` — though it
  is effectively inert, since revoking never removes a row (EC-08).
- **Row action naming.** `aria-label="Actions for {name}"` (`ApiTokensTable/index.tsx:246-249`)
  — unique per row and meaningful.
- **Status derivation matches the server.** `revoked` wins over `expired`, and expiry uses
  `<= Date.now()` (`apiTokenMapper/index.ts:25-33`) — the same comparison as
  `ApiTokenService.verify` (`api-token.service.ts:117`), so the badge cannot disagree with
  reality.
- **Expiry presets never send a past timestamp.** `expiryToIso` always adds to `Date.now()`
  (`CreateApiTokenDialog/index.tsx:89-95`), so the server's past-expiry 400
  (`api-tokens.controller.ts:113-122`) is unreachable from the UI.
- **Name field labelling.** `<Label htmlFor={nameId}>` + `<Input id={nameId} autoFocus>`
  (`:169-179`) — correct, and the pattern the two `Select`s should copy.
- **No `apiClient` outside the gateway.** `grep -rn "apiClient" packages/api-tokens/admin/src`
  → `httpApiTokenGateway` only.
- **i18n completeness.** Every user-visible string is a namespaced `apiTokens.*` descriptor,
  including all four error branches and both empty states.

**Defect tally:** `5 🐞 · 0 Critical · 2 High · 2 Medium · 1 Low · 0 🔒`
(BUG-01/02/03 carried `🔒` before verification; all three were re-classified as `data-loss`,
which is what their Category lines already said — nothing here is an auth, authz,
tenant-isolation or disclosure defect.)
**Accessibility tally:** `7 ♿ · 1 Supports · 3 Partially Supports · 3 Does Not Support ·
0 Not Applicable`

## 7. Recommended E2E Tests

This unit has **zero** coverage, so items 1–3 are foundational: there is no Page Object and
no `page.route` seed to build on. Follow `apps/admin-e2e/src/support/pages/MembersPage.ts`
and `apps/admin-e2e/src/support/api/members.ts` as the templates, and
`apps/admin-e2e/src/support/a11y.ts` for the axe harness.

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | `apps/admin-e2e` — new POM + seed | `support/pages/ApiTokensPage.ts`, `support/api/apiTokens.ts` | the harness itself: mock `GET/POST/DELETE /api/api-tokens` and `GET /api/workspaces`, with fixtures for active/expired/revoked/multi-workspace tokens | prerequisite for everything below |
| 2 | `apps/admin-e2e` | `api-tokens/reveal-secret.spec.ts` | the secret is focusable and selectable by keyboard; a **rejected** `navigator.clipboard.writeText` surfaces an error toast; Esc before copying warns instead of discarding; the value never appears in any list response | 🐞 BUG-01, 🐞 BUG-02, 🐞 BUG-03, ♿ A11Y-01, ♿ A11Y-03 |
| 3 | `apps/admin-e2e` | `api-tokens/a11y.spec.ts` | axe over eight states — table, skeleton, error, empty, no-access, **create dialog**, **reveal dialog**, **revoke confirm** — in **both** light and dark themes | ♿ A11Y-06, a11y ❌ |
| 4 | `apps/admin-e2e` | `api-tokens/keyboard.spec.ts` | every control is reachable and operable by keyboard; Esc closes each dialog and restores focus to its trigger; after a revoke, focus lands on a stable anchor rather than `<body>` | ♿ A11Y-05, F10/F11 ❌ |
| 5 | `apps/admin-e2e` | `api-tokens/create-token.spec.ts` | the Access and Expires selects have accessible names (post-fix); each expiry preset produces the right `expiresAt`; multi-workspace selection sends both ids; a failed POST keeps the dialog open with its values; the submit cannot double-fire | ♿ A11Y-02, F7/F8 ❌, EC-21 |
| 6 | `apps/admin-e2e` | `api-tokens/tokens-list.spec.ts` | the table renders name/prefix/scope/status/expiry/last-used; a revoked-and-expired token reads **Revoked**; `expiresAt: null` reads "Never"; an unresolvable workspace id falls back to the raw uuid; the Token column never contains a full secret | F2/F3/F4 ❌ |
| 7 | `apps/admin-e2e` | `api-tokens/states.spec.ts` | 500 renders the error alert with a working Retry, **not** the empty state; the empty state hides its create action without `tokens:create`; the no-access state issues **zero** requests | F5/F6 ❌ |
| 8 | `apps/admin-e2e` | extend `api-tokens/create-token.spec.ts` | a failed `GET /api/workspaces` shows a distinct error, not "No workspaces found.", and blocks submission | 🐞 BUG-04, EC-28 |
| 9 | `apps/admin-e2e` | `api-tokens/revoke.spec.ts` | the confirm dialog names the token; cancelling sends nothing; confirming flips the badge and removes the kebab; the kebab is absent on expired/revoked rows; a failed DELETE toasts and leaves the row unchanged | F10/F12/F14 ❌ |
| 10 | `apps/admin-e2e` | `api-tokens/pagination.spec.ts` | no pager at ≤ 25 tokens; "Page 1 of 2" at 30; Previous/Next disable at the ends; (post-fix) the page is reflected in the URL and survives a reload | 🐞 BUG-05, F13 ❌ |
| 11 | `apps/admin-e2e` | `api-tokens/reflow.spec.ts` | at a 320 px viewport the eight-column table scrolls inside its own container and every row kebab stays reachable | ♿ A11Y-06 |
| 12 | unit (`packages/api-tokens/admin`) | `infrastructure/apiTokenMapper/index.spec.ts` | `statusOf` across revoked / expired / active and the exact-expiry boundary; `toApiToken` on null timestamps; `toCreatedApiToken` carries the secret and nothing else does | F3/F17 ❌, EC-09 |
| 13 | `apps/admin-e2e` | `api-tokens/live-region.spec.ts` | after a revoke, a polite live region announces the change and a success toast fires (post-fix) | ♿ A11Y-04 |
