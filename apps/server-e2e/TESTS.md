# Server E2E test catalog

> **Generated file — do not edit by hand.** Regenerate with
> `npx nx catalog server-e2e` after adding, renaming or removing a test.
> `npx nx catalog:check server-e2e` fails if this file has drifted from the
> specs — run it locally; **no CI pipeline runs it today**, and none runs the
> suite itself either.

_1324 test cases across 86 spec files._

<!-- source: apps/server-e2e/src/harness/blob-store-isolation.spec.ts -->
_<sub>apps/server-e2e/src/harness/blob-store-isolation.spec.ts</sub>_

## media blob store

| Test case |
| --- |
| holds the bytes after an upload and drops them on delete |
| starts every test with no blobs left over from the last one |

<!-- source: apps/server-e2e/src/harness/create-server.spec.ts -->
_<sub>apps/server-e2e/src/harness/create-server.spec.ts</sub>_

## createServer (the host bootstrap)

### the request body cap is configured, not inherited

| Test case |
| --- |
| accepts a body well past express’s inherited 100 kB default |
| refuses a body over the configured cap with 413 |
| still accepts a body under the configured cap |

### a boot failure says which plugin failed

| Test case |
| --- |
| names the plugin whose onPluginInit throws, and rejects |

### one plugin’s bad docs pass does not take the API down

| Test case |
| --- |
| logs the plugin and still serves both the API and the reference |

### the docs mount paths

| Test case |
| --- |
| returns null, and mounts nothing, when docs are disabled |
| returns both mount paths normalised |
| serves both routes at a path configured without a leading slash |
| registers the JSON route first, so it wins a path collision |

### SIGTERM is handled rather than fatal

| Test case |
| --- |
| installs shutdown listeners so in-flight requests are not dropped |

### serving the admin bundle from staticDir

| Test case |
| --- |
| serves a real asset from the bundle |
| falls back to index.html for a deep client-side route |
| leaves an unknown API path as a JSON 404 |
| does not swallow a non-GET request |
| 404s a missing asset instead of returning the page |
| 404s a missing asset even when the client accepts HTML |
| gives a JSON client a 404 it can parse, not a page |
| serves the API only, without failing boot, when the bundle is absent |
| serves nothing extra when staticDir is omitted |

<!-- source: apps/server-e2e/src/harness/harness-guards.spec.ts -->
_<sub>apps/server-e2e/src/harness/harness-guards.spec.ts</sub>_

## harness guards

### serial execution (assertSerialExecution)

| Test case |
| --- |
| permits the pinned single worker |
| permits an unknown worker count rather than guessing |
| refuses two workers, naming the flag and the reason |
| refuses any count above one |
| yields to an explicit opt-in, for whoever implements the scheme |

### memory advisory (warnOnLowMemory)

| Test case |
| --- |
| says nothing when there is headroom |
| names memory as the suspect when there is not |
| reports a plausible amount for this machine |

### external database safety (assertDisposableExternalDatabase)

| Test case |
| --- |
| accepts a database whose name reads as disposable |
| refuses the exact database DATABASE_URL names |
| refuses it even when the two URLs are spelled differently |
| refuses a name that does not read as disposable |
| yields to an explicit opt-in for an oddly-named scratch database |
| never yields the DATABASE_URL check to that opt-in |

### infrastructure diagnostics (isDatabaseUnreachable)

| Test case |
| --- |
| recognises the pg-pool AggregateError seen in the wild |
| recognises a socket errno, however deeply wrapped |
| recognises `write EINVAL` from a socket that went away mid-write |
| recognises a Postgres admin-shutdown SQLSTATE |
| does NOT claim an assertion failure is infrastructure |
| does NOT claim a constraint violation is infrastructure |

### infrastructure diagnostics (withDatabaseDiagnostics)

| Test case |
| --- |
| re-labels a real pool failure as infrastructure, not a test failure |
| passes an assertion failure through untouched |
| returns the value when nothing goes wrong |

### SSE parsing (parseSse)

| Test case |
| --- |
| reads a frame written the way the server writes it |
| reads a frame written without the optional space |
| still skips comment frames |

<!-- source: apps/server-e2e/src/harness/harness-isolation.spec.ts -->
_<sub>apps/server-e2e/src/harness/harness-isolation.spec.ts</sub>_

## harness isolation (resetDb)

| Test case |
| --- |
| clears outbox_events, so an undispatched row cannot be retried inside a later test |
| clears non-system roles, so a seeded role key can be reused |
| leaves the system roles alone, because users FK them |
| leaves no workspace behind |

## harness lifecycle (a second app in one file)

| Test case |
| --- |
| boots a usable app after a previous one was closed |

<!-- source: apps/server-e2e/src/harness/production-parity.spec.ts -->
_<sub>apps/server-e2e/src/harness/production-parity.spec.ts</sub>_

## production parity

### the API reference rides the docs flag (setupApiDocs)

