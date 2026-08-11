# Server E2E test catalog

> **Generated file — do not edit by hand.** Regenerate with
> `npx nx catalog server-e2e`. CI runs `npx nx catalog:check server-e2e`
> and fails if this file has drifted from the specs.

_827 test cases across 50 spec files._

<!-- source: apps/server-e2e/src/server/activity/activity-filter.spec.ts -->
_<sub>apps/server-e2e/src/server/activity/activity-filter.spec.ts</sub>_

## GET /api/activity (query-builder filter)

| Test case |
| --- |
| filters by a scalar kind rule (eq) |
| combines kinds with an OR group |
| filters by an `at` lower bound (gte) |
| AND-composes the filter with the existing kind param |
| rejects an unknown field with 400 (whitelist) |
| rejects malformed JSON with 400 |

<!-- source: apps/server-e2e/src/server/activity/activity.spec.ts -->
_<sub>apps/server-e2e/src/server/activity/activity.spec.ts</sub>_

## Activity log (GET /api/activity + recording)

### recording (in-band, transactional)

| Test case |
| --- |
| records user.signed_in on login and exposes it via the read API |
| records user.suspended when an admin disables a member |
| records user.role_changed with the from/to roles in meta |
| records user.invited with the email in meta |

### transactional guarantee

| Test case |
| --- |
| writes no audit row when the mutation is rejected and rolled back |
| records nothing for the member when re-enable is rejected |

### filtering, pagination, and sort

| Test case |
| --- |
| filters by a comma-separated kind list (IN) |
| filters by actor email (case-insensitive substring) |
| paginates with page/pageSize and echoes the envelope |
| sorts by time, newest first by default and oldest first on asc |
| returns an empty page for a future `from` bound |

### authorization (activity:read)

| Test case |
| --- |
| allows an admin (200) |
| forbids a contributor with 403 |
| forbids a viewer with 403 |
| rejects an unauthenticated request with 401 |

### logout

| Test case |
| --- |
| records user.signed_out for the session owner |
| records nothing extra for a logout with no live session |

<!-- source: apps/server-e2e/src/server/api-tokens/api-tokens-management.spec.ts -->
_<sub>apps/server-e2e/src/server/api-tokens/api-tokens-management.spec.ts</sub>_

## API token management (/api/api-tokens)

| Test case |
| --- |
| mints a token and returns the plaintext exactly once |
| mints a token spanning several workspaces |
| collapses duplicate workspace ids |
| rejects an empty workspace bucket |
| lists a multi-workspace token under each of its workspaces |
| rejects an expiry in the past |
| revokes a token |
| gates management on the tokens permissions |
| requires authentication |

<!-- source: apps/server-e2e/src/server/api-tokens/public-content-api.spec.ts -->
_<sub>apps/server-e2e/src/server/api-tokens/public-content-api.spec.ts</sub>_

## Public content API (/api/v1)

### authentication

| Test case |
| --- |
| 401s without an Authorization header |
| 401s on an unknown bearer token |
| 401s on a non-bearer Authorization scheme |
| does not accept a session cookie in place of a token |
| 401s once the token is revoked |
| 401s once the token has expired |
| does not open the management API to a bearer token |

### workspace resolution

| Test case |
| --- |
| defaults to the only workspace of a single-workspace token |
| requires X-Workspace-Id when the token covers several |
| reads each workspace of a multi-workspace token |
| 403s a workspace outside the token’s bucket |
| 403s a foreign X-Workspace-Id even on a single-workspace token |
| 400s a malformed X-Workspace-Id |

### entry reads

| Test case |
| --- |
| serves only published, non-deleted entries |
| returns a flat entry: no relations, no media, no workspace |
| reads one entry by id |
| 404s a draft entry by id |
| 404s an entry that lives in another workspace |
| 404s a content type the workspace was not granted |
| 404s an unknown content type |
| serves a single (page) type through the same list route |
| paginates |
| sorts by a whitelisted column, ascending and descending |
| falls back to newest-updated for a sort key it does not allow |
| rejects a page or pageSize outside its bounds |
| searches across the type’s text columns |
| matches LIKE metacharacters in a search literally |
| filters on a scalar field with the query-builder tree |
| never lets a filter widen the published-only scope |
| 400s a malformed filter and an unknown filter field |
| 400s a filter traversing into an ungranted relation |
| returns only the selected fields |
| applies a field selection to the single-entry route too |
| 400s an unknown or unselectable field name |
| reads an empty ?fields= as "no preference", not "no fields" |
| 400s a fields list longer than the cap |
| still filters and sorts on fields it was not asked to return |
| expands a relation only when asked, and only to published targets |
| caps preview items with relationLimit, keeping total truthful |
| rejects a relationLimit outside 1…100 |
| 400s expanding a relation into an ungranted type |
| expands every granted relation field when none are named |
| 400s naming more expandable fields than the cap allows |
| 400s a relationFields name that is not a relation |
| pages one relation field from the sibling route |
| 404s the relation and media routes for an entry it cannot read |
| exposes media fields as empty views when nothing is attached |
| resolves attached media to metadata and URLs, capped by mediaLimit |
| omits a media id that names an asset in another workspace |
| 400s a mediaFields name that is not a media field |
| rejects an undeclared query parameter |

### localization

| Test case |
| --- |
| 400s an unknown locale on every route that takes one |
| reads a localized entry by id without naming its locale |
| filters a list by localeGroupId, scoped to the requested locale |
| reads a group’s row in the requested locale |
| 404s a group whose row in the requested locale is not published |
| 404s a group in another workspace |
| previews an entry’s sibling translations, published only |
| previews translations across a whole list page |
| serves the same siblings from the /translations route |
| orders translations by locale slug |
| hides a soft-deleted or cross-workspace sibling |
| previews translations on the group-addressed entry read |
| 404s /translations for an entry it cannot read |
| serves every single-entry route by translation group too |
| 404s the group sibling routes when the locale has no published row |
| 400s every locale feature on a type that is not localized |

### schema discovery

| Test case |
| --- |
| lists only the types the workspace was granted |
| serves one type’s field schema |
| 404s the schema of an ungranted type |

<!-- source: apps/server-e2e/src/server/api-tokens/public-content-writes.spec.ts -->
_<sub>apps/server-e2e/src/server/api-tokens/public-content-writes.spec.ts</sub>_

## Public content API — writes (/api/v1)

### scope

| Test case |
| --- |
| refuses every write to a read-only token |
| refuses a write into a workspace outside the token’s bucket |
| 404s a type the workspace was not granted |

### create

| Test case |
| --- |
| creates a draft, invisible to a read-only token until published |
| lets a write-scoped token read its own draft back |
| defers value validation to publish on a publishable type |
| 422s a create on a NON-publishable type straight away |
| 400s a malformed relation delta |

### update

| Test case |
| --- |
| merges the submitted values instead of replacing the bag |
| still clears a field that is sent explicitly as null |
| moves a published entry back to draft, keeping publishedAt |
| 404s an entry in another workspace |

