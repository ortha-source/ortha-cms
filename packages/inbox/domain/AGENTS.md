# @orthacms/inbox-domain

The framework-free contract of the in-app inbox
([ADR-0023](../../../docs/adr/0023-notices-and-the-inbox.md)): the item kinds
(`INBOX_KINDS`), what each carries (`InboxPayloads`), the tab each files under
(`categoryOf`), and the `INBOX_WRITER` port a feature hands items through.

**No dependencies, of any kind** — asserted by `package-manifest.spec.ts`.
Protection and alarms import this package for the writer token they inject
`@Optional()`; a dependency here would be inherited by every producer, and the
inbox's server never should be.

## The decisions that live here

**The producer decides who hears about what, and says it in a typed payload.**
The inbox is a sink: it stores an `InboxDelivery` and owns the read state. The
admin renders the sentence from `kind` and `payload`, so the words are
translated where every other admin string is.

**`dedupeKey` is the item's identity per recipient.** A delivery from an
outbox subscriber is at-least-once; the key (unique with the user) is what
makes a retried write a no-op. Choose it so that "the same news" maps to the
same key — `review.requested:<request>:<head revision>`, for instance — and
new news to a new one.

## Adding a kind

An `INBOX_KINDS` entry, its payload in `InboxPayloads`, its tab in
`categoryOf` (the spec asserts every kind has one), the producer that writes
it, and the admin's sentence for it (`inbox-admin`'s `readItem`). An unknown
kind still renders in the admin, as a plain line, so an older admin never
drops an item a newer server wrote.
