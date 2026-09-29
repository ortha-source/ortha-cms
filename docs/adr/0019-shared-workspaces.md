# 0019 — Shared workspaces are a read-only exception to workspace isolation

- **Status:** Proposed — amended 2026-09-29 by
  [Explicit per-source grants](#amendment-explicit-per-source-grants), which
  supersedes the implicit grant rule below
- **Date:** 2026-09-28
- **Deciders:** Engineering

## Context

Every content row belongs to exactly one workspace, and every read, write and
bulk operation ANDs `workspace_id` (content dossier **I-04**). That isolation is
enforced in application code — the join tables and relation FKs carry no
workspace constraint — in a handful of places: the relation target checks on
write, the relation reads, the admin records list the relation picker reuses,
the public REST expansion, and GraphQL's nested loads.

Teams asked for the one thing isolation forbids: a **library** workspace — a
brand's authors, a shared tag vocabulary, legal copy — whose records other
workspaces can link to and render, without copying them into every workspace
and letting the copies drift. The need is read and link only; nobody asked to
edit another team's records from their own workspace.

The forces:

- The exception must not widen any **write**. A consumer editing or deleting a
  library record is exactly the cross-tenant access isolation exists to stop.
- It must be **one rule**, not five. Isolation is already spread across several
  read paths; a sharing rule restated at each one is five chances to drift, and
  a drift on a visibility rule is a leak.
- A consumer should see what a reader would see — **published** records — not
  the library's drafts.
- Workspaces already grant content types (`workspace_content`); a consumer that
  was never given `author` should not see anyone's authors.

## Decision

We will add a `workspaces.is_shared` flag (default `false`, toggled through the
existing `PATCH /workspaces/:id`, same permission, `workspace.setShared()` on the
aggregate). While a workspace is **shared** and **active**, every entry it holds
that is **published and not soft-deleted** is readable and linkable from every
**other** workspace that holds a grant for the entry's type. _(Superseded: "a
grant for the entry's type" is now an explicit **shared grant** naming the
source — see the amendment.)_

The rule lives in **one** read-side query, content's `SharedSourcesQuery`,
expressed as SQL sub-selects (`foreignVisibleWhere` / `visibleWhere`) so it
composes into the synchronous query builders every read path already uses. The
admin list's `?source=own|shared|all`, the single-entry read, relation link
reads and writes, the public relation expansion and GraphQL's nested loads all
call it; none restates it.

Everything that writes keeps the strict `workspace_id = :workspace` predicate.
A foreign id is a 404 on update, publish, unpublish, delete and every bulk
route. The inverse side of a many-to-many — whose "link" is a join row the
_target_ owns — may link and unlink only own records, because a foreign target
there would mean writing into the library's relation.

Visibility is **not transitive** (a shared workspace exposes its own rows, never
what it can itself see), an **archived** shared workspace exposes nothing, and a
link to a foreign target that stops being visible — unpublished, deleted,
unshared, archived, grant revoked — is **hidden** from every read while its row
stays in the database, so re-publishing restores it. The shared side can ask
`GET /content/:type/:id/usages` how many links other workspaces hold, by
workspace, before it unpublishes something.

The top-level public list of a type stays own-workspace: sharing extends what a
workspace's records may _point at_, not what its API _lists_. _(Superseded by the
amendment: with an explicit shared grant the public list is the union of the
type's visible sources.)_

### Agents (MCP and the copilot)

An agent authoring content has to _find_ a library record before it can link
one, so the agent tools follow the admin rule rather than the public one — the
same `SharedSourcesQuery`, never a restatement:

- `content_list` (MCP) and `admin_content_search` (copilot) take an optional
  `source: 'own' | 'shared' | 'all'`, default `own` (unchanged). Foreign rows
  are published and live whatever `status` asks of own rows; every item carries
  `source: { workspaceId, workspaceName } | null`. Page-size bounds and argument
  validation are unchanged.
- `content_get` (MCP) and `admin_content_get` (copilot) read a visible foreign
  entry with `source` and `readOnly: true` (own: `source: null`,
  `readOnly: false`). The MCP id-addressed reads beside it — `content_relations`,
  `content_media`, `content_translations` — follow the same visibility, media
  resolving in the entry's own workspace. The copilot's revision tools stay
  own-workspace (a record's history lives in its workspace) and say so for a
  visible foreign id rather than answering "no versions".
- Every write tool — MCP `content_update` / `_publish` / `_unpublish` /
  `_delete` / `_bulk_*`, the copilot's `content_propose_*` and their appliers —
  still writes through the strict own-workspace predicate. On a **visible**
  foreign id it fails with a 403 tool error naming the shared workspace, saying
  the record is read-only here, and telling the agent to link it by id instead
  of copying it. The explanation is computed only on the failure path and only
  for an id the caller could already read; an unknown, draft, deleted or
  ungranted id keeps the plain not-found, so it is no enumeration signal. The
  batch lifecycle tools, whose contract is that an unmatched id is silently
  skipped, refuse a batch naming a visible foreign id before writing anything.
- Linking a visible foreign record through a relation field keeps working
  unchanged. The tool descriptions say all of this in a sentence each: shared
  records are read-only here, find them with `source`, link by id, never create
  a local copy.

## Consequences

- One place to review. The visibility rule is a single class with two
  predicates; a change to it changes every surface at once, which is the point.
- Every admin relation read now carries a sub-select that drops links into
  foreign workspaces that are no longer visible. It is an indexed semi-join on
  the target table and is paid on join-backed reads only.
- Entries carry `source` (`null` for own) on the list and the single read, plus
  `readOnly` on the single read; relation refs carry `source`. The admin uses
  them to render library records as such and to hide write affordances.
- A consumer's own entry stays saveable while it holds an owning single FK to a
  library record that has since become invisible: an unchanged FK is not
  re-validated on update.
- Media of a library entry resolve in the entry's **own** workspace (the admin
  `/media` read and the public media expansion), since that is where the assets
  live.