### relations

| Test case |
| --- |
| assigns and unassigns links without sending the whole set |
| refuses to link two localized types across locales |
| refuses a cross-locale relation at create too, not just update |
| still links freely to a target type that is not localized |
| sets a single relation by translation group, per locale |
| clears a single relation with set: null, and refuses an ambiguous one |
| 422s a translation group with no row in this locale |
| 422s a malformed relation id instead of 500ing |
| 422s a link to an entry outside the workspace |

### localization

| Test case |
| --- |
| adds a translation to an existing record’s group |
| 409s a locale the group already holds |
| 404s a translation group that does not exist |
| addresses a write at the group’s row for the requested locale |
| deletes one translation, leaving the group’s others live |

### publish

| Test case |
| --- |
| unpublishes back to a draft |

### delete

| Test case |
| --- |
| removes an entry from the public reads |
| 404s an entry in another workspace |

### media

| Test case |
| --- |
| uploads an asset, attaches it, and serves it back to the same token |
| lets a read-only token fetch bytes but never upload |
| 404s an asset outside the request’s workspace |
| 422s a media id the workspace does not own |
| 400s an upload with no file part |

<!-- source: apps/server-e2e/src/server/api-tokens/public-graphql-api.spec.ts -->
_<sub>apps/server-e2e/src/server/api-tokens/public-graphql-api.spec.ts</sub>_

## Public GraphQL API (/api/v1/graphql)

### authentication

| Test case |
| --- |
| 401s without an Authorization header |
| 401s on an unknown bearer token |
| does not accept a session cookie in place of a token |
| 403s on a workspace outside the token’s bucket |
| 400s when a multi-workspace token names no workspace |
| needs no header when the token covers exactly one workspace |

### grant pruning

| Test case |
| --- |
| omits an ungranted content type from the schema entirely |
| refuses a query naming an ungranted type before any resolver runs |
| lists exactly the granted types for discovery |
| gives two workspaces different schemas |

### reads

| Test case |
| --- |
| returns published entries and their values |
| hides a draft from a read-only token |
| hides entries from another workspace |
| reads one entry by id |
| serves a single-kind type as one record, not a list |
| filters with the same tree the REST `?filter=` takes |
| searches, sorts and paginates |

### parity with the REST API

| Test case |
| --- |
| returns the same record over both protocols |
| agrees on which entries are visible |

### expansions

| Test case |
| --- |
| expands a many-to-many relation |
| serves an owning single relation as the target itself |
| respects a relation page size and still reports the true total |
| attaches sibling translations |
| reads a record by its translation group in a chosen locale |

### draft visibility

| Test case |
| --- |
| refuses `status: DRAFT` for a read-only token |
| allows it for a write-scoped token |

### mutations

| Test case |
| --- |
| refuses every write for a read-scoped token |
| runs the create → update → publish → delete lifecycle |
| clears a field with an explicit null but not by omission |
| reports a failed publish as a 422 with its per-field issues |
| applies a relation delta |

### cost limits

| Test case |
| --- |
| refuses a multi-operation document with no operationName |

### the GraphiQL playground

| Test case |
| --- |
| is not served when developer tooling is off |
| does not take the API down with it |

### errors

| Test case |
| --- |
| reports a field error as HTTP 200 with the REST status in extensions |
| 400s a body that is not a GraphQL request |

<!-- source: apps/server-e2e/src/server/api-tokens/public-graphql-limits.spec.ts -->
_<sub>apps/server-e2e/src/server/api-tokens/public-graphql-limits.spec.ts</sub>_

## Public GraphQL API cost limits (/api/v1/graphql)

| Test case |
| --- |
| accepts a query inside every budget |
| refuses a query nested past the depth limit |
| refuses a document longer than the length limit |
| refuses a document that aliases past the field limit |
| refuses a shallow but expensive query on complexity |
| refuses the query before executing it |

<!-- source: apps/server-e2e/src/server/api-tokens/public-graphql-playground.spec.ts -->
_<sub>apps/server-e2e/src/server/api-tokens/public-graphql-playground.spec.ts</sub>_

## Public GraphQL playground (/api/v1/graphql/playground)

### with developer tooling on

| Test case |
| --- |
| serves GraphiQL as HTML, without a token |
| points the editor at the API endpoint under the global prefix |
| loads no external assets, so an air-gapped install works |
| serves a byte-identical page on a second request |

<!-- source: apps/server-e2e/src/server/auth/accept-invite.spec.ts -->
_<sub>apps/server-e2e/src/server/auth/accept-invite.spec.ts</sub>_

## accept an invite

### the invite response

| Test case |
| --- |
| hands the raw token back exactly once, on invite |

### GET /api/auth/invite/:token

| Test case |
| --- |
| describes who the invite is for, with no session |
| leaks nothing beyond the email and name |
| does not consume the token — the link survives a page refresh |
| 404s an unknown token |
| 404s an expired token |
| 404s a token whose invite was revoked |

### POST /api/auth/invite/accept

| Test case |
| --- |
| activates the account, sets the credential, and signs the invitee in |
| keeps the role the admin chose — the invitee cannot pick their own |
| lets the invitee log in with the password they chose |
| burns the token — the same link cannot be used twice |
| rejects only one of two concurrent accepts of the same link |
| 404s an expired token |
| 404s an unknown token, without hinting that it is unknown |
| stops working once the invite is resent (the link rotated) |
| 400s a password under the minimum length |
| 400s a password past bcrypt’s 72-byte ceiling rather than truncating it |
| 400s when the confirmation does not match |
| rejects a request from a disallowed origin (CSRF defense) |
| 404s an invite for an account that is already active |

<!-- source: apps/server-e2e/src/server/auth/login-throttle.spec.ts -->
_<sub>apps/server-e2e/src/server/auth/login-throttle.spec.ts</sub>_

## POST /api/auth/login (rate limit)

| Test case |
| --- |
| returns 429 once the limit is exceeded |

<!-- source: apps/server-e2e/src/server/auth/login.spec.ts -->
_<sub>apps/server-e2e/src/server/auth/login.spec.ts</sub>_

## POST /api/auth/login

### valid credentials

| Test case |
| --- |
| returns 201 with { ok: true } |
| sets an httpOnly session cookie |
| cookie carries the configured attributes (HttpOnly, Lax, Path, Max-Age, not Secure) |
| persists exactly one session row |
| opens a distinct session on each login |
| matches the email case-insensitively |

### rejected credentials (generic 401, no cookie)

| Test case |
| --- |
| rejects an unknown email |
| rejects a wrong password |
| rejects a pending (not-yet-active) user |
| rejects a disabled user |
| rejects a user with no password set (invite pending) |
| creates no session for a failed login |

### request validation (400)

| Test case |
| --- |
| rejects a missing email |
| rejects a missing password |
| rejects an empty body |
| rejects a malformed email |
| rejects an empty password string |
| rejects a non-string password |
| rejects a non-string email |
| rejects a null email |
| rejects an unknown extra field (forbidNonWhitelisted) |

