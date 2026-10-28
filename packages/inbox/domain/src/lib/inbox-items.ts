/**
 * What the inbox holds, and the port a feature writes to it through.
 *
 * The inbox is a sink. It does not know what a review or an alarm is — the
 * plugin that owns the event decides who hears about it, says it in a typed
 * payload, and hands it over through {@link InboxWriter}. That is the mail
 * arrangement turned inward (ADR-0023): the producer owns the words, the inbox
 * owns storage and the read state, and neither package depends on the other's
 * framework. The admin renders the sentence from `kind` and `payload`, so the
 * words are translated where every other admin string is.
 */

/** Every kind of item, one per thing a person may want to hear about. */
export const INBOX_KINDS = {
    /** Somebody named you as a reviewer. */
    REVIEW_REQUESTED: 'review.requested',
    /** A record you asked a review for has every approval it needs. */
    REVIEW_READY: 'review.ready',
    /** A save moved past your approval, which no longer counts. */
    REVIEW_APPROVAL_STALE: 'review.approval_stale',
    /** An alarm you own flagged new records. */
    ALARM_FLAGGED: 'alarm.flagged'
} as const;

/** Which item a row is. */
export type InboxKind = (typeof INBOX_KINDS)[keyof typeof INBOX_KINDS];

/** The inbox's tabs. Every kind belongs to exactly one. */
export type InboxCategory = 'reviews' | 'alarms' | 'updates';

/** The tabs, in the order the page shows them. */
export const INBOX_CATEGORIES: readonly InboxCategory[] = [
    'reviews',
    'alarms',
    'updates'
];

/**
 * The tab an item is filed under. Work asked of you is `reviews`; something
 * flagged is `alarms`; news about your own request is `updates`.
 */
export function categoryOf(kind: InboxKind): InboxCategory {
    switch (kind) {
        case INBOX_KINDS.REVIEW_REQUESTED:
        case INBOX_KINDS.REVIEW_APPROVAL_STALE:
            return 'reviews';
        case INBOX_KINDS.ALARM_FLAGGED:
            return 'alarms';
        case INBOX_KINDS.REVIEW_READY:
            return 'updates';
    }
}

/** The record an entry-shaped item is about. */
export interface InboxEntryRef {
    contentType: string;
    contentTypeLabel: string;
    entryId: string;
    /** The record's display title, or `null` when it has none to show. */
    entryTitle: string | null;
}

/** What each kind carries, beside the row's own columns. */
export interface InboxPayloads {
    [INBOX_KINDS.REVIEW_REQUESTED]: InboxEntryRef & {
        /** Who asked, by name (or address). */
        requesterName: string;
        /** The rule's count; `0` when nobody protected the type. */
        required: number;
    };
    [INBOX_KINDS.REVIEW_READY]: InboxEntryRef & {
        required: number;
    };
    [INBOX_KINDS.REVIEW_APPROVAL_STALE]: InboxEntryRef & {
        /** The version the approval was on. */
        approvedRevisionNumber: number;
    };
    [INBOX_KINDS.ALARM_FLAGGED]: {
        ruleId: string;
        ruleName: string;
        severity: 'error' | 'warn' | 'info';
        contentType: string;
        contentTypeLabel: string;
        /** Records this scan newly flagged. */
        newCount: number;
    };
}

/** One item to hand somebody, before it is stored. */
export type InboxDelivery = {
    [K in InboxKind]: {
        kind: K;
        /** Whose inbox it lands in. */
        userId: string;
        /** The workspace it concerns; `null` for one that concerns none. */
        workspaceId: string | null;
        payload: InboxPayloads[K];
        /** App-relative path the item opens ("workspaces/ws/reviews"). */
        link: string;
        /**
         * The item's identity, so delivering it twice stores it once — an
         * outbox subscriber is at-least-once, and a retried write must not
         * become a second item. Unique per recipient.
         */
        dedupeKey: string;
    };
}[InboxKind];

/**
 * How a plugin puts an item in somebody's inbox.
 *
 * Writes **in the caller's open transaction when there is one**, so an item
 * about a request that rolled back is never stored; otherwise — an outbox
 * subscriber, a sweep — on its own, relying on `dedupeKey` for the retry.
 * Delivering a key already stored for that person is a silent no-op.
 */
export interface InboxWriter {
    deliver(items: readonly InboxDelivery[]): Promise<void>;
}

/** DI token a plugin injects the writer under, optionally. */
export const INBOX_WRITER = Symbol('INBOX_WRITER');
