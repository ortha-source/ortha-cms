# Inbox — what a person was told, across every workspace

Packages: `@orthacms/inbox-domain`, `@orthacms/inbox-server`, `@orthacms/inbox-admin`.
Decision: [ADR-0023](../adr/0023-notices-and-the-inbox.md).

## 01. Business description

### The problem it solves

Review requests and alarm findings ask people for something and then wait for them to
notice. Before the inbox the only way to notice was to go and look — the Reviews page, the
Alarms page, Home. Somebody working inside one workspace heard nothing about the others.

The inbox is one list per person of the things that concern them, in every workspace they
belong to, with a read state: **Margaret asked you to review “Team page”**, **Alarm “Author
is not published” flagged 3 records**, **“Spring sale” has every approval it needs — you can
publish it**, **Your approval of “Pricing FAQ” no longer counts — it changed since**.

### Who sees it

Every signed-in person, about their own items. There is no permission: an inbox is the
person's own, like their preferences. API tokens never reach it — a token names nobody.

### Where it shows

- **Inbox** in the global sidebar's Overview group, with the unread count.
- A button beside **← Home** in a workspace's sidebar, with the same count.
- `/inbox`: tabs **All · Reviews · Alarms · Updates** (in the URL, `?tab=`), each with its
  unread count; items split into **Today** and **Earlier**; one action per item that opens
  it and marks it read; **Mark all as read** in the top bar.

### What it is not

- **Not mail.** Mail's notices ([ADR-0023](../adr/0023-notices-and-the-inbox.md)) are the
  same moments by email; each works without the other.
- **Not the activity log.** The log is what happened in the system, for administrators; the
  inbox is what concerns one person, for that person.
- **Not a subscription system.** Producers decide who hears about what; there is nothing to
  follow.

## 02. Composition

| Package        | Role                                                                   |
| -------------- | ---------------------------------------------------------------------- |
| `inbox-domain` | Kinds, payloads, tabs, the `INBOX_WRITER` port. No dependencies.       |
| `inbox-server` | `inbox_items`, `/api/inbox`, the writer adapter, the workspace purger. |
| `inbox-admin`  | The page, the sidebar row's count, the workspace header's button.      |

Producers today: **protection** (`review.requested`, `review.ready`,
`review.approval_stale`) and **alarms** (`alarm.flagged`).

| Kind                    | Tab     | To whom                                  | When                                                  |
| ----------------------- | ------- | ---------------------------------------- | ----------------------------------------------------- |
| `review.requested`      | reviews | each reviewer a request newly names      | a request is opened, or its reviewers change          |
| `review.ready`          | updates | the requester                            | the vote that completes the kernel's count            |
| `review.approval_stale` | reviews | who approved the version a save replaced | a save, on a rule that does not count stale approvals |
| `alarm.flagged`         | alarms  | the alarm's creator                      | a scan opens new findings on it                       |

## 03. Data model

`inbox_items(id, user_id, workspace_id?, kind, category, payload jsonb, link, dedupe_key,
created_at, read_at?)`, unique `(user_id, dedupe_key)`. No foreign keys out of the table.

## 04. HTTP API

| Route                  | Answer                                                 |
| ---------------------- | ------------------------------------------------------ |
| `GET /inbox`           | `{ items, nextCursor }`, newest first                  |
| `GET /inbox/summary`   | `{ unread, byCategory: { reviews, alarms, updates } }` |
| `POST /inbox/read`     | `{ marked }`                                           |
| `POST /inbox/:id/read` | 204; 404 for an id that is not the caller's            |

## 05. Invariants

- **I-01** Every route reads or writes the caller's own rows; no route names a user.
- **I-02** An item about another person's id answers exactly like one that does not exist.
- **I-03** Delivering the same `(user, dedupeKey)` twice stores one item.
- **I-04** An item written by a use case commits with that use case's write or not at all.
- **I-05** The list and the counts show only items about no workspace or about one the
  person still belongs to; leaving hides, rejoining shows again.
- **I-06** Deleting a workspace deletes its items.
- **I-07** The sidebar count, the header button and the tab counts are one read and agree.
- **I-08** Opening an item marks it read; marking read changes nothing outside the inbox.
- **I-09** A failed read is never shown as an empty inbox.
- **I-10** With the inbox plugin unregistered, producers behave exactly as before.
- **I-11** Every kind files under exactly one tab, and an unknown kind still renders.

## 06. Testing checklist

| Action                                  | Expected                                           |
| --------------------------------------- | -------------------------------------------------- |
| Ask Boris to review                     | One `review.requested` item for Boris, nobody else |
| Change the reviewers to Boris and Carla | An item for Carla only                             |
| Second approval on a two-approval rule  | A `review.ready` item for the requester            |
| Save after Boris approved               | A `review.approval_stale` item for Boris           |
| Same outbox event delivered twice       | One item                                           |
| Mark another person's item read         | 404                                                |
| Leave the workspace                     | Its items disappear from the list and the counts   |
| Open an item                            | It is read; the counts drop everywhere             |
| Inbox API fails                         | The page says it could not load                    |

Server: `apps/server-e2e/src/server/inbox/inbox.spec.ts`. Browser:
`apps/admin-e2e/src/inbox/inbox.spec.ts`.

## 07. Where the code and the documentation diverge

None known at the time of writing. Named gaps: read items are never pruned, and a deleted
user's items are not purged (they are unreachable).