### OriginGuard (login CSRF defense)

| Test case |
| --- |
| rejects a disallowed Origin with 403 |
| allows the configured Origin |
| allows a request with no Origin header |
| runs before body validation (bad Origin + bad body → 403) |

<!-- source: apps/server-e2e/src/server/auth/logout.spec.ts -->
_<sub>apps/server-e2e/src/server/auth/logout.spec.ts</sub>_

## POST /api/auth/logout

| Test case |
| --- |
| returns 201 { ok: true } and clears the cookie |
| revokes the session so the cookie no longer authenticates |
| is idempotent with no session cookie |
| is idempotent with a bogus session cookie |
| can be called twice with the same cookie (second is a no-op) |
| revokes only the presented session, not the user’s others |

### OriginGuard (CSRF defense)

| Test case |
| --- |
| rejects a disallowed Origin with 403 and keeps the session alive |
| allows the configured Origin |

<!-- source: apps/server-e2e/src/server/auth/me.spec.ts -->
_<sub>apps/server-e2e/src/server/auth/me.spec.ts</sub>_

## GET /api/auth/me

### unauthenticated (401)

| Test case |
| --- |
| rejects a request with no cookie |
| rejects a bogus session token |
| rejects an empty session cookie value |
| rejects when only unrelated cookies are present |
| rejects a malformed cookie header |

### authenticated

| Test case |
| --- |
| returns the current user after login (cookie flow) |
| exposes only the public fields (no hash/token leak) |
| includes the permission keys the user’s role grants |
| works with an explicitly forwarded session cookie |
| finds the session cookie among several cookies |
| reflects the user’s assigned role |

### invalidated sessions (401)

| Test case |
| --- |
| rejects an expired session |
| rejects a revoked session |
| rejects a session whose user was deleted |
| rejects a live session whose account was suspended |
| accepts the same session again once the account is reactivated |
| rejects a live session whose account fell back to pending |

<!-- source: apps/server-e2e/src/server/auth/root-admin.spec.ts -->
_<sub>apps/server-e2e/src/server/auth/root-admin.spec.ts</sub>_

## Root admin bootstrap (RootAdminSeeder)

### provisioning on boot

| Test case |
| --- |
| creates an active admin user with the configured email |
| lets the provisioned admin log in |

### idempotency & non-destructive behavior

| Test case |
| --- |
| returns "created" then "exists" for the same email |
| inserts no duplicate row on a repeat ensure |
| matches an existing email case-insensitively (no overwrite) |

### misconfiguration (fail-fast)

| Test case |
| --- |
| aborts boot when an email is configured without a password |

<!-- source: apps/server-e2e/src/server/content/content-entries-write.spec.ts -->
_<sub>apps/server-e2e/src/server/content/content-entries-write.spec.ts</sub>_

## Content entry writes (/api/content/:type)

### create / read / update

| Test case |
| --- |
| creates a draft, reads it back, and updates it |
| saves an incomplete draft of a publishable type, but 422s on publish |
| allows editing a draft to an incomplete state, and moves a published entry back to draft on edit |
| 422s an invalid create of a non-publishable (always-live) type |
| 404s reading an unknown id |

### workspace-scoped relations

| Test case |
| --- |
| accepts a single relation whose target is in the same workspace |
| 422s a single relation whose target lives in another workspace |
| 422s a single relation pointing at a non-existent id |

### join-backed relations (many-to-many + inverse)

| Test case |
| --- |
| persists a many-to-many on create and reads it back with titles |
| resolves a linked record’s slug from its slug field |
| replaces the link set on update (unlink + link in one save) |
| 422s a many-to-many target in another workspace |
| 404s the relations read for a missing entry |
| links and unlinks via relation deltas on save |
| merges a link delta onto existing links (append, not override) |
| persists order via the reorder delta on save |
| paginates a field with many links |
| 400s a relation delta on a single relation |
| 400s a malformed relation delta (non-array unlink), not a 500 |
| 400s a relation delta carrying a non-uuid id |
| 422s linking a target in another workspace via a delta |
| links the inverse side (tag.articles) via a delta on save |
| applies link, unlink, and order in one delta on save |
| keeps a link on soft delete but drops it on purge (FK cascade) |

### publish / unpublish

| Test case |
| --- |
| publishes then unpublishes a draft |
| 400s publishing a non-publishable type |
| keeps publishedAt through an edit and clears it on unpublish |

### delete / restore / purge (paranoid)

| Test case |
| --- |
| soft-deletes, hides from the list, lists in trash, restores, purges |

### bulk

| Test case |
| --- |
| previews then publishes only the valid drafts (and hits the bulk route, not :id) |
| bulk soft-deletes a set of entries |

### authorization

| Test case |
| --- |
| 401s unauthenticated writes |
| 403s a viewer on create and delete |
| lets a contributor create but not delete |

<!-- source: apps/server-e2e/src/server/content/content-media-fields.spec.ts -->
_<sub>apps/server-e2e/src/server/content/content-media-fields.spec.ts</sub>_

## Content media fields (/api/content/:type)

| Test case |
| --- |
| stores and reads back a single media asset id |
| 422s a media id that does not exist |
| 422s a media asset from another workspace (no cross-workspace leak) |
| 422s an asset whose kind fails the field accept restriction |
| preserves the order of a multiple media field across an update |
| carries the thumb/preview derivative urls on a resolved ref |
| resolves media ids to refs via GET /:id/media |
| captures media ids in the revision snapshot |

<!-- source: apps/server-e2e/src/server/content/content-schema.spec.ts -->
_<sub>apps/server-e2e/src/server/content/content-schema.spec.ts</sub>_

## Content schema (GET /api/content-schema)

### authorization

| Test case |
| --- |
| 401s an unauthenticated list request |
| 401s an unauthenticated detail request |
| 403s an authenticated user whose role lacks content:read |

### list

| Test case |
| --- |
| returns a summary of every code-defined content type |

### detail

| Test case |
| --- |
| returns the full field schema for a type |
| 404s an unknown content type |

<!-- source: apps/server-e2e/src/server/content/content-types.spec.ts -->
_<sub>apps/server-e2e/src/server/content/content-types.spec.ts</sub>_

## Content catalogue handover (GET /api/content-types + grants)

| Test case |
| --- |
| 401s an unauthenticated request |
| serves the code-defined registry, not the mock catalogue |
| grants a workspace the real registry slugs on content mode "all" |

<!-- source: apps/server-e2e/src/server/content/entry-revisions.spec.ts -->
_<sub>apps/server-e2e/src/server/content/entry-revisions.spec.ts</sub>_

## Content entry revisions (/api/content/:type/:id/revisions)

| Test case |
| --- |
| records a revision on create, keyed to the acting user |
| appends an incrementing revision on every save, newest first |
| captures the whole document — scalars and a many-to-many link set |
| resolves relation snapshot ids to titled records in the detail |
| restores an earlier revision as a new revision (append-only) |
| 404s an unknown revision number |