| Test case |
| --- |
| is not mounted with docs disabled (the production default) |
| is mounted, and describes the prefixed routes, with docs enabled |
| sits outside every guard, as an unauthenticated request proves |

### session cookie attributes follow the configured shape

| Test case |
| --- |
| emits Secure + SameSite=None when the deployment configures them |
| emits neither when the deployment does not (the test default) |

<!-- source: apps/server-e2e/src/server/activity/activity-coverage.spec.ts -->
_<sub>apps/server-e2e/src/server/activity/activity-coverage.spec.ts</sub>_

## activity coverage — which write paths produce an audit row

### media library

| Test case |
| --- |
| audits a folder create, rename and delete |
| audits an asset upload, edit, move and delete |
| never repeats the actor inside meta — it has two columns of its own |

### content entries

| Test case |
| --- |
| audits a create, an edit, a soft delete and a restore |
| records a permanent delete under its own kind |
| says nothing when a save changed no value |
| audits a bulk delete once per row it actually removed |
| writes the event in the same transaction as the entry |

### invite acceptance

| Test case |
| --- |
| records the activation as well as the sign-in |

### idempotency under redelivery

| Test case |
| --- |
| a re-delivered event does not double-record |

### a subject the mapper cannot name

| Test case |
| --- |
| parks the event instead of writing an empty-string subject |
| still records a membership event that does name its subject |

### the log has no write surface

| Test case |
| --- |
| rejects every verb but GET on /api/activity |

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
| rejects a bucket naming a workspace that does not exist |
| rejects a bucket that mixes real and phantom workspaces |
| still accepts an archived workspace — existence, not status |
| lists a multi-workspace token under each of its workspaces |
| rejects an expiry in the past |
| revokes a token |
| gates management on the tokens permissions |
| requires authentication |

### list pagination

| Test case |
| --- |
| returns an empty first page with a real total when there is nothing |
| returns an empty page past the last one, still with the real total |
| accepts the maximum page size and rejects one past it |
| rejects a zero or negative page |
| rejects a non-uuid workspace filter |
| pages without dropping or repeating a token |

### secrets at rest

| Test case |
| --- |
| stores the SHA-256 of the secret, never the secret |
| round-trips a name with RTL and multibyte characters intact |

### audit trail

| Test case |
| --- |
| records token.created when a token is minted |
| never writes the secret or its hash into the log |
| records token.revoked when a token is killed |
| audits a replayed revoke once, not once per call |
| writes nothing when the revoked id is unknown |
| writes no audit row when the mint is rejected |

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

<!-- source: apps/server-e2e/src/server/api-tokens/public-content-bulk.spec.ts -->
_<sub>apps/server-e2e/src/server/api-tokens/public-content-bulk.spec.ts</sub>_

## Public content API — batches (/api/v1)

### scope

| Test case |
| --- |
| refuses every batch route to a read-only token |
| 404s a type the workspace was not granted |

### save

| Test case |
| --- |
| creates and updates in one call, reporting each item |
| matches `bulk` as a route, not as an entry id |
| merges an update instead of replacing the values bag |
| saves the good items and reports only the bad one |
| fails only the item that names a bare translation group |
| adds a translation when the item says `op: "create"` |
| 400s an empty batch and one over the cap |

### publish

| Test case |
| --- |
| publishes the valid drafts and says why it skipped the rest |
| counts only the entries an unpublish actually changed |

### delete

| Test case |
| --- |
| removes the listed entries and counts them |

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
| reads back a relation written by the same create |
| does not widen draft visibility for a read-only token |

### read arguments are bounded exactly as REST bounds them

| Test case |
| --- |
| refuses %s over both protocols |
| caps a search needle passed as a variable |
| still accepts the boundary values REST accepts |

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
| costs a fragment bomb in linear time instead of hanging |
| costs a page size that comes from a variable default |
| lets the standard introspection query through |
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
| serves every casing of the route, from one rendered page |
| derives the endpoint through a trailing slash |

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
| 404s an empty token segment, without a 500 |
| 404s a token that is not hex, without a 500 |
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
| accepts the exact 12-character floor |
| accepts the exact 72-byte ceiling |
| counts the ceiling in bytes, so a 72-character accented passphrase is rejected |
| accepts a multibyte passphrase that fits inside 72 bytes |
| 400s when the confirmation does not match |
| rejects a request from a disallowed origin (CSRF defense) |
| 404s an invite for an account that is already active |

<!-- source: apps/server-e2e/src/server/auth/change-password.spec.ts -->
_<sub>apps/server-e2e/src/server/auth/change-password.spec.ts</sub>_

## Change password (ChangePasswordUseCase)

| Test case |
| --- |
| replaces the stored credential |
| signs out every device the old password had signed in |
| keeps the caller’s own session alive when one is named |
| touches nobody else’s sessions |
| writes a user.password_changed audit row naming the actor and the eviction count |
| audits a change that evicted nothing rather than staying silent |
| leaves the credential and the sessions alone when the account is unknown |
| refuses a password past bcrypt’s byte ceiling instead of truncating it |

