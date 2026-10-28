# 0023 — Notices: a second kind of mail, and an inbox, so people hear about work

- **Status:** Accepted
- **Date:** 2026-10-28
- **Deciders:** Engineering

## Context

Two features ask people for something and then wait for them to notice.
Publication protection ([ADR-0017](0017-publication-protection.md)) records a
review request against named reviewers; alarms
([ADR-0015](0015-alarms-are-non-blocking.md)) flag records that need fixing.
In both, the only way the person learns there is work is to go and look: the
Reviews page, the Alarms page, Home's attention cards. `docs/artifacts/protection.md`
calls the missing review mail "the single largest usability gap in the feature
as shipped".

The mail port ([ADR-0018](0018-mail-provider.md)) exists, but it was built for
one kind of message and says so everywhere: a `TransactionalMail` carries a
raw token that exists only inside the issuing transaction, its row expires
with the token, and `reveal-link` hands the newest undelivered row's link back
as a secret. `docs/design/mail.md` also scopes out "digests, subscriptions" —
written when the only messages anybody wanted were invitations and resets.

## Decision

**1. Mail gets a second kind of message — a _notice_ — beside the
transactional one, through a second port.** `NOTIFICATION_DISPATCHER` /
`NotificationDispatcher.notify(notice)` in `@orthacms/mail-domain`, bound by the
mail plugin to the same service and the same queue. A notice is a
discriminated union (`review_requested`, `alarm_digest`) with its own typed
fields, its own templates (`DEFAULT_NOTIFICATION_TEMPLATES`, overridable per
kind through `notificationTemplates`), **no token and no stored link**, and a
fixed time-to-live (`NOTICE_TTL_MS`, three days) after which an undelivered
row is swept. `reveal-link` reads token kinds only, so a newer notice can never
hide an invite's link. A notice is still queued in the caller's transaction:
a request that rolls back tells nobody.

**2. A review request mails the reviewers it newly names** — inline in
`EntryReviewService.requestReview`, inside its unit of work. Changing the
reviewers mails only the people added; approvals, saves and the reopen after a
publish send nothing.

**3. Alarms send a digest, not a message per finding.** A periodic loop in
`alarms-server` builds one message per recipient per period (daily by default,
weekly or off by preference) listing what was newly flagged in errors and
warnings; `info` never mails. A database claim (`alarm_digest_runs`, unique per
recipient and period) makes "once per period" true across processes, which a
per-process timer alone cannot (ADR-0015 says as much of the sweep).

**4. An in-app inbox** — `@orthacms/inbox-{domain,server,admin}` — holds the
same events as items a person can read and mark read, across every workspace
they belong to. Producers write through an optional `INBOX_WRITER` port
(the mail pattern: the producer owns the words, the inbox owns storage), so
the inbox package depends on no feature and a host without it changes nothing.

**5. Counts in the navigation** — "Reviews 3", "Alarms 2", and the same per
workspace in the global sidebar's list — are reported by the owning plugin
through `useBadge` hooks and drawn by the navigation.

## Consequences

- `docs/design/mail.md`'s "no digests" line is superseded for notices; the
  rest of its scope (no marketing, no subscriptions to arbitrary content, no
  template editor, no second channel) stands.
- Every notice kind is a template, a typed shape and the use case that raises
  it — the same "all three or none" rule `MAIL_KINDS` follows.
- Notice copy is English, like the token messages; the override hook is the
  answer for another language, as before.
- A deployment with no mail provider binds neither dispatcher: review requests
  and alarms work exactly as before, and the inbox and the navigation counts
  still tell people.

## Alternatives considered

- **Widen `TransactionalMail` with optional fields.** Every notice would carry
  a fake token and expiry, and every token message would grow fields it never
  uses; `reveal-link` would have to guess which rows hold secrets.
- **Send notices from outbox subscribers.** Subscribers run inside the
  dispatcher's claim transaction, outside any unit of work, and the mail queue
  refuses writes there by design. Writing inline in the use case is simpler
  and keeps "rolled back, told nobody" true.
- **A message per alarm finding.** A rescan can open hundreds; a per-finding
  mail is the fastest way to teach people to filter the CMS out of their
  inbox.
- **An inbox before counts and mail.** It is the largest piece and the only
  one that adds a table people have to keep tidy; the counts and the mail
  reach people without it. All three ship together here, and each works
  without the others.