### publish transitions

| Test case |
| --- |
| promotes the latest revision to published on publish |
| supersedes the previously-published revision when a newer one publishes |
| reverts the published revision to draft on unpublish |
| promotes the revision through a bulk publish too |
| keeps the published version live when a newer draft is saved |
| publishes a specific earlier version, making it live |
| publishes the newest version in place |
| 404s publishing an unknown version |

<!-- source: apps/server-e2e/src/server/content/list-entries-relation-filter.spec.ts -->
_<sub>apps/server-e2e/src/server/content/list-entries-relation-filter.spec.ts</sub>_

## Content relation filtering (GET /api/content/:typeName?filter=)

### many-to-one (author.name)

| Test case |
| --- |
| filters entries by a related record field |
| excludes a soft-deleted target (the relation scope) |
| excludes a target in another workspace (the workspace scope) |

### many-to-many (tags.*)

| Test case |
| --- |
| filters by a tag field with EXISTS semantics (no row duplication) |
| matches only entries linked to the given tag |

### negation (NOT EXISTS semantics)

| Test case |
| --- |
| excludes an entry that has ANY link matching the negated value |
| keeps an entry with no links at all under a negated rule |
| "is empty" on a relation id means "has no related row" |
| "is not empty" on a relation id means "has a related row" |
| a negated ROOT column still matches rows where it is NULL |

### self-referential (test_page.parent)

| Test case |
| --- |
| filters by the parent's own field |
| filters through a relation UNDER the self-hop (parent.owner.name) |
| filters two self-hops deep (parent.parent.title) |
| does not match a page against its own row |

### composition + bounds

| Test case |
| --- |
| combines a root field and a relation path under OR |
| 400s an unknown field under a relation |
| 400s a path deeper than the relation-hop budget |

## Filter fields (GET /api/content-schema/:name/filter-fields)

| Test case |
| --- |
| 401s an unauthenticated request |
| 404s an unknown content type |
| 404s a real type the workspace was not granted |
| prunes a relation whose target is not granted |
| returns the recursive filterable surface |

<!-- source: apps/server-e2e/src/server/content/list-entries.spec.ts -->
_<sub>apps/server-e2e/src/server/content/list-entries.spec.ts</sub>_

## Content entries (GET /api/content/:typeName)

### authorization

| Test case |
| --- |
| 401s an unauthenticated request |
| 403s a user whose role lacks content:read |

### list pipeline

| Test case |
| --- |
| returns the paginated envelope |
| searches text-like columns (ILIKE) |
| sorts by a column, descending with the `-` prefix |
| applies the query-builder `?filter=` tree |
| 404s an unknown content type |
| 400s a page size over the cap |

### publishable-only status

| Test case |
| --- |
| omits `status` for a non-publishable type |
| 400s a status filter on a non-publishable type |

### workspace isolation

| Test case |
| --- |
| does not leak workspace A's entries when listing with workspace B's header |
| 400s a request with no X-Workspace-Id header |
| 400s a malformed (non-UUID) X-Workspace-Id header |
| 403s a workspace the user is not a member of |

<!-- source: apps/server-e2e/src/server/content/relation-preview.spec.ts -->
_<sub>apps/server-e2e/src/server/content/relation-preview.spec.ts</sub>_

## Content relation preview (GET /api/content/:typeName?relations=preview)

### opt-in

| Test case |
| --- |
| omits `relations` entirely when not requested |
| omits `relations` when `relations=preview` names no fields |
| previews only the named fields, so a hidden column costs nothing |
| drops unknown field names instead of failing the request |

### storage forms

| Test case |
| --- |
| resolves an owning single relation (many-to-one) to a titled ref |
| resolves an owning many-to-many, ordered by position |
| resolves the inverse side of a many-to-many |

### the page cap

| Test case |
| --- |
| caps items at one page but reports the true total |
| continues from the preview on the paginated per-field route |

### batching

| Test case |
| --- |
| issues the same number of queries for a 1-row and a 5-row page |

<!-- source: apps/server-e2e/src/server/copilot/copilot-chat.spec.ts -->
_<sub>apps/server-e2e/src/server/copilot/copilot-chat.spec.ts</sub>_

## Copilot chat (POST /api/copilot/runs)

### guard composition

| Test case |
| --- |
| 401s an unauthenticated run |
| 403s a role without copilot:use |
| 403s a cross-site Origin (OriginGuard) |
| 400s a run with no X-Workspace-Id (WorkspaceGuard) |
| 403s a workspace the caller is not a member of |

### request validation

| Test case |
| --- |
| 400s an undeclared top-level property, naming it |
| 400s an undeclared property inside the nested context |
| 400s an empty message |
| tells the model it can resolve vague references from the context |
| passes the nested context through to the prompt intact |

### the event stream

| Test case |
| --- |
| streams run-started, the answer, then exactly one done |
| persists the turn and serves it back on the transcript route |
| continues an existing conversation rather than starting a new one |
| 404s a conversation belonging to another user |

### the tool loop

| Test case |
| --- |
| runs a tool, streams its call and result, and feeds it back |
| fences the tool result as untrusted data |
| turns a tool that throws into a tool error and keeps going |
| refuses a tool the model invented, without failing the run |
| rejects arguments that do not match the tool schema |
| refuses an identical repeated call instead of re-running the tool |
| treats a call with different arguments as a new call |
| stops with max-steps when the model never stops calling tools |
| audits every attempted call, successful or not |

### the capability profile

| Test case |
| --- |
| offers a viewer no write tools |
| offers a contributor both propose and apply tools |
| offers an admin an apply tool exactly as it would a read one |
| still withholds both from a role without the permission |
| refuses a withheld tool at execution, not only at offer time |

### model selection

| Test case |
| --- |
| serves the catalogue of registered backends |
| gates the catalogue on copilot:use |
| runs on the requested provider and model, and records both |
| records the default model when the run names none |
| refuses an unregistered provider with an error frame |
| refuses a model the provider does not offer |

### the content tools — filter, locale, projection

| Test case |
| --- |
| filters on a scalar field with the query-builder grammar |
| combines free-text search with a filter |
| separates entries with unpublished changes from never-published drafts |
| turns an unknown filter path into a tool error |
| searches the requested locale, not the default one |
| rejects an unknown locale rather than silently using the default |
| narrows values to the requested fields, keeping the envelope |
| reports filterable paths from listTypes |
| advertises publishedAt, which the admin’s picker omits |
| withholds locale, which is a tool parameter rather than a filter |
| advertises a relation hop once its target type is granted |
| projects getEntry too |

### the content tools

| Test case |
| --- |
| offers the phase-1 read tools and searches real entries |
| names the workspace’s granted types in the system prompt, without fields |
| refuses a content type the workspace was not granted |

<!-- source: apps/server-e2e/src/server/copilot/copilot-conversations.spec.ts -->
_<sub>apps/server-e2e/src/server/copilot/copilot-conversations.spec.ts</sub>_

## Copilot conversations (PATCH /api/copilot/conversations/:id)

