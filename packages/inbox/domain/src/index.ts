/**
 * `@orthacms/inbox-domain` — the framework-free contract of the in-app inbox:
 * the item kinds, their payloads, the tabs they file under, and the
 * `INBOX_WRITER` port a feature hands items through (ADR-0023).
 *
 * **No dependencies, of any kind**, asserted by `package-manifest.spec.ts`: a
 * feature that wants to tell somebody something imports this and nothing of
 * the inbox's server, so a host without the inbox changes nothing.
 */

export {
    INBOX_CATEGORIES,
    INBOX_KINDS,
    INBOX_WRITER,
    categoryOf,
    type InboxCategory,
    type InboxDelivery,
    type InboxEntryRef,
    type InboxKind,
    type InboxPayloads,
    type InboxWriter
} from './lib/inbox-items';