<!-- source: apps/server-e2e/src/server/auth/login-throttle-proxy.spec.ts -->
_<sub>apps/server-e2e/src/server/auth/login-throttle-proxy.spec.ts</sub>_

## POST /api/auth/login (rate limit behind a trusted proxy)

| Test case |
| --- |
| buckets per forwarded client IP |
| does not let a second client inherit the first client’s exhaustion |
| records the forwarded client IP on the session, not the proxy’s |

<!-- source: apps/server-e2e/src/server/auth/login-throttle.spec.ts -->
_<sub>apps/server-e2e/src/server/auth/login-throttle.spec.ts</sub>_

## POST /api/auth/login (rate limit)

| Test case |
| --- |
| returns 429 once the limit is exceeded |
| ignores a spoofed X-Forwarded-For when no proxy is trusted |

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
| rejects an email with leading or trailing whitespace |
| rejects an oversized body with 413 rather than parsing it |
| treats SQL metacharacters in the email as data, not syntax |

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
| includes exactly the permission keys the user’s role grants |
| grants a viewer exactly the read-only set |
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

<!-- source: apps/server-e2e/src/server/auth/password-reset.spec.ts -->
_<sub>apps/server-e2e/src/server/auth/password-reset.spec.ts</sub>_

## reset a password

### POST /api/users/:id/password-reset

| Test case |
| --- |
| mints exactly one token and hands the raw value back once |
| stores only the hash — the raw token is not in the database |
| rotates: issuing again kills the previous link |
| refuses a second issue inside the cooldown, so a double-click cannot orphan the first link |
| 409s a pending member — there is no password to reset yet |
| 409s a suspended member — a reset must not reopen a closed account |
| 404s an unknown member |
| 403s a caller without users:update |
| 401s an unauthenticated caller |
| audits the issue against the admin who performed it |

### GET /api/auth/reset/:token

| Test case |
| --- |
| names the account the link is for, with no session |
| leaks nothing beyond the email and name |
| does not consume the token — the link survives a page refresh |
| 404s an unknown token |
| 404s an expired token |
| 404s an empty token segment, without a 500 |
| 404s a token that is not hex, without a 500 |
| does not honour an invite token — the two flows never cross |

### POST /api/auth/reset

| Test case |
| --- |
| sets the new credential and lets the member sign in with it |
| kills the old password |
| revokes every live session — the old password does not outlive itself |
| issues no session of its own — holding a link is not signing in |
| burns the token — the same link cannot be used twice |
| 404s an expired token, leaving the old password in place |
| 404s once the account has been suspended, even with a live link |
| rejects a password that misses the server rules |
| rejects a mismatched confirmation server-side |
| cannot be pointed at another account |
| rejects a hostile Origin |
| audits the change against the member, with the eviction count |

<!-- source: apps/server-e2e/src/server/auth/role-seeding.spec.ts -->
_<sub>apps/server-e2e/src/server/auth/role-seeding.spec.ts</sub>_

## System role seeding

| Test case |
| --- |
| seeds exactly the catalogue the code defines |
| grants each system role exactly its matrix row |
| is idempotent — a second run changes nothing |
| survives two instances seeding at once |
| prunes a permission the code no longer defines |
| revokes a stale grant of a permission that still exists |
| leaves a custom role’s grants of live permissions alone |
| drops a custom role’s grant of a permission the code retired |

<!-- source: apps/server-e2e/src/server/auth/roles-service.spec.ts -->
_<sub>apps/server-e2e/src/server/auth/roles-service.spec.ts</sub>_

## RolesService.delete

| Test case |
| --- |
| deletes a custom role |
| refuses to delete the %s system role |
| distinguishes "protected" from "missing" |
| is not idempotent — a second delete reports the role is gone |
| refuses concurrently, without one racer slipping through |

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

<!-- source: apps/server-e2e/src/server/auth/session-boundaries.spec.ts -->
_<sub>apps/server-e2e/src/server/auth/session-boundaries.spec.ts</sub>_

## Session lifetime boundaries

### lastUsedAt refresh throttle

| Test case |
| --- |
| does not write on every authenticated request |
| writes once the throttle window has elapsed, then throttles again |

### expiry instant

| Test case |
| --- |
| rejects a session at exactly its expiry, not just past it |
| keeps a session valid a moment before its expiry |

### secrets at rest

| Test case |
| --- |
| stores the session token’s digest, never the token |
| stores a password as bcrypt at cost 12 |

### Cookie header parsing

| Test case |
| --- |
| finds the session among two hundred other cookies |
| 401s on a malformed header rather than failing |
| 401s on an empty session value |
| 401s when the token arrives under a different cookie name |

<!-- source: apps/server-e2e/src/server/auth/sso-authority.spec.ts -->
_<sub>apps/server-e2e/src/server/auth/sso-authority.spec.ts</sub>_

## SSO authority

### just-in-time provisioning, off (the default)

| Test case |
| --- |
| creates nobody, however verified the address is |