### renaming

| Test case |
| --- |
| replaces the derived title |
| trims the title, and rejects one that is blank once trimmed |
| rejects a title past the limit |
| does not reorder the list — a rename is not a use |

### archiving

| Test case |
| --- |
| moves the thread between two disjoint lists, reversibly |
| keeps the transcript readable by id |
| applies a rename and an archive in one request |

### validation

| Test case |
| --- |
| 400s an empty patch — it cannot mean anything |
| 400s an unknown property |
| 400s a non-uuid id, rather than treating it as a miss |
| rejects `archived` as a bare string |

### scoping

| Test case |
| --- |
| 404s another user’s thread — the id is not probeable |
| 404s a thread from another workspace |
| 403s a role without copilot:use |
| 401s an unauthenticated request |
| 403s a cross-origin write — `OriginGuard` is on this route |

<!-- source: apps/server-e2e/src/server/copilot/copilot-media-files.spec.ts -->
_<sub>apps/server-e2e/src/server/copilot/copilot-media-files.spec.ts</sub>_

## Copilot file creation

### the offer

| Test case |
| --- |
| offers file creation to a contributor, who holds media:create |
| withholds it from a viewer, whose copilot stays read-only |
| refuses the call from a viewer who names it anyway |

### an approved file lands in the library

| Test case |
| --- |
| creates a real asset with the bytes the model wrote |
| files it in the folder the model chose |
| replaces an extension that contradicts the chosen format |
| shows the file’s text in the prompt before anything is written |
| writes nothing when the user refuses |
| records the change as a proposal joined to the new asset |

### failures land before approval, where they are recoverable

| Test case |
| --- |
| rejects a path and names the parameter that does the job |
| rejects a folder id from another workspace |
| rejects an empty file |
| rejects a format outside the enum |

### files attached to a turn

| Test case |
| --- |
| tells the model what was attached, without inlining the bytes |
| fences the manifest as untrusted data |
| says up front whether a file can be read |
| refuses an asset from another workspace |
| refuses an id that is not an asset at all |
| carries into a follow-up turn in the same thread |
| serves them back on the persisted transcript |
| rejects more attachments than one turn may carry |
| rejects an attachment that is not a uuid |
| rejects an unknown key inside an attachment |

<!-- source: apps/server-e2e/src/server/copilot/copilot-proposals.spec.ts -->
_<sub>apps/server-e2e/src/server/copilot/copilot-proposals.spec.ts</sub>_

## Copilot changes

### the offer

| Test case |
| --- |
| offers the write tools to an admin |
| offers a viewer no write tool at all |
| offers a contributor the whole write surface, matching the role matrix |
| exposes no publish tool at any role |

### a write asks before it runs

| Test case |
| --- |
| parks the call and shows the user its arguments |
| never asks about a read |
| refuses the call when the user says no, and writes nothing |
| stops asking for the rest of the chat once allowed for it |

### a propose tool writes, and records what it wrote

| Test case |
| --- |
| creates the entry and the row that recorded it |
| tells the model it saved, so it does not hedge |
| carries a before/after diff on an edit |
| refuses an edit that would change nothing |
| refuses a field the type does not declare |
| refuses a content type the workspace was not granted |

### applying runs the ordinary use-case

| Test case |
| --- |
| writes the change and records who made it |
| appends a revision, because it went through the ordinary write |
| merges rather than replacing the untouched fields |
| reports a failed apply instead of claiming success |

### there is no approval boundary any more

| Test case |
| --- |
| serves no accept or reject route |
| serves no per-workspace policy route |

### the record of what changed

| Test case |
| --- |
| lists the workspace’s changes |
| 400s an undeclared query parameter |
| does not leak another workspace’s proposals |

<!-- source: apps/server-e2e/src/server/copilot/copilot-read-catalogue.spec.ts -->
_<sub>apps/server-e2e/src/server/copilot/copilot-read-catalogue.spec.ts</sub>_

## Copilot read catalogue

### the offer

| Test case |
| --- |
| offers every read tool in the catalogue to an admin |
| offers no MCP-only tool |
| refuses an MCP-only tool the model names anyway |
| withholds the audit log from a contributor, who lacks activity:read |
| offers a viewer the whole read catalogue except the audit log |

### admin_content_revisions / admin_content_diff

| Test case |
| --- |
| lists an entry’s versions, newest first |
| reports only the fields that changed between two versions |
| names the missing version rather than failing opaquely |
| refuses a content type the workspace was not granted |

### i18n_locales_list / i18n_translations_get

| Test case |
| --- |
| lists the configured locales, marking the default |
| reports which locales an entry has been translated into |
| says a type is not localized rather than answering “no translations” |
| refuses a content type the workspace was not granted |

### media_assets_search

| Test case |
| --- |
| searches every folder, not just the workspace root |
| filters by kind |
| does not see another workspace’s assets |
| omits the storage URL, which a model cannot fetch anyway |
| carries a download path the asking user’s browser can follow |

### media_folders_list

| Test case |
| --- |
| turns a folder name into the id the search tool takes |
| returns a nested tree flat, with parent pointers |
| does not see another workspace’s folders |

### media_asset_read

| Test case |
| --- |
| decodes a text file the model can then work with |
| refuses a binary file instead of decoding it |
| refuses bytes that are not valid UTF-8 despite a text MIME type |
| reports another workspace’s asset as missing, not forbidden |
| cuts a file longer than the cap short and says so |
| is available to a viewer, whose copilot still cannot write |

### activity_recent

| Test case |
| --- |
| reads the audit trail for an admin |
| is not callable by a contributor even if the model names it |

### workspace_members_list

| Test case |
| --- |
| lists this workspace’s members with their roles |
| does not list accounts that are not members of this workspace |

<!-- source: apps/server-e2e/src/server/i18n/i18n-content.spec.ts -->
_<sub>apps/server-e2e/src/server/i18n/i18n-content.spec.ts</sub>_

## Content i18n (/api/content/:type + /api/i18n)

### locales endpoint

| Test case |
| --- |
| serves the configured locales with exactly one default |

### create stamps the locale

| Test case |
| --- |
| defaults to the default locale (en) when none is sent |
| stamps an explicit locale |
| 400s an unknown locale |
| gives a plain create its own fresh translation group |

### strict list scoping + default fallback

| Test case |
| --- |
| lists only the default locale when no ?locale= is sent |
| lists only the requested locale with ?locale=de (strict) |
| 400s a list scoped to an unknown locale |
| falls back to the default row where the requested locale is missing |

### create translation (POST /content + localeGroupId)

| Test case |
| --- |
| creates a new draft sibling sharing the group |
| 409s a duplicate locale in the group |
| 400s a sibling in an unknown target locale |
| 404s a localeGroupId that names no group in the workspace |

### shared-field sync

