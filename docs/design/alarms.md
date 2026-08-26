# Content alarms

> **Status:** shipped. The decision behind it is
> [ADR-0015](../adr/0015-alarms-are-non-blocking.md); the packages are
> [`alarms/server`](../../packages/alarms/server/AGENTS.md) and
> [`alarms/admin`](../../packages/alarms/admin/AGENTS.md), whose `AGENTS.md`
> files are the reference for their own internals. This document is the
> cross-cutting picture: what it catches, how a rule is made, and what it
> cannot do.

## The gap it fills

The schema already enforces everything that can be enforced hard. A required
field cannot be missing on a published record; a required link-managed relation
with zero links is a 422. That is not what alarms are for.

Alarms are for content that is **schema-valid and wrong**:

| Case                                                   | Why the schema cannot catch it                                                                                         |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| A published article whose author is a draft            | `publishedOnly` is a **read-time** visibility filter. The publish succeeds; the relation simply vanishes from the API. |
| A published article with no cover image                | Making it `required` would stop an incomplete draft from being saved, which is the whole point of a draft.             |
| Three thousand records written before Tuesday's policy | Nothing will ever raise an event about them again.                                                                     |

## The model

A **rule** is a content type, a saved records-list filter, a severity, and two
strings — its own name and the title its findings show. A **finding** is one
rule's verdict about one entry.

```
rule    ─ contentType, filter (the query-builder tree, verbatim), severity
finding ─ (rule, entry) → open | muted | resolved, first_seen_at, muted_reason
```

Everything else follows from those two sentences:

- **The rule editor is the query builder**, over the paths
  `/content-schema/:name/filter-fields` already publishes. No new grammar.
- **Evaluation is content's own `EntryMatchQuery`** — the same surface, parser
  and translator the records list uses, so a rule cannot mean something the list
  does not.
- **"Show me the flagged records"** is a link back into the list with the same
  filter.
- **The primary key `(rule_id, entry_id)` is the idempotency.** Outbox delivery
  is at-least-once; the upsert makes a re-delivered event a no-op.

## How a rule actually gets made

Not from a blank form. The sequence a person goes through is:

1. Something looks wrong → they filter the content list.
2. They see the fourteen records and confirm it by eye.
3. They ask the CMS to keep watching.

So **"Save as rule"** lives in the records toolbar, and the dialog asks for two
strings and a severity — the condition is already built and already checked.
There is no create-rule page at all; `AlarmRuleEditorPage` edits an existing
one.

The two strings are separate on purpose. The **rule name** is editorial policy
("Relations point at published records"); the **finding title** speaks to
whoever is looking at one article ("Author is not published").

## Where a finding shows up

| Surface                     | Slot                        | For whom                                       |
| --------------------------- | --------------------------- | ---------------------------------------------- |
| The entry editor's rail     | `ENTRY_SIDEBAR_WIDGET_SLOT` | An editor, on the page where it gets fixed     |
| A records-table column      | `RECORDS_COLUMN_SLOT`       | Someone scanning a collection (off by default) |
| The workspace's alarms page | its own workspace route     | Whoever owns editorial policy                  |

The first is the one the feature exists for: an editor never has to know a rule
exists. None of the three required a line of change in `content-admin`.

## When rules run

| Trigger                               | Examines                                           |
| ------------------------------------- | -------------------------------------------------- |
| `entry.created` / `updated`           | that entry, against every rule of its type         |
| `entry.published` / `unpublished` / … | ...plus the entries whose rules traverse **to** it |
| Saving or editing a rule              | the whole collection, against that one rule        |
| The periodic sweep                    | every active rule, one at a time                   |

The second row is the non-obvious one and the reason findings close themselves.
"This published article links to a draft author" is a fact about the _article_,
but the event that fixes it arrives about the _author_. So publishing an author
re-evaluates the articles whose rules traverse an author relation — the stored
rule composed with `AND author.id = <the author>`, which is expressible only
because the filter is a tree we can compose rather than a string.

The sweep exists for the rules events cannot cover: "not updated in 90 days"
describes an entry precisely because nobody is touching it. It is a plain
in-process interval (the outbox dispatcher's own backstop is the precedent), so
it is per-process and unsuitable for anything that must happen exactly once.

## The time bomb this uncovered

The query builder had a relative-date operator, `within_last`, that resolved to
a concrete cutoff **in the browser** at serialisation time. For a URL that is
deliberate and right — a shared "last 7 days" link should keep showing the rows
the sender saw. For a **stored** filter it is a silent bug: a rule reading "not
updated in 90 days", written today, would mean "not updated since 24 August"
for ever, and would look entirely normal in the editor while doing it.

So `within_last` became a real server-side operator
(`col >= now() - make_interval(...)`, resolved by Postgres at query time), and
`treeToJsonFilter` grew a `relativeDates` option. The list still freezes its
cutoff into links; the rule editor keeps the window relative. One consequence
worth knowing: a rule saved from the records toolbar inherits the URL's frozen
cutoff, because the URL has no way to say which of the two the person meant —
making it a rolling window is a one-line edit in the rule editor.

## What this cannot express

A rule is a **predicate on one row**. Anything that is a `GROUP BY` is outside
the model:

- "Two products share a slug"
- "This section has fewer than three articles"
- "This translation is older than its source"

Supporting them needs a second kind of rule and a second evaluator. That is out
of scope, not pending — and it is stated here rather than discovered in a demo.

Also out of scope for now:

- **Subjects other than content entries.** Media without `alt`, a user with no
  role. The mechanism generalises; the port to generalise it through is worth
  designing after a second subject actually exists, not before.
- **Delivery outside the CMS.** Webhooks are a feature in their own right and
  belong in their own plugin, built on the outbox's existing retry, backoff and
  dead-letter machinery rather than a queue of their own.

## Open question

`alarms:manage` is granted to **admin** only. Reading findings
(`alarms:read`) goes to every role, because the entry editor shows them inline
and a contributor who cannot see them cannot act on them.

The genuinely open half is **muting**: it is a statement about what the
workspace considers acceptable, which argues for `alarms:manage`, and a
contributor who cannot mute a false positive is stuck looking at it for ever,
which argues the other way. The current split leans strict. If it turns out to
be wrong, the fix is to let a contributor mute **with a mandatory reason**, so
silencing stays a visible decision rather than a way to clear the screen.