### just-in-time provisioning, on

| Test case |
| --- |
| creates an active account on the configured role |
| gives the account no password, so only the provider can open it |
| records the provisioning as its own audit fact |
| lets a role-mapping handler choose the new account's role |
| falls back to the configured role when the handler names an unknown one |

### just-in-time provisioning, on for a different domain

| Test case |
| --- |
| refuses an address outside the allowed domains |

### role mapping on an account that already exists

| Test case |
| --- |
| leaves the role alone when no handler is configured |
| promotes when the handler says so |
| never demotes an administrator |

### accepting an invitation with a work account

| Test case |
| --- |
| activates the invited account and signs them in |
| sets no password, so the provider stays the only way in |
| just signs the same person in when they follow the link again |
| is spent for anybody else — the one-time guarantee |
| refuses a link addressed to somebody else |
| refuses an unverified address, however real the invite is |
| refuses a token that is not an invite at all |

### passwords turned off

| Test case |
| --- |
| refuses a password sign-in for an ordinary account |
| still accepts the root administrator — the break-glass path |
| leaves the SSO path working |

<!-- source: apps/server-e2e/src/server/auth/sso-logout.spec.ts -->
_<sub>apps/server-e2e/src/server/auth/sso-logout.spec.ts</sub>_

## SSO back-channel logout

| Test case |
| --- |
| ends the sessions one provider session opened |
| ends every session the account holds when told only the subject |
| leaves a password session alone — it was never the provider's to end |
| refuses an unverified notification |
| refuses a request with no token at all |
| is idempotent, because providers retry |
| says nothing about a subject with no account here |
| 404s for a provider nobody registered |
| tells intermediaries not to cache the answer |

<!-- source: apps/server-e2e/src/server/auth/sso.spec.ts -->
_<sub>apps/server-e2e/src/server/auth/sso.spec.ts</sub>_

## SSO sign-in

### the provider list

| Test case |
| --- |
| is public, and names what is registered |

### starting an attempt

| Test case |
| --- |
| sets a short-lived attempt cookie and redirects to the provider |
| sends a PKCE challenge and never the verifier |
| 404s for a provider nobody registered |
| refuses to carry %s as the post-sign-in destination |

### completing an attempt

| Test case |
| --- |
| signs in an existing account whose verified address matches |
| opens an ordinary session — indistinguishable from a password one |
| clears the attempt cookie, so a spent handle cannot ride along |
| links the identity, so the account survives an email change |

### the POST callback

| Test case |
| --- |
| completes a sign-in from a form post, as SAML returns one |
| refuses a form post with a foreign state, like the redirect route |

### refusals

| Test case |
| --- |
| refuses a callback with no attempt cookie |
| refuses a replayed callback — the attempt is one-time |
| refuses a foreign state before it exchanges anything |
| refuses a tampered response |
| refuses an unverified address, however real the account is |
| creates nobody — a verified stranger is still refused |
| refuses a disabled account, the same way the password path does |
| refuses a pending invite — accepting it is what makes it an account |
| refuses when the provider itself declines |

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
| skips an id from another workspace, and does not report it as done |
| skips a foreign id on bulk delete too, leaving its row alive |

### a delete refused by the database

| Test case |
| --- |
| 409s when an ON DELETE RESTRICT reference still points at the row |
| 409s the bulk variant too |
| deletes normally once the reference is detached |

### authorization

| Test case |
| --- |
| 401s unauthenticated writes |
| 403s a viewer on create and delete |
| lets a contributor create but not delete |

<!-- source: apps/server-e2e/src/server/content/content-grants.spec.ts -->
_<sub>apps/server-e2e/src/server/content/content-grants.spec.ts</sub>_

## Content grants on the admin API (workspace_content)

### an ungranted type answers exactly as an unknown one

| Test case |
| --- |
| 404s the schema of an ungranted type with the unknown-type body |
| 404s the entries list of an ungranted type with the same body |
| serves the granted type unchanged |

### reads

| Test case |
| --- |
| 404s every read route of an ungranted type |
| keeps the global /api/content-schema catalogue unscoped |

### writes

| Test case |
| --- |
| 404s a create of an ungranted type and writes no row |
| 404s update / publish / delete / bulk on an ungranted type |
| lets the granted type through unchanged |

### a workspace granted nothing

| Test case |
| --- |
| 404s every type, including ones other workspaces hold |

### a revoked grant

| Test case |
| --- |
| stops accepting creates as soon as the grant row is gone |

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

### workspace scoping

| Test case |
| --- |
| never surfaces the title of a target that lives in another workspace |

### batching

| Test case |
| --- |
| issues the same number of queries for a 1-row and a 5-row page |

<!-- source: apps/server-e2e/src/server/content/revision-scope.spec.ts -->
_<sub>apps/server-e2e/src/server/content/revision-scope.spec.ts</sub>_

## Revision scoping and permissions (/api/content/:type/:id/revisions)

### the :typeName is checked against the revision’s content_type

