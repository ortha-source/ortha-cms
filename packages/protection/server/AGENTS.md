# `@orthacms/protection-server`

The **publication-protection plugin** — a per-content-type rule requiring N
approvals before an entry may be published
([ADR-0017](../../../docs/adr/0017-publication-protection.md)). Three tables and
one rule surface.

**Layout: layered (ADR-0003)**, in the thin-context shape `alarms` uses — a
Drizzle-backed repository and a service, not an aggregate. The only invariant
here is a unique index, and ADR-0003 is explicit that a thin context gets
mappers rather than a domain port with one implementation.

```
src/lib/
  protection.module.ts        the one dynamic module — takes no config
  domain/errors/              transport-agnostic failures
  application/
    protection-rules.service.ts  which types a workspace may protect, + defaults
    dto/save-protection-rule.dto.ts
  infrastructure/
    schema/                   protection_rules · review_requests · review_approvals
    protection-rule.repository.ts  storage, and the upsert
    purge/                    clears all three when a workspace is deleted
  http/controllers/
    protection-rules.controller.ts  /api/protection/rules
  docs/                       the OpenAPI pass — the view is an interface
```

## What it owns

| Route                                  | Scope     | Permission          |
| -------------------------------------- | --------- | ------------------- |
| `GET /protection/rules`                | workspace | `protection:manage` |
| `PUT /protection/rules/:kind/:slug`    | workspace | `protection:manage` |
| `DELETE /protection/rules/:kind/:slug` | workspace | `protection:manage` |

`protection:manage` is administrator-only and has **no `protection:read` beside
it** — the only such asymmetry in the catalogue. A contributor does need to know
that _this entry_ wants two approvals, but that answer comes from the entry
under `content:read` (a later PR), not from the workspace's rule table. Nobody
else has a reason to read the table, and a key nobody needs is a key that only
ever gets granted by accident.

The **decision** these rules feed — may this person publish this entry — is
`evaluateProtection` in `@orthacms/protection-domain` and is not re-implemented
here. This package never reads an approval or a revision.

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
- **Activity events.** `protection.rule_changed` (`protection:I-14`) is _not_
  emitted yet, so a rule change currently leaves no audit row. The service
  already opens a `UnitOfWork` around the write for exactly that reason — the
  event will land in the same transaction as the row rather than becoming a
  second thing to remember.