- Reader entitlements (`CONTENT_READ_SCOPE`) are still AND-ed onto every public
  read of a foreign row. A reader's segment set is resolved in the consumer
  workspace, so a library record restricted to the library's own segments is
  hidden from consumers — the fail-closed direction.
- Some reads are still own-workspace by construction and ignore sharing: the
  admin list's relation-path `?filter=` sub-selects, the i18n sibling lookup for
  a foreign group's draft sibling, transfer's export graph walk, and revisions.
  They under-show rather than over-show.
- A library record linked by a consumer through a required single relation with
  `onDelete: 'restrict'` cannot be purged by the library until the consumer
  unlinks it — the database constraint still holds across workspaces.

## Alternatives considered

- **Copying records into consumers** (a sync job). Gives every workspace its own
  rows and keeps isolation absolute, but the copies drift, every edit fans out
  into N writes, and a consumer can edit a copy that is supposed to be
  canonical.
- **Per-record or per-type sharing ACLs** (share _this_ author with _those_
  workspaces). More precise, but it is a second permission system beside RBAC
  and content grants, and nothing the teams asked for needs it. The workspace
  flag plus the consumer's existing type grant covers the use cases with one
  boolean.
- **Transitive sharing** (a shared workspace re-exports what it can see). Makes
  the visible set a graph walk and the answer to "where did this record come
  from" ambiguous. Not needed; ruled out.
- **Restating the rule at each read path.** The shape isolation already had;
  rejected because the visibility rule is exactly the kind of predicate that
  drifts between copies.

## Amendment: Explicit per-source grants

- **Date:** 2026-09-29
- **Supersedes:** the implicit grant rule in _Decision_ ("every other workspace
  that holds a grant for the entry's type") and the own-workspace top-level
  public list.

### Context

One own grant `(workspace, kind, slug)` did two unrelated things: it let the
workspace author its own records of the type **and** silently exposed that type
from every shared workspace in the deployment. A team could not say "we use the
library's tags but keep none of our own", nor "we author our own tags and do not
want the library's", nor pick one library out of several. Sharing a new
workspace changed what every other workspace saw without anyone choosing it.

### Decision

`workspace_content` gains `source_workspace_id` (nullable, FK to `workspaces`,
`ON DELETE CASCADE`), unique over `(workspace_id, kind, slug,
source_workspace_id)` with `NULLS NOT DISTINCT`. A row with no source is an
**own grant**; a row with a source is a **shared grant** — "Tags · Travel
Library". The two are independent: a workspace holds either, both, or several
shared grants of one type.

```
visibleSources(W, slug) = (W holds the own grant ? [W] : [])
                        ∪ { S : W holds a shared grant (slug, S),
                                S is shared and active,
                                S holds its own grant for slug }
```

- A type is **reachable** from W when that set is non-empty. Reachability gates
  every **read**: the admin's `:typeName` read routes, `GET /content-schema`
  (catalogue `access`, detail, filter fields), relation targets on write and
  read, the picker, the public REST and GraphQL surfaces (the schema is built
  per reachable set), the MCP and copilot read tools, usages, and the I-50
  waiver — a required relation is waived only when its target is **not**
  reachable.
- **Writing** a type needs the **own** grant. A reachable type without one is a
  `403` — _This workspace can only use "Tags" records from shared workspaces; it
  cannot create its own._ — never the unknown-type `404`, because the type is
  visible. An unreachable type keeps the `404`, so nothing is enumerated.
- A shared grant whose source stops being shared, is archived, or drops its own
  grant is **inert** — kept, reported as `available: false`, exposing nothing.
  Revoking a shared grant needs no entry count: it owns no records.
- The admin list's `?source=own` is empty for a type without the own grant, and
  `?sourceWorkspaceId=` narrows a `shared` / `all` list to one visible source
  (anything else is a uniform 400); the
  top-level public list and entry reads return the union of the type's visible
  sources (foreign rows published only, no `source` on the wire).
- The rule is written once as data (`content-types/queries/content-access.ts`,
  pure and unit-tested) and once as SQL (`shared-grant.sql.ts`, composed into
  `SharedSourcesQuery` and `WorkspaceGrantsQuery`).
- Surface: `WorkspaceView.sharedContent`, `POST /workspaces/:id/content` with
  `sourceWorkspaceId`, `DELETE /workspaces/:id/content/:slug?source=`,
  `GET /workspaces/:id/shared-sources`, and `content.sharedContent` on create.
  The wizard's "All content" still means every **own** type only.

### Migration

The migration that adds the column preserves what every workspace could see:
for each own grant `(W, kind, slug)` and each shared, active `S ≠ W` holding its
own grant of `(kind, slug)`, it writes the shared grant `(W, kind, slug, S)`.
After it, sharing a workspace changes nothing for anyone until a consumer adds
a shared grant naming it.

### Consequences

- Sharing is opt-in on **both** sides: the source flags itself shared, each
  consumer picks it per type. A newly shared workspace exposes nothing.
- The grant table now answers two questions; every reader must say which it
  means. `WorkspaceGrantsQuery.grantedSlugs` is the own set (writes),
  `reachableSlugs` the readable set, `access` both with source names.
- An own grant alone no longer exposes any foreign record, so a workspace that
  never wants library content simply holds no shared grants.