| Test case |
| --- |
| does not serve an article’s timeline under another type’s name |
| does not serve an article’s snapshot under another type’s name |
| refuses restore and publish of a version under another type’s name |

### workspace scoping

| Test case |
| --- |
| shows no history for an entry that lives in another workspace |

### restore is tolerant of a snapshot the type has outgrown

| Test case |
| --- |
| drops a stored key whose field no longer exists instead of 422ing |

### permissions by role

| Test case |
| --- |
| 401s every revision route without a session |
| lets a viewer read the timeline but not restore or publish a version |
| lets a contributor restore a version — restore is an edit (content:update) |
| lets a contributor publish a version — the role holds content:publish |
| separates the two gates: content:update alone restores but cannot publish |
| 403s a disallowed Origin on both write routes (CSRF) |

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
| serves a run naming no provider from the first registered one |
| routes to a later provider when the run names it |
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

### the model a thread was left on

| Test case |
| --- |
| starts null — a fresh thread has recorded no choice |
| records a concrete backend and serves it back |
| still accepts the legacy `default`, and stores it verbatim |
| 400s a backend the operator never registered |
| does not reorder the list — picking a model is not a use |
| 404s another user’s thread, like every other patch |

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

### a bad draft fails before anything is written

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

### a change that reaches other locales says so

| Test case |
| --- |
| names the sibling locales and the shared field on an edit |
| says nothing when the edit touches only localized fields |
| says nothing when the record has no other locales |
| the disclosure is true — the sibling really is rewritten |
| merges the disclosure across a batch, and counts the records |

### applying runs the ordinary use-case

| Test case |
| --- |
| writes the change and records who made it |
| appends a revision, because it went through the ordinary write |
| merges rather than replacing the untouched fields |
| reports a failed apply instead of claiming success |

### a batch translation is one change

| Test case |
| --- |
| writes every locale, carrying the shared values over |
| stops at the first failure and says how many landed |
| refuses a locale the record already has, before writing anything |

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

<!-- source: apps/server-e2e/src/server/copilot/copilot-run-authority.spec.ts -->
_<sub>apps/server-e2e/src/server/copilot/copilot-run-authority.spec.ts</sub>_

## Copilot run authority

### ADR-0005 §7 — the copilot cannot publish

| Test case |
| --- |
| refuses a `status` smuggled into a propose tool’s values bag |
| refuses a `status` smuggled in as a top-level tool argument |
| leaves an edited entry a draft, whatever the model asked for |
| offers no tool with a `status` parameter or a publish in its name |

### a parked run may only be answered by the user it belongs to

| Test case |
| --- |
| refuses another member of the same workspace |
| refuses a member of another workspace naming their own |
| lets the owner answer their own run |

### an apply-effect tool leaves a receipt

| Test case |
| --- |
| records a `copilot_proposals` row and a proposal frame |
| audits a failed apply as a failed tool call |

### the system prompt

| Test case |
| --- |
| states the untrusted-data rule exactly once |
| cannot be given new sections by the client |

### GET /copilot/proposals

| Test case |
| --- |
| will not confirm another user’s conversation id |

<!-- source: apps/server-e2e/src/server/copilot/copilot-skills.spec.ts -->
_<sub>apps/server-e2e/src/server/copilot/copilot-skills.spec.ts</sub>_

## Copilot skills

### the catalogue

| Test case |
| --- |
| serves the deployment’s code skills to anyone who may chat |
| withholds instruction bodies from the list |
| includes a workspace’s own enabled skills |
| leaves a disabled skill out of it |
| does not leak another workspace’s skills |

### authoring

| Test case |
| --- |
| lets an admin create, edit and delete one |
| 403s a contributor on every write |
| 409s a name a code skill already holds |
| 409s a name this workspace already uses |
| rejects a malformed name |
| 400s an empty patch |
| lists disabled and code skills on the manage route |

### a run

| Test case |
| --- |
| puts an always-on skill in force without being asked |
| puts an attached skill’s body in the prompt |
| lists an unattached skill without its body |
| records what a turn ran with on the transcript |
| ends the run with a readable error when a skill does not resolve |
| does not resolve a skill from another workspace |
| refuses more skills than one turn may carry |
| refuses instruction text in the request body |
| orders the skills sections after AUTHORITY and before ANSWERING |

<!-- source: apps/server-e2e/src/server/database/connection-pool.spec.ts -->
_<sub>apps/server-e2e/src/server/database/connection-pool.spec.ts</sub>_

## database connection pool limits

| Test case |
| --- |
| opens the pool with an explicit ceiling and an explicit wait |
| fails a checkout it cannot serve instead of waiting forever |
| serves the queue again as soon as a client comes back |

<!-- source: apps/server-e2e/src/server/database/outbox-dispatcher.spec.ts -->
_<sub>apps/server-e2e/src/server/database/outbox-dispatcher.spec.ts</sub>_

## OutboxDispatcher (drain, retry ceiling, concurrency)

