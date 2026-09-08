# `@orthacms/protection-server`

The **publication-protection plugin** — a per-content-type rule requiring N
approvals before an entry may be published
([ADR-0017](../../../docs/adr/0017-publication-protection.md)). Three tables, the
rule surface, and the review surface those rules govern.

**Layout: layered (ADR-0003)**, in the thin-context shape `alarms` uses — a
Drizzle-backed repository and a service, not an aggregate. The only invariant
here is a unique index, and ADR-0003 is explicit that a thin context gets
mappers rather than a domain port with one implementation.

```
src/lib/
  protection.module.ts        the one dynamic module — takes no config
  protection.events.ts        the four domain-event kinds and their builders
  domain/errors/              transport-agnostic failures
  application/
    protection-rules.service.ts  which types a workspace may protect, + defaults
    entry-review.service.ts      the state of one entry, and the four writes
    review-queue.service.ts      every open request in the workspace
    dto/                         save-rule · review-note · queue-query
  infrastructure/
    schema/                   protection_rules · review_requests · review_approvals
    protection-rule.repository.ts  storage, and the upsert
    review-request.repository.ts   the ask; resolved, never deleted
    review-approval.repository.ts  the votes; every revision, not just the head
    head-revision.query.ts         asks content which version is the head
    purge/                    clears all three when a workspace is deleted
  http/controllers/
    protection-rules.controller.ts  /api/protection/rules
    entry-review.controller.ts      /api/protection/entries/:type/:id
    review-queue.controller.ts      /api/protection/queue
  docs/                       the OpenAPI pass — the view is an interface
```

## What it owns

| Route                                        | Scope     | Permission          |
| -------------------------------------------- | --------- | ------------------- |
| `GET /protection/rules`                      | workspace | `protection:manage` |
| `PUT /protection/rules/:kind/:slug`          | workspace | `protection:manage` |
| `DELETE /protection/rules/:kind/:slug`       | workspace | `protection:manage` |
| `GET /protection/entries/:type/:id`          | workspace | `content:read`      |
| `POST /protection/entries/:type/:id/request` | workspace | `content:update`    |
| `DELETE …/request`                           | workspace | `content:update`    |
| `POST …/approve`                             | workspace | `content:approve`   |
| `POST …/changes`                             | workspace | `content:approve`   |
| `DELETE …/approve`                           | workspace | `content:approve`   |
| `GET /protection/queue`                      | workspace | `content:read`      |

`protection:manage` is administrator-only and has **no `protection:read` beside
it** — the only such asymmetry in the catalogue. A contributor does need to know
that _this entry_ wants two approvals, and that answer comes from
`GET /protection/entries/:type/:id` under `content:read`, not from the
workspace's rule table. Nobody else has a reason to read the table, and a key
nobody needs is a key that only ever gets granted by accident.