| Test case |
| --- |
| propagates a non-localized field to siblings but leaves localized fields alone |
| syncs an array-valued shared field (jsonb) without tripping the change predicate |
| leaves siblings alone when an array-valued shared field is resent unchanged |
| appends a revision to each sibling the sync rewrote |
| leaves sibling history alone when only a localized field changes |
| leaves a mirrored relation unset where the target has no translation |
| syncs shared fields when a sibling is created into the group |
| 422s and rolls back when the sync would invalidate a published sibling |
| moves a rewritten published sibling back to draft, keeping publishedAt |
| leaves a draft sibling — and its publishedAt — alone |

### relation locale sync

| Test case |
| --- |
| syncs a shared many-relation to every sibling |
| unlinks across the group too, not just links |
| gives a new translation the links the group already had |
| does not let a new translation wipe the links it arrives without |
| mirrors a localized many-relation into each sibling locale |
| mirrors a localized single relation into each sibling locale |
| drops a mirrored link whose target is untranslated, and still saves |
| keeps an unsynced relation independent per locale |
| lets one record share a one-to-one target across its locales |
| refuses a one-to-one target already claimed in the same locale |
| leaves siblings — and their history — alone when links are resent unchanged |
| versions a sibling and moves it to Modified when only its links change |
| frees a one-to-one target once the holder is soft-deleted |
| says nothing about locales when the type has none |
| reports the sync mode on the schema so the editor can explain itself |

### locale aggregate filters

| Test case |
| --- |
| hasLocale / missingLocale select by group membership |
| localeCount filters by number of translations |

### locale panel + summary

| Test case |
| --- |
| returns one item per configured locale, present or null |
| batches group summaries for a page of rows |
| 400s the locale endpoints on a non-i18n type |

### non-i18n regression

| Test case |
| --- |
| ignores ?locale= on a non-localized type |

<!-- source: apps/server-e2e/src/server/insights/content-insights.spec.ts -->
_<sub>apps/server-e2e/src/server/insights/content-insights.spec.ts</sub>_

## Content insights (/api/insights/content)

### GET /totals

| Test case |
| --- |
| counts entries, published and drafts |
| excludes soft-deleted entries from every count |
| counts only the workspace named by the header |
| reports the change over the window, not the lifetime total |
| rejects a window outside 1–365 |

### GET /stale

| Test case |
| --- |
| files each entry in the bucket its last edit falls in |
| places a boundary entry in exactly one bucket |
| counts only published entries — a draft is not neglected content |

### GET /pipeline

| Test case |
| --- |
| splits each type into published and draft |
| omits a type the workspace has never used |

### GET /unshipped

| Test case |
| --- |
| counts a published-then-edited entry as modified |
| does not count a draft that was never published |
| does not count an entry that is live and current |
| stops counting an entry once it is unpublished |
| excludes soft-deleted entries |
| ignores a non-publishable type entirely |
| counts only the workspace named by the header |

### GET /velocity

| Test case |
| --- |
| buckets entries by when they were published |
| widens the bucket for a longer window |

### GET /punchcard

| Test case |
| --- |
| groups saves by ISO weekday and hour |
| counts every save, not just publishes |
| counts only this workspace’s revisions |

### authorization

| Test case |
| --- |
| 401s without a session |
| 400s without a workspace header |
| 403s for a workspace the caller is not a member of |
| 403s a viewer, who holds no content:read |
| refuses every route without a session |

<!-- source: apps/server-e2e/src/server/insights/localization-insights.spec.ts -->
_<sub>apps/server-e2e/src/server/insights/localization-insights.spec.ts</sub>_

## Localization insights (/api/insights/i18n)

### GET /coverage

| Test case |
| --- |
| lists every configured locale, translated or not |
| counts records, not rows |
| counts a single-locale record as untranslated AND needing work |
| counts a part-way record as needing work but not untranslated |
| adds up across records at different stages |
| drops a soft-deleted translation from its record’s coverage |
| is empty for a workspace with no content |
| counts only the workspace named by the header |

### authorization

| Test case |
| --- |
| 401s without a session |
| 400s without a workspace header |
| 403s for a workspace the caller is not a member of |

<!-- source: apps/server-e2e/src/server/insights/media-insights.spec.ts -->
_<sub>apps/server-e2e/src/server/insights/media-insights.spec.ts</sub>_

## Media insights (/api/insights/media)

### GET /storage

| Test case |
| --- |
| groups assets and bytes by kind, largest by bytes first |
| returns byte totals as numbers, not strings |
| is empty for a workspace with no assets |
| counts only the workspace named by the header |

### GET /alt

| Test case |
| --- |
| counts images with real alt text as covered |
| does not count a blank alt as covered |
| ignores non-image assets entirely |

### GET /uploads

| Test case |
| --- |
| buckets uploads by when they were added |
| excludes uploads older than the window |
| clamps an over-large window rather than rejecting it |

### authorization

| Test case |
| --- |
| 401s without a session |
| 400s without a workspace header |
| 403s for a workspace the caller is not a member of |

<!-- source: apps/server-e2e/src/server/mcp/mcp.spec.ts -->
_<sub>apps/server-e2e/src/server/mcp/mcp.spec.ts</sub>_

## MCP endpoint (/api/v1/mcp)

### authentication

| Test case |
| --- |
| 401s without an Authorization header |
| 401s on an unknown bearer token |
| does not accept a session cookie in place of a token |
| 401s once the token is revoked |

### workspace resolution

| Test case |
| --- |
| needs no header when the token covers one workspace |
| 400s when a multi-workspace token names none |
| honours X-Workspace-Id for a multi-workspace token |
| accepts ?workspaceId= on the endpoint URL |
| 403s a workspace outside the token bucket |

### initialize

| Test case |
| --- |
| reports the server identity and its capabilities |

### tools/list

| Test case |
| --- |
| shows a read-scoped token only the read tools |
| shows a full-scoped token the write tools too |
| annotates read-only and destructive tools |
| shows no copilot-only tool, whatever the scope |
| shows the shared tools to a read-scoped token |
| runs a shared tool for a read-scoped token |
| gives an MCP caller the bearer-fetchable download path |
| refuses a copilot-only tool invoked by name |
| refuses copilot-only file creation, which a full token could otherwise afford |
| gives every tool an object input schema |

### authorization

| Test case |
| --- |
| refuses a write tool a read token invokes by name |
| refuses each write tool to a read token |
| refuses draft visibility to a read token |
| reports an unknown tool as not_found |

### discovery

| Test case |
| --- |
| lists only the workspace’s granted types |
| returns a type’s fields and a values JSON Schema |
| 404s an ungranted type exactly like an unknown one |
| exposes granted types as resources |
| reads a content-type resource |

### reads

| Test case |
| --- |
| lists published entries only |
| does not leak another workspace’s entries |
| reads one entry by id |
| honours a sparse fieldset |
| rejects an unknown argument rather than ignoring it |
| requires a locator on a single-entry read |

### write round-trip

| Test case |
| --- |
| creates a draft, reads it back, publishes, and deletes it |
| clears a field with an explicit null but leaves omitted ones |
| reports publish-time validation failures with per-field issues |
| cannot write into a workspace outside the bucket |

