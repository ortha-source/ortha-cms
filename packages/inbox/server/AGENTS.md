# @orthacms/inbox-server

The in-app inbox's server plugin
([ADR-0023](../../../docs/adr/0023-notices-and-the-inbox.md)): one table of
things a person was told, the `/api/inbox` routes over their **own** rows,
and the `INBOX_WRITER` adapter producers inject optionally.

**Layout: layered (ADR-0003)**, thin-context shape — a repository and a
service, no aggregate.

```
src/lib/
  inbox.module.ts             global; binds INBOX_WRITER
  application/
    inbox.service.ts          pages (cursor), unread summary, read state
    dto/inbox-query.dto.ts    ?category, ?unread, ?before, ?limit; mark-all body
  infrastructure/
    schema/inbox-items.ts     inbox_items
    inbox-item.repository.ts  deliver (idempotent), pages, counts, read
    inbox-writer.service.ts   the INBOX_WRITER adapter
    inbox-workspace.purger.ts a deleted workspace's items go with it
  http/inbox.controller.ts    /api/inbox
  docs/describe-inbox-api.ts  the OpenAPI pass
```

## Routes

| Route                  | What                                                   |
| ---------------------- | ------------------------------------------------------ |
| `GET /inbox`           | One page, newest first; `category`, `unread`, `before` |
| `GET /inbox/summary`   | Unread, in total and per tab — the navigation badge    |
| `POST /inbox/read`     | Mark everything (or one tab) read                      |
| `POST /inbox/:id/read` | Mark one read; idempotent; 404 if not the caller's     |

**No permission and no workspace header.** Every route reads or writes the
caller's own rows, identified by the session, like `/api/preferences`. API
tokens never reach it: the app-wide guard is a session guard, and a token
names no person to have an inbox. The writes carry `OriginGuard`.

## The decisions that are easy to get wrong

**Delivery joins the caller's transaction when there is one.** A use case
(protection's `requestReview`) writes its items inside its unit of work, so an
item about a request that rolled back is never stored. An outbox subscriber
has none, and `UnitOfWork.current()` is then the base pool — safe because
`(user_id, dedupe_key)` is unique and a retried delivery is
`ON CONFLICT DO NOTHING`.

**Leaving a workspace hides its items; deleting it removes them.** The list
and the counts read only items about no workspace or about one the person is
still a member of (an `EXISTS` over `memberships`), so rejoining brings them
back. `InboxWorkspacePurger` deletes a deleted workspace's items — `workspace_id`
carries no foreign key, as no cross-plugin column here does.

**Someone else's id reads like no id.** `POST /inbox/:id/read` answers 404 for
both, so the route is no oracle for other people's item ids.

**The cursor is opaque and stable.** `createdAt|id`, ordered on both, so an
item arriving while somebody pages never shifts a page under them.

## Not here yet

- **Retention.** Read items are kept; nothing prunes them yet.
- **A deleted user's items** are not purged (users have no purge registry);
  they are unreachable, since only that user's session can read them.