`content:approve` is granted to **contributor and admin, never viewer** —
approving is an editorial act — and to **no API token scope at all**
(`protection:I-12`, pinned in identity's `api-token-scope.spec.ts`). A token
names nobody, so ADR-0017 §6's refusal to offer an approve tool on any agent
surface would buy nothing if minting a key cast the vote the tool may not.

The **decision** these rules feed — may this person publish this entry — is
`evaluateProtection` in `@orthacms/protection-domain` and is not re-implemented
here. `EntryReviewService` reads the rule, the head revision and the votes, and
hands all three to the kernel.

## How the head revision is reached

An approval is bound to a **revision**, so recording one means knowing which
version is currently the head and who wrote it. `content_entry_revisions` is
**host-owned** and modelled by `content-server`: this package owns none of it,
cannot declare a foreign key into it, and has no business knowing its column
names.

So `HeadRevisionQuery` asks content through its existing `RevisionStore` port,
which the review-routes PR exports from `content-server`'s barrel and its module
— the whole change to content in that PR. `RevisionStore.list` already answers
"newest-first, for this content type, in this workspace", which is both the
question and the authorization check an entry route needs before it records
anything: an entry with no revision under that type in that workspace is one
this workspace cannot review.

A new narrow port (`CONTENT_HEAD_REVISION`) was considered and rejected — a
second port over the same table is a second thing to keep in step for no gain.
Reaching into the table directly was rejected for the reason above.

## Every number comes from the kernel

`ProtectionDecision` carries `given` and `stale` only on its **refusal** branch:
the publish path needs them to say "2 required, 1 given", and a satisfied
publish needs no numbers. The editor does need them — it draws "2 of 2" — and
the obvious fix, counting the votes in the service, is the one thing this
package must not do. A count computed twice is a panel that disagrees with the
API refusing the publish, and it would disagree first on exactly the paths
nobody exercises: `countStaleApprovals` and the four-eyes exclusion.

So `countsOf` asks the kernel a question it is guaranteed to refuse — the real
rule with an unreachable threshold — and reads the counts off the refusal. One
implementation of counting, and the panel cannot drift from the gate.

## The decisions that are easy to get wrong

**Registering the plugin must change nothing.** With no rule row, publication
behaves byte for byte as it does with the plugin uninstalled — that is
[`protection:I-04`](../../../docs/design/protection.md), it is the state every
existing installation is in, and it is the first thing to keep true. The plugin
takes **no configuration** for the same reason: the rule table is the whole
configuration surface and its empty state is the off state.

**`PUT` replaces; it does not patch.** Every field is optional and every omitted
one takes its _default_, not its previous value. The settings form always sends
all six, and a partial body that quietly kept old values would make "what does
this rule do" a question about history rather than about the request. The
defaults live in `RULE_DEFAULTS` in the service — once, next to the reason — and
`definedOnly()` is what makes "omitted means default" true rather than nearly
true: `class-transformer` materialises an omitted optional as an explicit
`undefined`, which spread over the defaults would store a null.

**Unknown, wrong-kind and ungranted all answer 404.** Content's own
`resolveGrantedType` makes the same choice: telling them apart lets a member of
one workspace enumerate the deployment's content model through this tab.

**`DELETE` checks no grant and is idempotent.** Asking for a type to be
unprotected succeeds when it already is, and a rule stranded by a revoked grant
is precisely the row an administrator is trying to clear — a 404 would leave one
nothing in the product could reach. For the same reason `GET /rules` does **not**
filter by the current grants.

**A request is resolved, never deleted; an approval is deleted, never resolved.**
Withdrawing a request frees the partial unique index for the next ask while
leaving the row as history, so "sent for review on Tuesday, pulled back an hour
later" stays answerable and the audit row still points at something. Withdrawing
a _vote_ removes it outright — and only on the head. A vote on an earlier
version is already not counting, and deleting that one would erase the
struck-through line that is the only explanation for why the number moved after
a save.

**The four-eyes check refuses the write, not just the count.** The kernel
excludes the head author from the count, so a stored self-approval would be a row
that silently never counts: the reviewer sees their name in the list, the number
does not move, and nothing says why. `POST …/approve` answers **409** — not 403,
because the caller does hold `content:approve` and a 403 would send them asking
an administrator for a permission they already have.

**`managesProtection` is a permission, not a role.** Withdrawing somebody else's
request and being told a bypass is available both hang off `protection:manage`
rather than off the `admin` role key, because `system-roles.ts` says outright
that _"the routes gate on the permission, never on the role"_ — an operator who
mints a custom role holding that key has said that role administers protection
here.

**The upsert is one statement, not read-then-write.** Two administrators saving
the same tab would both find no row and both insert, and the second would 500 on
the unique constraint. `onConflictDoUpdate` lets the database arbitrate, which
it already knows how to do.

## The tables

Three, and **not one of them carries a foreign key into another plugin's
schema**:

- `workspace_id` — `workspaces` belongs to `workspaces-server`, and cross-plugin
  FKs are not how this codebase scopes rows. `ProtectionWorkspacePurger` is what
  removes them instead (`protection:I-16`, swept by
  `workspace-delete-residue.spec.ts`).
- `updated_by` / `requested_by` / `user_id` — the person may be deleted and the
  rule must outlive them.
- **`revision_id` — `content_entry_revisions` is host-owned**: `content-server`
  emits no migrations for it, the host's drizzle config re-exports it into the
  diff, and a plugin cannot declare an FK into a table whose migration it does
  not own. The integrity that matters is not referential anyway — a deleted
  revision leaving an approval that matches no head is exactly the wanted
  behaviour.

`kind` is `text` with a **check constraint**, not the `content_kind` enum: that
enum belongs to `workspaces`' schema, and importing another plugin's schema
object to share a type is a dependency this package should not take.

`review_requests` has a **partial** unique index on `entry_id where resolved_at
is null` — one _open_ request per entry, so asking twice updates the note rather
than stacking a second row into the reviewer's queue, while a resolved request
stays as history and does not block the next ask.

## Not here yet

Deliberately, and each is its own PR:

- **The `CONTENT_PUBLISH_GUARD` port and its provider.** Until it lands, a rule
  is stored and read but nothing consults it — publication is unaffected.
- **The review routes** (`request` / `approve` / `changes` / `queue`) and
  `content:approve`. The two tables they write are already here so the migration
  is written once.
- **`entry.publish_bypassed`.** It belongs to the guard provider, which is the
  only thing that can be bypassed.
- **Resolving a request on publish.** Withdrawing sets `resolved_at`; closing one
  because the entry went out needs the publish path, which is the same PR.
- **Mail on a review request.** After the mail port (ORT-207). Until then the
  queue page is the only way a reviewer learns there is work.