### kill switch

| Test case |
| --- |
| unmounts the endpoint when disabled |

<!-- source: apps/server-e2e/src/server/media/media-assets.spec.ts -->
_<sub>apps/server-e2e/src/server/media/media-assets.spec.ts</sub>_

## media assets

| Test case |
| --- |
| uploads a file and persists the asset |
| falls back to the uploader’s email when they have no display name |
| uploads into a folder when folderId is given |
| streams the uploaded bytes back on download |
| lists a folder page and the workspace root |
| renames and moves an asset via PATCH |
| duplicates an asset |
| bulk-deletes assets |

### image derivatives

| Test case |
| --- |
| probes dimensions and generates thumb + preview for a large image |
| skips preview for a small image but still makes a thumb |
| serves the original when the requested variant does not exist |
| falls back to the original for a bogus ?variant= |
| produces no derivatives for a non-image upload |
| carries the derivatives onto a duplicated image |

### validation

| Test case |
| --- |
| rejects an upload with no file (400) |
| rejects an unknown body field (400) |

### authorization

| Test case |
| --- |
| rejects an unauthenticated upload with 401 |
| forbids a viewer from uploading (403) |

| Test case |
| --- |
| never returns an asset from another workspace (404) |

### raw download scope

| Test case |
| --- |
| streams to a member of the owning workspace, ignoring the header |
| 404s for a user who is not a member of the owning workspace |

<!-- source: apps/server-e2e/src/server/media/media-folders.spec.ts -->
_<sub>apps/server-e2e/src/server/media/media-folders.spec.ts</sub>_

## media folders

| Test case |
| --- |
| creates a folder and lists it with the root count |
| renames a folder |
| deletes an empty folder (204) |
| deletes a non-empty folder together with everything inside it |
| cascades only inside the caller’s workspace |

### authorization

| Test case |
| --- |
| rejects an unauthenticated request with 401 |
| forbids a viewer from creating a folder (403) |
| lets a viewer read folders (200) |
| rejects a disallowed Origin on create (403) |
| allows the configured Origin on create |

<!-- source: apps/server-e2e/src/server/preferences/preferences.spec.ts -->
_<sub>apps/server-e2e/src/server/preferences/preferences.spec.ts</sub>_

## /api/preferences

### GET (read)

| Test case |
| --- |
| defaults to the system theme before anything is saved |
| returns only the theme (no userId/timestamps leak) |
| rejects an unauthenticated read with 401 |

### PUT (upsert)

| Test case |
| --- |
| creates the row on first save and returns the new theme |
| updates the existing row on a second save (no duplicate) |
| accepts each valid theme |
| rejects an unauthenticated write with 401 |

### PUT (upsert) › validation (400)

| Test case |
| --- |
| rejects a theme outside the enum |
| rejects a missing theme |
| rejects a non-string theme |
| rejects an unknown extra field (forbidNonWhitelisted) |

### PUT (upsert) › OriginGuard (CSRF defense)

| Test case |
| --- |
| rejects a disallowed Origin with 403 |
| allows the configured Origin |
| allows a request with no Origin header |

<!-- source: apps/server-e2e/src/server/server.spec.ts -->
_<sub>apps/server-e2e/src/server/server.spec.ts</sub>_

## server bootstrap

| Test case |
| --- |
| responds 404 on an unknown route under the global prefix |

<!-- source: apps/server-e2e/src/server/users/get-user.spec.ts -->
_<sub>apps/server-e2e/src/server/users/get-user.spec.ts</sub>_

## GET /api/users/:id

| Test case |
| --- |
| rejects an unauthenticated request with 401 |
| returns the member with role and workspaces |
| flags the sole active admin with isLastAdmin |
| returns 404 for an unknown id |
| returns 400 for a non-uuid id |
| allows a viewer (holds users:read) to read a member |

<!-- source: apps/server-e2e/src/server/users/invite-user.spec.ts -->
_<sub>apps/server-e2e/src/server/users/invite-user.spec.ts</sub>_

## POST /api/users/invites

| Test case |
| --- |
| rejects an unauthenticated request with 401 |
| creates a pending member, assigns the role, and issues an invite token |
| assigns the new member to the given workspaces (unknown ids ignored) |
| rejects a non-UUID workspace id with 400 |
| rejects a duplicate email with 409 |
| treats an existing email case-insensitively (409) |
| rejects a malformed email with 400 |
| rejects an unknown role with 400 |
| rejects an unknown extra field with 400 |
| forbids a contributor (lacks users:create) with 403 |

<!-- source: apps/server-e2e/src/server/users/list-users-filter.spec.ts -->
_<sub>apps/server-e2e/src/server/users/list-users-filter.spec.ts</sub>_

## GET /api/users (query-builder filter)

| Test case |
| --- |
| filters by a scalar email rule (ilike, %v%) |
| filters by the role relation (role.key eq) via an EXISTS subquery |
| combines rules with an OR group |
| AND-composes the filter with the existing status param |
| rejects an unknown field with 400 (whitelist) |
| rejects an unknown operator with 400 |
| rejects malformed JSON with 400 |
| rejects a tree nested past the group-depth cap with 400 |
| rejects an empty `in` list with 400 (never silently matches all) |
| rejects an oversized `in` list with 400 (DoS guard) |
| treats an empty filter as no filter (returns all) |

<!-- source: apps/server-e2e/src/server/users/list-users.spec.ts -->
_<sub>apps/server-e2e/src/server/users/list-users.spec.ts</sub>_

## GET /api/users

| Test case |
| --- |
| rejects an unauthenticated request with 401 |
| returns the paginated envelope with the expected shape |
| never leaks the password hash |
| filters by a name or email substring, case-insensitively |
| paginates with page and pageSize |
| returns every status when unfiltered (the members grid contract) |
| scopes to active accounts when status=active (the typeahead contract) |
| rejects an unknown status with 400 |
| rejects an unknown query field with 400 |
| rejects a non-numeric page with 400 |
| accepts the maximum page size (100) |
| rejects a page size over the maximum with 400 |
| allows a viewer to read (users:read is granted to every role) |

<!-- source: apps/server-e2e/src/server/users/manage-invites.spec.ts -->
_<sub>apps/server-e2e/src/server/users/manage-invites.spec.ts</sub>_

## manage pending invites

### POST /api/users/:id/invites/resend

| Test case |
| --- |
| rotates the invite token, keeping exactly one live |
| rejects resending to an active member with 409 |
| returns 404 for an unknown id |
| forbids a contributor (lacks users:create) with 403 |

### DELETE /api/users/:id/invites

| Test case |
| --- |
| revokes a pending invite, deleting the placeholder user (204) |
| refuses to revoke an active member with 409 |
| returns 404 for an unknown id |
| forbids a contributor (lacks users:delete) with 403 |

<!-- source: apps/server-e2e/src/server/users/set-user-status.spec.ts -->
_<sub>apps/server-e2e/src/server/users/set-user-status.spec.ts</sub>_