| Test case |
| --- |
| claims the oldest batch, delivers it, and stamps what it delivered |
| delivers only to subscribers whose kinds match, once per registration |
| increments attempts and leaves the row pending when a subscriber throws |
| spaces retries out instead of burning the ceiling at commit rate |
| stops claiming a row once it has failed MAX_DELIVERY_ATTEMPTS times |
| does not let a full batch of poison rows starve the events behind them |
| collapses concurrent drains instead of running one per caller |
| keeps the pool usable when many units of work commit over a backlog |
| picks up a row nothing asked it to, once the poll backstop is running |

<!-- source: apps/server-e2e/src/server/database/unit-of-work.spec.ts -->
_<sub>apps/server-e2e/src/server/database/unit-of-work.spec.ts</sub>_

## UnitOfWork + OutboxWriter (transaction boundary)

| Test case |
| --- |
| runs the callback in one transaction, and a nested run joins it |
| rolls the appended events back with the state change that produced them |
| commits the events with the state change that produced them |
| is a no-op for an empty event array |
| rejects the whole unit of work when one append repeats an eventId |
| refuses an append outside a unit of work instead of committing it alone |
| reports whether a unit of work is active, and hands out the base connection outside one |

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

<!-- source: apps/server-e2e/src/server/i18n/i18n-locale-integrity.spec.ts -->
_<sub>apps/server-e2e/src/server/i18n/i18n-locale-integrity.spec.ts</sub>_

## i18n locale integrity (/api/content + /api/i18n + /api/insights)

### concurrent saves across a translation group

| Test case |
| --- |
| serializes two locales of one record instead of deadlocking |
| still lets a save with nothing to propagate through untouched |

### POST …/locale-summary is guarded like the POST it is

| Test case |
| --- |
| rejects a disallowed Origin |
| allows the app origin and a client that sends none, answering 200 |
| echoes back only the keys the caller supplied |

### rows in an unconfigured locale

| Test case |
| --- |
| is reported by the boot-time checker, with type, slug and count |
| finds nothing when every row is in a configured locale |
| is excluded from the panel, the summary and the list |
| is filtered out of the coverage aggregate (F26) |
| drops a group made only of unconfigured rows |

### virtual locale filters

| Test case |
| --- |
| counts only configured locales, so localeCount agrees with coverage (EC-25) |
| refuses hasLocale %s, which negates inside the EXISTS (EC-26) |
| rejects an operator the field does not admit (F19) |
| reads missingLocale in [...] as missing ALL of them (EC-27) |
| still answers the operators it does admit |

### authorization on the panel and the summary

| Test case |
| --- |
| lets a viewer read both — they hold content:read (EC-37) |
| rejects a non-member of the named workspace (EC-38) |
| 404s an entry id from another workspace, with no enumeration signal (EC-39) |

### language and direction on the wire

| Test case |
| --- |
| returns a resolved dir for every configured locale |
| carries locale + dir on the entry locale panel |
| returns the locale on the entry payload the editor reads |

<!-- source: apps/server-e2e/src/server/i18n/i18n-rtl-locales.spec.ts -->
_<sub>apps/server-e2e/src/server/i18n/i18n-rtl-locales.spec.ts</sub>_

## i18n locales (RTL)

| Test case |
| --- |
| infers rtl from the language subtag, and from a script subtag |
| lets an explicit dir override the inference |

<!-- source: apps/server-e2e/src/server/i18n/i18n-single-locale-coverage.spec.ts -->
_<sub>apps/server-e2e/src/server/i18n/i18n-single-locale-coverage.spec.ts</sub>_

## i18n coverage with one configured locale (/api/insights/i18n)

| Test case |
| --- |
| forces notLocalized to 0 — there is nowhere to translate to (F27) |
| lists only the one configured locale |

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
| counts only the workspace named by the header |

### GET /pipeline

| Test case |
| --- |
| splits each type into published and draft |
| omits a type the workspace has never used |
| counts only the workspace named by the header |

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
| counts only the workspace named by the header |
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
| reports the same figures per content type |
| omits a localized type the workspace has never used |
| orders types by how much content they hold |
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

### argument validation

| Test case |
| --- |
| refuses arguments the tool’s inputSchema rejects |
| refuses a call missing a required argument |
| still answers a permission refusal before it reads the arguments |
| lets a well-formed call through untouched |
| reports a non-uuid folderId as bad_request, not an opaque 500 |
| reports a non-uuid assetId as bad_request, not an opaque 500 |

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

### transport

| Test case |
| --- |
| 405s a GET rather than opening a stream nothing will ever write to |
| 405s a DELETE — there is no session to end |
| 401s an unauthenticated GET, before the verb is considered |
| 401s a bearer value carrying internal whitespace |
| 400s a repeated ?workspaceId= instead of ignoring it |
| answers an unknown method with -32601, not a 500 |
| 202s a notification with an empty body |
| answers a batch with one result per request |
| answers %s with a JSON-RPC error, not a 500 |
| 406s a POST that does not accept both content types |
| ignores an Mcp-Session-Id from a client that thinks it has one |
| answers an unreadable resource URI with -32002 and structured data |
| refuses a tool result over the endpoint ceiling |
| abandons a tool call that outlives the endpoint deadline |

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

