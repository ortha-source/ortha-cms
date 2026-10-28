/**
 * The second kind of message the CMS sends: a **notice** — somebody's action
 * concerns you, here is where to look.
 *
 * It is deliberately not a {@link TransactionalMail}. A transactional message
 * carries a secret that exists only inside the issuing transaction, expires
 * with the token, and is what `reveal-link` hands back when delivery fails. A
 * notice carries no secret at all: its link is an ordinary admin URL behind
 * sign-in, so there is nothing to reveal and nothing that may not outlive a
 * failed send. Folding the two into one shape would force every notice to
 * invent a token and every token mail to grow optional fields (ADR-0023).
 *
 * A notice is still queued **in the caller's transaction**, for the same
 * reason the outbox is: a review request that rolled back must not tell
 * anybody they were asked.
 */

/** The notices the CMS sends. One per thing a person may want to hear about. */
export const NOTIFICATION_KINDS = {
    /** Somebody named you as a reviewer on a record. */
    REVIEW_REQUESTED: 'review_requested',
    /** What your alarms flagged since the last digest. */
    ALARM_DIGEST: 'alarm_digest'
} as const;

/** Which notice a queued row is. */
export type NotificationKind =
    (typeof NOTIFICATION_KINDS)[keyof typeof NOTIFICATION_KINDS];

/**
 * How long a queued notice may wait to be handed over. Past it the row is
 * swept unsent: telling somebody on Friday that a review was asked for on
 * Monday is noise, and the queue page already says so.
 */
export const NOTICE_TTL_MS = 3 * 24 * 60 * 60 * 1000;

/** What every notice needs to reach somebody. */
interface NoticeRecipient {
    /** Where it goes. */
    to: string;
    /** The member it is for — the audit trail, never `reveal-link`. */
    userId: string;
    /** Their display name, when they have one — the greeting uses it. */
    recipientName?: string | null;
}

/** "Grace asked you to review Pricing FAQ." */
export interface ReviewRequestedNotice extends NoticeRecipient {
    kind: typeof NOTIFICATION_KINDS.REVIEW_REQUESTED;
    /** Who asked — a name, or their address when they have none. */
    requesterName: string;
    /** The record's display title, or `null` when it has none to show. */
    entryTitle: string | null;
    /** The content type's label ("Pages"). */
    contentTypeLabel: string;
    /** The workspace's name ("Marketing site"). */
    workspaceName: string;
    /** How many approvals the type's rule wants; `0` when nobody protected it. */
    requiredApprovals: number;
    /** Who else was asked, by name, in pick order. */
    alsoAsked: readonly string[];
    /** App-relative path of the review, joined onto `appUrl` by the dispatcher. */
    reviewPath: string;
}

/** One alarm's line in a digest. */
export interface AlarmDigestLine {
    /** The alarm's name, as it is listed ("Author is not published"). */
    name: string;
    /** Only the two severities a digest carries; `info` never mails. */
    severity: 'error' | 'warn';
    /** The collection it watches ("Articles"). */
    contentTypeLabel: string;
    /** Findings opened since the previous digest. */
    newCount: number;
    /** Findings open now, new or not. */
    openCount: number;
}

/** One workspace's section of a digest. */
export interface AlarmDigestSection {
    workspaceName: string;
    /** App-relative path of the workspace's alarms page. */
    alarmsPath: string;
    lines: readonly AlarmDigestLine[];
}

/** "5 new alarm findings in 2 workspaces." */
export interface AlarmDigestNotice extends NoticeRecipient {
    kind: typeof NOTIFICATION_KINDS.ALARM_DIGEST;
    /** How often this recipient receives one — the copy says so. */
    period: 'daily' | 'weekly';
    sections: readonly AlarmDigestSection[];
    /** App-relative path of the recipient's notification settings. */
    settingsPath: string;
}

/** Every notice, discriminated by `kind`. */
export type Notice = ReviewRequestedNotice | AlarmDigestNotice;

/**
 * Queues notices. A separate port from `MAIL_DISPATCHER` so a plugin that only
 * ever tells people things never sees the token-bearing half, and so a
 * deployment without mail binds neither.
 */
export interface NotificationDispatcher {
    /**
     * Renders `notice` and writes it to the queue **in the caller's open
     * transaction** — refused outside one.
     */
    notify(notice: Notice): Promise<void>;
}

/** DI token a plugin injects the notice dispatcher under, optionally. */
export const NOTIFICATION_DISPATCHER = Symbol('NOTIFICATION_DISPATCHER');