## POST /api/users/:id/(disable|enable)

| Test case |
| --- |
| disables an active member and revokes their sessions |
| lets a reactivated member sign in again, on a fresh session |
| refuses to let a member disable themselves with 409 |
| rejects disabling an already-disabled member with 409 |
| re-enables a disabled member |
| rejects enabling an already-active member with 409 |
| returns 404 disabling an unknown id |
| rejects an unauthenticated request with 401 |
| forbids a contributor (lacks users:update) with 403 |

<!-- source: apps/server-e2e/src/server/users/update-user.spec.ts -->
_<sub>apps/server-e2e/src/server/users/update-user.spec.ts</sub>_

## PATCH /api/users/:id

| Test case |
| --- |
| rejects an unauthenticated request with 401 |
| changes a member’s role and persists it |
| updates the display name |
| refuses to demote the last remaining admin with 409 |
| allows demoting an admin when another active admin remains |
| rejects an unknown role with 400 |
| rejects an unknown extra field with 400 |
| returns 404 for an unknown id |
| returns 400 for a non-uuid id |
| forbids a viewer (lacks users:update) with 403 |

<!-- source: apps/server-e2e/src/server/users/user-sessions.spec.ts -->
_<sub>apps/server-e2e/src/server/users/user-sessions.spec.ts</sub>_

## User sessions (admin)

| Test case |
| --- |
| rejects unauthenticated access with 401 |
| lists a member’s live sessions |
| marks the caller’s own session as current |
| revokes a session and drops it from the list |
| is idempotent — revoking an unknown session still 204s |
| lets a viewer read sessions but not revoke them (403) |
| returns 400 for a non-uuid user id |

<!-- source: apps/server-e2e/src/server/workspaces/create-workspace.spec.ts -->
_<sub>apps/server-e2e/src/server/workspaces/create-workspace.spec.ts</sub>_

## POST /api/workspaces

### authenticated admin (holds workspaces:create)

| Test case |
| --- |
| creates a workspace and seeds the creator as its sole member |
| rejects a duplicate slug with 409 |

### authorization

| Test case |
| --- |
| rejects an unauthenticated request with 401 |
| forbids a contributor (lacks workspaces:create) with 403 |
| forbids a viewer (lacks workspaces:create) with 403 |

### validation (400)

| Test case |
| --- |
| rejects a missing name |
| rejects a slug with illegal characters |
| rejects an unknown extra field |
| rejects a missing content block |

### OriginGuard (CSRF)

| Test case |
| --- |
| rejects a disallowed Origin with 403 |
| allows the configured app origin |
| allows a request with no Origin (non-browser client) |

<!-- source: apps/server-e2e/src/server/workspaces/update-workspace.spec.ts -->
_<sub>apps/server-e2e/src/server/workspaces/update-workspace.spec.ts</sub>_

## Update workspace (PATCH /api/workspaces/:id)

| Test case |
| --- |
| updates name, description, and color and records workspace.updated |
| applies a partial patch, leaving unspecified fields intact |
| is a no-op for an empty patch and records nothing |
| forbids a contributor (lacks workspaces:update) with 403 |
| 403s for an unknown workspace (never 404 — no id enumeration) |
| forbids an admin who is not a member of the workspace |

<!-- source: apps/server-e2e/src/server/workspaces/workspace-access.spec.ts -->
_<sub>apps/server-e2e/src/server/workspaces/workspace-access.spec.ts</sub>_

## Workspace access is scoped to membership

### GET /api/workspaces

| Test case |
| --- |
| returns only the workspaces the caller belongs to |
| is empty for a user who belongs to no workspace |
| starts returning a workspace once the user is added to it |
| requires workspaces:read |

### /api/workspaces/:id/… as a non-member

| Test case |
| --- |
| forbids reading the other tenant’s entry counts |
| forbids editing, archiving, and deleting it |
| forbids changing its members |
| forbids granting and revoking its content types |
| leaves the workspace untouched after every rejected call |

<!-- source: apps/server-e2e/src/server/workspaces/workspace-content.spec.ts -->
_<sub>apps/server-e2e/src/server/workspaces/workspace-content.spec.ts</sub>_

## Workspace content grants

### POST /api/workspaces/:id/content

| Test case |
| --- |
| grants a content type and records workspace.content_granted |
| is idempotent — re-granting records nothing new |
| 400s for an unknown content-type slug |
| forbids a viewer (lacks workspaces:update) with 403 |

### DELETE /api/workspaces/:id/content/:slug

| Test case |
| --- |
| revokes an empty content type and records workspace.content_revoked |
| refuses (409) to revoke a type that still has entries in the workspace |
| is a no-op (200) when the type was never granted |
| forbids a viewer (lacks workspaces:update) with 403 |

### GET /api/workspaces/:id/content/:slug/entry-count

| Test case |
| --- |
| reports zero for an empty type and the live count after a create |
| forbids a viewer (lacks workspaces:update) with 403 |

<!-- source: apps/server-e2e/src/server/workspaces/workspace-lifecycle.spec.ts -->
_<sub>apps/server-e2e/src/server/workspaces/workspace-lifecycle.spec.ts</sub>_

## Workspace lifecycle (archive / unarchive / delete)

### POST /api/workspaces/:id/archive

| Test case |
| --- |
| archives a workspace and records workspace.archived |
| is idempotent — archiving an archived workspace records nothing new |
| unarchives back to active and records workspace.unarchived |
| forbids a contributor (lacks workspaces:update) with 403 |
| 403s for an unknown workspace (never 404 — no id enumeration) |
| forbids an admin who is not a member of the workspace |

### DELETE /api/workspaces/:id

| Test case |
| --- |
| deletes a workspace and records workspace.deleted |
| forbids a contributor (lacks workspaces:delete) with 403 |
| 403s for an unknown workspace (never 404 — no id enumeration) |
| forbids an admin who is not a member from deleting it |
| forbids the entry-count read for a non-member admin |
| refuses (409) to delete a workspace that still has content entries |
| forbids the entry-count read for a contributor (lacks workspaces:delete) with 403 |

<!-- source: apps/server-e2e/src/server/workspaces/workspace-members.spec.ts -->
_<sub>apps/server-e2e/src/server/workspaces/workspace-members.spec.ts</sub>_

## Workspace members + activity

### workspace.created

| Test case |
| --- |
| records workspace.created when an admin creates a workspace |

### POST /api/workspaces/:id/members

| Test case |
| --- |
| adds a member and records workspace.member_added |
| is idempotent — re-adding a member records nothing new |
| 403s for an unknown workspace (never 404 — no id enumeration) |
| forbids a non-member admin from adding themselves |
| 404s for an unknown user |
| forbids a contributor (lacks workspaces:update) with 403 |

### DELETE /api/workspaces/:id/members/:userId

| Test case |
| --- |
| removes a member and records workspace.member_removed |
| removes the creator like any other member (no owner protection) |
| is a no-op (204) and records nothing when not a member |
| forbids a viewer (lacks workspaces:update) with 403 |
