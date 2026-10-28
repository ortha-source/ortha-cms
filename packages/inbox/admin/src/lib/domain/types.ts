/**
 * The inbox as the admin reads it — the wire shapes of `/api/inbox`, restated
 * here rather than imported from the server package, the way every admin
 * plugin restates its API (`inbox-domain` is the server's contract, and the
 * admin does not import a Node package).
 */

/** The item kinds the server writes. An unknown one renders as a plain line. */
export type InboxKind =
    | 'review.requested'
    | 'review.ready'
    | 'review.approval_stale'
    | 'alarm.flagged';

/** The page's tabs, after "All". */
export type InboxCategory = 'reviews' | 'alarms' | 'updates';

export const INBOX_CATEGORIES: readonly InboxCategory[] = [
    'reviews',
    'alarms',
    'updates'
];

/** One item, mapped. */
export type InboxItem = {
    id: string;
    kind: InboxKind | string;
    category: InboxCategory;
    workspaceId: string | null;
    /** Shaped by `kind`; read through the typed accessors below. */
    payload: Record<string, unknown>;
    /** Absolute admin path the item opens (`/workspaces/…`). */
    to: string;
    createdAt: string;
    read: boolean;
};

export type InboxPage = {
    items: InboxItem[];
    nextCursor: string | null;
};

export type InboxSummary = {
    unread: number;
    byCategory: Record<InboxCategory, number>;
};

/** A payload string field, or `null` when absent or not a string. */
export function text(item: InboxItem, key: string): string | null {
    const value = item.payload[key];
    return typeof value === 'string' && value.trim() ? value : null;
}

/** A payload number field, or `0`. */
export function number(item: InboxItem, key: string): number {
    const value = item.payload[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Items split by whether they arrived today, in the reader's own zone. */
export function byDay(
    items: readonly InboxItem[],
    now: Date = new Date()
): { today: InboxItem[]; earlier: InboxItem[] } {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const today: InboxItem[] = [];
    const earlier: InboxItem[] = [];
    for (const item of items) {
        (new Date(item.createdAt) >= start ? today : earlier).push(item);
    }
    return { today, earlier };
}
