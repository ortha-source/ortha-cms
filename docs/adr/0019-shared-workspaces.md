# 0019 — Shared workspaces are a read-only exception to workspace isolation

- **Status:** Proposed
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
**other** workspace that holds a grant for the entry's type.

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
workspace's records may _point at_, not what its API _lists_.

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
