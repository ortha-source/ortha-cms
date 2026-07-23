# Server E2E test catalog

> **Generated file — do not edit by hand.** Regenerate with
> `npx nx catalog server-e2e`. CI runs `npx nx catalog:check server-e2e`
> and fails if this file has drifted from the specs.

_359 test cases across 32 spec files._

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
| does not sync a relation to a localizable target across locales |
| syncs shared fields when a sibling is created into the group |
| 422s and rolls back when the sync would invalidate a published sibling |

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
| refuses to delete a non-empty folder with 409 |

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
| 404s for an unknown workspace |

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
| 404s for an unknown workspace |

### DELETE /api/workspaces/:id

| Test case |
| --- |
| deletes a workspace and records workspace.deleted |
| forbids a contributor (lacks workspaces:delete) with 403 |
| 404s for an unknown workspace |
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
| 404s for an unknown workspace |
| 404s for an unknown user |
| forbids a contributor (lacks workspaces:update) with 403 |

### DELETE /api/workspaces/:id/members/:userId

| Test case |
| --- |
| removes a member and records workspace.member_removed |
| removes the creator like any other member (no owner protection) |
| is a no-op (204) and records nothing when not a member |
| forbids a viewer (lacks workspaces:update) with 403 |