### browsing a folder

| Test case |
| --- |
| pages, and reports the whole-folder total with each page |
| sorts over the whole folder, not over one page of it |
| searches names and tags, and counts only the matches |
| filters by kind alongside the search |

| Test case |
| --- |
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

<!-- source: apps/server-e2e/src/server/media/media-direct-serve.spec.ts -->
_<sub>apps/server-e2e/src/server/media/media-direct-serve.spec.ts</sub>_

## media direct serve

| Test case |
| --- |
| redirects an image to a signed URL instead of streaming it |
| never caches the redirect, which outlives the URL it points at |
| signs an uploaded .html as an attachment |
| authorizes before it redirects — a non-member gets the same 404 |
| still 404s an asset that does not exist |

## media direct serve, off by default

| Test case |
| --- |
| streams the bytes through the app |

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

<!-- source: apps/server-e2e/src/server/media/media-hardening.spec.ts -->
_<sub>apps/server-e2e/src/server/media/media-hardening.spec.ts</sub>_

## media hardening

### download hardening

| Test case |
| --- |
| serves an uploaded HTML file as an inert attachment |
| serves a scripted SVG as an attachment too |
| keeps a raster image inline, still with nosniff + CSP |
| hardens the token-authenticated /v1 download the same way |

### list filters

| Test case |
| --- |
| rejects a non-uuid folderId with 400, not 500 |
| rejects an unknown kind with 400, not 500 |
| still accepts the sentinel filter values |
| treats % and _ in ?search= as literal characters |

| Test case |
| --- |
| duplicates to a 400 when " copy" overflows the name limit |
| lets two sibling folders share a name |

<!-- source: apps/server-e2e/src/server/media/media-local-storage.spec.ts -->
_<sub>apps/server-e2e/src/server/media/media-local-storage.spec.ts</sub>_

## media assets on the local filesystem provider

| Test case |
| --- |
| writes the blob to <root>/<workspace>/<asset>/<name> and serves those exact bytes |
| leaves no file and no empty directory behind when the asset is deleted |
| refuses to serve a file outside the storage root when the stored key traverses |
| refuses to delete a file outside the storage root when the stored key traverses |
| answers 404 when the blob is missing from disk |
| does not name the storage key in the 404 body |

<!-- source: apps/server-e2e/src/server/media/media-storage-provider-check.spec.ts -->
_<sub>apps/server-e2e/src/server/media/media-storage-provider-check.spec.ts</sub>_

## storage provider boot check

| Test case |
| --- |
| refuses to boot over assets written by another provider |
| boots normally once no row names a foreign provider |

<!-- source: apps/server-e2e/src/server/media/media-token-scope.spec.ts -->
_<sub>apps/server-e2e/src/server/media/media-token-scope.spec.ts</sub>_

## media token download scope

| Test case |
| --- |
| serves the bytes when the header names the owning workspace |
| 404s when the header names another workspace in the same bucket |
| 400s a multi-workspace token that names no workspace at all |

<!-- source: apps/server-e2e/src/server/media/media-upload-cap.spec.ts -->
_<sub>apps/server-e2e/src/server/media/media-upload-cap.spec.ts</sub>_

## media upload cap (config-driven)

| Test case |
| --- |
| accepts a file of exactly the cap |
| rejects one byte over the cap with a 413 that names the limit |
| applies the same cap to the token upload route |

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

<!-- source: apps/server-e2e/src/server/tools/tool-registry.spec.ts -->
_<sub>apps/server-e2e/src/server/tools/tool-registry.spec.ts</sub>_

## Tool registry (one registry, two surfaces)

### both consumers mounted

| Test case |
| --- |
| shows one shared tool to both surfaces of one running app |
| keeps each surface’s narrowed tools to itself |

### the MCP endpoint unmounted

| Test case |
| --- |
| leaves the copilot a full catalogue |

### the copilot unmounted

| Test case |
| --- |
| leaves the MCP endpoint a full catalogue |

<!-- source: apps/server-e2e/src/server/transfer/transfer-round-trip.spec.ts -->
_<sub>apps/server-e2e/src/server/transfer/transfer-round-trip.spec.ts</sub>_

## Content transfer (/api/content/:type/export, /import)

### export

| Test case |
| --- |
| exports the selected record with its relations one hop out |
| leaves relations out when they are not asked for |
| reports what an export would carry without producing it |
| streams a ZIP when files are asked for, with the record files inside |
| exports a CSV whose header matches the type |
| offers a blank CSV template for the type |

### import

