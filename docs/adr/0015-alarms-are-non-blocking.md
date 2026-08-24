# 0015 — Alarms flag content, and never block a write

- **Status:** Accepted
- **Date:** 2026-08-24
- **Deciders:** Engineering

## Context

The CMS enforces content rules in exactly one place: the content type's schema.
`EntryValidationService` checks values, `publish-gate.ts` decides whether an
entry may go live, and `EntryWriterService` counts link-managed relations before
a publish. Those rules are hard, and they are the right kind of hard — a field
declared `required` cannot be missing on a published record.

But a large class of real content problems is not expressible there, and should
not be:

- **A published entry pointing at a draft one.** The publish succeeds; the
  public API's `publishedOnly` visibility simply omits the relation at read
  time, so the page ships with the author missing and nobody is told.
- **Fields that are optional by schema and mandatory by policy.** A cover image,
  an SEO description. Making them `required` would be wrong: a draft has to be
  saveable while incomplete, which is exactly why publishable types keep their
  required columns nullable.
- **Editorial policy that arrives after the content.** A rule agreed on Tuesday
  says nothing about the three thousand records written before it. No event will
  ever fire for them.

None of these can be checked while validating one entry's values, and none of
them should stop anyone from saving.

We also had to decide where such rules would come from. A rule needs a
condition, and a CMS that grows a second query language grows a second set of
bugs, a second thing to document, and a second surface that drifts from the
first.

## Decision

We will add an **alarms** plugin that evaluates workspace-defined rules against
content and records **findings**, under three rules.

**1. An alarm never blocks a write.** No severity — `info`, `warn` or `error` —
gates a save, a publish, or any other operation. Severity orders a list and
colours a chip. A rule produces information; a person decides what to do with
it.

**2. A rule is a saved records-list filter.** `alarm_rules.filter` stores the
exact query-builder tree the records list puts in `?filter=`, and it is
evaluated through content's own `EntryMatchQuery` — the same surface, parser and
translator the list uses. There is no alarms query language.

**3. A finding is state, not an event.** `alarm_findings` holds one row per
`(rule, entry)` pair. It opens when the entry starts matching, resolves itself
when it stops, and can be muted with a reason that survives both.

## Consequences

**What this makes easy.**

- The rule editor is the query builder that already exists, over the paths the
  server already publishes. Nothing new to learn, document, or keep in step.
- "Save this filter as a rule" is a real one-click flow, and it is the primary
  way rules get made: someone filters a list because something looks wrong, sees
  the fourteen records, and asks the CMS to keep watching. The condition is
  already built and already checked by eye.
- "Show me the flagged records" is a link back into the list with the same
  filter.
- Findings close themselves. Publishing the draft author closes the finding on
  every article that linked to it, with nobody pressing anything.
- Because delivery is at-least-once and the finding's key is
  `(rule_id, entry_id)`, the evaluator is idempotent by construction rather than
  by care.

**What this makes harder, and what it rules out.**

- **A rule cannot express an aggregate over the collection.** "Two products
  share a slug", "this section has fewer than three articles" are `GROUP BY`
  questions, not predicates on a row, and the filter grammar cannot say them.
  Supporting them would need a second kind of rule and a second evaluator. That
  is out of scope, not pending.
- **The first request after this ships will be for a blocking severity.** The
  answer is this ADR. A severity with veto power makes the alarms plugin and the
  publish gate two competing authorities on whether an entry is valid, and they
  will disagree — at which point neither can be trusted, and the one that is
  actually enforced (the gate) is the one nobody is reading. If something must
  not be publishable, it belongs in the content type's schema.
- **A stored filter means something a URL filter does not.** The query builder
  resolves a "within the last N days" window into a concrete cutoff when it
  serialises into a link, deliberately — a shared deep link should keep showing
  the same rows. A stored rule needs the opposite, so `within_last` became a
  real server-side operator and `treeToJsonFilter` grew a `relativeDates`
  option. Without it, "not updated in 90 days" would have quietly meant "not
  updated since the day the rule was written".
- **Rules about entries nobody touches need a periodic pass.** "Not updated in
  90 days" describes an entry precisely because no events are being raised about
  it. The plugin therefore runs an in-process interval sweep. That is a
  per-process timer, not a scheduler, and is unsuitable for anything that must
  happen exactly once.

## Alternatives considered

**Extend `EntryValidationService`.** Rejected: it is the publish authority, and
adding advisory rules to it means either they gain veto power (see above) or the
service starts returning issues that mean two different things.

**A module inside `content/server`, like `insights/`.** Tempting, and rejected
on one practical ground: a plugin owns its tables and its migrations, and moving
tables between plugins later is real work. The owner is chosen once, and it is
cheaper to choose it now. `transfer` (ADR-0014) is the precedent for a plugin
that depends on content without living in it.

**A rule expression language.** Rejected. It would duplicate the filter engine's
semantics, its security whitelist, its relation-hop budget and its error
reporting, and the two would drift the first time either gained an operator.

**Findings as an append-only event log.** Rejected on three counts: a re-delivered
outbox event would duplicate rows; every save would raise a fresh notification
about a problem the reader already knows; and "how many problems are open" would
become a fold over a journal instead of a count.

**Ship webhook delivery with it.** Deferred. Webhooks are a feature in their own
right (publish → revalidate a front end, trigger a deploy) and belong in their
own plugin, built on the outbox's existing retry, backoff and dead-letter
machinery rather than a delivery queue of the alarms plugin's own.