| Test case |
| --- |
| round-trips a graph: export, wipe, import, and it is back |
| dry-runs without writing, and says what it would do |
| skips an existing record by default rather than duplicating it |
| updates the matched record when the policy says so |
| adds a second copy when the policy says duplicate |
| links a related record that is already here instead of adding another |
| writes a fresh related record when the relation policy says recreate |
| updates the related record from the file when asked to |
| keeps the two policies apart: duplicate the record, link its author |
| never writes across workspaces, whatever the manifest claims |
| refuses a document written by a newer format version |
| rejects a file that is not a transfer document |
| requires a file at all |

### permissions

| Test case |
| --- |
| refuses export to a viewer, who may read but not take the library |
| refuses import to a viewer |
| refuses a signed-out caller |
| hides a content type the workspace was never granted |

### validation

| Test case |
| --- |
| rejects an unknown format |
| rejects an empty selection |
| rejects an unknown body field |
| rejects an unknown conflict policy |
| rejects an unknown relation policy |

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
| rejects a whitespace-only name with 400 |
| trims surrounding whitespace from the name |

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
| rejects an inherited Object.prototype name with 400, not a 500 |
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

### resend cooldown (INVITE_RECENTLY_SENT)

| Test case |
| --- |
| refuses a resend issued moments ago, with a machine code |
| allows the resend once the window has passed |
| does not apply to the first invite |
| keeps one live token when two resends race |

### conflict bodies carry a stable machine code

| Test case |
| --- |
| tags a resend to an active member as INVALID_MEMBER_STATE |
| tags a duplicate invite as EMAIL_TAKEN |

<!-- source: apps/server-e2e/src/server/users/origin-guard.spec.ts -->
_<sub>apps/server-e2e/src/server/users/origin-guard.spec.ts</sub>_

## OriginGuard — users-server state-changing routes

### PATCH /api/users/:id

| Test case |
| --- |
| rejects a disallowed Origin with 403 |
| allows the configured app origin |
| allows a request with no Origin (non-browser client) |
| does not escalate a role from a hostile Origin |

### POST /api/users/invites

| Test case |
| --- |
| rejects a disallowed Origin with 403 |
| allows the configured app origin |
| allows a request with no Origin (non-browser client) |

### POST /api/users/:id/disable

| Test case |
| --- |
| rejects a disallowed Origin with 403, leaving the account active |
| allows the configured app origin |

### POST /api/users/:id/enable

| Test case |
| --- |
| rejects a disallowed Origin with 403 |

### POST /api/users/:id/invites/resend

| Test case |
| --- |
| rejects a disallowed Origin with 403 |
| allows the configured app origin |

### DELETE /api/users/:id/invites

| Test case |
| --- |
| rejects a disallowed Origin with 403, leaving the row in place |
| allows the configured app origin |

### POST /api/users/:id/password-reset

| Test case |
| --- |
| rejects a disallowed Origin with 403, minting no link |
| allows the configured app origin |

### reads are unaffected

| Test case |
| --- |
| allows GET /api/users from any Origin |
| allows GET /api/users/:id from any Origin |

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

### display name is trimmed, and may not be blank

| Test case |
| --- |
| rejects a whitespace-only name with 400 |
| trims surrounding whitespace from a real name |

### conflict bodies carry a stable machine code

| Test case |
| --- |
| tags a self role change as SELF_ACTION |
| tags demoting the last admin as LAST_ADMIN_PROTECTED |

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
| 403s a viewer on both routes — a session list is not `users:read` data |
| 403s a viewer reading even their OWN session list |
| 403s a contributor — the gate is the permission, not the role |
| never exposes a session token beyond the revocation handle |
| returns 400 for a non-uuid user id |
| returns an empty list for a member with no live sessions |
| returns an empty list for a user id that does not exist |
| scopes a revoke to :id — a session belonging to someone else survives |
| is idempotent — revoking the same session twice still 204s |
| takes effect on the member’s very next request, with no cache TTL |

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

<!-- source: apps/server-e2e/src/server/workspaces/workspace-regressions.spec.ts -->
_<sub>apps/server-e2e/src/server/workspaces/workspace-regressions.spec.ts</sub>_

## Workspaces regressions

### removing the last member

| Test case |
| --- |
| is refused, leaving the workspace reachable |
| still allows leaving while another member remains |

### concurrent creates with the same slug

| Test case |
| --- |
| yields exactly one 201 and 409s the losers, never a 500 |

### invited member emails

| Test case |
| --- |
| rejects %s instead of provisioning a user |
| still provisions a pending account for a real address |

### members array size

| Test case |
| --- |
| refuses an array past the cap |

### read routes that fed the create/grant decision

| Test case |
| --- |
| 403s the slug probe for a role that cannot create |
| 403s the content-type catalogue for a role that can neither create nor update |
| still serves both to a role that can create |

### deleting a workspace purges its cross-plugin rows

| Test case |
| --- |
| removes media and token-bucket rows that no foreign key reaches |
| drops the workspace from a token bucket without revoking the token |
| leaves another workspace’s rows untouched |
| purges nothing when the delete is refused |

### the outbox survives a dispatcher outage

| Test case |
| --- |
| commits the change, holds the event, and audits it on recovery |
